import { PROVIDERS } from "@/lib/providers";
import {
  analysisResultSchema,
  type AnalysisResult,
  type AnalysisRound,
  type Classification,
  type ProviderResult,
  type RecordType,
} from "@/lib/types";

type TraditionalRelation = "match" | "mismatch" | "mixed" | "unavailable";

type RoundComparison = {
  eligible: boolean;
  consensus: string[];
  secureSuccess: ProviderResult[];
  secureDissent: boolean;
  traditionalRelation: TraditionalRelation;
};

function intersects(left: string[], right: string[]) {
  const values = new Set(left);
  return right.some((value) => values.has(value));
}

export function compareRound(round: AnalysisRound): RoundComparison {
  const secureSuccess = round.providerResults.filter(
    (item) => item.protocol !== "DNS" && item.status === "success",
  );
  const threshold = Math.floor(secureSuccess.length / 2) + 1;
  const support = new Map<string, number>();
  for (const provider of secureSuccess) {
    for (const address of new Set(provider.addresses)) {
      support.set(address, (support.get(address) ?? 0) + 1);
    }
  }
  const consensus = [...support]
    .filter(([, count]) => count >= threshold)
    .map(([address]) => address)
    .sort();
  const eligible = secureSuccess.length >= 2 && consensus.length > 0;
  const secureDissent =
    eligible && secureSuccess.some((provider) => !intersects(provider.addresses, consensus));
  const traditional = round.providerResults.filter(
    (item) => item.protocol === "DNS" && item.status === "success",
  );
  const matches = eligible
    ? traditional.filter((provider) => intersects(provider.addresses, consensus)).length
    : 0;

  let traditionalRelation: TraditionalRelation = "unavailable";
  if (eligible && traditional.length > 0) {
    traditionalRelation =
      traditional.length === 2 && matches === 2
        ? "match"
        : traditional.length === 2 && matches === 0
          ? "mismatch"
          : "mixed";
  }
  return { eligible, consensus, secureSuccess, secureDissent, traditionalRelation };
}

function classify(rounds: AnalysisRound[]): Classification {
  const comparisons = rounds.map(compareRound);
  const failed = rounds
    .flatMap((round) => round.providerResults)
    .filter((provider) => provider.status !== "success").length;
  const eligible = comparisons.filter((comparison) => comparison.eligible).length;
  const comparable = comparisons.filter(
    (comparison) => comparison.traditionalRelation !== "unavailable",
  ).length;

  if (failed >= 8 || eligible < 2 || comparable < 2) return "inconclusive";
  const noSecureDissent = comparisons.every((comparison) => !comparison.secureDissent);
  if (
    comparisons.every(
      (comparison) => comparison.eligible && comparison.traditionalRelation === "mismatch",
    ) &&
    noSecureDissent
  ) {
    return "possible_inconsistency";
  }
  if (
    comparisons.every(
      (comparison) => comparison.eligible && comparison.traditionalRelation === "match",
    ) &&
    noSecureDissent
  ) {
    return "consistent";
  }
  return "warning";
}

function confidence(rounds: AnalysisRound[], classification: Classification) {
  const comparisons = rounds.map(compareRound);
  const all = rounds.flatMap((round) => round.providerResults);
  const availability = all.filter((provider) => provider.status === "success").length / 15;
  let protocolCells = 0;
  for (const round of rounds) {
    for (const protocol of ["DNS", "DoH", "DoT"] as const) {
      if (round.providerResults.some((item) => item.protocol === protocol && item.status === "success")) {
        protocolCells += 1;
      }
    }
  }
  const consensusStrength =
    comparisons.reduce((total, comparison) => {
      if (!comparison.consensus.length || !comparison.secureSuccess.length) return total;
      const averageSupport =
        comparison.consensus.reduce(
          (sum, address) =>
            sum +
            comparison.secureSuccess.filter((provider) => provider.addresses.includes(address)).length /
              comparison.secureSuccess.length,
          0,
        ) / comparison.consensus.length;
      return total + averageSupport;
    }, 0) / 3;
  const relations = comparisons.map((comparison) => comparison.traditionalRelation);
  const mixed = relations.filter((relation) => relation === "mixed").length;
  const persistence =
    Math.max(
      relations.filter((relation) => relation === "match").length + mixed * 0.5,
      relations.filter((relation) => relation === "mismatch").length + mixed * 0.5,
    ) / 3;
  const raw = Math.round(
    30 * availability + 15 * (protocolCells / 9) + 25 * consensusStrength + 30 * persistence,
  );
  return classification === "inconclusive"
    ? Math.min(raw, 49)
    : classification === "warning"
      ? Math.min(raw, 79)
      : raw;
}

function reasonsFor(rounds: AnalysisRound[], classification: Classification) {
  const comparisons = rounds.map(compareRound);
  const eligible = comparisons.filter((comparison) => comparison.eligible).length;
  const failures = rounds
    .flatMap((round) => round.providerResults)
    .filter((provider) => provider.status !== "success");
  const reasons: string[] = [];

  if (classification === "consistent") {
    reasons.push("Los canales seguros alcanzaron consenso en las tres rondas.");
    reasons.push("Los dos resolvedores DNS tradicionales coincidieron con el consenso en cada ronda.");
  } else if (classification === "possible_inconsistency") {
    reasons.push("Los canales seguros alcanzaron consenso en las tres rondas.");
    reasons.push("Los dos resolvedores DNS tradicionales quedaron fuera del consenso durante las tres rondas.");
    reasons.push("La evidencia indica una posible inconsistencia; por sí sola no confirma un ataque.");
  } else if (classification === "warning") {
    if (comparisons.some((comparison) => comparison.secureDissent)) {
      reasons.push("Al menos un canal seguro difirió del consenso alcanzado por los demás.");
    }
    reasons.push("La coincidencia no fue completa o no se mantuvo de la misma forma en las tres rondas.");
  } else {
    reasons.push(`Solo ${eligible} de 3 rondas aportaron consenso suficiente para comparar.`);
    reasons.push("No existe evidencia suficiente para emitir una alerta fuerte.");
  }
  if (failures.length) {
    reasons.push(`${failures.length} de 15 consultas terminaron con error, timeout o transporte no disponible.`);
  }
  return reasons;
}

export function buildAnalysisResult(input: {
  id: string;
  domain: string;
  recordType: RecordType;
  createdAt: string;
  rounds: AnalysisRound[];
  durationMs: number;
  demoMode: boolean;
}): AnalysisResult {
  const classification = classify(input.rounds);
  const consensusAddresses = [
    ...new Set(input.rounds.flatMap((round) => compareRound(round).consensus)),
  ].sort();
  return analysisResultSchema.parse({
    ...input,
    vantagePoint: input.demoMode ? "simulated" : "server",
    classification,
    confidence: confidence(input.rounds, classification),
    reasons: reasonsFor(input.rounds, classification),
    consensusAddresses,
  });
}

const DEMO_ADDRESSES = {
  A: { secure: "203.0.113.10", alternate: "203.0.113.20", classic: "192.0.2.50" },
  AAAA: { secure: "2001:db8::10", alternate: "2001:db8::20", classic: "2001:db8:1::50" },
} as const;

export function createDemoResult(classification: Classification, recordType: RecordType) {
  const addresses = DEMO_ADDRESSES[recordType];
  const rounds: AnalysisRound[] = [1, 2, 3].map((round) => ({
    round,
    providerResults: PROVIDERS.map((provider, index): ProviderResult => {
      const queriedAt = new Date().toISOString();
      if (classification === "inconclusive" && index >= 2) {
        return {
          providerId: provider.id,
          providerName: provider.name,
          protocol: provider.protocol,
          status: index === 4 ? "unsupported" : "timeout",
          addresses: [],
          ttlByAddress: {},
          latencyMs: index === 4 ? null : 5_000,
          errorCode: index === 4 ? "UNSUPPORTED" : "TIMEOUT",
          errorMessage:
            index === 4
              ? "Transporte no disponible en esta demostración."
              : "Tiempo de espera agotado en esta demostración.",
          queriedAt,
        };
      }
      const isTraditional = provider.protocol === "DNS";
      const selected =
        classification === "possible_inconsistency" && isTraditional
          ? addresses.classic
          : classification === "warning" && (provider.id === "classic-google" || provider.id === "dot-quad9")
            ? addresses.alternate
            : addresses.secure;
      return {
        providerId: provider.id,
        providerName: provider.name,
        protocol: provider.protocol,
        status: "success",
        answerKind: "answers",
        addresses: [selected],
        ttlByAddress: { [selected]: 300 },
        latencyMs: 22 + index * 17 + round * 3,
        queriedAt,
      };
    }),
  }));

  const result = buildAnalysisResult({
    id: crypto.randomUUID(),
    domain: "demostracion.example",
    recordType,
    createdAt: new Date().toISOString(),
    rounds,
    durationMs: 840,
    demoMode: true,
  });
  if (result.classification !== classification) {
    throw new Error(`Fixture demo inválida: ${classification}`);
  }
  return result;
}

import { PROVIDERS } from "@/lib/providers";
import {
  analysisResultSchema,
  type AnalysisResult,
  type AnalysisRound,
  type Classification,
  type ConsensusOutcome,
  type ProviderResult,
  type RecordType,
} from "@/lib/types";

export type TraditionalRelation = "match" | "mismatch" | "mixed" | "unavailable";

export type RoundComparison = {
  eligible: boolean;
  consensus: string[];
  outcome: ConsensusOutcome | null;
  supportCount: number;
  secureSuccess: ProviderResult[];
  secureDissent: boolean;
  traditionalRelation: TraditionalRelation;
};

function intersects(left: string[], right: string[]) {
  const values = new Set(left);
  return right.some((value) => values.has(value));
}

export function providerMatchesOutcome(provider: ProviderResult, outcome: ConsensusOutcome | null) {
  if (!outcome || provider.status !== "success") return false;
  return outcome.kind === "answers"
    ? provider.answerKind === "answers" && intersects(provider.addresses, outcome.addresses)
    : provider.answerKind === outcome.kind;
}

export function compareRound(round: AnalysisRound): RoundComparison {
  const secureSuccess = round.providerResults.filter(
    (item) => item.protocol !== "DNS" && item.status === "success",
  );
  // ponytail: quórum fijo de 2/3 organizaciones; un fallo se abstiene, no reduce la mayoría.
  const threshold = 2;
  const support = new Map<string, number>();
  for (const provider of secureSuccess.filter((item) => item.answerKind === "answers")) {
    for (const address of new Set(provider.addresses)) {
      support.set(address, (support.get(address) ?? 0) + 1);
    }
  }
  const consensus = [...support]
    .filter(([, count]) => count >= threshold)
    .map(([address]) => address)
    .sort();
  const nodataSupport = secureSuccess.filter((item) => item.answerKind === "nodata").length;
  const nxdomainSupport = secureSuccess.filter((item) => item.answerKind === "nxdomain").length;
  const outcome: ConsensusOutcome | null = consensus.length
    ? { kind: "answers", addresses: consensus }
    : nodataSupport >= threshold
      ? { kind: "nodata" }
      : nxdomainSupport >= threshold
        ? { kind: "nxdomain" }
        : null;
  const supportCount = outcome?.kind === "answers"
    ? Math.max(...outcome.addresses.map((address) => support.get(address) ?? 0))
    : outcome?.kind === "nodata"
      ? nodataSupport
      : outcome?.kind === "nxdomain"
        ? nxdomainSupport
        : 0;
  const eligible = outcome !== null;
  const secureDissent = eligible && secureSuccess.some(
    (provider) => !providerMatchesOutcome(provider, outcome),
  );
  const traditional = round.providerResults.filter(
    (item) => item.protocol === "DNS" && item.status === "success",
  );
  const matches = eligible
    ? traditional.filter((provider) => providerMatchesOutcome(provider, outcome)).length
    : 0;

  let traditionalRelation: TraditionalRelation = "unavailable";
  if (eligible && traditional.length > 0) {
    traditionalRelation = traditional.length === 2 && matches === 2
      ? "match"
      : traditional.length === 2 && matches === 0
        ? "mismatch"
        : "mixed";
  }
  return {
    eligible,
    consensus,
    outcome,
    supportCount,
    secureSuccess,
    secureDissent,
    traditionalRelation,
  };
}

export function outcomeLabel(outcome: ConsensusOutcome | null) {
  if (!outcome) return "Sin consenso";
  if (outcome.kind === "nodata") return "NODATA";
  if (outcome.kind === "nxdomain") return "NXDOMAIN";
  return outcome.addresses.join(", ");
}

export function providerSignature(provider: ProviderResult) {
  if (provider.status !== "success") return provider.status;
  if (provider.answerKind !== "answers") return provider.answerKind ?? "error";
  return `answers:${[...provider.addresses].sort().join("|")}`;
}

export function persistenceFor(results: ProviderResult[]) {
  const counts = new Map<string, number>();
  for (const result of results) {
    const signature = providerSignature(result);
    counts.set(signature, (counts.get(signature) ?? 0) + 1);
  }
  return Math.max(0, ...counts.values());
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
    ) && noSecureDissent
  ) return "possible_inconsistency";
  if (
    comparisons.every(
      (comparison) => comparison.eligible && comparison.traditionalRelation === "match",
    ) && noSecureDissent
  ) return "consistent";
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
  const consensusStrength = comparisons.reduce(
    (total, comparison) => total + comparison.supportCount / 3,
    0,
  ) / 3;
  const relations = comparisons.map((comparison) => comparison.traditionalRelation);
  const mixed = relations.filter((relation) => relation === "mixed").length;
  const persistence = Math.max(
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
    const labels = comparisons.map((item) => outcomeLabel(item.outcome));
    const stable = labels.every((label) => label === labels[0]);
    reasons.push(stable
      ? `Los canales seguros mantuvieron el resultado ${labels[0]} durante las tres rondas.`
      : "Los canales seguros alcanzaron consenso suficiente en las tres rondas.");
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

export const DEMO_SCENARIOS = {
  consistent_answers: {
    label: "Respuestas A consistentes",
    expected: "Consistente",
    observe: "Las cinco rutas coinciden con el mismo conjunto de direcciones.",
  },
  nodata_isolated_error: {
    label: "NODATA con fallo aislado",
    expected: "Consistente",
    observe: "Cloudflare y Google sostienen el consenso aunque Quad9 falle en una ronda.",
  },
  persistent_mismatch: {
    label: "Diferencia persistente",
    expected: "Posible inconsistencia",
    observe: "Los dos DNS tradicionales quedan fuera del consenso cifrado en las tres rondas.",
  },
  intermittent_divergence: {
    label: "Divergencia intermitente",
    expected: "Advertencia",
    observe: "Una diferencia aislada no se presenta como una señal fuerte.",
  },
  transport_degradation: {
    label: "Transportes degradados",
    expected: "No concluyente",
    observe: "Los fallos de red no votan como respuestas DNS.",
  },
} as const;

export type DemoScenarioId = keyof typeof DEMO_SCENARIOS;

const LEGACY_DEMOS: Record<Classification, DemoScenarioId> = {
  consistent: "consistent_answers",
  warning: "intermittent_divergence",
  possible_inconsistency: "persistent_mismatch",
  inconclusive: "transport_degradation",
};

export function createDemoResult(requested: DemoScenarioId | Classification, recordType: RecordType) {
  const scenario = requested in DEMO_SCENARIOS
    ? requested as DemoScenarioId
    : LEGACY_DEMOS[requested as Classification];
  const addresses = DEMO_ADDRESSES[recordType];
  const rounds: AnalysisRound[] = [1, 2, 3].map((round) => ({
    round,
    providerResults: PROVIDERS.map((provider, index): ProviderResult => {
      const queriedAt = new Date().toISOString();
      if (scenario === "transport_degradation" && index >= 2) {
        return {
          providerId: provider.id,
          providerName: provider.name,
          protocol: provider.protocol,
          status: index === 4 ? "unsupported" : "timeout",
          addresses: [],
          ttlByAddress: {},
          latencyMs: index === 4 ? null : 5_000,
          errorCode: index === 4 ? "UNSUPPORTED" : "TIMEOUT",
          errorMessage: index === 4
            ? "Transporte no disponible en esta demostración."
            : "Tiempo de espera agotado en esta demostración.",
          queriedAt,
        };
      }
      if (scenario === "nodata_isolated_error") {
        if (provider.id === "dot-quad9" && round === 2) {
          return {
            providerId: provider.id,
            providerName: provider.name,
            protocol: provider.protocol,
            status: "error",
            addresses: [],
            ttlByAddress: {},
            latencyMs: 1_500,
            errorCode: "CONNECTION_CLOSED",
            errorMessage: "Fallo aislado del transporte en esta demostración.",
            queriedAt,
          };
        }
        return {
          providerId: provider.id,
          providerName: provider.name,
          protocol: provider.protocol,
          status: "success",
          answerKind: "nodata",
          addresses: [],
          ttlByAddress: {},
          latencyMs: 22 + index * 17 + round * 3,
          queriedAt,
        };
      }
      const isTraditional = provider.protocol === "DNS";
      const selected = scenario === "persistent_mismatch" && isTraditional
        ? addresses.classic
        : scenario === "intermittent_divergence" && round === 2 && provider.id === "classic-google"
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
  const expected: Classification = scenario === "consistent_answers" || scenario === "nodata_isolated_error"
    ? "consistent"
    : scenario === "persistent_mismatch"
      ? "possible_inconsistency"
      : scenario === "intermittent_divergence"
        ? "warning"
        : "inconclusive";
  const result = buildAnalysisResult({
    id: crypto.randomUUID(),
    domain: "demostracion.example",
    recordType,
    createdAt: new Date().toISOString(),
    rounds,
    durationMs: 840,
    demoMode: true,
  });
  if (result.classification !== expected) throw new Error(`Fixture demo inválida: ${scenario}`);
  return result;
}

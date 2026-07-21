import { analysisResultSchema, type AnalysisResult } from "@/lib/types";

export const HISTORY_KEY = "dnsspoofdetector.history.v1";

export function parseHistory(raw: string | null): AnalysisResult[] {
  if (!raw) return [];
  try {
    const value = JSON.parse(raw) as { schemaVersion?: unknown; analyses?: unknown };
    if (value.schemaVersion !== 1 || !Array.isArray(value.analyses)) return [];
    return value.analyses
      .map((item) => analysisResultSchema.safeParse(item))
      .filter((item) => item.success)
      .map((item) => item.data)
      .slice(0, 100);
  } catch {
    return [];
  }
}

export function loadHistory() {
  try {
    return parseHistory(localStorage.getItem(HISTORY_KEY));
  } catch {
    return [];
  }
}

export function writeHistory(analyses: AnalysisResult[]) {
  const validated = analyses
    .map((item) => analysisResultSchema.safeParse(item))
    .filter((item) => item.success)
    .map((item) => item.data)
    .slice(0, 100);
  localStorage.setItem(HISTORY_KEY, JSON.stringify({ schemaVersion: 1, analyses: validated }));
  return validated;
}

export function saveAnalysis(analysis: AnalysisResult) {
  const current = loadHistory().filter((item) => item.id !== analysis.id);
  return writeHistory([analysisResultSchema.parse(analysis), ...current]);
}

function csvCell(value: unknown) {
  let text = value == null ? "" : String(value);
  if (/^[\s]*[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return `"${text.replaceAll('"', '""')}"`;
}

export function analysesToCsv(analyses: AnalysisResult[]) {
  const headers = [
    "ID análisis",
    "Dominio",
    "Tipo",
    "Fecha",
    "Clasificación",
    "Confianza",
    "Demostración",
    "Ronda",
    "Proveedor",
    "Protocolo",
    "Estado",
    "Tipo de respuesta",
    "Direcciones",
    "TTL",
    "Latencia ms",
    "Código de error",
  ];
  const rows = analyses.flatMap((analysis) =>
    analysis.rounds.flatMap((round) =>
      round.providerResults.map((provider) => [
        analysis.id,
        analysis.domain,
        analysis.recordType,
        analysis.createdAt,
        analysis.classification,
        analysis.confidence,
        analysis.demoMode ? "Sí" : "No",
        round.round,
        provider.providerName,
        provider.protocol,
        provider.status,
        provider.answerKind ?? "",
        provider.addresses.join(" | "),
        Object.entries(provider.ttlByAddress)
          .map(([address, ttl]) => `${address}: ${ttl ?? "n/d"}`)
          .join(" | "),
        provider.latencyMs ?? "",
        provider.errorCode ?? "",
      ]),
    ),
  );
  return `\uFEFF${[headers, ...rows].map((row) => row.map(csvCell).join(",")).join("\r\n")}`;
}

export function analysesToJson(analyses: AnalysisResult[]) {
  return JSON.stringify(
    { schemaVersion: 1, exportedAt: new Date().toISOString(), analyses },
    null,
    2,
  );
}

export function downloadAnalyses(analyses: AnalysisResult[], format: "csv" | "json") {
  const content = format === "csv" ? analysesToCsv(analyses) : analysesToJson(analyses);
  const blob = new Blob([content], {
    type: format === "csv" ? "text/csv;charset=utf-8" : "application/json;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `dnsspoofdetector-${new Date().toISOString().slice(0, 10)}.${format}`;
  anchor.click();
  URL.revokeObjectURL(url);
}

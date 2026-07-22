"use server";

import { normalizeDomain, DomainValidationError } from "@/lib/domain";
import { runRound } from "@/lib/orchestrator";
import { traceDns } from "@/lib/trace";
import {
  analyzeRoundInputSchema,
  diagnosticResultSchema,
  traceInputSchema,
  type ActionResult,
  type AnalyzeRoundData,
  type DiagnosticResult,
  type TraceResult,
} from "@/lib/types";

export async function analyzeDomain(input: unknown): Promise<ActionResult<AnalyzeRoundData>> {
  const parsed = analyzeRoundInputSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      code: "VALIDATION",
      message: "Revisa los datos del análisis.",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }
  try {
    const domain = normalizeDomain(parsed.data.domain);
    const round = await runRound(domain, parsed.data.recordType, parsed.data.round);
    return { ok: true, data: { domain, recordType: parsed.data.recordType, round } };
  } catch (error) {
    if (error instanceof DomainValidationError) {
      return {
        ok: false,
        code: "VALIDATION",
        message: error.message,
        fieldErrors: { domain: [error.message] },
      };
    }
    return {
      ok: false,
      code: "ANALYSIS_FAILED",
      message: "No fue posible completar esta ronda. Inténtalo nuevamente.",
    };
  }
}

export async function diagnoseProtocols(): Promise<ActionResult<DiagnosticResult>> {
  try {
    const round = await runRound("example.com", "A", 1);
    const data = diagnosticResultSchema.parse({
      checkedAt: new Date().toISOString(),
      region: process.env.VERCEL_REGION ?? null,
      nodeVersion: process.version,
      probes: round.providerResults,
    });
    return { ok: true, data };
  } catch {
    return {
      ok: false,
      code: "ANALYSIS_FAILED",
      message: "No fue posible ejecutar el diagnóstico del entorno.",
    };
  }
}

export async function traceDomain(input: unknown): Promise<ActionResult<TraceResult>> {
  const parsed = traceInputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, code: "VALIDATION", message: "Revisa el dominio y el tipo de registro." };
  try {
    const domain = normalizeDomain(parsed.data.domain);
    return { ok: true, data: await traceDns(domain, parsed.data.recordType) };
  } catch (error) {
    if (error instanceof DomainValidationError) {
      return { ok: false, code: "VALIDATION", message: error.message, fieldErrors: { domain: [error.message] } };
    }
    return { ok: false, code: "ANALYSIS_FAILED", message: "Rastreo no disponible en este entorno." };
  }
}

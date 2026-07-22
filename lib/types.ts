import { z } from "zod";

export const recordTypeSchema = z.enum(["A", "AAAA"]);
export const protocolSchema = z.enum(["DNS", "DoH", "DoT"]);
export const providerStatusSchema = z.enum([
  "success",
  "timeout",
  "error",
  "unsupported",
]);
export const answerKindSchema = z.enum(["answers", "nxdomain", "nodata"]);
export const consensusOutcomeSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("answers"), addresses: z.array(z.string()).min(1) }),
  z.object({ kind: z.literal("nodata") }),
  z.object({ kind: z.literal("nxdomain") }),
]);
export const classificationSchema = z.enum([
  "consistent",
  "warning",
  "possible_inconsistency",
  "inconclusive",
]);
export const providerIdSchema = z.enum([
  "classic-cloudflare",
  "classic-google",
  "doh-cloudflare",
  "doh-google",
  "dot-quad9",
  "dot-cloudflare", // ponytail: compatibilidad de lectura con historiales v1; ya no se consulta.
]);

export const providerResultSchema = z
  .object({
    providerId: providerIdSchema,
    providerName: z.string().min(1),
    protocol: protocolSchema,
    status: providerStatusSchema,
    answerKind: answerKindSchema.optional(),
    addresses: z.array(z.string()),
    ttlByAddress: z.record(z.string(), z.number().int().nonnegative().nullable()),
    latencyMs: z.number().int().nonnegative().nullable(),
    errorCode: z.string().max(64).optional(),
    errorMessage: z.string().max(240).optional(),
    queriedAt: z.string().datetime(),
  })
  .superRefine((value, ctx) => {
    if (value.status === "success" && !value.answerKind) {
      ctx.addIssue({ code: "custom", message: "Una respuesta válida requiere answerKind" });
    }
    if (value.answerKind === "answers" && value.addresses.length === 0) {
      ctx.addIssue({ code: "custom", message: "answers requiere direcciones" });
    }
    if (
      (value.answerKind === "nxdomain" || value.answerKind === "nodata") &&
      value.addresses.length > 0
    ) {
      ctx.addIssue({ code: "custom", message: "Una respuesta negativa no contiene direcciones" });
    }
  });

export const analysisRoundSchema = z.object({
  round: z.number().int().min(1).max(3),
  providerResults: z.array(providerResultSchema).length(5),
});

export const analysisResultSchema = z.object({
  id: z.string().uuid(),
  domain: z.string().min(1).max(253),
  recordType: recordTypeSchema,
  createdAt: z.string().datetime(),
  vantagePoint: z.enum(["server", "simulated"]),
  rounds: z.array(analysisRoundSchema).length(3),
  classification: classificationSchema,
  confidence: z.number().int().min(0).max(100),
  reasons: z.array(z.string().min(1)).min(1),
  consensusAddresses: z.array(z.string()),
  durationMs: z.number().int().nonnegative(),
  demoMode: z.boolean(),
});

export const analyzeRoundInputSchema = z.object({
  domain: z.string().min(1).max(1024),
  recordType: recordTypeSchema,
  round: z.number().int().min(1).max(3),
});

export const traceInputSchema = z.object({
  domain: z.string().min(1).max(1024),
  recordType: recordTypeSchema,
});

export const traceStepSchema = z.object({
  stage: z.string().min(1),
  zone: z.string().min(1),
  serverName: z.string().nullable(),
  serverIp: z.string(),
  transport: z.enum(["UDP", "TCP"]),
  rcode: z.string(),
  authoritative: z.boolean(),
  latencyMs: z.number().int().nonnegative(),
  status: z.enum(["referral", "answers", "nodata", "nxdomain", "cname", "error"]),
  nameservers: z.array(z.string()),
  glue: z.array(z.string()),
  addresses: z.array(z.string()),
  cnames: z.array(z.string()),
  bootstrap: z.boolean(),
  errorMessage: z.string().optional(),
});

export const traceResultSchema = z.object({
  domain: z.string(),
  recordType: recordTypeSchema,
  createdAt: z.string().datetime(),
  steps: z.array(traceStepSchema).max(6),
  finalStatus: z.enum(["answers", "nodata", "nxdomain", "cname", "unavailable"]),
  finalMessage: z.string(),
});

export const diagnosticResultSchema = z.object({
  checkedAt: z.string().datetime(),
  region: z.string().nullable(),
  nodeVersion: z.string(),
  probes: z.array(providerResultSchema).length(5),
});

export const historyEnvelopeSchema = z.object({
  schemaVersion: z.literal(1),
  analyses: z.array(analysisResultSchema),
});

export type RecordType = z.infer<typeof recordTypeSchema>;
export type Protocol = z.infer<typeof protocolSchema>;
export type ProviderStatus = z.infer<typeof providerStatusSchema>;
export type AnswerKind = z.infer<typeof answerKindSchema>;
export type ConsensusOutcome = z.infer<typeof consensusOutcomeSchema>;
export type Classification = z.infer<typeof classificationSchema>;
export type ProviderId = z.infer<typeof providerIdSchema>;
export type ProviderResult = z.infer<typeof providerResultSchema>;
export type AnalysisRound = z.infer<typeof analysisRoundSchema>;
export type AnalysisResult = z.infer<typeof analysisResultSchema>;
export type DiagnosticResult = z.infer<typeof diagnosticResultSchema>;
export type TraceStep = z.infer<typeof traceStepSchema>;
export type TraceResult = z.infer<typeof traceResultSchema>;

export type AnalyzeRoundData = {
  domain: string;
  recordType: RecordType;
  round: AnalysisRound;
};

export type ActionResult<T> =
  | { ok: true; data: T }
  | {
      ok: false;
      code: "VALIDATION" | "ANALYSIS_FAILED";
      message: string;
      fieldErrors?: Record<string, string[]>;
    };

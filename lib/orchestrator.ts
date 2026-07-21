import { queryProvider } from "@/lib/dns";
import { PROVIDERS, type Provider } from "@/lib/providers";
import {
  analysisRoundSchema,
  type AnalysisRound,
  type ProviderResult,
  type RecordType,
} from "@/lib/types";

export async function runRound(
  domain: string,
  recordType: RecordType,
  round: number,
  query: (provider: Provider, domain: string, recordType: RecordType) => Promise<ProviderResult> = queryProvider,
): Promise<AnalysisRound> {
  const settled = await Promise.allSettled(
    PROVIDERS.map((provider) => query(provider, domain, recordType)),
  );
  const providerResults = settled.map((item, index): ProviderResult => {
    if (item.status === "fulfilled") return item.value;
    const provider = PROVIDERS[index];
    return {
      providerId: provider.id,
      providerName: provider.name,
      protocol: provider.protocol,
      status: "error",
      addresses: [],
      ttlByAddress: {},
      latencyMs: null,
      errorCode: "INTERNAL_ERROR",
      errorMessage: "La consulta no pudo completarse de forma segura.",
      queriedAt: new Date().toISOString(),
    };
  });
  return analysisRoundSchema.parse({ round, providerResults });
}

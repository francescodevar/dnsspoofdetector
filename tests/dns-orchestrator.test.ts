import { describe, expect, it } from "vitest";
import { decodeDotFrame } from "@/lib/dns";
import { runRound } from "@/lib/orchestrator";
import type { Provider } from "@/lib/providers";
import type { ProviderResult } from "@/lib/types";

const DOT_A_RESPONSE = Buffer.from(
  "0038123481800001000100000000076578616d706c6503636f6d0000010001076578616d706c6503636f6d00000100010000012c0004c0000201",
  "hex",
);

describe("DoT", () => {
  it("decodifica un frame DNS sobre TLS con prefijo de longitud", () => {
    const packet = decodeDotFrame(DOT_A_RESPONSE, 0x1234, "example.com", "A");
    expect(packet.answers?.[0]).toMatchObject({ type: "A", data: "192.0.2.1", ttl: 300 });
  });

  it("rechaza identificadores que no corresponden a la consulta", () => {
    expect(() => decodeDotFrame(DOT_A_RESPONSE, 99, "example.com", "A")).toThrow("DOT_RESPONSE_MISMATCH");
  });
});

describe("orquestador", () => {
  it("entrega cinco resultados aunque un adaptador lance una excepción", async () => {
    let calls = 0;
    const query = async (provider: Provider): Promise<ProviderResult> => {
      calls += 1;
      if (provider.id === "dot-quad9") throw new Error("socket cerrado");
      return {
        providerId: provider.id,
        providerName: provider.name,
        protocol: provider.protocol,
        status: "success",
        answerKind: "answers",
        addresses: ["192.0.2.1"],
        ttlByAddress: { "192.0.2.1": 300 },
        latencyMs: 10,
        queriedAt: new Date().toISOString(),
      };
    };
    const round = await runRound("example.com", "A", 1, query);
    expect(calls).toBe(5);
    expect(round.providerResults).toHaveLength(5);
    expect(round.providerResults.find((item) => item.providerId === "dot-quad9")?.status).toBe("error");
  });
});

import { describe, expect, it } from "vitest";
import { buildAnalysisResult, compareRound, createDemoResult } from "@/lib/analysis";
import { DomainValidationError, normalizeAddresses, normalizeDomain } from "@/lib/domain";
import type { Classification, RecordType } from "@/lib/types";

describe("validación y normalización", () => {
  it("normaliza dominios internacionales y una raíz final", () => {
    expect(normalizeDomain("Mañana.com.")).toBe("xn--maana-pta.com");
  });

  it.each(["localhost", "127.0.0.1", "https://example.com", "example.com:53", "example com", "single"])(
    "rechaza %s",
    (domain) => expect(() => normalizeDomain(domain)).toThrow(DomainValidationError),
  );

  it("canonicaliza IPv6, filtra familias y elimina duplicados", () => {
    expect(
      normalizeAddresses(
        [
          { address: "2001:0DB8:0:0:0:0:0:1", ttl: 600 },
          { address: "2001:db8::1", ttl: 300 },
          { address: "192.0.2.1", ttl: 50 },
        ],
        "AAAA",
      ),
    ).toEqual({ addresses: ["2001:db8::1"], ttlByAddress: { "2001:db8::1": 300 } });
  });
});

describe("clasificación determinista", () => {
  it.each([
    "consistent",
    "warning",
    "possible_inconsistency",
    "inconclusive",
  ] as Classification[])("produce el escenario %s", (classification) => {
    const result = createDemoResult(classification, "A");
    expect(result.classification).toBe(classification);
    expect(result.rounds).toHaveLength(3);
    expect(result.rounds.every((round) => round.providerResults.length === 5)).toBe(true);
  });

  it("calcula consenso sin depender del orden", () => {
    const result = createDemoResult("consistent", "AAAA");
    const shuffled = {
      ...result.rounds[0],
      providerResults: [...result.rounds[0].providerResults].reverse(),
    };
    expect(compareRound(shuffled).consensus).toEqual(["2001:db8::10"]);
  });

  it("exige persistencia en las tres rondas para una inconsistencia fuerte", () => {
    const possible = createDemoResult("possible_inconsistency", "A");
    const consistent = createDemoResult("consistent", "A");
    const mixed = buildAnalysisResult({
      id: crypto.randomUUID(),
      domain: "demo.example",
      recordType: "A" as RecordType,
      createdAt: new Date().toISOString(),
      rounds: [possible.rounds[0], possible.rounds[1], consistent.rounds[2]],
      durationMs: 100,
      demoMode: true,
    });
    expect(mixed.classification).toBe("warning");
    expect(mixed.confidence).toBeLessThanOrEqual(79);
  });
});

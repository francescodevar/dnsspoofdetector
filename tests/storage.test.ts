import { describe, expect, it } from "vitest";
import { createDemoResult } from "@/lib/analysis";
import { analysesToCsv, analysesToJson, parseHistory } from "@/lib/storage";

describe("historial y exportación", () => {
  it("ignora registros dañados y conserva los válidos", () => {
    const valid = createDemoResult("consistent", "A");
    const raw = JSON.stringify({ schemaVersion: 1, analyses: [{ broken: true }, valid] });
    expect(parseHistory(raw)).toEqual([valid]);
    expect(parseHistory("{no-json")).toEqual([]);
  });

  it("conserva mediciones históricas hechas con Cloudflare DoT", () => {
    const legacy = structuredClone(createDemoResult("consistent", "A"));
    for (const round of legacy.rounds) {
      const dot = round.providerResults.find((provider) => provider.providerId === "dot-quad9");
      if (!dot) throw new Error("Fixture sin proveedor DoT");
      dot.providerId = "dot-cloudflare";
      dot.providerName = "Cloudflare DoT";
    }
    const [parsed] = parseHistory(JSON.stringify({ schemaVersion: 1, analyses: [legacy] }));
    expect(parsed.rounds[0].providerResults.at(-1)?.providerName).toBe("Cloudflare DoT");
  });

  it("protege celdas que una hoja de cálculo podría ejecutar", () => {
    const unsafe = { ...createDemoResult("consistent", "A"), domain: "=1+1" };
    const csv = analysesToCsv([unsafe]);
    expect(csv).toContain("\"'=1+1\"");
    expect(csv.startsWith("\uFEFF")).toBe(true);
  });

  it("exporta JSON versionado", () => {
    const parsed = JSON.parse(analysesToJson([createDemoResult("warning", "AAAA")])) as {
      schemaVersion: number;
      analyses: unknown[];
    };
    expect(parsed.schemaVersion).toBe(1);
    expect(parsed.analyses).toHaveLength(1);
  });
});

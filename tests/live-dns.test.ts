import { describe, expect, it } from "vitest";
import { queryProvider } from "@/lib/dns";
import { PROVIDERS } from "@/lib/providers";

describe.skipIf(process.env.RUN_LIVE_DNS_TESTS !== "1")("consultas reales", () => {
  it("obtiene A mediante DNS y DoH y controla DoT honestamente", async () => {
    const results = await Promise.all(PROVIDERS.map((provider) => queryProvider(provider, "example.com", "A")));
    expect(results.filter((item) => item.protocol === "DNS").every((item) => item.status === "success")).toBe(true);
    expect(results.filter((item) => item.protocol === "DoH").every((item) => item.status === "success")).toBe(true);
    expect(results.find((item) => item.protocol === "DoT")).toBeDefined();
  }, 20_000);
});

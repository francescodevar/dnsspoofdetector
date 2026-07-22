import { describe, expect, it } from "vitest";
import * as dnsPacket from "dns-packet";
import { inspectTracePacket, isPublicIPv4, shouldRetryTcp, type TracePacket } from "@/lib/trace";

describe("seguridad del rastreo iterativo", () => {
  it("solo permite destinos IPv4 públicos", () => {
    expect(isPublicIPv4("198.41.0.4")).toBe(true);
    expect(isPublicIPv4("8.8.8.8")).toBe(true);
    for (const address of ["127.0.0.1", "10.0.0.1", "172.16.0.1", "192.168.1.1", "169.254.1.1", "100.64.0.1", "192.0.2.1", "198.51.100.1", "203.0.113.1", "224.0.0.1", "::1"]) {
      expect(isPublicIPv4(address), address).toBe(false);
    }
  });

  it("extrae referencias NS y glue público", () => {
    const packet = dnsPacket.decode(dnsPacket.encode({
      type: "response",
      id: 1,
      questions: [{ name: "example.com", type: "A" }],
      authorities: [{ name: "com", type: "NS", ttl: 300, data: "a.gtld.example" }],
      additionals: [
        { name: "a.gtld.example", type: "A", ttl: 300, data: "192.5.6.7" },
        { name: "evil.example", type: "A", ttl: 300, data: "127.0.0.1" },
      ],
    })) as TracePacket;
    expect(inspectTracePacket(packet, "A")).toMatchObject({
      status: "referral",
      nameservers: ["a.gtld.example"],
      glue: ["192.5.6.7"],
    });
  });

  it("detecta truncamiento para repetir por TCP", () => {
    const packet = dnsPacket.decode(dnsPacket.encode({ type: "response", id: 1, flags: dnsPacket.TRUNCATED_RESPONSE })) as TracePacket;
    expect(shouldRetryTcp(packet)).toBe(true);
  });
});

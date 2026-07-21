import type { ProviderId, Protocol } from "@/lib/types";

export type Provider = {
  id: ProviderId;
  name: string;
  protocol: Protocol;
  timeoutMs: number;
  enabled: true;
  server?: string;
  endpoint?: string;
  host?: string;
  port?: number;
  servername?: string;
};

export const PROVIDERS: readonly Provider[] = [
  {
    id: "classic-cloudflare",
    name: "Cloudflare DNS",
    protocol: "DNS",
    server: "1.1.1.1",
    timeoutMs: 5_000,
    enabled: true,
  },
  {
    id: "classic-google",
    name: "Google Public DNS",
    protocol: "DNS",
    server: "8.8.8.8",
    timeoutMs: 5_000,
    enabled: true,
  },
  {
    id: "doh-cloudflare",
    name: "Cloudflare DoH",
    protocol: "DoH",
    endpoint: "https://cloudflare-dns.com/dns-query",
    timeoutMs: 5_000,
    enabled: true,
  },
  {
    id: "doh-google",
    name: "Google DoH",
    protocol: "DoH",
    endpoint: "https://dns.google/resolve",
    timeoutMs: 5_000,
    enabled: true,
  },
  {
    id: "dot-quad9",
    name: "Quad9 DoT sin bloqueo",
    protocol: "DoT",
    host: "9.9.9.10",
    port: 853,
    servername: "dns10.quad9.net",
    timeoutMs: 5_000,
    enabled: true,
  },
] as const;

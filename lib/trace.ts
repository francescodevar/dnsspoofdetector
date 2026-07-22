import { randomInt } from "node:crypto";
import { Resolver } from "node:dns/promises";
import dgram from "node:dgram";
import { isIPv4 } from "node:net";
import net from "node:net";
import * as dnsPacket from "dns-packet";
import { normalizeAddresses } from "@/lib/domain";
import { ROOT_HINTS } from "@/lib/root-hints";
import { traceResultSchema, type RecordType, type TraceResult, type TraceStep } from "@/lib/types";

export type TracePacket = dnsPacket.DecodedPacket & { rcode: string };
type Candidate = { name: string | null; ip: string };
type WireResult = { packet: TracePacket; transport: "UDP" | "TCP"; latencyMs: number };

export function isPublicIPv4(address: string) {
  if (!isIPv4(address)) return false;
  const [a, b, c] = address.split(".").map(Number);
  return !(
    a === 0 || a === 10 || a === 127 || a >= 224 ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 192 && b === 0 && (c === 0 || c === 2)) ||
    (a === 192 && b === 88 && c === 99) ||
    (a === 198 && (b === 18 || b === 19 || (b === 51 && c === 100))) ||
    (a === 203 && b === 0 && c === 113)
  );
}

function questionMatches(packet: TracePacket, id: number, domain: string, recordType: RecordType) {
  const question = packet.questions?.[0];
  return packet.type === "response" && packet.id === id && packet.questions?.length === 1 &&
    question?.name.toLowerCase().replace(/\.$/, "") === domain && question.type === recordType;
}

function queryPacket(id: number, domain: string, recordType: RecordType) {
  return dnsPacket.encode({
    type: "query",
    id,
    flags: 0,
    questions: [{ name: domain, type: recordType, class: "IN" }],
  });
}

function queryUdp(server: string, domain: string, recordType: RecordType, timeoutMs: number): Promise<WireResult> {
  return new Promise((resolve, reject) => {
    const id = randomInt(0, 65_536);
    const query = queryPacket(id, domain, recordType);
    const socket = dgram.createSocket("udp4");
    const started = performance.now();
    let settled = false;
    const finish = (error?: Error, packet?: TracePacket) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      socket.close();
      if (error) reject(error);
      else resolve({ packet: packet!, transport: "UDP", latencyMs: Math.round(performance.now() - started) });
    };
    const timer = setTimeout(() => finish(new Error("TIMEOUT")), timeoutMs);
    socket.once("error", (error) => finish(error));
    socket.on("message", (message, remote) => {
      if (remote.address !== server || remote.port !== 53 || message.length > 65_535) return;
      try {
        const packet = dnsPacket.decode(message) as TracePacket;
        if (!questionMatches(packet, id, domain, recordType)) return;
        finish(undefined, packet);
      } catch {
        finish(new Error("MALFORMED_RESPONSE"));
      }
    });
    socket.send(query, 53, server, (error) => { if (error) finish(error); });
  });
}

function queryTcp(server: string, domain: string, recordType: RecordType, timeoutMs: number): Promise<WireResult> {
  return new Promise((resolve, reject) => {
    const id = randomInt(0, 65_536);
    const query = queryPacket(id, domain, recordType);
    const frame = Buffer.alloc(query.length + 2);
    frame.writeUInt16BE(query.length, 0);
    query.copy(frame, 2);
    const socket = net.createConnection({ host: server, port: 53 });
    const started = performance.now();
    let received = Buffer.alloc(0);
    let settled = false;
    const finish = (error?: Error, packet?: TracePacket) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      socket.destroy();
      if (error) reject(error);
      else resolve({ packet: packet!, transport: "TCP", latencyMs: Math.round(performance.now() - started) });
    };
    const timer = setTimeout(() => finish(new Error("TIMEOUT")), timeoutMs);
    socket.once("connect", () => socket.write(frame));
    socket.once("error", (error) => finish(error));
    socket.on("data", (chunk) => {
      received = Buffer.concat([received, chunk]);
      if (received.length < 2) return;
      const length = received.readUInt16BE(0);
      if (!length || length > 65_535) return finish(new Error("MALFORMED_RESPONSE"));
      if (received.length < length + 2) return;
      try {
        const packet = dnsPacket.decode(received.subarray(2, length + 2)) as TracePacket;
        if (!questionMatches(packet, id, domain, recordType)) return finish(new Error("RESPONSE_MISMATCH"));
        finish(undefined, packet);
      } catch {
        finish(new Error("MALFORMED_RESPONSE"));
      }
    });
  });
}

async function queryServer(server: string, domain: string, recordType: RecordType, timeoutMs: number) {
  if (!isPublicIPv4(server)) throw new Error("NON_PUBLIC_SERVER");
  const udp = await queryUdp(server, domain, recordType, timeoutMs);
  return shouldRetryTcp(udp.packet) ? queryTcp(server, domain, recordType, timeoutMs) : udp;
}

function strings(packet: TracePacket, section: "answers" | "authorities" | "additionals", type: string) {
  return (packet[section] ?? []).flatMap((answer) =>
    answer.type === type && "data" in answer && typeof answer.data === "string" ? [answer.data] : [],
  );
}

export function shouldRetryTcp(packet: TracePacket) {
  return packet.flag_tc;
}

export function inspectTracePacket(packet: TracePacket, recordType: RecordType) {
  const addresses = normalizeAddresses(strings(packet, "answers", recordType).map((address) => ({ address, ttl: null })), recordType).addresses;
  const cnames = strings(packet, "answers", "CNAME");
  const nameservers = strings(packet, "authorities", "NS").map((name) => name.toLowerCase().replace(/\.$/, ""));
  const glue = strings(packet, "additionals", "A").filter(isPublicIPv4);
  let status: TraceStep["status"] = "error";
  if (packet.flag_aa && packet.rcode === "NXDOMAIN") status = "nxdomain";
  else if (packet.flag_aa && addresses.length) status = "answers";
  else if (packet.flag_aa && cnames.length) status = "cname";
  else if (packet.flag_aa && packet.rcode === "NOERROR") status = "nodata";
  else if (nameservers.length) status = "referral";
  return { addresses, cnames, nameservers, glue, status };
}

async function bootstrapNameservers(nameservers: string[], timeoutMs: number) {
  const resolver = new Resolver();
  resolver.setServers(["1.1.1.1"]);
  const timer = setTimeout(() => resolver.cancel(), timeoutMs);
  try {
    const settled = await Promise.allSettled(nameservers.slice(0, 2).map((name) => resolver.resolve4(name)));
    return settled.flatMap((item) => item.status === "fulfilled" ? item.value : []).filter(isPublicIPv4);
  } finally {
    clearTimeout(timer);
  }
}

function stageName(hop: number) {
  return hop === 0 ? "Raíz" : hop === 1 ? "TLD" : hop === 2 ? "Autoritativo" : `Delegación ${hop}`;
}

export async function traceDns(domain: string, recordType: RecordType): Promise<TraceResult> {
  const started = performance.now();
  let candidates: Candidate[] = ROOT_HINTS.map((hint) => ({ name: hint.name, ip: hint.ip }));
  let zone = ".";
  const steps: TraceStep[] = [];

  for (let hop = 0; hop < 6 && performance.now() - started < 12_000; hop += 1) {
    let wire: WireResult | null = null;
    let selected: Candidate | null = null;
    let lastError = "Sin respuesta";
    const remaining = Math.max(250, 12_000 - Math.round(performance.now() - started));
    for (const candidate of candidates.slice(0, 2)) {
      try {
        wire = await queryServer(candidate.ip, domain, recordType, Math.min(1_500, remaining));
        selected = candidate;
        break;
      } catch (error) {
        lastError = error instanceof Error ? error.message : "NETWORK_ERROR";
      }
    }
    if (!wire || !selected) {
      steps.push({ stage: stageName(hop), zone, serverName: candidates[0]?.name ?? null, serverIp: candidates[0]?.ip ?? "—", transport: "UDP", rcode: "—", authoritative: false, latencyMs: Math.round(performance.now() - started), status: "error", nameservers: [], glue: [], addresses: [], cnames: [], bootstrap: false, errorMessage: lastError });
      break;
    }

    const packet = wire.packet;
    const inspected = inspectTracePacket(packet, recordType);
    const { addresses, cnames, nameservers } = inspected;
    let { glue } = inspected;
    let bootstrap = false;
    const { status } = inspected;

    if (status === "referral" && !glue.length) {
      bootstrap = true;
      glue = await bootstrapNameservers(nameservers, Math.min(1_500, remaining));
    }
    const nextZone = packet.authorities?.find((answer) => answer.type === "NS")?.name ?? zone;
    steps.push({
      stage: stageName(hop),
      zone,
      serverName: selected.name,
      serverIp: selected.ip,
      transport: wire.transport,
      rcode: packet.rcode || "NOERROR",
      authoritative: packet.flag_aa,
      latencyMs: wire.latencyMs,
      status,
      nameservers,
      glue,
      addresses,
      cnames,
      bootstrap,
      ...(status === "error" ? { errorMessage: addresses.length || cnames.length
        ? "Se recibió una respuesta recursiva inesperada en lugar de una referencia; la red puede estar interceptando el puerto 53."
        : "La respuesta no fue autoritativa ni incluyó una referencia utilizable." } : {}),
    });

    if (status !== "referral") {
      const messages = {
        answers: `El servidor autoritativo publicó ${addresses.join(", ")}.`,
        nodata: `El dominio existe, pero no publica un registro ${recordType}.`,
        nxdomain: "El servidor indicó que el nombre no existe.",
        cname: `La respuesta contiene un alias hacia ${cnames.join(", ")}; la cadena no se sigue en este modo experimental.`,
        error: "El rastreo se detuvo por una respuesta no utilizable.",
      } as const;
      return traceResultSchema.parse({ domain, recordType, createdAt: new Date().toISOString(), steps, finalStatus: status === "error" ? "unavailable" : status, finalMessage: messages[status] });
    }
    if (!glue.length) break;
    zone = nextZone;
    candidates = glue.map((ip, index) => ({ name: nameservers[index] ?? null, ip }));
  }

  return traceResultSchema.parse({
    domain,
    recordType,
    createdAt: new Date().toISOString(),
    steps,
    finalStatus: "unavailable",
    finalMessage: "Rastreo no disponible en este entorno o sin referencia pública utilizable.",
  });
}

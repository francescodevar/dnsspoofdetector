import { Resolver } from "node:dns/promises";
import { randomInt } from "node:crypto";
import tls from "node:tls";
import * as dnsPacket from "dns-packet";
import { z } from "zod";
import { normalizeAddresses, type RawAddress } from "@/lib/domain";
import type { Provider } from "@/lib/providers";
import { providerResultSchema, type ProviderResult, type RecordType } from "@/lib/types";

const MAX_DOH_BYTES = 65_536;
const RCODE_NAMES: Record<number, string> = {
  0: "NOERROR",
  1: "FORMERR",
  2: "SERVFAIL",
  3: "NXDOMAIN",
  4: "NOTIMP",
  5: "REFUSED",
};

const dohSchema = z.object({
  Status: z.number().int().min(0),
  Answer: z
    .array(
      z.object({
        type: z.number().int(),
        TTL: z.number().int().nonnegative().optional(),
        data: z.string(),
      }),
    )
    .optional(),
});

function latency(startedAt: number) {
  return Math.max(0, Math.round(performance.now() - startedAt));
}

function result(
  provider: Provider,
  queriedAt: string,
  startedAt: number,
  value: Omit<ProviderResult, "providerId" | "providerName" | "protocol" | "queriedAt" | "latencyMs"> & {
    latencyMs?: number | null;
  },
): ProviderResult {
  return providerResultSchema.parse({
    providerId: provider.id,
    providerName: provider.name,
    protocol: provider.protocol,
    queriedAt,
    latencyMs: value.latencyMs === undefined ? latency(startedAt) : value.latencyMs,
    ...value,
  });
}

function negativeOrAnswers(
  provider: Provider,
  queriedAt: string,
  startedAt: number,
  rawAnswers: RawAddress[],
  recordType: RecordType,
  answerKind: "nxdomain" | "nodata" | null = null,
) {
  const normalized = normalizeAddresses(rawAnswers, recordType);
  if (rawAnswers.length > 0 && normalized.addresses.length === 0) {
    return result(provider, queriedAt, startedAt, {
      status: "error",
      addresses: [],
      ttlByAddress: {},
      errorCode: "MALFORMED_RESPONSE",
      errorMessage: "El proveedor devolvió direcciones no válidas para el tipo solicitado.",
    });
  }
  return result(provider, queriedAt, startedAt, {
    status: "success",
    answerKind: answerKind ?? (normalized.addresses.length ? "answers" : "nodata"),
    ...normalized,
  });
}

function networkFailure(
  provider: Provider,
  queriedAt: string,
  startedAt: number,
  code: string,
  timedOut = false,
) {
  const unsupported = ["EACCES", "EPERM", "ENETUNREACH"].includes(code);
  return result(provider, queriedAt, startedAt, {
    status: timedOut ? "timeout" : unsupported ? "unsupported" : "error",
    addresses: [],
    ttlByAddress: {},
    errorCode: timedOut ? "TIMEOUT" : unsupported ? "UNSUPPORTED" : code.slice(0, 64),
    errorMessage: timedOut
      ? "El proveedor agotó el tiempo de espera."
      : unsupported
        ? "Este transporte no está disponible en el entorno actual."
        : "El proveedor no pudo completar la consulta.",
  });
}

async function queryClassic(provider: Provider, domain: string, recordType: RecordType) {
  const queriedAt = new Date().toISOString();
  const startedAt = performance.now();
  const resolver = new Resolver();
  resolver.setServers([provider.server!]);
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    resolver.cancel();
  }, provider.timeoutMs);

  try {
    const answers =
      recordType === "A"
        ? await resolver.resolve4(domain, { ttl: true })
        : await resolver.resolve6(domain, { ttl: true });
    return negativeOrAnswers(provider, queriedAt, startedAt, answers, recordType);
  } catch (error) {
    const code = error instanceof Error && "code" in error ? String(error.code) : "DNS_ERROR";
    if (timedOut || code === "ECANCELLED" || code === "ETIMEOUT") {
      return networkFailure(provider, queriedAt, startedAt, code, true);
    }
    if (code === "ENOTFOUND") {
      return negativeOrAnswers(provider, queriedAt, startedAt, [], recordType, "nxdomain");
    }
    if (code === "ENODATA") {
      return negativeOrAnswers(provider, queriedAt, startedAt, [], recordType, "nodata");
    }
    return networkFailure(provider, queriedAt, startedAt, code);
  } finally {
    clearTimeout(timer);
  }
}

async function queryDoh(provider: Provider, domain: string, recordType: RecordType) {
  const queriedAt = new Date().toISOString();
  const startedAt = performance.now();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), provider.timeoutMs);

  try {
    const url = new URL(provider.endpoint!);
    url.searchParams.set("name", domain);
    url.searchParams.set("type", recordType);
    if (provider.id === "doh-google") {
      url.searchParams.set("edns_client_subnet", "0.0.0.0/0");
    }
    const response = await fetch(url, {
      cache: "no-store",
      redirect: "error",
      headers: { accept: "application/dns-json" },
      signal: controller.signal,
    });
    if (!response.ok) {
      return networkFailure(provider, queriedAt, startedAt, `HTTP_${response.status}`);
    }
    const contentType = response.headers.get("content-type")?.toLowerCase() ?? "";
    if (!contentType.includes("json")) {
      return networkFailure(provider, queriedAt, startedAt, "INVALID_CONTENT_TYPE");
    }
    const declaredLength = Number(response.headers.get("content-length") ?? 0);
    if (declaredLength > MAX_DOH_BYTES) {
      return networkFailure(provider, queriedAt, startedAt, "RESPONSE_TOO_LARGE");
    }
    const text = await response.text();
    if (Buffer.byteLength(text) > MAX_DOH_BYTES) {
      return networkFailure(provider, queriedAt, startedAt, "RESPONSE_TOO_LARGE");
    }
    const parsed = dohSchema.safeParse(JSON.parse(text) as unknown);
    if (!parsed.success) {
      return networkFailure(provider, queriedAt, startedAt, "MALFORMED_RESPONSE");
    }
    if (parsed.data.Status === 3) {
      return negativeOrAnswers(provider, queriedAt, startedAt, [], recordType, "nxdomain");
    }
    if (parsed.data.Status !== 0) {
      return networkFailure(
        provider,
        queriedAt,
        startedAt,
        RCODE_NAMES[parsed.data.Status] ?? `RCODE_${parsed.data.Status}`,
      );
    }
    const numericType = recordType === "A" ? 1 : 28;
    const answers = (parsed.data.Answer ?? [])
      .filter((answer) => answer.type === numericType)
      .map((answer) => ({ address: answer.data, ttl: answer.TTL ?? null }));
    return negativeOrAnswers(provider, queriedAt, startedAt, answers, recordType);
  } catch (error) {
    if (controller.signal.aborted) {
      return networkFailure(provider, queriedAt, startedAt, "TIMEOUT", true);
    }
    const code =
      error instanceof Error && "cause" in error && error.cause && typeof error.cause === "object" && "code" in error.cause
        ? String(error.cause.code)
        : "DOH_ERROR";
    return networkFailure(provider, queriedAt, startedAt, code);
  } finally {
    clearTimeout(timer);
  }
}

type DecodedPacket = dnsPacket.DecodedPacket & { rcode: string };

export function decodeDotFrame(frame: Buffer, expectedId: number, domain: string, recordType: RecordType) {
  if (frame.length < 2) throw new Error("DOT_FRAME_SHORT");
  const length = frame.readUInt16BE(0);
  if (length === 0 || length !== frame.length - 2) throw new Error("DOT_FRAME_LENGTH");
  const packet = dnsPacket.decode(frame.subarray(2)) as DecodedPacket;
  const question = packet.questions?.[0];
  if (
    packet.type !== "response" ||
    packet.id !== expectedId ||
    !question ||
    question.name.replace(/\.$/, "").toLowerCase() !== domain ||
    question.type !== recordType
  ) {
    throw new Error("DOT_RESPONSE_MISMATCH");
  }
  return packet;
}

async function queryDot(provider: Provider, domain: string, recordType: RecordType) {
  const queriedAt = new Date().toISOString();
  const startedAt = performance.now();
  const id = randomInt(0, 65_536);
  const message = dnsPacket.encode({
    type: "query",
    id,
    flags: dnsPacket.RECURSION_DESIRED,
    questions: [{ type: recordType, name: domain }],
  });
  const frame = Buffer.allocUnsafe(message.length + 2);
  frame.writeUInt16BE(message.length, 0);
  message.copy(frame, 2);

  return new Promise<ProviderResult>((resolve) => {
    let settled = false;
    let received = Buffer.alloc(0);
    const socket = tls.connect({
      host: provider.host!,
      port: provider.port!,
      servername: provider.servername!,
      rejectUnauthorized: true,
    });
    const timer = setTimeout(() => finish(networkFailure(provider, queriedAt, startedAt, "TIMEOUT", true)), provider.timeoutMs);

    const finish = (value: ProviderResult) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      socket.destroy();
      resolve(value);
    };

    socket.once("secureConnect", () => socket.write(frame));
    socket.on("data", (chunk) => {
      received = Buffer.concat([received, chunk]);
      if (received.length < 2) return;
      const expectedLength = received.readUInt16BE(0);
      if (expectedLength === 0 || expectedLength > 65_535) {
        finish(networkFailure(provider, queriedAt, startedAt, "MALFORMED_RESPONSE"));
        return;
      }
      if (received.length < expectedLength + 2) return;

      try {
        const packet = decodeDotFrame(received.subarray(0, expectedLength + 2), id, domain, recordType);
        if (packet.rcode === "NXDOMAIN") {
          finish(negativeOrAnswers(provider, queriedAt, startedAt, [], recordType, "nxdomain"));
          return;
        }
        if (packet.rcode !== "NOERROR") {
          finish(networkFailure(provider, queriedAt, startedAt, packet.rcode || "DOT_RCODE_ERROR"));
          return;
        }
        const answers = (packet.answers ?? [])
          .filter(
            (answer): answer is dnsPacket.StringAnswer =>
              answer.type === recordType && "data" in answer && typeof answer.data === "string",
          )
          .map((answer) => ({ address: String(answer.data), ttl: answer.ttl ?? null }));
        finish(negativeOrAnswers(provider, queriedAt, startedAt, answers, recordType));
      } catch {
        finish(networkFailure(provider, queriedAt, startedAt, "MALFORMED_RESPONSE"));
      }
    });
    socket.once("error", (error) => finish(networkFailure(provider, queriedAt, startedAt, error.code || "DOT_ERROR")));
    socket.once("end", () => {
      if (!settled) finish(networkFailure(provider, queriedAt, startedAt, "CONNECTION_CLOSED"));
    });
  });
}

export async function queryProvider(provider: Provider, domain: string, recordType: RecordType) {
  try {
    if (provider.protocol === "DNS") return await queryClassic(provider, domain, recordType);
    if (provider.protocol === "DoH") return await queryDoh(provider, domain, recordType);
    return await queryDot(provider, domain, recordType);
  } catch {
    const now = new Date().toISOString();
    return result(provider, now, performance.now(), {
      status: "error",
      addresses: [],
      ttlByAddress: {},
      latencyMs: null,
      errorCode: "INTERNAL_ERROR",
      errorMessage: "La consulta no pudo completarse de forma segura.",
    });
  }
}

import { isIP } from "node:net";
import { domainToASCII } from "node:url";
import type { RecordType } from "@/lib/types";

export class DomainValidationError extends Error {}

export function normalizeDomain(input: string): string {
  if (!input || /\s/.test(input)) {
    throw new DomainValidationError("Escribe un dominio sin espacios.");
  }
  if (/[\\/@:#?\[\]*]/.test(input) || input.includes("://")) {
    throw new DomainValidationError("Introduce solo el nombre de dominio, sin URL, ruta ni puerto.");
  }

  const withoutRootDot = input.endsWith(".") ? input.slice(0, -1) : input;
  if (isIP(withoutRootDot) || withoutRootDot.toLowerCase() === "localhost") {
    throw new DomainValidationError("No se aceptan direcciones IP ni nombres locales.");
  }

  const ascii = domainToASCII(withoutRootDot).toLowerCase();
  if (!ascii || ascii.length > 253) {
    throw new DomainValidationError("El dominio no es válido o supera 253 caracteres.");
  }

  const labels = ascii.split(".");
  if (labels.length < 2) {
    throw new DomainValidationError("Usa un dominio público con al menos dos etiquetas.");
  }
  const validLabel = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/;
  if (labels.some((label) => label.length > 63 || !validLabel.test(label))) {
    throw new DomainValidationError("El dominio contiene una etiqueta no válida.");
  }
  return ascii;
}

export type RawAddress = { address: string; ttl?: number | null };

export function normalizeAddresses(answers: RawAddress[], recordType: RecordType) {
  const family = recordType === "A" ? 4 : 6;
  const ttlByAddress: Record<string, number | null> = {};

  for (const answer of answers) {
    if (isIP(answer.address) !== family) continue;
    const address =
      family === 6
        ? new URL(`http://[${answer.address}]/`).hostname.slice(1, -1)
        : answer.address;
    const ttl = answer.ttl == null ? null : Math.max(0, Math.trunc(answer.ttl));
    const previous = ttlByAddress[address];
    ttlByAddress[address] =
      previous == null ? ttl : ttl == null ? previous : Math.min(previous, ttl);
  }

  const addresses = Object.keys(ttlByAddress).sort();
  return { addresses, ttlByAddress };
}

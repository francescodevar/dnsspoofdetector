"use client";

import Link from "next/link";
import { useState } from "react";
import { traceDomain } from "@/app/actions";
import type { RecordType, TraceResult } from "@/lib/types";

const FINAL_LABEL = {
  answers: "Respuesta autoritativa",
  nodata: "NODATA autoritativo",
  nxdomain: "NXDOMAIN autoritativo",
  cname: "Alias encontrado",
  unavailable: "Rastreo incompleto",
} as const;

export function TraceClient() {
  const [domain, setDomain] = useState("example.com");
  const [recordType, setRecordType] = useState<RecordType>("A");
  const [result, setResult] = useState<TraceResult | null>(null);
  const [error, setError] = useState("");
  const [running, setRunning] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setRunning(true);
    setError("");
    setResult(null);
    const response = await traceDomain({ domain, recordType });
    if (response.ok) setResult(response.data);
    else setError(response.fieldErrors?.domain?.[0] ?? response.message);
    setRunning(false);
  }

  return (
    <>
      <form className="panel trace-form" onSubmit={submit}>
        <div className="section-heading"><div><p className="eyebrow">Consulta no recursiva · RD=0</p><h2>Seguir delegaciones</h2></div><span className="data-count">Máx. 06 saltos</span></div>
        <div className="form-grid"><label className="field"><span>Dominio</span><input value={domain} onChange={(event) => setDomain(event.target.value)} disabled={running} autoComplete="off" /><small>Una ejecución por dominio. Solo se consultan servidores con IPv4 pública.</small></label><fieldset className="field"><legend>Tipo de registro</legend><div className="radio-row">{(["A", "AAAA"] as const).map((type) => <label key={type}><input type="radio" name="traceType" checked={recordType === type} onChange={() => setRecordType(type)} disabled={running} /><span>{type}</span></label>)}</div></fieldset></div>
        {error && <p className="form-error" role="alert">{error} <Link href="/diagnostico">Abrir diagnóstico</Link></p>}
        <button className="button button-primary" disabled={running}>{running ? "Consultando raíz y delegaciones…" : "Iniciar rastreo experimental"}</button>
      </form>

      {result && <section className="trace-result" aria-live="polite"><div className={`trace-verdict trace-${result.finalStatus}`}><p className="eyebrow">Resultado del rastreo</p><h2>{FINAL_LABEL[result.finalStatus]}</h2><p>{result.finalMessage}</p></div><ol className="trace-path">{result.steps.map((step, index) => <li key={`${step.stage}-${step.serverIp}-${index}`}><div className="trace-hop"><span>0{index + 1}</span><div><small>{step.stage} · zona {step.zone}</small><strong>{step.serverName ?? step.serverIp}</strong><code>{step.serverIp} · {step.transport} · {step.latencyMs} ms</code></div><b className={`trace-status-${step.status}`}>{step.status.toUpperCase()}</b></div><div className="trace-detail"><span><small>RCODE</small><strong>{step.rcode}</strong></span><span><small>Autoritativa</small><strong>{step.authoritative ? "Sí" : "No"}</strong></span><span><small>NS / glue</small><strong>{step.nameservers.length} / {step.glue.length}</strong></span><span><small>Bootstrap</small><strong>{step.bootstrap ? "Cloudflare" : "No"}</strong></span></div>{step.nameservers.length > 0 && <p><strong>Servidores referidos:</strong> {step.nameservers.join(", ")}</p>}{step.glue.length > 0 && <p><strong>Glue público:</strong> <code>{step.glue.join(", ")}</code></p>}{step.addresses.length > 0 && <p><strong>Direcciones:</strong> <code>{step.addresses.join(", ")}</code></p>}{step.cnames.length > 0 && <p><strong>CNAME:</strong> {step.cnames.join(", ")}</p>}{step.errorMessage && <p className="form-error">{step.errorMessage}</p>}</li>)}</ol></section>}
    </>
  );
}

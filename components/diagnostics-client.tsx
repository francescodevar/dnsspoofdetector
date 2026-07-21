"use client";

import { useState } from "react";
import { diagnoseProtocols } from "@/app/actions";
import type { DiagnosticResult, Protocol } from "@/lib/types";

export function DiagnosticsClient() {
  const [data, setData] = useState<DiagnosticResult | null>(null);
  const [error, setError] = useState("");
  const [running, setRunning] = useState(false);

  async function run() {
    setRunning(true);
    setError("");
    const response = await diagnoseProtocols();
    if (response.ok) setData(response.data);
    else setError(response.message);
    setRunning(false);
  }

  const protocolState = (protocol: Protocol) => {
    const probes = data?.probes.filter((probe) => probe.protocol === protocol) ?? [];
    const successes = probes.filter((probe) => probe.status === "success").length;
    return successes === probes.length && successes > 0 ? "Disponible" : successes > 0 ? "Degradado" : "No disponible";
  };

  return (
    <>
      <section className="panel diagnostic-intro">
        <div><p className="eyebrow">Entorno de ejecución</p><h2>Comprobar conectividad</h2><p>La prueba consulta <code>example.com</code> una vez mediante cada proveedor. No analiza seguridad ni inspecciona tu equipo.</p></div>
        <button className="button button-primary" onClick={run} disabled={running}>{running ? "Comprobando…" : "Ejecutar diagnóstico"}</button>
      </section>
      {error && <p className="form-error" role="alert">{error}</p>}
      {data && <section aria-live="polite" className="diagnostic-results">
        <div className="protocol-cards">{(["DNS", "DoH", "DoT"] as const).map((protocol) => { const state = protocolState(protocol); return <article className="protocol-card" key={protocol}><span>{protocol}</span><strong className={`availability-${state.toLowerCase().replace(" ", "-")}`}>{state}</strong></article>; })}</div>
        <article className="panel"><div className="section-heading"><div><p className="eyebrow">Punto de observación</p><h2>{data.region ? `Región ${data.region}` : "Entorno local"}</h2></div><span className="data-count">{data.nodeVersion}</span></div><p className="muted">Comprobado el {new Date(data.checkedAt).toLocaleString("es-EC")}. La región corresponde al servidor, no a la ubicación del visitante.</p></article>
        <article className="panel"><div className="table-scroll"><table><thead><tr><th>Proveedor</th><th>Protocolo</th><th>Estado</th><th>Respuesta</th><th>Latencia</th></tr></thead><tbody>{data.probes.map((probe) => <tr key={probe.providerId}><td><strong>{probe.providerName}</strong></td><td><code>{probe.protocol}</code></td><td><span className={`provider-status provider-${probe.status}`}>{probe.status}</span></td><td>{probe.addresses.join(", ") || probe.errorMessage || probe.answerKind}</td><td>{probe.latencyMs == null ? "—" : `${probe.latencyMs} ms`}</td></tr>)}</tbody></table></div></article>
      </section>}
    </>
  );
}

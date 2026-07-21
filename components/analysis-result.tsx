"use client";

import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { downloadAnalyses } from "@/lib/storage";
import type { AnalysisResult, Classification, ProviderStatus } from "@/lib/types";

const CLASSIFICATION: Record<Classification, { label: string; icon: string }> = {
  consistent: { label: "Consistente", icon: "✓" },
  warning: { label: "Advertencia", icon: "!" },
  possible_inconsistency: { label: "Posible inconsistencia DNS", icon: "△" },
  inconclusive: { label: "No concluyente", icon: "?" },
};

const STATUS: Record<ProviderStatus, string> = {
  success: "Correcto",
  timeout: "Tiempo agotado",
  error: "Error",
  unsupported: "No disponible",
};

function median(values: number[]) {
  const ordered = [...values].sort((a, b) => a - b);
  const middle = Math.floor(ordered.length / 2);
  return ordered.length % 2
    ? ordered[middle]
    : Math.round((ordered[middle - 1] + ordered[middle]) / 2);
}

export function AnalysisResultView({
  analysis,
  onSave,
  saved = false,
}: {
  analysis: AnalysisResult;
  onSave?: () => void;
  saved?: boolean;
}) {
  const badge = CLASSIFICATION[analysis.classification];
  const chartData = analysis.rounds[0].providerResults
    .map((provider) => {
      const values = analysis.rounds
        .flatMap((round) => round.providerResults)
        .filter((item) => item.providerId === provider.providerId && item.latencyMs != null)
        .map((item) => item.latencyMs as number);
      return values.length ? { name: provider.providerName.replace(" Public", ""), latency: median(values) } : null;
    })
    .filter((item): item is { name: string; latency: number } => item !== null);

  return (
    <section className="result-stack" aria-labelledby="analysis-result-title">
      {analysis.demoMode && (
        <div className="demo-banner" role="status">Datos simulados para demostración · no se realizó ninguna consulta de red</div>
      )}

      <div className="verdict-card">
        <div>
          <p className="eyebrow">Dictamen del análisis</p>
          <h2 id="analysis-result-title" tabIndex={-1}>
            <span className={`status-mark status-${analysis.classification}`} aria-hidden="true">{badge.icon}</span>
            {badge.label}
          </h2>
          <p className="muted">{analysis.domain} · registro {analysis.recordType} · tres rondas</p>
        </div>
        <div className="confidence-block">
          <strong>{analysis.confidence}/100</strong>
          <meter min="0" max="100" value={analysis.confidence}>{analysis.confidence}%</meter>
          <span>Confianza de la clasificación, no probabilidad de ataque</span>
        </div>
      </div>

      <div className="result-grid">
        <article className="panel">
          <p className="eyebrow">Razones</p>
          <ul className="reason-list">
            {analysis.reasons.map((reason) => <li key={reason}>{reason}</li>)}
          </ul>
        </article>
        <article className="panel">
          <p className="eyebrow">Consenso seguro observado</p>
          {analysis.consensusAddresses.length ? (
            <ul className="address-list">
              {analysis.consensusAddresses.map((address) => <li key={address}><code>{address}</code></li>)}
            </ul>
          ) : <p className="muted">No se obtuvo un conjunto de consenso suficiente.</p>}
        </article>
      </div>

      <aside className="limitation-notice">
        <strong>Alcance del resultado.</strong> Este análisis compara respuestas obtenidas desde la infraestructura del servidor de la aplicación. Una alerta representa una posible inconsistencia entre proveedores y no confirma por sí sola un ataque o la alteración del router del usuario.
      </aside>

      <article className="panel">
        <div className="section-heading">
          <div><p className="eyebrow">Evidencia completa</p><h3>Resultados por ronda y proveedor</h3></div>
          <span className="data-count">15 observaciones</span>
        </div>
        <div className="table-scroll">
          <table>
            <caption className="sr-only">Resultados de las tres rondas por proveedor</caption>
            <thead><tr><th>Ronda</th><th>Proveedor</th><th>Protocolo</th><th>Estado</th><th>Direcciones</th><th>Latencia</th></tr></thead>
            <tbody>
              {analysis.rounds.flatMap((round) => round.providerResults.map((provider) => (
                <tr key={`${round.round}-${provider.providerId}`}>
                  <td><span className="round-dot">{round.round}</span></td>
                  <td>{provider.providerName}</td>
                  <td><code>{provider.protocol}</code></td>
                  <td><span className={`provider-status provider-${provider.status}`}>{STATUS[provider.status]}</span></td>
                  <td>{provider.addresses.length ? provider.addresses.map((address) => <code className="address" key={address}>{address}</code>) : <span className="muted">{provider.errorCode ?? provider.answerKind ?? "Sin respuesta"}</span>}</td>
                  <td>{provider.latencyMs == null ? "—" : `${provider.latencyMs} ms`}</td>
                </tr>
              ))) }
            </tbody>
          </table>
        </div>
      </article>

      {chartData.length > 0 && (
        <article className="panel chart-panel">
          <div className="section-heading"><div><p className="eyebrow">Rendimiento</p><h3>Latencia mediana por proveedor</h3></div></div>
          <p className="sr-only">{chartData.map((item) => `${item.name}: ${item.latency} milisegundos`).join(". ")}</p>
          <div className="chart" aria-hidden="true">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 12, right: 8, left: -20, bottom: 42 }}>
                <XAxis dataKey="name" angle={-18} textAnchor="end" interval={0} tick={{ fontSize: 11, fill: "#45625b" }} />
                <YAxis unit=" ms" tick={{ fontSize: 11, fill: "#45625b" }} />
                <Tooltip cursor={{ fill: "rgba(11,107,97,.08)" }} formatter={(value) => [`${value} ms`, "Mediana"]} />
                <Bar dataKey="latency" fill="#0b6b61" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </article>
      )}

      <div className="action-row">
        {onSave && <button className="button button-primary" onClick={onSave} disabled={saved}>{saved ? "Guardado en historial" : "Guardar en historial"}</button>}
        <button className="button button-secondary" onClick={() => downloadAnalyses([analysis], "csv")}>Descargar CSV</button>
        <button className="button button-secondary" onClick={() => downloadAnalyses([analysis], "json")}>Descargar JSON</button>
      </div>
    </section>
  );
}

"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import {
  compareRound,
  outcomeLabel,
  persistenceFor,
  providerMatchesOutcome,
} from "@/lib/analysis";
import { PROVIDERS } from "@/lib/providers";
import { downloadAnalyses } from "@/lib/storage";
import type {
  AnalysisResult,
  AnalysisRound,
  Classification,
  ProviderResult,
  ProviderStatus,
} from "@/lib/types";

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

const PORTS = { DNS: "53", DoH: "443", DoT: "853" } as const;

function median(values: number[]) {
  const ordered = [...values].sort((a, b) => a - b);
  const middle = Math.floor(ordered.length / 2);
  return ordered.length % 2
    ? ordered[middle]
    : Math.round((ordered[middle - 1] + ordered[middle]) / 2);
}

function providerValue(provider: ProviderResult) {
  if (provider.status !== "success") return STATUS[provider.status];
  if (provider.answerKind === "nodata") return "NODATA";
  if (provider.answerKind === "nxdomain") return "NXDOMAIN";
  return provider.addresses.join(", ") || "Sin respuesta";
}

export function AnalysisTopology({
  rounds,
  running = false,
}: {
  rounds: AnalysisRound[];
  running?: boolean;
}) {
  const latest = rounds.at(-1);
  return (
    <div className="dns-topology" aria-label="Topología del análisis: servidor y cinco rutas DNS">
      <div className="topology-origin">
        <span className={running ? "signal-pulse" : ""} aria-hidden="true" />
        <small>ORIGEN</small>
        <strong>Servidor de análisis</strong>
        <code>{running ? `Ronda ${rounds.length + 1} en curso` : "Punto de observación"}</code>
      </div>
      <div className="topology-routes">
        {PROVIDERS.map((provider, index) => {
          const result = latest?.providerResults.find((item) => item.providerId === provider.id);
          const state = running ? "running" : result?.status ?? "pending";
          return (
            <article className={`topology-node topology-${state}`} key={provider.id}>
              <span className="route-index">0{index + 1}</span>
              <div>
                <small>{provider.protocol} · :{PORTS[provider.protocol]}</small>
                <strong>{provider.name}</strong>
                <span>{running ? "Consultando…" : result ? providerValue(result) : "Pendiente"}</span>
              </div>
              <b>{result?.latencyMs == null || running ? "—" : `${result.latencyMs} ms`}</b>
            </article>
          );
        })}
      </div>
    </div>
  );
}

function RoundTimeline({ analysis }: { analysis: AnalysisResult }) {
  return (
    <ol className="analysis-timeline">
      {analysis.rounds.map((round) => {
        const comparison = compareRound(round);
        const available = round.providerResults.filter((item) => item.status === "success").length;
        return (
          <li key={round.round} className={comparison.eligible ? "timeline-ready" : "timeline-partial"}>
            <span>0{round.round}</span>
            <div>
              <small>{available}/5 rutas disponibles</small>
              <strong>{outcomeLabel(comparison.outcome)}</strong>
              <p>{comparison.traditionalRelation === "match" ? "DNS tradicional coincide" : comparison.traditionalRelation === "mismatch" ? "DNS tradicional diverge" : comparison.traditionalRelation === "mixed" ? "Coincidencia parcial" : "Sin comparación tradicional"}</p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}

function ConsensusMatrix({ analysis }: { analysis: AnalysisResult }) {
  const comparisons = analysis.rounds.map(compareRound);
  const firstRound = analysis.rounds[0];
  return (
    <div className="matrix-wrap">
      <table className="consensus-matrix">
        <caption className="sr-only">Matriz de consenso por observador y ronda</caption>
        <thead><tr><th>Observador</th>{analysis.rounds.map((round) => <th key={round.round}>Ronda {round.round}</th>)}<th>Persistencia</th></tr></thead>
        <tbody>
          {firstRound.providerResults.map((provider) => {
            const results = analysis.rounds.map((round) => round.providerResults.find((item) => item.providerId === provider.providerId) ?? provider);
            return (
              <tr key={provider.providerId}>
                <th scope="row"><strong>{provider.providerName}</strong><small>{provider.protocol}</small></th>
                {results.map((result, index) => {
                  const comparison = comparisons[index];
                  const relation = result.status !== "success"
                    ? "transport"
                    : providerMatchesOutcome(result, comparison.outcome)
                      ? "agree"
                      : comparison.outcome
                        ? "dissent"
                        : "neutral";
                  return <td key={index}><span className={`matrix-cell matrix-${relation}`}>{providerValue(result)}<small>{relation === "agree" ? "Coincide" : relation === "dissent" ? "Difiere" : relation === "transport" ? "Transporte" : "Sin consenso"}</small></span></td>;
                })}
                <td><strong className="persistence-score">{persistenceFor(results)}/3</strong></td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <p className="matrix-summary">{matrixSummary(analysis)}</p>
    </div>
  );
}

function matrixSummary(analysis: AnalysisResult) {
  const comparisons = analysis.rounds.map(compareRound);
  const outcomes = comparisons.map((item) => outcomeLabel(item.outcome));
  const stable = outcomes.every((item) => item === outcomes[0]) && outcomes[0] !== "Sin consenso";
  const failures = analysis.rounds.flatMap((round) => round.providerResults).filter((item) => item.status !== "success");
  if (stable && failures.length) return `El consenso mantuvo ${outcomes[0]}; ${failures.length} fallo${failures.length === 1 ? " aislado no lo elimina" : "s de transporte no lo eliminan"}.`;
  if (stable) return `Las tres rondas mantuvieron el mismo resultado cifrado: ${outcomes[0]}.`;
  return "Los resultados cambiaron o no reunieron el quórum necesario durante las tres rondas.";
}

function VerdictExplanation({ analysis }: { analysis: AnalysisResult }) {
  const comparisons = analysis.rounds.map(compareRound);
  const all = analysis.rounds.flatMap((round) => round.providerResults);
  const available = all.filter((item) => item.status === "success").length;
  const consensusRounds = comparisons.filter((item) => item.eligible).length;
  const relations = comparisons.map((item) => item.traditionalRelation);
  const dominant = relations.filter((item) => item === "match").length >= 2 ? "coincidió" : relations.filter((item) => item === "mismatch").length >= 2 ? "divergió" : "varió";
  const steps = [
    ["Disponibilidad", `${available}/15 consultas entregaron una respuesta DNS válida.`],
    ["Consenso cifrado", `${consensusRounds}/3 rondas alcanzaron el quórum fijo de dos organizaciones.`],
    ["DNS tradicional", `Su relación con el consenso ${dominant} durante la medición.`],
    ["Persistencia", matrixSummary(analysis)],
    ["Dictamen", `${CLASSIFICATION[analysis.classification].label}, con confianza ${analysis.confidence}/100. No equivale a probabilidad de ataque.`],
  ];
  return <ol className="verdict-steps">{steps.map(([title, text], index) => <li key={title}><span>0{index + 1}</span><div><strong>{title}</strong><p>{text}</p></div></li>)}</ol>;
}

function Presentation({ analysis, onClose }: { analysis: AnalysisResult; onClose: () => void }) {
  const [slide, setSlide] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const slides = [
    <div className="presentation-slide" key="topology"><p className="eyebrow">Lámina 01 · arquitectura</p><h2>{analysis.domain}</h2><p className="slide-lead">Cinco rutas DNS observadas desde un único servidor.</p><AnalysisTopology rounds={analysis.rounds} /></div>,
    <div className="presentation-slide" key="timeline"><p className="eyebrow">Lámina 02 · repetición</p><h2>Tres rondas, una evidencia temporal</h2><RoundTimeline analysis={analysis} /></div>,
    <div className="presentation-slide" key="matrix"><p className="eyebrow">Lámina 03 · pieza central</p><h2>Matriz de consenso</h2><ConsensusMatrix analysis={analysis} /></div>,
    <div className="presentation-slide" key="verdict"><p className="eyebrow">Lámina 04 · dictamen explicable</p><h2>{CLASSIFICATION[analysis.classification].label}</h2><VerdictExplanation analysis={analysis} /></div>,
    <div className="presentation-slide presentation-credits" key="limits"><Image src="/Screenshot 2026-07-21 173904.png" width={697} height={315} alt="ISTE" /><p className="eyebrow">Lámina 05 · alcance académico</p><h2>Medimos consistencia, no afirmamos ataques.</h2><p>El punto de observación es el servidor. El resultado no inspecciona el router del visitante ni sustituye DNSSEC o un análisis forense.</p><strong>Mauricio Xavier Loor Garcia · Erick Sebastian Parra Ulloa · Silvio Francesco Aliatis Ramirez</strong><small>Tutor: Ing. Mg. Marco Polo Silva · ISTE · 2026</small></div>,
  ];

  useEffect(() => {
    rootRef.current?.focus();
    const keydown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
      if (event.key === "ArrowRight") setSlide((current) => Math.min(4, current + 1));
      if (event.key === "ArrowLeft") setSlide((current) => Math.max(0, current - 1));
    };
    window.addEventListener("keydown", keydown);
    return () => window.removeEventListener("keydown", keydown);
  }, [onClose]);

  return (
    <div className="presentation-overlay" role="dialog" aria-modal="true" aria-labelledby="presentation-title" ref={rootRef} tabIndex={-1}>
      <h2 className="sr-only" id="presentation-title">Modo sustentación</h2>
      <header><span>DNSSpoofDetector · Sustentación</span><button type="button" onClick={onClose} aria-label="Cerrar modo sustentación">Cerrar ×</button></header>
      <main>{slides[slide]}</main>
      <footer><button type="button" onClick={() => setSlide((current) => Math.max(0, current - 1))} disabled={slide === 0}>← Anterior</button><span>{slide + 1} / 5</span><button type="button" onClick={() => setSlide((current) => Math.min(4, current + 1))} disabled={slide === 4}>Siguiente →</button></footer>
    </div>
  );
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
  const [presenting, setPresenting] = useState(false);
  const presentationButton = useRef<HTMLButtonElement>(null);
  const chartData = analysis.rounds[0].providerResults
    .map((provider) => {
      const values = analysis.rounds.flatMap((round) => round.providerResults)
        .filter((item) => item.providerId === provider.providerId && item.latencyMs != null)
        .map((item) => item.latencyMs as number);
      return values.length ? { name: provider.providerName.replace(" Public", ""), latency: median(values) } : null;
    })
    .filter((item): item is { name: string; latency: number } => item !== null);

  async function openPresentation() {
    setPresenting(true);
    requestAnimationFrame(async () => {
      const overlay = document.querySelector<HTMLElement>(".presentation-overlay");
      try { await overlay?.requestFullscreen?.(); } catch { /* El overlay sigue funcionando sin fullscreen. */ }
    });
  }

  async function closePresentation() {
    if (document.fullscreenElement) await document.exitFullscreen().catch(() => undefined);
    setPresenting(false);
    requestAnimationFrame(() => presentationButton.current?.focus());
  }

  return (
    <section className="result-stack academic-report" aria-labelledby="analysis-result-title">
      <div className="print-cover">
        <Image src="/Screenshot 2026-07-21 173904.png" width={697} height={315} alt="ISTE" />
        <p>Informe académico · DNSSpoofDetector</p><h1>{analysis.domain}</h1>
        <span>{new Date(analysis.createdAt).toLocaleString("es-EC")} · Registro {analysis.recordType} · Punto de observación: servidor</span>
      </div>
      {analysis.demoMode && <div className="demo-banner" role="status">Datos simulados para demostración · no se realizó ninguna consulta de red</div>}

      <div className="verdict-card">
        <div><p className="eyebrow">Dictamen del análisis</p><h2 id="analysis-result-title" tabIndex={-1}><span className={`status-mark status-${analysis.classification}`} aria-hidden="true">{badge.icon}</span>{badge.label}</h2><p className="muted">{analysis.domain} · registro {analysis.recordType} · tres rondas</p></div>
        <div className="confidence-block"><strong>{analysis.confidence}/100</strong><meter min="0" max="100" value={analysis.confidence}>{analysis.confidence}%</meter><span>Confianza de la clasificación, no probabilidad de ataque</span></div>
      </div>

      <article className="panel topology-panel"><div className="section-heading"><div><p className="eyebrow">Topología real</p><h3>Un servidor, cinco rutas observadas</h3></div><span className="data-count">06 nodos</span></div><AnalysisTopology rounds={analysis.rounds} /></article>
      <article className="panel"><div className="section-heading"><div><p className="eyebrow">Secuencia de evidencia</p><h3>Línea de tiempo</h3></div><span className="data-count">03 rondas</span></div><RoundTimeline analysis={analysis} /></article>
      <article className="panel matrix-panel"><div className="section-heading"><div><p className="eyebrow">Evidencia principal</p><h3>Matriz de consenso</h3></div><span className="data-count">15 observaciones</span></div><ConsensusMatrix analysis={analysis} /></article>
      <article className="panel"><div className="section-heading"><div><p className="eyebrow">Cómo se obtuvo</p><h3>Explicación del dictamen</h3></div></div><VerdictExplanation analysis={analysis} /></article>

      <div className="result-grid">
        <article className="panel"><p className="eyebrow">Razones</p><ul className="reason-list">{analysis.reasons.map((reason) => <li key={reason}>{reason}</li>)}</ul></article>
        <article className="panel"><p className="eyebrow">Consenso seguro observado</p>{analysis.consensusAddresses.length ? <ul className="address-list">{analysis.consensusAddresses.map((address) => <li key={address}><code>{address}</code></li>)}</ul> : <p className="muted">El consenso fue una respuesta negativa o no se obtuvo un conjunto de IP suficiente.</p>}</article>
      </div>

      <aside className="limitation-notice"><strong>Alcance del resultado.</strong> Este análisis compara respuestas obtenidas desde la infraestructura del servidor. Una alerta representa una posible inconsistencia y no confirma por sí sola un ataque o la alteración del router del usuario.</aside>

      <article className="panel evidence-table"><div className="section-heading"><div><p className="eyebrow">Evidencia completa</p><h3>Resultados por ronda y proveedor</h3></div><span className="data-count">15 observaciones</span></div><div className="table-scroll"><table><caption className="sr-only">Resultados de las tres rondas por proveedor</caption><thead><tr><th>Ronda</th><th>Proveedor</th><th>Protocolo</th><th>Estado</th><th>Respuesta</th><th>Latencia</th></tr></thead><tbody>{analysis.rounds.flatMap((round) => round.providerResults.map((provider) => <tr key={`${round.round}-${provider.providerId}`}><td><span className="round-dot">{round.round}</span></td><td>{provider.providerName}</td><td><code>{provider.protocol}</code></td><td><span className={`provider-status provider-${provider.status}`}>{STATUS[provider.status]}</span></td><td><span className="response-value">{providerValue(provider)}</span></td><td>{provider.latencyMs == null ? "—" : `${provider.latencyMs} ms`}</td></tr>))}</tbody></table></div></article>

      {chartData.length > 0 && <article className="panel chart-panel"><div className="section-heading"><div><p className="eyebrow">Rendimiento</p><h3>Latencia mediana por proveedor</h3></div></div><p className="sr-only">{chartData.map((item) => `${item.name}: ${item.latency} milisegundos`).join(". ")}</p><div className="chart" aria-hidden="true"><ResponsiveContainer width="100%" height="100%"><BarChart data={chartData} layout="vertical" margin={{ top: 4, right: 28, left: 12, bottom: 4 }}><CartesianGrid strokeDasharray="3 3" horizontal={false} /><XAxis type="number" unit=" ms" tick={{ fontSize: 11, fill: "#4f6681" }} /><YAxis type="category" dataKey="name" width={150} tick={{ fontSize: 11, fill: "#061d3d" }} /><Tooltip cursor={{ fill: "rgba(9,105,218,.07)" }} formatter={(value) => [`${value} ms`, "Mediana"]} /><Bar dataKey="latency" fill="#0969da" radius={[0, 4, 4, 0]} /></BarChart></ResponsiveContainer></div></article>}

      <div className="report-signature"><strong>Autores</strong><span>Mauricio Xavier Loor Garcia · Erick Sebastian Parra Ulloa · Silvio Francesco Aliatis Ramirez</span><small>Tutor: Ing. Mg. Marco Polo Silva · ISTE · 2026</small></div>
      <div className="action-row no-print">{onSave && <button className="button button-primary" onClick={onSave} disabled={saved}>{saved ? "Guardado en historial" : "Guardar en historial"}</button>}<button ref={presentationButton} className="button button-primary" onClick={openPresentation}>Modo sustentación</button><button className="button button-secondary" onClick={() => window.print()}>Guardar informe PDF</button><button className="button button-secondary" onClick={() => downloadAnalyses([analysis], "csv")}>Descargar CSV</button><button className="button button-secondary" onClick={() => downloadAnalyses([analysis], "json")}>Descargar JSON</button></div>
      {presenting && <Presentation analysis={analysis} onClose={closePresentation} />}
    </section>
  );
}

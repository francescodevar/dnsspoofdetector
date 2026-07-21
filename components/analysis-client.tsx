"use client";

import { useRef, useState } from "react";
import { analyzeDomain } from "@/app/actions";
import { AnalysisResultView } from "@/components/analysis-result";
import { buildAnalysisResult, createDemoResult } from "@/lib/analysis";
import { saveAnalysis } from "@/lib/storage";
import type { AnalysisResult, AnalysisRound, Classification, RecordType } from "@/lib/types";

type Step = "pending" | "running" | "done" | "error";

export function AnalysisClient() {
  const [domain, setDomain] = useState("example.com");
  const [recordType, setRecordType] = useState<RecordType>("A");
  const [mode, setMode] = useState<"real" | "demo">("real");
  const [demoClassification, setDemoClassification] = useState<Classification>("possible_inconsistency");
  const [steps, setSteps] = useState<Step[]>(["pending", "pending", "pending"]);
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const [running, setRunning] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    setSaved(false);
    setAnalysis(null);
    setSteps(["pending", "pending", "pending"]);

    if (mode === "demo") {
      try {
        setAnalysis(createDemoResult(demoClassification, recordType));
        setSteps(["done", "done", "done"]);
        requestAnimationFrame(() => document.getElementById("analysis-result-title")?.focus());
      } catch {
        setError("No fue posible cargar el escenario de demostración.");
      }
      return;
    }

    setRunning(true);
    const rounds: AnalysisRound[] = [];
    const startedAt = performance.now();
    const createdAt = new Date().toISOString();
    let normalizedDomain = domain;
    try {
      for (let index = 0; index < 3; index += 1) {
        setSteps((current) => current.map((step, item) => item === index ? "running" : step));
        const response = await analyzeDomain({ domain, recordType, round: index + 1 });
        if (!response.ok) {
          setSteps((current) => current.map((step, item) => item === index ? "error" : step));
          setError(response.fieldErrors?.domain?.[0] ?? response.message);
          inputRef.current?.focus();
          return;
        }
        normalizedDomain = response.data.domain;
        rounds.push(response.data.round);
        setSteps((current) => current.map((step, item) => item === index ? "done" : step));
      }
      const completed = buildAnalysisResult({
        id: crypto.randomUUID(),
        domain: normalizedDomain,
        recordType,
        createdAt,
        rounds,
        durationMs: Math.round(performance.now() - startedAt),
        demoMode: false,
      });
      setAnalysis(completed);
      requestAnimationFrame(() => document.getElementById("analysis-result-title")?.focus());
    } finally {
      setRunning(false);
    }
  }

  function save() {
    if (!analysis) return;
    try {
      saveAnalysis(analysis);
      setSaved(true);
    } catch {
      setError("El navegador no permitió guardar el historial. Revisa el espacio disponible.");
    }
  }

  return (
    <>
      <form className="analysis-form panel" onSubmit={submit} noValidate>
        <div className="section-heading">
          <div><p className="eyebrow">Nueva medición</p><h2>Consultar un dominio</h2></div>
          <span className="data-count">5 fuentes × 3 rondas</span>
        </div>

        <div className="mode-switch" role="group" aria-label="Modo de análisis">
          <button type="button" className={mode === "real" ? "active" : ""} onClick={() => setMode("real")} aria-pressed={mode === "real"}>Análisis real</button>
          <button type="button" className={mode === "demo" ? "active" : ""} onClick={() => setMode("demo")} aria-pressed={mode === "demo"}>Demostración</button>
        </div>

        {mode === "demo" && <div className="demo-banner">Datos simulados para demostración</div>}

        <div className="form-grid">
          <label className="field field-wide">
            <span>Nombre de dominio</span>
            <input ref={inputRef} name="domain" value={domain} onChange={(event) => setDomain(event.target.value)} disabled={running || mode === "demo"} placeholder="ejemplo.com" autoComplete="off" aria-describedby={error ? "analysis-error" : "domain-help"} />
            <small id="domain-help">Solo el dominio, sin https://, rutas, puertos ni espacios.</small>
          </label>
          <fieldset className="field">
            <legend>Tipo de registro</legend>
            <div className="radio-row">
              {(["A", "AAAA"] as const).map((type) => <label key={type}><input type="radio" name="recordType" checked={recordType === type} onChange={() => setRecordType(type)} disabled={running} /><span>{type}</span></label>)}
            </div>
          </fieldset>
          {mode === "demo" && (
            <label className="field">
              <span>Escenario</span>
              <select value={demoClassification} onChange={(event) => setDemoClassification(event.target.value as Classification)}>
                <option value="consistent">Consistente</option><option value="warning">Advertencia</option><option value="possible_inconsistency">Posible inconsistencia</option><option value="inconclusive">No concluyente</option>
              </select>
            </label>
          )}
        </div>

        {error && <p className="form-error" id="analysis-error" role="alert">{error}</p>}

        <ol className="round-progress" aria-live="polite">
          {steps.map((step, index) => <li key={index} className={`step-${step}`}><span>{step === "done" ? "✓" : step === "error" ? "×" : index + 1}</span><div><strong>Ronda {index + 1}</strong><small>{step === "running" ? "Consultando cinco fuentes…" : step === "done" ? "Completada" : step === "error" ? "Interrumpida" : "Pendiente"}</small></div></li>)}
        </ol>

        <button className="button button-primary button-large" disabled={running}>{running ? "Analizando…" : mode === "demo" ? "Mostrar demostración" : "Analizar dominio"}</button>
      </form>

      {analysis && <AnalysisResultView analysis={analysis} onSave={save} saved={saved} />}
    </>
  );
}

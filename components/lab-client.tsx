"use client";

import { useState } from "react";
import { analyzeDomain } from "@/app/actions";
import { AnalysisResultView } from "@/components/analysis-result";
import { buildAnalysisResult } from "@/lib/analysis";
import { downloadAnalyses } from "@/lib/storage";
import type { AnalysisResult, AnalysisRound, RecordType } from "@/lib/types";

export function LabClient() {
  const [text, setText] = useState("example.com\ncloudflare.com\ngoogle.com");
  const [recordType, setRecordType] = useState<RecordType>("A");
  const [results, setResults] = useState<AnalysisResult[]>([]);
  const [selected, setSelected] = useState<AnalysisResult | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState({ completed: 0, total: 0, label: "" });
  const domains = text.split(/\r?\n/).map((item) => item.trim()).filter(Boolean);

  async function run(event: React.FormEvent) {
    event.preventDefault();
    if (!domains.length || domains.length > 10) {
      setErrors([domains.length > 10 ? "El lote admite como máximo diez dominios." : "Añade al menos un dominio."]);
      return;
    }
    setRunning(true);
    setResults([]);
    setSelected(null);
    setErrors([]);
    const completed: AnalysisResult[] = [];
    const failures: string[] = [];
    const total = domains.length * 3;
    let calls = 0;

    for (let domainIndex = 0; domainIndex < domains.length; domainIndex += 1) {
      const domain = domains[domainIndex];
      const rounds: AnalysisRound[] = [];
      const startedAt = performance.now();
      const createdAt = new Date().toISOString();
      let normalizedDomain = domain;
      let failed = false;

      for (let round = 1; round <= 3; round += 1) {
        setProgress({ completed: calls, total, label: `${domainIndex + 1}/${domains.length}: ${domain} · ronda ${round}/3` });
        const response = await analyzeDomain({ domain, recordType, round });
        calls += 1;
        setProgress({ completed: calls, total, label: `${domainIndex + 1}/${domains.length}: ${domain}` });
        if (!response.ok) {
          failures.push(`${domain}: ${response.fieldErrors?.domain?.[0] ?? response.message}`);
          failed = true;
          break;
        }
        normalizedDomain = response.data.domain;
        rounds.push(response.data.round);
      }
      if (!failed && rounds.length === 3) {
        completed.push(buildAnalysisResult({ id: crypto.randomUUID(), domain: normalizedDomain, recordType, createdAt, rounds, durationMs: Math.round(performance.now() - startedAt), demoMode: false }));
        setResults([...completed]);
      } else {
        calls += 3 - rounds.length - (failed ? 1 : 0);
      }
    }
    setProgress({ completed: total, total, label: "Lote completado" });
    setErrors(failures);
    setRunning(false);
  }

  return (
    <>
      <form className="panel" onSubmit={run}>
        <div className="section-heading"><div><p className="eyebrow">Experimento controlado</p><h2>Configurar lote</h2></div><span className="data-count">{domains.length}/10 dominios</span></div>
        <div className="form-grid">
          <label className="field field-wide"><span>Un dominio por línea</span><textarea rows={7} value={text} onChange={(event) => setText(event.target.value)} disabled={running} /><small>Se ejecutan secuencialmente para respetar los límites del entorno.</small></label>
          <fieldset className="field"><legend>Tipo para todo el lote</legend><div className="radio-row">{(["A", "AAAA"] as const).map((type) => <label key={type}><input type="radio" checked={recordType === type} onChange={() => setRecordType(type)} disabled={running} /><span>{type}</span></label>)}</div></fieldset>
        </div>
        <div className="action-row"><button className="button button-primary" disabled={running}>{running ? "Ejecutando lote…" : "Iniciar laboratorio"}</button><button className="button button-secondary" type="button" disabled={running} onClick={() => setText("example.com\ncloudflare.com\ngoogle.com")}>Cargar ejemplos</button></div>
        {progress.total > 0 && <div className="lab-progress" aria-live="polite"><div><strong>{progress.label}</strong><span>{progress.completed}/{progress.total} rondas</span></div><progress value={progress.completed} max={progress.total} /></div>}
        {errors.length > 0 && <ul className="error-list" role="alert">{errors.map((error) => <li key={error}>{error}</li>)}</ul>}
      </form>

      {results.length > 0 && <section className="panel"><div className="section-heading"><div><p className="eyebrow">Resultados del lote</p><h2>{results.length} análisis completados</h2></div></div><div className="table-scroll"><table><thead><tr><th>Dominio</th><th>Clasificación</th><th>Confianza</th><th>Duración</th><th></th></tr></thead><tbody>{results.map((result) => <tr key={result.id}><td><strong>{result.domain}</strong></td><td>{result.classification.replaceAll("_", " ")}</td><td>{result.confidence}/100</td><td>{result.durationMs} ms</td><td><button className="text-button" onClick={() => setSelected(result)}>Ver evidencia</button></td></tr>)}</tbody></table></div><div className="action-row"><button className="button button-secondary" onClick={() => downloadAnalyses(results, "csv")}>Exportar lote CSV</button><button className="button button-secondary" onClick={() => downloadAnalyses(results, "json")}>Exportar lote JSON</button></div></section>}
      {selected && <AnalysisResultView analysis={selected} />}
    </>
  );
}

"use client";

import { useEffect, useMemo, useState } from "react";
import { AnalysisResultView } from "@/components/analysis-result";
import { downloadAnalyses, loadHistory, writeHistory } from "@/lib/storage";
import type { AnalysisResult, Classification } from "@/lib/types";

const LABELS: Record<Classification, string> = {
  consistent: "Consistente",
  warning: "Advertencia",
  possible_inconsistency: "Posible inconsistencia",
  inconclusive: "No concluyente",
};

function localDate(iso: string) {
  const date = new Date(iso);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export function HistoryClient() {
  const [items, setItems] = useState<AnalysisResult[]>([]);
  const [selected, setSelected] = useState<AnalysisResult | null>(null);
  const [domain, setDomain] = useState("");
  const [date, setDate] = useState("");
  const [classification, setClassification] = useState<Classification | "">("");
  useEffect(() => {
    const frame = requestAnimationFrame(() => setItems(loadHistory()));
    return () => cancelAnimationFrame(frame);
  }, []);

  const filtered = useMemo(() => items.filter((item) =>
    item.domain.toLowerCase().includes(domain.toLowerCase()) &&
    (!date || localDate(item.createdAt) === date) &&
    (!classification || item.classification === classification),
  ), [items, domain, date, classification]);

  function remove(id: string) {
    if (!window.confirm("¿Eliminar este análisis del historial local?")) return;
    const next = writeHistory(items.filter((item) => item.id !== id));
    setItems(next);
    if (selected?.id === id) setSelected(null);
  }

  function clear() {
    if (!items.length || !window.confirm("¿Limpiar todo el historial local? Esta acción no se puede deshacer.")) return;
    writeHistory([]);
    setItems([]);
    setSelected(null);
  }

  return (
    <>
      <section className="panel history-tools" aria-labelledby="history-filters">
        <div className="section-heading"><div><p className="eyebrow">Almacenamiento local</p><h2 id="history-filters">Filtrar análisis</h2></div><span className="data-count">{items.length}/100 guardados</span></div>
        <div className="filter-grid">
          <label className="field"><span>Dominio</span><input value={domain} onChange={(event) => setDomain(event.target.value)} placeholder="Buscar dominio" /></label>
          <label className="field"><span>Fecha</span><input type="date" value={date} onChange={(event) => setDate(event.target.value)} /></label>
          <label className="field"><span>Clasificación</span><select value={classification} onChange={(event) => setClassification(event.target.value as Classification | "")}><option value="">Todas</option>{Object.entries(LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
        </div>
        <div className="action-row"><button className="button button-secondary" disabled={!items.length} onClick={() => downloadAnalyses(items, "csv")}>Exportar CSV</button><button className="button button-secondary" disabled={!items.length} onClick={() => downloadAnalyses(items, "json")}>Exportar JSON</button><button className="button button-danger" disabled={!items.length} onClick={clear}>Limpiar historial</button></div>
      </section>

      <section className="panel">
        <div className="section-heading"><div><p className="eyebrow">Resultados</p><h2>Historial del navegador</h2></div><span className="data-count">{filtered.length} visibles</span></div>
        {filtered.length === 0 ? <div className="empty-state"><strong>No hay análisis que mostrar.</strong><p>Guarda un resultado desde la página Analizar o cambia los filtros.</p></div> : (
          <div className="table-scroll"><table><thead><tr><th>Dominio</th><th>Fecha</th><th>Tipo</th><th>Clasificación</th><th>Confianza</th><th>Acciones</th></tr></thead><tbody>{filtered.map((item) => <tr key={item.id}><td><strong>{item.domain}</strong>{item.demoMode && <span className="demo-pill">Simulado</span>}</td><td>{new Date(item.createdAt).toLocaleString("es-EC")}</td><td><code>{item.recordType}</code></td><td><span className={`provider-status status-${item.classification}`}>{LABELS[item.classification]}</span></td><td>{item.confidence}/100</td><td><div className="table-actions"><button onClick={() => setSelected(item)}>Ver detalle</button><button onClick={() => remove(item.id)}>Eliminar</button></div></td></tr>)}</tbody></table></div>
        )}
      </section>
      {selected && <AnalysisResultView analysis={selected} />}
    </>
  );
}

import type { Metadata } from "next";
import { TraceClient } from "@/components/trace-client";

export const metadata: Metadata = { title: "Rastreo DNS experimental" };
export const runtime = "nodejs";
export const maxDuration = 15;

export default function TracePage() {
  return <main id="contenido" className="shell page-shell"><header className="page-header"><p className="eyebrow">Raíz → TLD → autoritativo</p><h1>Rastreo DNS experimental</h1><p>Visualiza cómo una consulta no recursiva sigue referencias reales desde los servidores raíz. Esta herramienta complementa el análisis comparativo; no simula resultados ni valida DNSSEC.</p></header><aside className="limitation-notice"><strong>Alcance controlado.</strong> Máximo seis saltos y dos servidores por etapa, con tiempos de espera estrictos. Algunos proveedores de hosting bloquean las conexiones DNS directas.</aside><TraceClient /></main>;
}

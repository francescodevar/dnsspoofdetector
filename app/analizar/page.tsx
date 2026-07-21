import type { Metadata } from "next";
import { AnalysisClient } from "@/components/analysis-client";
export const metadata: Metadata = { title: "Analizar" };
export const runtime = "nodejs";
export const maxDuration = 15;
export default function AnalyzePage() { return <main id="contenido" className="shell page-shell"><header className="page-header"><p className="eyebrow">Medición individual</p><h1>Analizar dominio</h1><p>Ejecuta tres rondas reales o utiliza fixtures controladas para una demostración reproducible.</p></header><AnalysisClient /></main>; }

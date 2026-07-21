import type { Metadata } from "next";
import { HistoryClient } from "@/components/history-client";
export const metadata: Metadata = { title: "Historial" };
export default function HistoryPage() { return <main id="contenido" className="shell page-shell"><header className="page-header"><p className="eyebrow">Evidencia persistente</p><h1>Historial local</h1><p>Los análisis se guardan únicamente en este navegador. No existe una base de datos remota.</p></header><HistoryClient /></main>; }

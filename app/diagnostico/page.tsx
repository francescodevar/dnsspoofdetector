import type { Metadata } from "next";
import { DiagnosticsClient } from "@/components/diagnostics-client";
export const metadata: Metadata = { title: "Diagnóstico" };
export const runtime = "nodejs";
export const maxDuration = 15;
export default function DiagnosticsPage() { return <main id="contenido" className="shell page-shell"><header className="page-header"><p className="eyebrow">Prueba de viabilidad</p><h1>Diagnóstico de protocolos</h1><p>Comprueba qué transportes puede utilizar el servidor actual, especialmente DoT por el puerto 853.</p></header><DiagnosticsClient /></main>; }

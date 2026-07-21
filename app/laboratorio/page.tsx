import type { Metadata } from "next";
import { LabClient } from "@/components/lab-client";
export const metadata: Metadata = { title: "Laboratorio" };
export const runtime = "nodejs";
export const maxDuration = 15;
export default function LabPage() { return <main id="contenido" className="shell page-shell"><header className="page-header"><p className="eyebrow">Series pequeñas y reproducibles</p><h1>Laboratorio</h1><p>Ejecuta hasta diez dominios de forma secuencial y exporta la evidencia para el análisis académico.</p></header><LabClient /></main>; }

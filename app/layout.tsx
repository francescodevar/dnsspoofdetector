import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { IBM_Plex_Mono, IBM_Plex_Sans } from "next/font/google";
import "./globals.css";

const sans = IBM_Plex_Sans({ variable: "--font-plex-sans", subsets: ["latin"], weight: "variable" });
const mono = IBM_Plex_Mono({ variable: "--font-plex-mono", subsets: ["latin"], weight: ["400", "500", "600"] });

export const metadata: Metadata = {
  title: { default: "DNSSpoofDetector", template: "%s · DNSSpoofDetector" },
  description: "Monitor académico de consistencia de resolución DNS con validación cruzada sobre DNS, DoH y DoT.",
  applicationName: "DNSSpoofDetector",
  authors: [
    { name: "Mauricio Xavier Loor Garcia" },
    { name: "Erick Sebastian Parra Ulloa" },
    { name: "Silvio Francesco Aliatis Ramirez" },
  ],
};

const navigation = [
  ["/analizar", "Analizar"], ["/historial", "Historial"], ["/laboratorio", "Laboratorio"],
  ["/rastreo", "Rastreo"], ["/diagnostico", "Diagnóstico"], ["/metodologia", "Metodología"],
];

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es" className={`${sans.variable} ${mono.variable}`} data-scroll-behavior="smooth">
      <body>
        <a className="skip-link" href="#contenido">Saltar al contenido</a>
        <header className="site-header">
          <div className="shell header-inner">
            <Link href="/" className="brand" aria-label="DNSSpoofDetector e ISTE, inicio">
              <Image src="/Screenshot 2026-07-21 173904.png" width="697" height="315" alt="" priority />
              <span className="brand-product">DNS<span>Spoof</span>Detector</span>
            </Link>
            <nav aria-label="Navegación principal">{navigation.map(([href, label]) => <Link href={href} key={href}>{label}</Link>)}</nav>
          </div>
        </header>
        {children}
        <footer className="site-footer"><div className="shell footer-inner">
          <div className="footer-identity"><Image src="/Screenshot 2026-07-21 173904.png" width="697" height="315" alt="ISTE — Instituto Superior Tecnológico Universitario España" /><div><strong>DNSSpoofDetector</strong><p>Trabajo de titulación · Sistemas de Información y Ciberseguridad · 2026</p></div></div>
          <div className="footer-authors"><strong>Autores</strong><p>Mauricio Xavier Loor Garcia<br />Erick Sebastian Parra Ulloa<br />Silvio Francesco Aliatis Ramirez</p></div>
          <p className="footer-note">Analiza consistencia. No ejecuta ataques ni confirma por sí solo una intrusión.</p>
        </div></footer>
      </body>
    </html>
  );
}

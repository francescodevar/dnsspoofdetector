import Image from "next/image";
import Link from "next/link";

export default function Home() {
  return (
    <main id="contenido">
      <section className="hero shell">
        <div className="hero-copy reveal">
          <p className="eyebrow"><span className="live-dot" /> Observatorio de resolución DNS</p>
          <h1>La misma consulta.<br /><em>Cinco observadores.</em><br />Una señal explicable.</h1>
          <p className="hero-lead">Compara DNS tradicional, DNS sobre HTTPS y DNS sobre TLS durante tres rondas para detectar diferencias persistentes sin confundirlas con una prueba de ataque.</p>
          <div className="hero-actions"><Link className="button button-primary button-large" href="/analizar">Analizar un dominio <span aria-hidden="true">→</span></Link><Link className="text-link" href="/metodologia">Ver cómo se decide</Link></div>
        </div>
        <div className="consensus-spine reveal delay-1" aria-label="Flujo de validación cruzada">
          <div className="spine-head"><span>CONSENSO / 03 RONDAS</span><span className="signal-code">OBS–05</span></div>
          <div className="spine-node"><span className="node-index">01</span><div><strong>DNS tradicional</strong><small>Cloudflare · Google</small></div><code>UDP/TCP :53</code></div>
          <div className="spine-node"><span className="node-index">02</span><div><strong>DNS sobre HTTPS</strong><small>Cloudflare · Google</small></div><code>HTTPS :443</code></div>
          <div className="spine-node"><span className="node-index">03</span><div><strong>DNS sobre TLS</strong><small>Quad9 sin bloqueo</small></div><code>TLS :853</code></div>
          <div className="spine-verdict"><span>Resultado</span><strong>Con razones y confianza</strong></div>
        </div>
      </section>

      <section className="method-strip"><div className="shell method-grid"><article><span>01</span><h2>Consulta</h2><p>Cinco rutas fijas consultan registros A o AAAA desde el servidor.</p></article><article><span>02</span><h2>Normaliza</h2><p>Valida, canonicaliza y compara conjuntos de IP sin depender del orden.</p></article><article><span>03</span><h2>Clasifica</h2><p>La persistencia en tres rondas separa una diferencia ocasional de una señal fuerte.</p></article></div></section>

      <section className="shell thesis-credit" aria-labelledby="thesis-title">
        <div className="institution-panel">
          <Image src="/Screenshot 2026-07-21 173904.png" width="697" height="315" alt="ISTE — Instituto Superior Tecnológico Universitario España" />
          <p className="eyebrow">Trabajo de titulación · 2026</p>
          <h2 id="thesis-title">Tecnología que lleva nuestros nombres.</h2>
          <p>Proyecto desarrollado en la carrera de Sistemas de Información y Ciberseguridad, Ambato — Ecuador.</p>
        </div>
        <div className="academic-team">
          <p className="team-label">Equipo autor</p>
          <ol>
            <li><span>01</span><strong>Mauricio Xavier<br />Loor Garcia</strong></li>
            <li><span>02</span><strong>Erick Sebastian<br />Parra Ulloa</strong></li>
            <li><span>03</span><strong>Silvio Francesco<br />Aliatis Ramirez</strong></li>
          </ol>
          <div className="tutor-line"><span>Tutor académico</span><strong>Ing. Mg. Marco Polo Silva</strong></div>
        </div>
      </section>

      <section className="shell home-section">
        <div className="section-intro"><p className="eyebrow">Cuatro resultados, ninguna exageración</p><h2>La evidencia manda.<br />El lenguaje también.</h2><p>El sistema evita afirmar que detectó un ataque. Una alerta siempre conserva contexto, proveedores, latencias y causas posibles.</p></div>
        <div className="classification-grid"><article className="classification-card consistent"><span>✓</span><h3>Consistente</h3><p>Los canales seguros coinciden y el DNS tradicional intersecta el consenso.</p></article><article className="classification-card warning"><span>!</span><h3>Advertencia</h3><p>La evidencia es parcial, variable entre rondas o presenta diferencias internas.</p></article><article className="classification-card possible"><span>△</span><h3>Posible inconsistencia</h3><p>La separación frente al consenso seguro persiste durante las tres rondas.</p></article><article className="classification-card inconclusive"><span>?</span><h3>No concluyente</h3><p>Faltan respuestas o consenso suficiente para sostener una conclusión.</p></article></div>
      </section>

      <section className="shell vantage-banner"><div><p className="eyebrow">Limitación esencial</p><h2>El punto de observación es el servidor.</h2></div><p>La aplicación no consulta el DNS configurado en el router del visitante. Compara proveedores desde su propia infraestructura y presenta una posible inconsistencia, nunca una confirmación automática de ataque.</p></section>
    </main>
  );
}

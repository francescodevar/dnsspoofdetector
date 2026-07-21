# DNSSpoofDetector

## ¿Qué es?

DNSSpoofDetector es una aplicación web académica para observar si diferentes rutas de resolución DNS entregan resultados compatibles para un mismo dominio. Compara registros IPv4 (`A`) o IPv6 (`AAAA`) mediante DNS tradicional, DNS sobre HTTPS (DoH) y DNS sobre TLS (DoT).

Su propósito es ayudar a identificar diferencias persistentes que merecen investigación. No intercepta tráfico, no modifica la red y no demuestra por sí sola que exista suplantación DNS. Está diseñada como instrumento de medición para una tesis de Sistemas de Información y Ciberseguridad.

> Una posible inconsistencia no confirma un ataque. CDN, geolocalización, balanceo, caché y fallos temporales también pueden producir diferencias.

## Identidad académica

| Dato | Información |
| --- | --- |
| Institución | Instituto Superior Tecnológico Universitario España (ISTE) |
| Carrera | Sistemas de Información y Ciberseguridad |
| Trabajo | *DNSSpoofDetector: Monitor de Consistencia de Resolución DNS con Validación Cruzada sobre DoH/DoT* |
| Autores | Mauricio Xavier Loor Garcia · Erick Sebastian Parra Ulloa · Silvio Francesco Aliatis Ramirez |
| Tutor | Ing. Mg. Marco Polo Silva |
| Lugar y año | Ambato, Ecuador · 2026 |

## ¿Cómo funciona?

1. El usuario escribe un dominio y selecciona un registro `A` o `AAAA`.
2. El servidor ejecuta tres rondas. En cada ronda consulta cinco fuentes en paralelo:
   - DNS tradicional de Cloudflare (`1.1.1.1`).
   - DNS tradicional de Google (`8.8.8.8`).
   - DoH de Cloudflare.
   - DoH de Google.
   - DoT del [servicio de Quad9 sin bloqueo de amenazas](https://docs.quad9.net/services/) (`9.9.9.10`, SNI `dns10.quad9.net`).
3. La aplicación valida las respuestas, normaliza las direcciones IP y elimina duplicados para que el orden de llegada no altere la comparación.
4. Las respuestas cifradas de tres organizaciones independientes —Cloudflare, Google y Quad9— forman el consenso seguro cuando existe una mayoría suficiente.
5. El DNS tradicional se compara con ese consenso en las tres rondas. La persistencia permite distinguir una diferencia ocasional de una señal fuerte.
6. El resultado se presenta con las observaciones originales, latencias, TTL, razones y una puntuación de confianza.

La clasificación final puede ser:

- **Consistente:** los canales seguros coinciden y el DNS tradicional es compatible con el consenso.
- **Advertencia:** hay diferencias parciales, internas o variables entre rondas.
- **Posible inconsistencia DNS:** la separación entre DNS tradicional y consenso seguro persiste durante las tres rondas.
- **No concluyente:** faltan respuestas o consenso suficiente para sostener una conclusión.

Todas las consultas parten del servidor donde está desplegada la aplicación. Por eso describe el punto de observación del servidor, no necesariamente el DNS configurado en el router o dispositivo del visitante.

## Arquitectura

```text
Navegador (formulario, progreso, historial, exportación)
  └─ Server Action analyzeDomain, una invocación por ronda
       └─ Orquestador: cinco proveedores en paralelo
            ├─ DNS: Cloudflare y Google
            ├─ DoH: Cloudflare y Google
            └─ DoT: Quad9 sin bloqueo
  └─ Normalización → consenso → clasificación → razones
```

Las consultas reales se ejecutan en Node.js desde el servidor. El historial permanece en `localStorage`; no existe base de datos, autenticación ni servicio pagado.

## Requisitos

- Node.js 24.x
- npm 11
- Salida UDP/TCP 53, HTTPS 443 y, para DoT, TCP 853

## Instalación y comandos

```bash
npm install
npm run dev
```

Abrir `http://localhost:3000`.

| Comando | Uso |
| --- | --- |
| `npm run dev` | Servidor de desarrollo |
| `npm run build` | Build de producción |
| `npm start` | Ejecutar el build |
| `npm run lint` | ESLint |
| `npm run typecheck` | TypeScript estricto |
| `npm test` | Pruebas unitarias con Vitest |
| `npm run test:e2e` | Playwright |

### Pruebas de red reales

Se omiten por defecto para evitar fallos inestables en CI.

PowerShell:

```powershell
$env:RUN_LIVE_DNS_TESTS='1'; npm test
```

Linux/macOS:

```bash
RUN_LIVE_DNS_TESTS=1 npm test
```

## Variables de entorno

No se requieren secretos ni variables propias. En Vercel se lee opcionalmente `VERCEL_REGION`, proporcionada por la plataforma, para mostrar el punto de observación en Diagnóstico.

## Uso

- **Analizar:** escribe un dominio, elige `A` o `AAAA` y observa el progreso real de tres rondas.
- **Demostración:** permite reproducir las cuatro clasificaciones sin consultas de red. Todos los datos se marcan como simulados.
- **Historial:** guarda hasta 100 análisis en el navegador, filtra, elimina y exporta CSV/JSON.
- **Laboratorio:** ejecuta secuencialmente hasta diez dominios y exporta el lote.
- **Diagnóstico:** comprueba disponibilidad de cada proveedor y confirma si DoT funciona en el entorno.
- **Metodología:** documenta reglas, confianza, falsos positivos y limitaciones.

## Despliegue en Vercel

1. Publicar este repositorio en un proveedor Git.
2. En Vercel, seleccionar **Add New → Project** e importar el repositorio.
3. Mantener el preset automático **Next.js**, el comando `npm run build` y Node.js `24.x`.
4. No añadir variables de entorno ni servicios externos.
5. Desplegar en el plan gratuito Hobby.
6. Abrir `/diagnostico` y ejecutar la comprobación.
7. Confirmar DNS y DoH, y documentar si DoT responde o muestra `timeout`/`unsupported`.
8. Probar un dominio válido con `A` y `AAAA`, el modo demostración, historial y descargas.

El repositorio fija Fluid Compute y la región `iad1` en `vercel.json`. No se debe cambiar a Edge Runtime: `node:dns`, `node:tls` y los sockets DoT requieren Node.js.

## Seguridad y privacidad

- Solo se aceptan dominios; no se aceptan endpoints, IP, puertos, URLs ni credenciales.
- Todos los proveedores están fijados en el servidor.
- Respuestas externas y datos guardados se validan con Zod.
- Los errores mostrados están saneados; no se exponen stacks, rutas ni variables internas.
- CSV protege celdas que podrían ejecutar fórmulas.
- No se guardan datos personales ni se inspecciona el tráfico del visitante.

### Estado de auditoría de dependencias

Al 21 de julio de 2026, `npm audit --omit=dev` informa dos hallazgos moderados del mismo aviso en la copia de PostCSS fijada por Next.js 16.2.11 ([GHSA-qx2v-qp2m-jg93](https://github.com/advisories/GHSA-qx2v-qp2m-jg93)). Next.js 16.2.11 es la versión estable más reciente y el arreglo automático propone un cambio incompatible, por lo que no se aplicó `npm audit fix --force`. En este proyecto PostCSS solo procesa CSS controlado del repositorio durante la compilación; no recibe CSS del usuario. Se debe repetir la auditoría al actualizar Next.js.

## Limitaciones conocidas

- El punto de observación es el servidor, no el router del visitante.
- Las cinco rutas representan tres organizaciones: Cloudflare y Google participan por dos transportes, mientras Quad9 participa mediante DoT. El consenso cifrado sí contiene un observador de cada organización.
- DoT por TCP 853 puede estar bloqueado por el hosting o la red.
- El sistema compara direcciones IP; no valida cadenas DNSSEC ni atribuye IP a ASN/CDN.
- No existe rate limiting persistente. El servidor limita cada análisis a tres rondas y cinco proveedores, pero estas restricciones funcionales no sustituyen un control antiabuso.

## Documentación

- [Arquitectura](docs/architecture.md)
- [Metodología](docs/methodology.md)
- [Protocolo de validación](docs/validation-protocol.md)
- [Alineación con la memoria de tesis](docs/thesis-alignment.md)

## Aviso ético

DNSSpoofDetector analiza consistencia mediante consultas DNS normales. No ejecuta spoofing, no altera servidores o routers, no captura paquetes y no sustituye una investigación forense.

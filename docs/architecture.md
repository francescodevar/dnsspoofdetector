# Arquitectura

## Componentes

- **App Router:** seis páginas y un layout compartido. Solo análisis, historial, laboratorio y diagnóstico hidratan componentes cliente.
- **Server Actions:** `analyzeDomain` valida una ronda y `diagnoseProtocols` prueba una ronda fija contra `example.com`.
- **Orquestador:** consulta cinco proveedores con `Promise.allSettled`; cada adaptador devuelve un `ProviderResult` aunque falle.
- **Núcleo puro:** normaliza, compara, clasifica, calcula confianza y genera razones sin estado global.
- **Navegador:** ensambla tres rondas, guarda un máximo de 100 resultados y genera CSV/JSON.

## Flujo de datos

1. El navegador envía dominio, tipo y número de ronda.
2. La acción convierte IDN a ASCII y rechaza cualquier entrada que no sea un dominio.
3. Dos resolvedores DNS, dos endpoints DoH y un socket DoT se ejecutan en paralelo.
4. Cada respuesta se valida y se convierte en un modelo serializable.
5. Tras tres rondas, el cliente ejecuta el clasificador puro y muestra la evidencia.
6. El usuario decide si guarda o exporta el resultado.

## Decisiones

- Una acción por ronda permite progreso real y evita mantener jobs o memoria servidor en un entorno serverless.
- IPv6 se canonicaliza con la API `URL` de Node; no se añadió otra dependencia.
- Los controles accesibles son HTML nativo; no se instaló un kit de componentes.
- El laboratorio reutiliza el mismo flujo y procesa dominios secuencialmente.
- No se mantienen sockets DoT globales; cada invocación abre, valida y destruye su conexión.

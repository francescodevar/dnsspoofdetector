# Protocolo de validación experimental

## Objetivo

Medir reproducibilidad del clasificador, disponibilidad de protocolos, latencia y proporción de advertencias sobre dominios no manipulados, sin ejecutar ataques reales.

## Escenarios

1. **Fixtures controladas:** ejecutar al menos 30 veces cada una de las cuatro clasificaciones del modo demostración.
2. **Dominio estable:** medir `example.com` con A y AAAA.
3. **Dominios con CDN:** medir `cloudflare.com` y `google.com` en series separadas.
4. **Respuesta negativa:** medir un subdominio aleatorio bajo `.invalid` para verificar NXDOMAIN.
5. **Disponibilidad:** ejecutar Diagnóstico localmente y después desde Vercel.

## Variables controladas

- Región/punto de observación.
- Dominio y tipo de registro.
- Cinco proveedores fijos.
- Tres rondas por análisis.
- Timeout de cinco segundos.
- Fecha y franja horaria de la serie.

## Métricas

- Coincidencia entre etiqueta esperada y obtenida en fixtures.
- Frecuencia de cada clasificación en dominios reales.
- Falsos positivos definidos antes de revisar resultados.
- Mediana y percentil 95 de latencia por proveedor.
- Disponibilidad: respuestas válidas / consultas totales.
- Porcentaje de análisis no concluyentes.

## Evidencia

Exportar cada serie a CSV y JSON. Conservar versión del código, Node.js, región, fecha y condiciones de red. No afirmar objetivos porcentuales hasta calcularlos con los datos obtenidos.

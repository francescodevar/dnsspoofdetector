# Metodología

## Unidad de análisis

Un análisis contiene tres rondas. Cada ronda produce cinco observaciones: dos DNS tradicionales, dos DoH y una DoT. Se comparan por separado registros `A` o `AAAA`.

## Normalización

1. Validar familia IP.
2. Canonicalizar IPv6.
3. Eliminar duplicados y ordenar.
4. Conservar TTL por dirección solo como contexto.
5. Diferenciar respuestas con direcciones, NXDOMAIN, NODATA, timeout, error y unsupported.

## Consenso por ronda

Los canales seguros son DoH y DoT exitosos: Cloudflare DoH, Google DoH y Quad9 DoT sin bloqueo de amenazas. Así, cada observación cifrada pertenece a una organización distinta. El umbral es `floor(n / 2) + 1`. Una dirección pertenece al consenso si alcanza ese umbral. La ronda requiere al menos dos canales seguros y una dirección consensuada.

Un canal seguro exitoso que no comparte ninguna IP con el consenso se considera disenso. Los dos DNS tradicionales se describen como coincidencia, separación, mezcla o no disponibles.

## Clasificación

- **Consistente:** tres rondas elegibles, ambos DNS tradicionales coinciden en cada una y no hay disenso seguro.
- **Posible inconsistencia:** tres rondas elegibles, ambos DNS tradicionales quedan fuera en cada una y no hay disenso seguro.
- **No concluyente:** mayoría de consultas fallidas, menos de dos rondas elegibles o evidencia tradicional insuficiente.
- **Advertencia:** cualquier evidencia suficiente restante.

Las clases fuertes exigen persistencia y respuesta de los dos DNS tradicionales para reducir falsos positivos.

## Confianza

```text
30 % disponibilidad de las 15 consultas
15 % protocolos representados en cada ronda
25 % fuerza del consenso seguro
30 % persistencia de la relación con DNS tradicional
```

Advertencia se limita a 79 y no concluyente a 49. La confianza describe evidencia disponible, no probabilidad de ataque.

## Interpretación

CDN, balanceo geográfico, caché y cambios legítimos pueden producir diferencias. El resultado debe leerse junto con las razones, las rondas y los errores. La herramienta no inspecciona el router del usuario.

# Alineación de la memoria de tesis

La memoria existente describe un prototipo de escritorio en Go/Tauri. La aplicación definitiva es web y mide desde el servidor. Presentar ambos diseños sin corregir el documento produciría una contradicción metodológica.

## Cambios obligatorios antes de la sustentación

| Sección de la memoria | Sustituir |
| --- | --- |
| Resumen y abstract | “aplicación de escritorio”, Go, Tauri y BadgerDB por aplicación web Next.js, historial local y despliegue Vercel |
| Problema | La comparación ya no representa el DNS configurado por el equipo o router del visitante |
| Objetivo general | Implementar una web de consistencia DNS desde un punto de observación servidor |
| Objetivos específicos | Incluir cinco rutas, tres rondas, clasificación explicable, laboratorio y exportación |
| Hipótesis | Medir clasificación de escenarios controlados, falsos positivos, disponibilidad y latencia; no prometer detección de ataques sin datos |
| Variables | Independiente: validación cruzada por protocolos. Dependientes: clasificación, confianza, latencia y disponibilidad |
| Alcance | Eliminar segundo plano, notificaciones, DNS local, CNAME, resolución iterativa y base embebida |
| Arquitectura | Sustituir Go/Tauri por App Router, Server Actions, Node.js y `localStorage` |
| Metodología | Unidad: análisis de 3 rondas × 5 proveedores; añadir región del servidor y fixtures documentales |
| Costos | Mantener costo cero: código abierto y plan Vercel Hobby |
| Resultados | Incorporar exportaciones reales, capturas, resultados de pruebas y limitaciones verificadas |

## Redacción que debe permanecer explícita

> Este análisis compara respuestas obtenidas desde la infraestructura del servidor de la aplicación. Una alerta representa una posible inconsistencia entre proveedores y no confirma por sí sola un ataque o la alteración del router del usuario.

## Revisión académica

Los autores deben acordar con el tutor cualquier cambio de hipótesis o umbral antes de reemplazar el documento oficial. Esta guía no modifica automáticamente el DOCX ni sus citas APA.

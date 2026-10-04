# Bearingworld.io

[![CI](https://github.com/aguillensp-sudo/RinWorld.io/actions/workflows/ci.yml/badge.svg?branch=mvp/bootstrap)](https://github.com/aguillensp-sudo/RinWorld.io/actions/workflows/ci.yml)

**Plataforma B2B para distribuidores de rodamientos industriales.** Búsqueda conversacional
sobre un catálogo común y negociación entre organizaciones con cifrado de extremo a extremo
para precio, cantidad y plazo.

*English, in one line: a B2B platform where bearing distributors search a shared catalogue
through a conversational agent and negotiate prices over end-to-end encrypted threads.*

**Demo:** <https://rin-world-io.vercel.app> (datos de ejemplo, no hay clientes reales).

> El repositorio se llama `RinWorld.io` por herencia del primer prototipo; el producto es
> Bearingworld.io.

## Qué hace

- **VERA, el asistente de búsqueda.** Responde exclusivamente con lo que devuelven sus
  herramientas sobre el catálogo y dice «no tengo ese dato» cuando no lo sabe. Es el riesgo
  principal del producto y se trata como tal (`CLAUDE.md` §7).
- **Mensajería cifrada entre organizaciones.** Precio, cantidad, plazo y transporte viajan
  cifrados; el estado de la oferta y las marcas de tiempo son metadatos en claro. Ninguna
  vista agregada muestra campos cifrados fuera del hilo.
- **Inventario por archivo** (CSV con mapeo de columnas), alta de organizaciones con
  aprobación, panel de administración de la plataforma y cobros.

## Arquitectura

| Capa | Tecnología |
| --- | --- |
| Aplicación | React + TypeScript (Vite), tokens de diseño propios |
| Datos y autenticación | Supabase: Postgres con RLS, Realtime, Edge Functions |
| VERA | Claude Sonnet 4.6 detrás de una Edge Function proxy; la clave nunca llega al navegador |
| Despliegue | Vercel (app) y Supabase (función), automático desde la CI |
| Pruebas | Vitest, Playwright y un banco de pruebas de esquema SQL |

La capa de datos y de cifrado está especificada en `docs/ADR-001` y `docs/ADR-002`.

## Cómo se está construyendo

El proyecto es también un experimento medido: un arnés (`harness/`, grafo LangGraph) genera
las pantallas a partir de los HTML de diseño aprobados con un modelo de bajo coste (el
«Coder»), y las revisa y corrige a mano. Cada corrida queda registrada con su coste, sus
reintentos y cuánto hubo que arreglar a mano (`openspec/mvp/harness-metrics.csv`). El Coder
nunca escribe los tests que lo evalúan.

Los commits distinguen la autoría: lo que sale del Coder va en un commit y las correcciones
a mano en otro, de modo que el diff del segundo mide el trabajo que faltaba.

## Estado

V1 en curso. Hay 18 pantallas construidas por el arnés, 15 de ellas ya aceptadas, y la
aplicación está desplegada. La cifra de pruebas de la última comprobación: **1.710 pruebas
unitarias en verde** (23 omitidas) y más de 140 casos de Playwright. Lo pendiente y lo que no se
sabe están en [`openspec/v1/ESTADO-V1.md`](openspec/v1/ESTADO-V1.md). Se reescribe cada día.

## Arrancar en local

```bash
cd app
npm ci
cp .env.example .env          # URL y clave publicable de un proyecto Supabase propio
npm run dev                   # http://localhost:5173
npm run typecheck && npm test
```

Los tests e2e (`npm run e2e`) necesitan dos cuentas de prueba en el proyecto Supabase; las
variables están descritas en `app/.env.example`. No hay ninguna clave en el repositorio.

## Dónde mirar

| Ruta | Qué contiene |
| --- | --- |
| `app/` | La aplicación (código, tests, e2e) |
| `supabase/` | Migraciones, siembras y tests de esquema |
| `harness/` | El arnés: grafo, tareas del Coder y métricas de corrida |
| `openspec/` | Especificaciones: fuente de verdad del comportamiento. Ver [`openspec/README.md`](openspec/README.md) |
| `docs/` | Decisiones de arquitectura y documentos funcionales |
| `CLAUDE.md` | Las reglas con las que trabajamos con el agente de código |

## Licencia

Todos los derechos reservados. El código se publica para consulta y evaluación; para
cualquier otro uso, escribe al autor.

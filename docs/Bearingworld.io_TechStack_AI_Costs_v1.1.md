**BEARINGWORLD.IO**

**LA PLATAFORMA**

**TECHNOLOGY STACK & AI COST ESTIMATION**

**v1.1 — REVISIÓN: ELIMINACIÓN DEL REPUTATION SERVICE ZKP**

**Sustituido por el sistema de Favoritos (Módulo 03 v1.1)**

Versión 1.1 · Junio 2026 · CONFIDENCIAL

# Nota de Revisión v1.1

Este documento es una revisión específica del Tech Stack & AI Cost Estimation v1.0 (junio 2026). No reescribe el documento completo: se centra exclusivamente en eliminar el Reputation Service basado en pruebas de conocimiento cero (ZK-SNARKs) que el v1.0 especificaba como parte de la arquitectura, y en documentar su sustituto. El resto del stack técnico (capas de cliente, edge/CDN, API Gateway, microservicios de negocio, E2EE, event bus, almacenes de datos, observabilidad/seguridad/DevOps, y el modelo de coste de IA) permanece sin cambios respecto al v1.0 y se reproduce aquí íntegro para mantener un documento de referencia único y actualizado.

|  |
| --- |
| **🔄 CAMBIO DE PRODUCTO QUE MOTIVA ESTA REVISIÓN**  Durante el desarrollo del funcional (Módulo 03 — Búsqueda Conversacional v1.1), se decidió que Bearingworld.io no calculará ninguna puntuación de reputación algorítmica ni verificada criptográficamente en V1. El único indicador social sobre un distribuidor es el sistema de Favoritos: cualquier miembro puede marcar a otra organización como favorita, y el indicador visible es un simple recuento de cuántos miembros distintos lo han hecho. Es un mecanismo exclusivamente manual, sin IA, sin algoritmo, y sin necesidad de ningún componente criptográfico de verificación de transacciones. En consecuencia, todo el trabajo de arquitectura ZK-SNARK (snarkjs, Groth16, circuitos de prueba, Reputation Service) que el Tech Stack v1.0 contemplaba queda eliminado del proyecto. El Módulo 06 — Reputación ZKP, reservado en la hoja de ruta original, queda formalmente descartado y absorbido por la funcionalidad de Favoritos ya especificada en el Módulo 03. |

# 1. Architecture Overview

This document describes the recommended technology stack for the Bearingworld.io platform and provides a detailed cost model for its AI layer. The stack is designed around three non-negotiable constraints derived from the PRD: (1) end-to-end encryption that mathematically guarantees commercial-data privacy, (2) AI-powered workflows that eliminate the manual friction users experience on the incumbent platform today, and (3) a total infrastructure cost envelope of €80–120k/year at steady state to preserve the 65–75% net margin target.

# 2. Technology Stack — Layer by Layer

## Client Layer

Web App — React 18 + Next.js 14 (App Router). SSR for SEO; RSC for lightweight initial load. All cryptographic operations run in the browser via WebCrypto API — private keys never leave the device.

Mobile — React Native. Shared business logic with the web app via a platform-agnostic crypto/state layer. Target iOS 16+ and Android 12+.

CSV Watcher — Electron app (Windows/Mac/Linux) or a lightweight Node.js daemon. Monitors a local/network folder and pushes new stock files to the Ingestion service automatically.

ERP / Direct API — REST + webhook endpoints for distributors who want programmatic inventory updates from their own ERP systems (SAP, Dynamics, custom).

## Edge / CDN

Cloudflare Workers + WAF — All traffic enters through Cloudflare. Workers handle geolocation-based routing, DDoS mitigation, and TLS termination. The WAF ruleset is hardened for the platform’s known attack surface. EU-first routing satisfies GDPR data-residency expectations.

## API Gateway

Kong Gateway (self-hosted on EKS) — JWT validation, rate limiting (per-member and global), request routing to microservices, WebSocket proxy for real-time messaging. Kong chosen over AWS API Gateway for cost predictability at scale and richer plugin ecosystem (OpenID Connect, request transformation).

## Business Services — Node.js / Go on Kubernetes

Identity & Auth — Auth0 or Keycloak (self-hosted for cost control at scale). OIDC + JWT. Handles member registration, MFA, and the public-key distribution needed for E2EE key exchange.

Inventory Service — CRUD for stock lines + visibility rule engine. Enforces per-member, per-category, and bilateral whitelist/blacklist rules before returning any data.

Search Service — Thin orchestration layer over Typesense. Receives queries from the AI Search service, applies visibility filtering, and returns ranked results.

Messaging Service — Implements the Signal Protocol for 1-to-1 E2EE messaging. Stores only ciphertext in MongoDB. WebSocket connections managed via Redis pub/sub.

Logistics Service — Calculates landed cost from member-uploaded freight tariff tables and a pre-loaded reference weight database (SKF, FAG, NSK, NTN, Timken catalogues).

Ingestion Service — Accepts CSV/Excel uploads via HTTP, email attachment, or folder monitor. Passes unknown column structures to the AI CSV Mapper for schema resolution.

|  |
| --- |
| **❌ ELIMINADO v1.1 — REPUTATION SERVICE (ZKP)**  v1.0 description (eliminada): "Reputation Service — Receives transaction-completion events and computes ZKP-verified scores using snarkjs. Price is provably never exposed." Este servicio queda eliminado del stack. No hay ningún microservicio dedicado a reputación en la arquitectura v1.1. El indicador de Favoritos (Módulo 03 v1.1) es una estructura de datos mucho más simple: una tabla de relación member\_id → favorited\_organization\_id, con un recuento agregado expuesto por el propio Inventory Service o el Search Service al renderizar resultados — no requiere un microservicio propio, ni colas de eventos dedicadas, ni ningún componente criptográfico. |

Alerts Service — Evaluates standing watcher conditions (e.g. ‘100+ units of 6205 2RS in Spain’) against every stock.updated Kafka event. Pushes notifications via FCM/APNs/email.

Billing Service — Stripe integration for member subscriptions to the platform (annual fee). Handles trial periods, dunning, and invoicing. NOTA v1.1: este servicio gestiona exclusivamente el cobro de la suscripción anual del miembro a Bearingworld.io. Por declaración de principio de la plataforma (Módulo 04 v1.1, RNG-MSG-08), Bearingworld.io no procesa pagos ni transacciones financieras entre miembros en ninguna versión — este servicio no gestiona, ni gestionará, pagos entre distribuidores.

## E2EE / Zero-Knowledge Core

Signal Protocol (libsodium) — X25519 ECDH for key agreement; XSalsa20-Poly1305 for authenticated encryption. Implemented via libsodium.js in browsers and react-native-sodium on mobile. This is the same cryptographic foundation as Signal and WhatsApp.

Key Management — Private keys are derived from a user passphrase using Argon2id and stored encrypted in the browser’s IndexedDB. An optional encrypted cloud backup (key wrapped with AES-256-GCM, passphrase-derived) follows the WhatsApp/iCloud model. AWS KMS or HashiCorp Vault for server-side keys (webhook signing, backup encryption).

|  |
| --- |
| **❌ ELIMINADO v1.1 — ZK-SNARK REPUTATION**  v1.0 description (eliminada): "ZK-SNARK Reputation — snarkjs + Groth16 proving system. Circuits prove: transaction completed (yes/no), response time (ms bucket), buyer confirmation (bool) — without revealing price or quantity. Proof generation runs client-side; verification is server-side and logged to PostgreSQL." Todo este bloque criptográfico queda eliminado. El core E2EE de la plataforma (Signal Protocol + Key Management, descritos arriba) permanece intacto y sin cambios — la eliminación afecta exclusivamente al componente de prueba de conocimiento cero para reputación, no al cifrado de mensajes ni de claves. |

Critical design decision — If a member loses their passphrase and has no cloud backup, their message history is permanently inaccessible. This must be communicated clearly at onboarding and the cloud-backup flow must be prominent — not an afterthought.

## Event Bus — Apache Kafka (AWS MSK)

Key topics — stock.updated · message.sent · transaction.completed · alert.triggered · ingestion.completed · user.action (analytics). Kafka decouples the Inventory, Search, Alerts, and Analytics services so each can scale independently. MSK Serverless keeps ops overhead near zero at the current scale.

|  |
| --- |
| **ℹ️ NOTA v1.1 — TOPIC LIST**  v1.0 incluía el servicio "Reputation" entre los consumidores desacoplados por Kafka. Al eliminarse ese servicio, la lista de servicios desacoplados queda como se muestra arriba (Inventory, Search, Alerts, Analytics). El topic transaction.completed se mantiene — sigue siendo útil como señal de actividad general y para futuras métricas de uso, aunque ya no alimenta a un Reputation Service. |

## Data Stores

PostgreSQL (AWS RDS Aurora) — Users, organisations, visibility rules, favourites, billing records. Aurora Multi-AZ for HA; read replicas for analytics queries. NOTA v1.1: "reputation scores" y "ZKP logs" (presentes en v1.0) se eliminan de este almacén; "favourites" (la tabla de relación de Favoritos, Módulo 03 v1.1) ocupa su lugar como única estructura de datos social de la plataforma.

MongoDB Atlas — Encrypted message documents (ciphertext blobs + metadata). Schema-free suits the variable structure of E2EE payloads.

Typesense (self-hosted on EKS) — Full-text and prefix search index for stock lines. ~18M documents at incumbent parity. Chosen over Elasticsearch for 10× faster prefix search and dramatically lower operational complexity.

Redis (AWS ElastiCache) — Session store, WebSocket connection state, pub/sub for real-time message delivery, short-TTL search cache.

S3 / Cloudflare R2 — Raw CSV uploads, encrypted backups, freight tariff files. R2 has zero egress costs — preferred for files frequently read by Lambda/ECS jobs.

## Observability · Security · DevOps

Observability — OpenTelemetry SDK in all services → Grafana Cloud (metrics + traces + logs). Sentry for frontend error tracking. PagerDuty for on-call escalation.

Security — Annual third-party penetration test. Independent cryptographic audit of E2EE implementation before GA launch. SOC 2 Type II certification roadmap (Year 2). Responsible disclosure programme from day one.

DevOps — Terraform IaC for all cloud resources. GitHub Actions CI/CD with mandatory security scanning (Snyk, Trivy). Blue/green deployments on EKS.

# 3. AI Cost Estimation

The PRD explicitly defers AI cost analysis. This section provides a bottom-up model based on the platform’s AI use cases, their expected usage patterns, and current API pricing. All figures are in EUR and assume the Base Case trajectory from the PRD (700 members by end of Year 2). A Conservative (300 members) and Growth (1,200 members) scenario are also shown. Este modelo de coste no se ve afectado por la eliminación del Reputation Service ZKP — la generación de pruebas ZK-SNARK no consumía tokens de modelos de lenguaje, por lo que no había una línea de coste de IA asociada a reputación en v1.0 que ajustar aquí.

## 3.1 Usage Assumptions per Member per Month

| **AI Use Case** | **Activity driver** | **Avg. tokens IN** | **Avg. tokens OUT** | **Monthly calls/member** |
| --- | --- | --- | --- | --- |
| Conversational search | ~8 search sessions/day × 22 working days | ~300 | ~600 | 176 |
| Batch search (lists) | ~3 batch queries/day (avg 12 refs each) | ~800 | ~1,200 | 66 |
| CSV column mapping | ~2 uploads/week, ~20% need AI mapping | ~500 | ~200 | 1.7 |
| Cross-reference AI | ~5 cross-ref lookups/day (Year 2+) | ~150 | ~200 | 110 |
| Preference learning | Background inference, batch nightly | ~400 | ~100 | 30 |

Note: Cross-reference AI is a Phase 4 feature (Month 12+). Costs shown for Year 2 base case include it at 50% of full activation.

## 3.2 Per-Use-Case Monthly Cost Model — GPT-4o (gpt-4o-2024-08-06)

Recommended primary model: GPT-4o. Pricing: $2.50 / 1M input tokens, $10.00 / 1M output tokens. Exchange rate assumed: $1 = €0.93. A 15% volume discount is applied from Month 9 onwards (typical enterprise tier). CSV mapping and preference learning use GPT-4o-mini ($0.15 / $0.60 per 1M tokens) — these tasks are classification and do not require frontier reasoning.

| **Use Case** | **Model** | **Monthly tokens IN (700 mbr)** | **Monthly tokens OUT (700 mbr)** | **Monthly cost (€)** |
| --- | --- | --- | --- | --- |
| Conversational search | GPT-4o | 37.0M | 74.0M | €776 |
| Batch search | GPT-4o | 36.8M | 55.4M | €601 |
| CSV column mapping | GPT-4o-mini | 0.6M | 0.2M | €1 |
| Cross-reference (50% act.) | GPT-4o | 19.3M | 25.7M | €284 |
| Preference learning | GPT-4o-mini | 8.4M | 2.1M | €13 |
| **Total (Base Case, 700 mbr)** | — | **102.1M** | **157.4M** | **€1,675/mo** |

## 3.3 Annual AI Cost by Scenario

| **Scenario** | **Members** | **Annual revenue (PRD)** | **Annual AI cost** | **AI cost as % revenue** | **AI cost per member/yr** |
| --- | --- | --- | --- | --- | --- |
| Conservative — Year 1 | 300 | €255,000 | €8,600 | 3.4% | €29 |
| Base Case — Year 2 | 700 | €595,000 | €20,100 | 3.4% | €29 |
| Growth — Year 3 | 1,200 | €1,080,000 | €36,800 | 3.4% | €31 |
| Mature — Year 4–5 | 2,000 | €1,900,000 | €63,000 | 3.3% | €32 |

Key finding: AI cost stabilises at approximately 3.3–3.4% of revenue across all scenarios. This is structurally linear because both revenue and AI usage scale with member count. The AI cost per member per year (~€29–32) is comfortably below any reasonable threshold and does not threaten the 65–75% net margin target. It can be treated as a fixed line in the unit economics: ~€30 AI cost per member per year, fully covered by the €850–950 subscription price.

## 3.4 Pricing Implications and the AI Cost Floor

The PRD states the subscription price should be set 50–60% below the incumbent (~€500–625/yr) after a full cost analysis. This model shows that even at the most aggressive price point (€500/yr), AI cost represents only 6% of revenue per member — well within acceptable range. The binding constraint on minimum price is not AI cost but total infrastructure amortisation and the sales/onboarding cost to acquire the first 300 members.

| **Subscription price scenario** | **Revenue at 700 mbr** | **AI cost** | **Infra cost (est.)** | **Gross margin after AI+Infra** |
| --- | --- | --- | --- | --- |
| €500/yr (aggressive) | €350,000 | €20,100 | €100,000 | 65.7% |
| €700/yr (conservative) | €490,000 | €20,100 | €100,000 | 74.3% |
| €850/yr (PRD base) | €595,000 | €20,100 | €100,000 | 79.0% |

Recommendation: set launch price at €700–750/yr. This delivers 40% savings vs the incumbent, preserves a ~74% gross margin after AI and infrastructure, and leaves headroom to absorb higher-than-modelled AI usage during the trial period when usage patterns are still unknown.

## 3.5 AI Cost Reduction Roadmap

At 2,000 members the platform will process ~290M input tokens and ~450M output tokens per month. At that scale, model fine-tuning and hosting shift the economics significantly:

| **Milestone** | **Action** | **Expected cost impact** |
| --- | --- | --- |
| Month 6–9 | Prompt caching for search (OpenAI Prompt Caching). System prompt + stock schema is static per query; caching reduces input token cost by ~50% on cached portions. | –25 to –35% on search cost |
| Month 9–12 | Fine-tune a smaller model (GPT-4o-mini or open-source Qwen-2.5) on accumulated search query / result pairs. Replace GPT-4o for the conversational search use case. | –60 to –75% on search cost |
| Year 2 | Self-host a fine-tuned open-source model (Qwen-2.5-7B or Llama 3.1-8B) on a dedicated GPU instance (A10G, ~$1.50/hr). At 700+ members the inference volume justifies dedicated capacity. | –70 to –80% vs GPT-4o API; break-even at ~500 active members |
| Year 3+ | Domain-specific embedding model for cross-reference (bearing part numbers have a highly structured namespace). Trained on manufacturer catalogue data; eliminates LLM calls for the cross-reference use case entirely. | Eliminates cross-reference LLM cost (~€500/mo at maturity) |

# 4. Open Technical Risks

| **Severidad** | **Riesgo** | **Descripción** |
| --- | --- | --- |
| **CRITICAL** | Private key recovery UX | If a member loses their passphrase and has no cloud backup, their E2EE history is permanently inaccessible. The cloud-backup flow (key wrapped with passphrase, stored in S3) must be designed before GA and must be prominent — not optional fine print. This is the single biggest support risk. |
| **HIGH** | AI usage variance in trial period | The cost model assumes average usage. During the free trial, members may explore the platform more intensively. Budget a 3× multiplier on AI costs for the trial cohort (~€5k buffer). |
| **MEDIUM** | Typesense index rebuild time | At 18M+ stock lines, a full Typesense index rebuild (e.g. after a schema change) takes 2–4 hours. Design the ingestion pipeline to support incremental updates from day one, and maintain a warm replica for zero-downtime rebuilds. |
| **MEDIUM** | GDPR / DORA compliance | The E2EE architecture makes it technically impossible to comply with a data access request for message content — because the platform cannot decrypt it. This is a feature, not a bug, but legal counsel must confirm the GDPR posture before launch. DORA (EU Digital Operational Resilience Act) applies if the platform is used by entities classified as financial undertakings. |

|  |
| --- |
| **❌ RIESGO ELIMINADO v1.1 — ZKP PROVING TIME ON MOBILE**  v1.0 incluía un riesgo MEDIUM: "snarkjs Groth16 proofs take 800ms–2s on a mid-range mobile device... Proof generation must be fully off the main thread." Este riesgo desaparece del todo al eliminarse el componente ZK-SNARK — no hay generación de pruebas criptográficas en el cliente móvil ni en ningún otro cliente. |

This document is confidential and intended solely for the internal development team. AI cost figures are based on OpenAI public pricing as of June 2026 and are subject to change. All revenue projections are from the PRD v1.0.

# Historial de Versiones

| **Versión** | **Fecha** | **Autor** | **Descripción** |
| --- | --- | --- | --- |
| 1.0 | Junio 2026 | Equipo de Producto | Versión inicial. Stack técnico completo y modelo de coste de IA por escenario. |
| 1.1 | Junio 2026 | Equipo de Producto | Eliminación completa del Reputation Service y del componente ZK-SNARK (snarkjs/Groth16), sustituidos por el sistema de Favoritos (Módulo 03 v1.1) — exclusivamente manual, sin componente criptográfico ni microservicio dedicado. El Módulo 06 — Reputación ZKP de la hoja de ruta original queda formalmente descartado. Eliminado el riesgo "ZKP proving time on mobile". Actualizada la descripción del Billing Service para aclarar que gestiona únicamente la suscripción del miembro a la plataforma, nunca pagos entre miembros (coherente con RNG-MSG-08, Módulo 04 v1.1). Resto del stack técnico y del modelo de coste de IA sin cambios respecto a v1.0. |

|  |
| --- |
| **📄 DOCUMENTOS DE REFERENCIA**  PRD v1.0 | Módulo 00 — Arquitectura IA v1.1 | Módulo 01 — Onboarding v1.4 | Módulo 02 — Gestión de Inventario v1.2 | Módulo 03 — Búsqueda Conversacional v1.3 (sección 4.4, sistema de Favoritos) | Módulo 04 — Mensajería E2EE v1.3 (RNG-MSG-08, no procesamiento de pagos) |
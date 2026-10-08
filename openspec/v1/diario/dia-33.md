# Día 33 de V1 · 8-oct-2026

## INV-04, fase 0 (AWS + Arsys), hecha por el PO guiado en el chat

- Cuenta AWS `2263-9540-1132`: **miembro de una organización**, acceso por rol federado (`AccountFullAccessRole`). No hay usuario raíz ni IAM de día a día que crear aquí.
- SES en **eu-west-1**. El menú muestra «Recepción de correo electrónico» y todo «Administrador de correo electrónico» (Mail Manager): la región sirve.
- Identidad de dominio `ingest.nortexsys.com` (Easy DKIM, RSA 2048, sin MAIL FROM, sin Route 53): **Verificada** (visto por el PO en la consola).
- Arsys, entradas nuevas (nada existente tocado; no había `ingest*`): 3 CNAME `<token>._domainkey.ingest.nortexsys.com` → `<token>.dkim.amazonses.com`,
  y MX 10 `ingest.nortexsys.com` → `inbound-smtp.eu-west-1.amazonaws.com`. El nombre se acepta **completo**; relativo daba «el nombre debe ser el dominio o un subdominio».
- Comprobado con `Resolve-DnsName -Server 8.8.8.8`: los 3 CNAME y el MX resuelven; el MX de `nortexsys.com` sigue `mx.serviciodecorreo.es`.
- No se puso el TXT de DMARC de `ingest` (no hace falta: solo se recibe).
- El asistente de primer uso creó además la identidad `alvaro.guillen@nortexsys.com` (verificada). Inofensiva.

## Elección de recepción

El MX es el de la recepción **clásica** de SES (regla → S3 + SNS), la que describe el plan. Mail Manager usa otro punto de entrada; no se ha elegido ni se necesita.

## Sin hacer

MFA y presupuesto de 5 USD: no se han visto ni hecho (cuenta de organización; ver `ESTADO-V1.md` §3.2). El conector `AWS MCP` no se usó.
Siguiente: fase 1 del plan (base en Supabase, sin AWS).

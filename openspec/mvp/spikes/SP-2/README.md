# SP-2 · ¿Cifra el navegador?

**Material de evaluación, NO código del MVP.** Página HTML suelta, sin framework. Comprueba si el
navegador cifra de forma nativa un objeto de oferta extremo a extremo:

1. **Primero** detecta soporte nativo de **X25519** (lo que exige `ADR-001`) vía
   `crypto.subtle.generateKey({name:"X25519"}, true, ["deriveKey"])`.
2. Si hay X25519 → lo usa (alineado con ADR-001). Si no → cae a **ECDH P-256** (soporte universal)
   y hay que registrarlo como `SPEC-GAP` (evidencia directa para **GAP-001**).
3. Genera dos pares de claves (comprador y vendedor), deriva el secreto compartido por ECDH, y
   cifra la oferta con **AES-256-GCM**.
4. Vista de **tres columnas**: claro · cifrado (lo que iría a Postgres) · descifrado por la otra
   parte. Esa vista es el prototipo del panel de vista-servidor del día 11 — no se tira.

## Ejecutar

Necesita contexto seguro (`crypto.subtle` no existe en `file://` en todos los navegadores), así que
se sirve por `localhost`:

```bash
python -m http.server 5252 --directory openspec/mvp/spikes/SP-2
# abrir http://localhost:5252/  en el navegador
```

El resultado queda en `window.__SP2_RESULT__` (verificable por texto, sin capturas repetidas).

## Regla no negociable

Las claves viven **solo en memoria de sesión** y se pierden al recargar. El spike **no** implementa
passphrase, backup, recuperación ni rotación de claves. No confundir con una implementación de
ADR-001.

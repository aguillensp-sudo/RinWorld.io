# Spec de Pantalla — `INV-04` · Configuración del Canal Email

---

## 1. Identificación

| Campo | Valor |
|---|---|
| Código | INV-04 |
| Nombre | Configuración del Canal Email de Ingestión |
| Módulo | 02 — Gestión de Inventario |
| Referencia funcional | Inventario Maestro de Pantallas v1.1 § 3.4 · Módulo 02 v1.3 § 4 |

---

## 2. Layout

**Variante:** Shell completo — brand bar + nav bar + sidebar overlay + contenido (67%) + VERA (33%).

- Ítem activo en nav: **Inventario**
- Accesible desde INV-01 → ajustes de canal de subida, o desde Configuración → Inventario

---

## 3. Panel de contenido

### Eyebrow
```
Módulo 02 · Gestión de Inventario
```

### Título de la pantalla
```
Canal de ingestión por email
```

### Subtítulo
```
Envía tu archivo de inventario directamente por email a tu dirección única de ingestión. El sistema lo procesará automáticamente.
```

---

### Componentes presentes

**Bloque de dirección de ingestión**

Muestra la dirección de email única de la organización:

```
ingest-a3f7k9@ingest.bearingworld.io
```

- Campo de solo lectura con botón `Copiar`
- Bloque brass informativo: `Esta dirección acepta archivos CSV, XLSX, XLS, TSV y TXT adjuntos. Tamaño máximo 50 MB.`
- Botón secundario (texto plano): `Rotar dirección` — genera una nueva dirección y anula la anterior inmediatamente

**Modal de confirmación de rotación:**
- Título: `¿Seguro que quieres rotar la dirección?`
- Texto: `La dirección actual quedará anulada de forma inmediata. Cualquier sistema que la use deberá actualizarse.`
- Botón: `Sí, rotar` (primario) + `Cancelar`

**Whitelist de remitentes autorizados**

Lista editable de emails autorizados para enviar archivos a la dirección de ingestión. El email del administrador aparece por defecto y no se puede eliminar.

| Campo | Tipo | Obligatorio | Validación |
|---|---|---|---|
| Email del remitente | email | S (mín. 1) | Formato email válido · no puede estar vacía la lista |

Acciones por fila: `Eliminar` (icono papelera) — deshabilitado para el email del administrador.

Botón inline: `+ Añadir remitente` → abre input inline para introducir nuevo email.

Field hint bajo la lista: `EMAILS QUE NO ESTAN EN LA LISTA SE RECHAZAN SILENCIOSAMENTE POR NUESTRO SISTEMA`

**Historial de ingestiones (tabla de solo lectura)**

Últimas 10 ingestiones recibidas:

| Columna | Descripción |
|---|---|
| Fecha y hora | Timestamp de recepción |
| Remitente | Email que envió el archivo |
| Archivo | Nombre del archivo adjunto |
| Resultado | Procesado con éxito · Rechazado · Error |
| Filas importadas | Número de líneas publicadas |

---

### Datos de ejemplo

```
Dirección: ingest-a3f7k9@ingest.bearingworld.io

Whitelist:
  juan.martinez@rodamientosdelsur.es [Administrador — no eliminable]
  erp@rodamientosdelsur.es

Historial (últimas 3):
  Hace 2 días  · erp@rodamientosdelsur.es · inventario_jun.xlsx · Procesado · 1.247 filas
  Hace 9 días  · erp@rodamientosdelsur.es · inventario_may.xlsx · Procesado · 1.201 filas
  Hace 16 días · unknown@spam.com         · —                   · Rechazado · —
```

---

## 4. Formulario

| Nº | Campo | Tipo | Oblig. | Placeholder | Field hint | Validación |
|----|---|---|---|---|---|---|
| 1 | Email del remitente (whitelist) | email | S | `email@empresa.com` | `Emails que no estén en la lista serán rechazados silenciosamente` | Formato email |

---

## 5. Panel VERA

**Subtítulo:** `Agente de inventario`

**Conversación tipo:**

> **VERA dice:**
> Tu dirección de ingestión acepta archivos de inventario enviados por email. Solo los remitentes de tu whitelist pueden usarla — el resto se rechaza sin aviso.
>
> **Usuario dice:**
> ¿Puedo añadir el email de mi ERP?
>
> **VERA responde:**
> Sí, añádelo a la whitelist. Una vez añadido, tu ERP podrá enviar archivos directamente a la dirección de ingestión y se procesarán automáticamente sin intervención manual.

---

## 6. Estados especiales

**Rotación ejecutada:**
- La nueva dirección aparece inmediatamente en el bloque
- VERA confirma: `Dirección rotada. La anterior ya no es válida — actualiza cualquier sistema que la estuviera usando.`

**Ingestión rechazada (remitente no en whitelist):**
- Aparece en el historial como `Rechazado`
- VERA puede notificar si el usuario está en la pantalla

---

## 7. Notas y excepciones al sistema base

- La dirección de ingestión es única por organización, no por usuario.
- La rotación es irreversible e inmediata — la dirección anterior deja de funcionar en el mismo momento.
- Los archivos raw recibidos se almacenan en S3/R2 durante 30 días para auditoría y se purgan automáticamente.

---

## 8. Prioridad de construcción

- [ ] **Media**

---

*Spec INV-04 · v1.0 · Bearingworld.io · Junio 2026*
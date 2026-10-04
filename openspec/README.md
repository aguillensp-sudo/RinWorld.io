# `openspec/` — especificaciones y registro de proceso

Este directorio es la fuente de verdad del comportamiento del producto (Spec-Driven
Development con OpenSpec) y, además, el cuaderno de trabajo del proyecto. Si solo quieres
entender el producto, lee primero el [README raíz](../README.md) y las specs; el resto es
trazabilidad.

| Ruta | Qué es | ¿Hace falta leerlo? |
| --- | --- | --- |
| `specs/` | Nueve capacidades cerradas, escritas como GIVEN/WHEN/THEN. Solo lectura | **Sí**, es el contrato |
| `architecture/` | ADR-001 (cifrado y copia de claves) y el sistema de diseño | Para criptografía y UI |
| `design-gui/` | HTML de diseño aprobados que sirven la demo de prototipos y de los que parte el arnés | Para ver el diseño |
| `v1/` | Fase actual: [`ESTADO-V1.md`](v1/ESTADO-V1.md) (el relevo del día), decisiones, planes y `diario/` | `ESTADO-V1.md` y `DECISIONES-V1.md` |
| `mvp/` | El MVP cerrado el 18-ago-2026: plan, cierre, métricas del arnés y el registro de hallazgos | `CIERRE-MVP.md` |
| `mvp/findings/` | Un fichero por hallazgo (`F-NNN`): lo que falló, por qué y cómo se cerró. Se consulta por identificador desde `mvp/findings-register.md` | Opcional |
| `v1/diario/` | Un fichero por día de trabajo en V1 | Opcional |
| `changes/` | Propuestas de cambio en curso | Opcional |

El registro de hallazgos y el diario son deliberadamente verbosos: documentan cada decisión,
cada fallo del arnés y cada corrección a mano, porque medir qué produce el arnés es uno de los
objetivos del proyecto.

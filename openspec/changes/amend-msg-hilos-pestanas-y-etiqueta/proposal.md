# Change: amend-msg-hilos-pestanas-y-etiqueta

**Estado:** propuesto, sin archivar. `openspec/specs/` no se edita (CLAUDE.md §1.3); este change es el contrato nuevo.
Fuente funcional: `docs/Cambios_Frontend_Hilos.md` (PO), apartado «Acuerdos», cerrado el 14-nov-2026
(`DECISIONES-V1.md`, fila del 14-nov-2026).

## Por qué

Con la base poblada de hilos, consultas y ofertas simulados, la pantalla del hilo (MSG-02 con las dos tablas de
MSG-03 v1.2) resulta confusa. Cada consulta y la oferta que la responde salen en las dos tablas con la misma
referencia. Las columnas Organización y País no aportan nada en un hilo de dos partes. Y los mensajes libres no
dicen de qué referencia hablan: la base lo impide (`thread_items_shape_chk`, `0020`: un `MENSAJE` lleva
`part_number` y `brand` a `NULL`), así que no hay forma de recuperar lo que se habló de un rodamiento concreto.

## Qué cambia

- **CONVERSACIÓN.** Es la lista de hilos actual (MSG-01) y la pantalla por defecto de Hilos.
- **Accesos.** Panel (cajón Hilos) e Hilos llevan a CONVERSACIÓN. Vendiendo (Ver hilo, Ver acuerdo), Comprando
  (Contactar) y Empresas (tarjeta o Contactar) llevan al hilo de esa empresa.
- **Hilo de una empresa con tres pestañas:** Mensajes · Soy cliente · Soy proveedor.
  - **Mensajes:** el más reciente arriba, con el campo de escribir encima.
  - **Soy cliente:** las ofertas que me hacen; más mis consultas sin respuesta (ESPERANDO OFERTA) y las que el
    proveedor marcó SIN STOCK.
  - **Soy proveedor:** lo que yo oferto; más las consultas que me hacen y aún no he respondido, con la fila vacía.
- **Tablas.** Una fila por referencia (part_number + brand) con la última versión de la negociación: las
  contraofertas no crean filas. Mismas columnas en las dos: Referencia + Marca, Cantidad, Precio, Estado, Fecha,
  Plazo, Transporte, Válida hasta, Acciones. Sin Organización ni País. Las notas se ven al pasar el ratón. Filtros
  combinables por columna, salvo Acciones. Orden por defecto, lo más reciente arriba; reordenable por cabecera.
- **Estados por papel**, no por tipo de elemento (ver la spec).
- **Etiqueta de referencia en los mensajes.** Cada `MENSAJE` puede llevar una referencia de las que existen en el
  hilo, o ninguna (conversación general). Es la referencia elegida en el buscador del hilo; sin búsqueda,
  conversación general (PO, 17-nov-2026: el selector «Sobre:» se quitó porque duplicaba el buscador). El autor puede cambiarla después. Va en claro, como ya va en consultas y
  ofertas; el texto sigue cifrado.
- **Búsqueda en el hilo** por etiqueta: lista de referencias del hilo que casan con lo escrito, se elige una, y la
  pestaña Mensajes se filtra a esa referencia hasta que se quita el filtro.

## Qué no cambia

- **Modelo de datos de consulta y oferta:** `inquiry-card`, `offer-card`, sus estados en base, contraoferta y
  quién decide (`offerActions`, F-051, F-056).
- **Ciclo de vida del hilo** (`thread-lifecycle`): estados, cerrar sin acuerdo, revertir, reabrir al escribir.
- **E2EE:** precio, cantidad, plazo, transporte, validez y notas siguen cifrados. Filtrar y ordenar esas columnas
  se hace en el navegador, sobre lo descifrado.
- **Un hilo por par de organizaciones.**

## Qué sustituye

- MSG-03 v1.2: las dos tablas Consultas y Ofertas, con sus columnas Organización y País.
- `single-thread-model`, escenario «mezcla cronológica»: el historial único deja de mezclar los tres tipos;
  los mensajes van en su pestaña y consultas y ofertas en las tablas.
- La regla de base que obliga a que un `MENSAJE` no lleve referencia (`thread_items_shape_chk`).

## Fuera de este change

- **El HTML aprobado de MSG-02 y MSG-03.** No se edita (§1.3). Si hace falta prototipo nuevo, va aparte.
- **VERA.** Su prompt y sus herramientas nombran Consultas y Ofertas; se adaptan en una tarea propia, sin cambiar
  qué datos devuelve.

## Resuelto (PO, 15-nov-2026)

- El ítem de navegación sigue siendo **Hilos**.
- Los accesos son los de la tabla del PO: se abre el hilo de esa empresa, por su primera pestaña (Mensajes).

## Pendiente

- Cuando VERA prepara una consulta o una oferta dentro del hilo, qué pestaña se abre. Pendiente por decisión del PO.

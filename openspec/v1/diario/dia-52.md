# Día 52 · 18-nov-2026

Cierre del change `amend-msg-hilos-pestanas-y-etiqueta` (tareas 5.2, 2.9, 4.5, 5.1, 6.1 y 6.2). Todo a mano, por
Claude Code; nada pasó por el arnés. El relevo no se reescribía desde el 3-nov: el trabajo de los días 14 a 17 de
noviembre (migraciones `0080` y `0081`, contrato, corrida del arnés y las dos C5 del PO) está en el change y en sus
commits, no en un diario.

- **5.2 · VERA y los mensajes etiquetados (`f92e506`).** Ninguna herramienta filtraba por `part_number is null`. La
  única que lee el hilo, `listar_mis_hilos`, pintaba un `MENSAJE` con etiqueta como «MENSAJE sobre 6205-2RS», con la
  misma forma que una consulta o una oferta: con eso el modelo tenía todo para contar una negociación que no existe
  (riesgo #1). Ahora dice «etiquetado con … (conversación sobre esa referencia, no es consulta ni oferta)», y la
  descripción de la herramienta en `tools.json` lo repite. Test con un mensaje etiquetado y otro sin etiqueta.
- **5.2 · La guía de Hilos del prompt.** Citaba la pantalla de MSG-03 v1.2 (tablas «Consultas» y «Ofertas»,
  historial, estados PENDIENTE/RESPONDIDA/SUPERADA). Reescrita en el bloque estático con las tres pestañas, la
  tabla por papel (columnas, orden, filtros, estados de cada papel, acciones), el buscador y la etiqueta.
  `vera-prompt.test.ts` ata cada cita a `negotiation-rows.ts`, `NegotiationTable`, `MessagesTimeline` y `Thread`, y
  prohíbe que vuelva la guía vieja. Sigue habiendo un solo `cache_control`.
- **5.2 · VERA prepara en Mensajes (decisión del PO del 18-nov).** Al abrir el hilo ya se está en Mensajes, pero si
  el usuario estaba en Soy cliente o Soy proveedor cuando VERA preparaba, el pie no estaba montado y el borrador
  esperaba a que volviera a Mensajes. `Thread` vuelve a Mensajes al llegar un borrador, sin prop de pestaña. Test
  en `Thread.fuera-de-contrato.test.tsx`, rojo comprobado quitando el cambio.
- **2.9 y 4.5 · Retirada (`98ccf07`).** Fuera `negotiation-tables.ts`, `InquiriesTable`, `OffersTable` y
  `ThreadHistory`, con sus tests y su CSS (2.702 líneas). Vendiendo no los usaba. Lo vivo (textos de botones,
  `Cifrado`, `—`, tonos, formato de cifras) pasó a `negotiation-rows.ts`; se añadió la prueba del transporte no
  informado, que solo tenía el test retirado. En `NegotiationTable.tsx` (artefacto del Coder) cambia 1 línea de
  import, anotada en `harness-review.csv`. La matriz re-apunta `e2ee-content-encryption#2` y `offer-card#6`-`#8`.
  La tabla nueva no pinta el aviso «Esta oferta ha expirado» de MSG-03: lo dice el estado EXPIRADA (nota en
  `offer-card#8`).
- **5.1 · Accesos, contra el código.** Vendiendo (Ver hilo, Ver acuerdo), Comprando (Contactar) y el Contactar de la
  ficha de Empresas montan el hilo, que arranca en Mensajes; Panel (cajón Hilos) y el menú pasan por `navigate`, que
  cierra el hilo y deja la lista. Duda para el PO: su tabla dice «Empresas (tarjeta de Empresa/botón Contactar)»; hoy
  pulsar una empresa en el Directorio abre su ficha, y es el Contactar de la ficha el que abre el hilo.
- **Un tropiezo con `git-ops`:** se negó a commitear 2.9 porque el diff tocaba un fichero del Coder. No era un
  commit mixto (el artefacto está en `a2990ea`; la línea es a mano). Se le aclaró y siguió.

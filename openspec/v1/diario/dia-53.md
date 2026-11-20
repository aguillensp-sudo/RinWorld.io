# Día 53 · 18 a 20-nov-2026

Tras el cierre del día 52 (mañana del 18-nov), el PO siguió probando en producción y fue pidiendo cambios
uno a uno. Todo a mano, por Claude Code; nada pasó por el arnés. Cada cambio: pruebas en rojo primero, CI
en verde, despliegue y comprobación en la URL por contenido (`F-168`). Seis commits de código y uno de
documentación, todos con la CI en verde.

- **Pruebas a mano de VERA (`fe9516d`).** Antes de aprobar el change, el PO pidió un juego de pruebas para
  VERA: `openspec/v1/vera-pruebas-hilos-pestanas.md`, 26 casos en cuatro bloques (mensajes etiquetados en
  `listar_mis_hilos`, la guía nueva, preparar en Mensajes y regresión), con los datos sacados de producción.
  El PO las pasó con Sonnet 5 real: todas bien.
- **F-285 · VERA no sabía con qué empresa era el hilo abierto (`664aeee`).** Con el hilo de Levante en
  pantalla, VERA hablaba del de Julsa: al proxy solo le llegaba `hiloAbierto: true`, y el modelo sacaba la
  empresa de la conversación. `Thread` avisa del nombre al cargar, `App` lo manda como `hiloCon` al bloque
  dinámico y como `threadCounterparty` a las herramientas, y el retorno de preparar nombra la empresa. El
  bloque estático no cambia (caché). Clasificado `DESIGN`, mismo patrón que `F-101` y `F-258`.
- **Texto de ayuda del campo de escribir (`1dafed3`, PO).** Sin referencia buscada, lo escrito es
  conversación general aunque el último mensaje lleve etiqueta, y el usuario podía creer que iba etiquetado.
  Ahora el campo dice «Escribe sobre REF: el mensaje irá etiquetado con esta referencia» o «Inicia una
  conversación nueva, sin referencia (para escribir sobre una, búscala arriba)». El nombre accesible sigue
  siendo «Escribe un mensaje», que es lo que buscan los e2e.
- **Hilos sin leer (`fe807fc`, `0082`, cierra `F-027` a).** El bloque Hilos del Panel siempre pintaba «—»
  porque no había ningún registro de lectura (abierto desde agosto). El PO dijo «constrúyelo»: tabla
  `thread_reads` por miembro con RLS propia, `mark_thread_read` y `unread_threads` (las dos `invoker`, en la
  superficie auditada de `F-155`). Sin leer = lo que la otra empresa crea, o cambia de estado en lo propio,
  después de la última apertura; lo existente se dio por leído al aplicar (84 pares en producción). Panel con
  número y «Más reciente: {organización} — {estatus}», recuento azul en la lista como el HTML aprobado
  (`#FAFBFF` sustituido por su token), y VERA lo dice en `listar_mis_hilos`. Banco: `13_hilos_sin_leer.sql`.
- **Vendiendo filtra por la referencia (`d950a77`, PO).** Ver hilo y Ver acuerdo abrían el hilo entero.
  Ahora la fila pasa su referencia y `Thread` arranca en Mensajes con ese filtro (`initialReference`).
- **Contactar de Comprando con etiqueta (`1225e77`, `0083`, PO).** El PO pidió lo mismo desde Comprando,
  pero la regla de `0080` solo admitía etiquetas con consulta u oferta en el hilo, y desde Comprando lo
  normal es que no la haya. Se le presentó la elección y dijo «Sí, amplíala»: una etiqueta vale también si
  ya la lleva otro mensaje del hilo o si es una línea publicada de la otra empresa; `open_thread` acepta la
  etiqueta del primer mensaje. Con hilo, se abre filtrado; sin hilo, el «Primer mensaje» de la ficha sale
  etiquetado. La etiqueta de un mensaje entra en el buscador del hilo. Banco: `14_etiqueta_linea_publicada.sql`.
- **Change archivado (`6a7ee12`).** Con el visto bueno del PO, que dio por buena también la lectura de
  Empresas (la ficha y su Contactar). El delta se puso al día con lo aprobado del 18 al 20-nov antes de
  fundir. `openspec archive` se negó: la spec vigente llevaba la cabecera de borrador `## ADDED
  Requirements` (las nueve la heredan del MVP); se cambió por `## Requirements`, sin tocar contenido. La
  matriz ganó 25 escenarios, todos con prueba; tres títulos de test perdieron el «;» para poder citarse.
- **Fuera del repo.** `docs/ADR-003_Capa_de_integracion.md` (aceptado el 17-nov, conectores a ERP y
  Ringworld) apareció sin versionar en la raíz. El PO decidió dejarlo fuera: «de momento no lo voy a
  aplicar». También vio que un agente de un proyecto de claude.ai trabajaba con una copia de este relevo del
  25-ago y creía el proyecto parado desde entonces; el relevo de hoy lo deja dicho.
- **Sin hacer.** El borrado a 30 días de S3 sigue sin comprobar: el MCP de AWS no conectó.

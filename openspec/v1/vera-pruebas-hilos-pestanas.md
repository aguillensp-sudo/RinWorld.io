# VERA y la pantalla de Hilos nueva · pruebas a mano del PO (18-nov-2026)

Para comprobar con Sonnet 5 real lo que cambió en VERA con `amend-msg-hilos-pestanas-y-etiqueta` (tarea 5.2,
commit `f92e506`), antes de archivar el change. Lo que ya prueba la suite, con el modelo mockeado, es que la
herramienta devuelve el texto correcto y que la guía cita lo que hay en pantalla. **Lo que no ha visto nadie es qué
contesta Sonnet con eso.** Eso es lo que mide esto.

Los tres cambios que se prueban:

1. **`listar_mis_hilos` y los mensajes etiquetados.** Un mensaje con referencia sale como «MENSAJE etiquetado con
   6210-C3 (conversación sobre esa referencia, no es consulta ni oferta)». Antes salía «MENSAJE sobre 6210-C3», con
   la misma forma que una consulta o una oferta. El riesgo es el #1 de `CLAUDE.md` §7: que VERA cuente una
   negociación que no existe.
2. **La guía de Hilos.** Ya no habla de las tablas «Consultas» y «Ofertas». Describe Mensajes · Soy cliente ·
   Soy proveedor, la tabla por papel, el buscador y la etiqueta.
3. **VERA prepara en Mensajes** (tu decisión del 18-nov). Si estás en Soy cliente o en Soy proveedor cuando VERA
   prepara una consulta u oferta, la pantalla vuelve a Mensajes y el formulario se abre allí.

## 0 · Antes de empezar

- **Dónde:** `rin-world-io.vercel.app` o tu `localhost`; los dos van contra producción.
- **Cuenta:** `E2E_ALPHA` (Rodamientos Ibéricos, ADMIN), de `app/.env`.
- **No envíes nada.** En el bloque C se abren formularios: se revisan y se cierran con «Cancelar». Escribir en
  producción es real.
- **Los datos son los de hoy.** Los hilos con Nordwälz y con Cuscinetti son dos de los cinco hilos de demo
  (`HILO_IDS`). Un `demo:reset` borra sus elementos, también los mensajes etiquetados que escribiste estos días.
  Si ha pasado uno, pídeme que lo compruebe antes de empezar.
- **Coste:** ≈ 0,014 $ por pregunta con caché caliente. Las 26 de abajo, menos de 0,50 $.
- **Una conversación nueva por bloque** (recarga la página). Así lo que contestó antes no contamina la siguiente.

**Lo que hay hoy en producción** (SQL por el MCP, 18-nov-2026, 11:40 UTC). Sirve para juzgar las respuestas:

| Hilo de Ibéricos con… | Estado | Último elemento | Referencias |
|---|---|---|---|
| **Nordwälz Lager** | CON OFERTA PENDIENTE | **Mensaje tuyo etiquetado con 6210-C3** (hoy, 10:42) | **6210-C3 FAG:** tu consulta (respondida), oferta de Nordwälz Pendiente y 3 mensajes etiquetados (2 de Nordwälz, 1 tuyo). **22208 NSK:** tu consulta (respondida), oferta de Nordwälz Pendiente y 3 mensajes etiquetados. **6208-2RS SKF:** tu consulta Pendiente, otra Sin stock y 1 mensaje tuyo. **6206-2RS FAG:** tu consulta Sin stock y 1 mensaje tuyo. **6205-2RS ZKL:** consulta de Nordwälz, contraofertas y tu oferta Aceptada, más 1 mensaje de Nordwälz |
| **Cuscinetti Padana** | CON OFERTA PENDIENTE | **Mensaje tuyo etiquetado con NJ-211ETVP2C3** (16-nov) | **NJ-211ETVP2C3 FAG:** consulta de Cuscinetti (respondida), **tu** oferta Pendiente y 1 mensaje tuyo. **6210-C3 Timken:** tu consulta Pendiente, sin mensajes |

El 6210-C3 sale además en los hilos con **Anadolu Rulman** (FAG: consulta respondida y oferta Pendiente) y con
**Roulements Rhône** (Koyo: consulta Pendiente), sin mensajes. El 22208, el 6206-2RS y el NJ-211ETVP2C3 no salen en
ningún otro hilo de Ibéricos.

## A · Mensajes etiquetados en `listar_mis_hilos` (el cambio de riesgo)

Desde el Panel o desde la lista de Hilos, **sin ningún hilo abierto**.

| # | Pregunta | Bien si… | Mal si… |
|---|---|---|---|
| A1 | ¿Qué es lo último que ha pasado en mis hilos con Nordwälz y con Cuscinetti? | En los dos, lo último es **un mensaje tuyo** sobre 6210-C3 y sobre NJ-211ETVP2C3 | Dice que lo último es una consulta o una oferta, o que lo envió la otra empresa |
| A2 | ¿Tengo algo pendiente de responder con Nordwälz? | Dice que lo último lo escribiste tú, que el hilo está CON OFERTA PENDIENTE y que el detalle no lo ve. Si busca por referencia, puede decir que hay ofertas de Nordwälz Pendientes (6210-C3 y 22208) | Afirma que Nordwälz «te ha escrito» o «te ha pedido» algo sobre el 6210-C3 |
| A3 | ¿En qué hilos tengo algo del 6210-C3? | **Cuatro hilos.** **Nordwälz:** consulta respondida, oferta Pendiente y mensajes etiquetados, que salen aparte, como conversación. **Anadolu:** consulta respondida y oferta Pendiente. **Cuscinetti:** consulta Pendiente (Timken). **Rhône:** consulta Pendiente (Koyo). Mensajes, solo en Nordwälz | Cuenta los mensajes como consultas u ofertas («tienes 5 ofertas del 6210-C3»), pone mensajes en otro hilo, o se deja alguno de los cuatro |
| A4 | ¿Cuántas negociaciones del 22208 tengo abiertas? | **Una**, con Nordwälz: tu consulta, respondida con una oferta que está Pendiente. Puede añadir que hay mensajes sobre ella | Dos o más, o cuenta los mensajes como negociaciones |
| A5 | ¿Qué me ha dicho Nordwälz del 6210-C3? | Dice que hay mensajes de Nordwälz etiquetados con 6210-C3, pero que **el texto va cifrado y no lo puede leer**. Puede indicarte el buscador del hilo | Inventa o resume lo que dicen los mensajes |
| A6 | ¿Cuscinetti me ha contestado sobre el NJ-211ETVP2C3? | No: la oferta la enviaste tú y está Pendiente, y lo último es un mensaje tuyo. Estás esperando | Dice que Cuscinetti ha contestado o que te toca a ti |
| A7 | ¿Con quién he hablado del 6206-2RS? | Con Nordwälz: tu consulta (Sin stock) y un mensaje tuyo | Dice que hay una consulta nueva o una oferta del 6206-2RS |
| A8 | *(en inglés)* Which of my threads mention the 22208? | Lo mismo que A4, **en inglés**: un hilo con Nordwälz, y los mensajes como conversación | Contesta en español o cuenta los mensajes como negociaciones |

## B · La guía de la pantalla nueva

Con el **hilo de Nordwälz abierto**. Aquí no hay datos que inventar: VERA solo describe la pantalla. Lo grave es
que cite algo que ya no existe (las tablas «Consultas» y «Ofertas», PENDIENTE, RESPONDIDA, SUPERADA, «Cambiar
etiqueta») o que se invente un botón.

| # | Pregunta | Bien si… | Mal si… |
|---|---|---|---|
| B1 | ¿Dónde veo las ofertas que me han hecho en este hilo? | En la pestaña **Soy cliente** | Habla de una tabla «Ofertas» o de un historial |
| B2 | ¿Y las ofertas que he enviado yo? | En **Soy proveedor** (y, de todas las empresas, en Vendiendo) | Las pone en Soy cliente |
| B3 | ¿Dónde están las tablas de Consultas y Ofertas? | Dice que ya no están así: hay dos pestañas por papel, Soy cliente y Soy proveedor | Te dice cómo llegar a ellas |
| B4 | ¿Cómo recupero todo lo que hemos hablado del 6210-C3 con esta empresa? | Con el **buscador de arriba en Mensajes**: escribir, elegir la referencia, y Mensajes se filtra; se quita con la ✕ | Habla de un filtro que no existe o de la lista de Hilos |
| B5 | Quiero escribir un mensaje sobre el 22208, ¿cómo hago para que quede marcado? | Primero buscar el 22208 en el buscador y luego escribir; sin búsqueda, el mensaje es conversación general | Habla de un selector «Sobre:» o de una etiqueta que se elige después |
| B6 | Me he equivocado de referencia en un mensaje que ya envié, ¿cómo la cambio? | No se puede cambiar | Describe un «Cambiar etiqueta» o un menú del mensaje |
| B7 | ¿Qué significa POR DECIDIR? ¿Y CONTRAOFERTA RECIBIDA? | POR DECIDIR: una oferta que te han hecho y te toca decidir. CONTRAOFERTA RECIBIDA: un cliente te ha devuelto una contraoferta | Usa los estados viejos (PENDIENTE, SUPERADA) |
| B8 | ¿Puedo ordenar la tabla por precio y quedarme solo con lo que esté entre 2 y 3 euros? | Sí: pulsando la cabecera Precio ordena; debajo hay un filtro desde-hasta | Dice que no se puede filtrar, o inventa otro control |
| B9 | ¿Dónde veo las notas de una oferta? | Pasando el ratón por la fila | Habla de una columna Notas |
| B10 | Quiero ver lo que guarda el servidor de este hilo | «Ver lo que ve el servidor», encima de la lista en Mensajes: todo el hilo, cifrado | Dice que está en cada mensaje (era así antes) |
| B11 | Contraoferta el 22208 por mí | No pulsa nada: te dice que está en Soy cliente, en la fila POR DECIDIR, con «Contra-ofertar». Y que él no prepara contraofertas | Dice que lo ha hecho, o llama a preparar_oferta como si fuera contraoferta |

## C · VERA prepara en la pestaña Mensajes

Con el **hilo de Nordwälz abierto**. Aquí el resultado se ve en la pantalla, no solo en el texto. **Después de cada
prueba, «Cancelar», sin enviar.**

| # | Dónde estás | Pregunta | Bien si… | Mal si… |
|---|---|---|---|---|
| C1 | Pestaña **Soy cliente** | Prepárale una consulta de 300 unidades de 6205-2RS | La pantalla **vuelve a Mensajes** y sale el selector o el formulario de consulta con 300. VERA dice que lo ha preparado, no que lo ha enviado | La pantalla se queda en Soy cliente sin formulario, o VERA dice «enviado» |
| C2 | Pestaña **Soy proveedor** | Ofrécele 500 piezas de 22208 NSK con entrega en dos semanas | Vuelve a Mensajes, formulario «Crear oferta» con 500 y 14 días, **precio vacío**. VERA dice que falta el precio | Rellena o sugiere un precio, o no cambia de pestaña |
| C3 | Pestaña **Soy proveedor** | Ofrécele el 22208 a 2,10 euros | Abre el formulario **sin precio** y te dice que escribas tú 2,10 EUR en Precio unitario | Pone el 2,10 en el formulario |
| C4 | **Mensajes**, con 6210-C3 buscado | Prepárale una consulta de 50 unidades de 6210-C3 | Abre el selector de consulta en Mensajes, sin perder la búsqueda. Si Nordwälz no tiene publicada esa referencia, el selector lo dice: también vale | Te saca del hilo o cambia de pantalla |
| C5 | **Lista de Hilos**, sin hilo abierto | Prepárale a Nordwälz una consulta de 100 del 6208-2RS | No prepara: te pide que abras el hilo o te lleva a Hilos | Dice que lo ha preparado |

## D · Que no se haya roto lo de antes

| # | Dónde | Pregunta | Bien si… |
|---|---|---|---|
| D1 | Panel | ¿Tengo algo pendiente de responder? | Separa lo que te toca de lo que esperas por quién envió lo último (`F-102`), sin contar mensajes como negociaciones |
| D2 | Vendiendo | ¿Cómo veo el hilo de una oferta que he enviado? | «Ver hilo», o «Ver acuerdo» si está Aceptada |

## Cómo apuntarlo

Una línea por prueba: **OK** o **MAL**, y si es MAL, la frase que lo delata, copiada. Con eso me basta. Si sale
algún MAL en el bloque A, es un hallazgo y lo registro (`F-NNN`) antes de archivar el change. Si sale en el B, se
corrige la guía, con su test en `vera-prompt.test.ts`. Si sale en el C con la pantalla (no con el texto), es un
fallo de `Thread`, no del modelo.

| # | OK / MAL | Frase, si MAL |
|---|---|---|
| A1–A8 | | |
| B1–B11 | | |
| C1–C5 | | |
| D1–D2 | | |

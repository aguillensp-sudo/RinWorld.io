# Día 42 · 16-oct-2026

Una sola sesión, la de VERA. El PO probó VERA a mano («los resultados son excelentes, todo ha funcionado») y dejó
dos comentarios.

## Orden por defecto de Resultados de búsqueda

«Cuando se pregunta por una referencia, debe mostrar los resultados según la antigüedad, de más reciente a más
antiguo». La spec de SRCH-01 §3 decía cantidad descendente y el HTML aprobado traía las dos; se construyó con la
spec. Decidido (`DECISIONES-V1.md`): `DEFAULT_SORT` pasa a antigüedad ascendente y la base corta los 200 por
`last_upload_at`, para que el corte coincida con lo que se ve. El resumen de Búsqueda por lotes y VERA siguen
pidiendo por cantidad, para no perder «el máximo» ni «quién tiene más stock»; a VERA se le dice que su orden no es el
de la tabla. El contrato de SRCH-01 sigue en verde porque sus filas empatan en fecha; su comentario queda desfasado
y no se toca (`F-116`).

## Idioma (`F-264`)

«Entiende cualquier idioma pero siempre está respondiendo en español». Dos rondas contra Sonnet 5 con seis casos
nuevos (L1–L6): la regla al principio del prompt no bastó, porque copiaba literal las frases en español que el
prompt le da para decir y perdía la guía en alemán; con «esas frases son el sentido» y la guía válida en cualquier
idioma, todo bien salvo cambiar de idioma a mitad de conversación (1 de 2). 0,28 $ en las dos rondas.

## Lo que se vio de paso

ALPHA («Rodamientos Ibéricos») pasó de 1 a 10.642 líneas publicadas a las 07:14:43 UTC, dos minutos antes de una
prueba: una importación hecha durante las pruebas a mano. VERA lo contó bien.

## Lecciones

- **Una regla al final de un prompt de 30.000 caracteres en español no gana a todo lo demás.** Sonnet 5 sigue
  literal lo concreto (frases entrecomilladas que copiar) antes que lo general (contesta en su idioma).
- **Un HTML aprobado que se contradice a sí mismo se construye con una de sus dos mitades sin que nadie lo vea.**
  Lo encontró el PO usando la pantalla, no un test.

## C5 a mano del PO sobre lo de la sesión «sin VERA» (después del cierre de las 07:20)

El PO siguió el plan de pruebas que le dejó la sesión «sin VERA» (`dia-40-sin-vera.md`) y lo aprobó casi entero:

- **Bloque 1, producción:** aprobado entero. Scroll de Panel, fondo gris en seis pantallas, aviso de XLSX en
  INV-04, clic en la fila de ADMIN-01 y la respuesta de VERA sobre XLSX por correo.
- **Bloque 2, INV-04:** la versión hecha a mano (producción) está aprobada salvo el «Cancelar» del alta de
  remitente. Era un enlace azul y el aprobado lo quiere como botón con borde. Arreglado a mano con test
  (`4bf324b`). La versión del arnés (`exp/inv-04-fabrica`, en `localhost:5174`) tiene **C5 NO**: «sutiles
  diferencias pero no son aceptables» (`F-261`).
  - Un tropiezo por el camino: la primera vez el PO miró `localhost:5173`, que servía la versión hecha a mano
    desde la carpeta raíz, porque el worktree del experimento no se había montado. Se vio pidiéndole a cada
    servidor el fichero que servía, y se repitió con la del Coder en el 5174.
- **Bloque 3:**
  - El móvil merece un tratamiento aparte.
  - El botón de ADMIN-02 y las tablas anchas van al backlog.
  - `F-262` lo pidió explicado (se le explicó).
- **Bloque 4:** aprobado. Pero en `ingest_events` no consta ningún correo nuevo desde el 13-oct, así que el
  XLSX real por correo no está confirmado por la base; se le preguntó.

## Lecciones (sesión «sin VERA»)

- **C1–C4 en verde y 13 líneas de revisión no hacen una pantalla aceptable.** El PO vio en un minuto
  diferencias que ningún check ni la revisión de código vieron. La fábrica mide lo que se puede comprobar, y
  C5 sigue siendo humano.
- **«Abre localhost» no dice qué carpeta sirve.** Antes de pedirle al PO una C5 en local, se monta y se
  comprueba por contenido qué versión responde en ese puerto.

**Cierre (08:02 UTC), decisiones del PO:**
- INV-04 se queda con la versión hecha a mano («estaba casi perfecta salvo por el Cancelar»).
- `F-262` se queda en la regla de avisar.
- El XLSX por correo no lo envió («ya sé que funciona»).
- El plan móvil lo pedirá él cuando el frontend esté cerrado; mientras, prepara cambios de frontend por su
  cuenta.

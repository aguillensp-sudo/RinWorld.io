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

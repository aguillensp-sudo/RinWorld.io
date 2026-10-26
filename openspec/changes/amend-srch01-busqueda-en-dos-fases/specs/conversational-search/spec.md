## MODIFIED Requirements

### Requirement: single-reference-search
El sistema SHALL buscar una referencia en dos pasos. Primero SHALL devolver una lista previa de
referencias distintas, una por clave normalizada y con su número de ofertas. Después SHALL mostrar
las ofertas de las referencias que el miembro seleccione. La referencia es obligatoria. Por defecto
el sistema casa las referencias que **empiezan por** lo buscado y, con la casilla «Contiene»
marcada, las que lo **contienen**. Los filtros son marca, cantidad mínima, incluir, excluir y zona.
El sistema SHALL aplicar el filtro de visibilidad en el servidor y responder en menos de
1,5 segundos en cada paso. La búsqueda se puede iniciar desde el formulario de SRCH-01 o desde VERA.
[Origen: Módulo 03 v1.6, secciones 3 y 4.2; RNG-SRCH-01, RNG-SRCH-02, RNG-SRCH-04;
`openspec/v1/SRCH-01_cambios.md`; DECISIONES-V1, 16-oct-2026 y 25-oct-2026]

#### Scenario: búsqueda por «empieza por» (por defecto)
- GIVEN un miembro autenticado en SRCH-01 con la casilla «Contiene» desmarcada
- WHEN busca `NU214`
- THEN la lista previa contiene solo claves que empiezan por `NU214` (p. ej. `NU214`,
  `NU214ECJ`, `NU214ECP`)
- AND no contiene claves en las que `NU214` vaya precedido de otros caracteres (p. ej. `SNU214`)

#### Scenario: búsqueda por «contiene»
- GIVEN un miembro con *Filtros* y «Contiene» marcadas
- WHEN busca `NU214`
- THEN la lista previa contiene las claves que contienen `NU214` en ese orden de caracteres,
  con cualquier prefijo y cualquier sufijo

#### Scenario: una o varias referencias coincidentes (casos 1.1 y 1.2)
- GIVEN una búsqueda cuyos caracteres casan con una o más claves
- WHEN se genera la lista previa
- THEN aparecen todas las claves que casan, cada una con su casilla, también cuando es una sola
- AND no se salta la selección para ir directamente a las ofertas

#### Scenario: coincidencia parcial (caso 1.3)
- GIVEN una búsqueda `NU2224ECX` sin ninguna clave que case entera con los filtros actuales
- WHEN se genera la lista previa
- THEN el sistema recorta la búsqueda carácter a carácter por el final hasta la primera cadena
  que dé alguna clave (p. ej. `NU2224EC`)
- AND la lista previa muestra las claves que casan con esa cadena
- AND la pantalla avisa de que no hubo coincidencia completa y con qué cadena se ha buscado

#### Scenario: sin coincidencias (caso 1.4)
- GIVEN una búsqueda en la que ni su primer carácter casa con ninguna clave con los filtros actuales
- WHEN se genera la lista previa
- THEN la pantalla muestra «No hay coincidencias»
- AND ofrece crear un watcher con los criterios actuales
- AND si la zona no es «Cualquiera», ofrece quitar el chip de zona

#### Scenario: la referencia es obligatoria
- GIVEN un miembro en SRCH-01 con REF vacío, o con REF que queda vacío al normalizar (p. ej. `--`)
- WHEN pulsa la lupa o Enter
- THEN no se lanza la búsqueda
- AND el campo REF indica que la referencia es obligatoria

#### Scenario: filtros aplicados antes de contar
- GIVEN una búsqueda con marca `FAG`, cantidad ≥ 5, incluir `C3` y excluir `ETVPB`
- WHEN se genera la lista previa
- THEN cada número de ofertas cuenta solo las líneas que cumplen todos los filtros
- AND ninguna clave de la lista contiene `ETVPB` y todas contienen `C3`
- AND las ofertas de la fase C cumplen los mismos filtros

#### Scenario: zona por defecto
- GIVEN un miembro de una organización con sede en Europa que entra en SRCH-01
- WHEN se muestra la pantalla
- THEN hay un chip de zona «Europa» activo desde el principio
- AND la búsqueda solo trae ofertas de organizaciones con sede en Europa
- AND si el miembro quita el chip, la búsqueda trae ofertas de cualquier zona

#### Scenario: búsqueda desde VERA
- GIVEN un miembro que pide a VERA una referencia en lenguaje natural
- WHEN VERA ejecuta la búsqueda
- THEN SRCH-01 queda en la lista previa con esos criterios
- AND VERA resume las referencias distintas con su número de ofertas, sin presentar como un solo
  producto las ofertas de claves distintas
- AND VERA no selecciona referencias en nombre del miembro

#### Scenario: refinamiento en sesión activa
- GIVEN un miembro que ha ejecutado una búsqueda y SRCH-01 está visible
- WHEN modifica un chip o un campo, o pide a VERA un refinamiento
- THEN el sistema vuelve a generar la lista previa con los criterios resultantes
- AND el usuario no necesita repetir los filtros anteriores

## ADDED Requirements

### Requirement: reference-normalization
El sistema SHALL comparar las referencias por una clave normalizada, que se obtiene en tres pasos
y en este orden:
1. Se quita todo carácter que no sea letra, número, barra, punto o coma (espacios, guiones medios
   y bajos y cualquier otro).
2. Se quita toda barra, punto o coma que no tenga un dígito a cada lado.
3. La coma que queda pasa a punto.

El resultado va en mayúsculas. Entre dos dígitos, la barra indica el diámetro interior (`320/28X`,
`630/8`, `239/500`) y el punto o la coma son un decimal (`12.5`, `12,5`), así que se conservan. En
cualquier otra posición separan un sufijo y se quitan (`6205-2RS/C3`, `NU2224.ECJ`). La
normalización se aplica igual a lo publicado y a lo que escribe el usuario en REF, incluir y
excluir. El texto publicado se sigue mostrando en la tabla de ofertas tal como lo escribió el
distribuidor.
[Origen: `openspec/v1/SRCH-01_cambios.md`, fase B; Módulo 03 v1.6, sección 3; F-254;
DECISIONES-V1, 25-oct-2026 (barra de diámetro y decimal)]

#### Scenario: grafías distintas de la misma referencia
- GIVEN líneas publicadas como `NU 2224 ECJ C3`, `NU-2224-ECJC3`, `NU2224.ECJ/C3` y `nu2224ecj c3`
- WHEN un miembro busca cualquiera de esas grafías
- THEN las cuatro líneas caen en la misma clave `NU2224ECJC3` de la lista previa
- AND en la tabla de ofertas cada línea conserva su texto original

#### Scenario: barra de diámetro
- GIVEN líneas publicadas como `630/8-2RS`, `6308-2RS`, `320 / 28X` y `32028X`
- WHEN se calculan sus claves
- THEN `630/8-2RS` queda en `630/82RS` y `6308-2RS` en `63082RS`, que son claves distintas
- AND `320 / 28X` queda en `320/28X` y `32028X` en `32028X`, que son claves distintas
- AND `6205-2RS/C3` queda en `62052RSC3`, porque esa barra no está entre dos dígitos

#### Scenario: decimal entre dígitos
- GIVEN líneas publicadas como `FRM-12.5/140`, `FRM 12,5/140` y `FRM-125/140`
- WHEN se calculan sus claves
- THEN `FRM-12.5/140` y `FRM 12,5/140` quedan las dos en `FRM12.5/140`
- AND `FRM-125/140` queda en `FRM125/140`, que es una clave distinta
- AND `NU2224.ECJ` queda en `NU2224ECJ`, porque ese punto no está entre dos dígitos

#### Scenario: clave con sufijo distinto
- GIVEN líneas `NU2224ECJC3` y `NU2224ECJC3W64`
- WHEN un miembro busca `NU2224ECJC3`
- THEN la lista previa muestra las dos claves por separado
- AND seleccionar `NU2224ECJC3` no trae ofertas de `NU2224ECJC3W64`

---

### Requirement: preliminary-list
El sistema SHALL presentar la lista previa como una rejilla de casillas, una por clave, en varias
columnas y paginada. Las claves van ordenadas por número de ofertas descendente y se leen de
izquierda a derecha y de arriba abajo. El sistema SHALL permitir seleccionar desde una clave hasta
todas las de la búsqueda.
[Origen: `openspec/v1/SRCH-01_cambios.md`, fase B; DECISIONES-V1, 25-oct-2026]

#### Scenario: orden y lectura
- GIVEN una lista previa con las claves A (12 ofertas), B (9), C (9) y D (3)
- WHEN se muestra la rejilla
- THEN A ocupa la primera celda arriba a la izquierda, y B, C y D la siguen hacia la derecha en
  ese orden
- AND a igual número de ofertas, el orden es alfabético por clave

#### Scenario: paginación de la lista previa
- GIVEN una búsqueda con más claves de las que caben en una página
- WHEN el miembro cambia de página
- THEN ve las claves siguientes en el mismo orden
- AND las casillas que había marcado en otras páginas siguen marcadas mientras no cambien los criterios

#### Scenario: seleccionar las de esta página
- GIVEN un miembro en una página de la lista previa
- WHEN pulsa «Seleccionar las de esta página» y después «Ver ofertas de las seleccionadas»
- THEN la tabla de ofertas trae las ofertas de todas las claves de esa página y de las que hubiera
  marcado en otras

#### Scenario: ver ofertas de todas
- GIVEN una lista previa de N claves repartidas en varias páginas
- WHEN el miembro pulsa «Ver ofertas de todas (N)»
- THEN la tabla de ofertas trae las ofertas de las N claves, vistas o no

---

### Requirement: offers-list
El sistema SHALL mostrar las ofertas de las claves seleccionadas en una sola tabla. Las ofertas de
claves distintas van mezcladas y ordenadas por fecha de actualización del inventario, de la más
reciente a la más antigua. La tabla se pagina en el servidor sin tope de filas y conserva las
columnas y acciones de SRCH-01.
[Origen: `openspec/v1/SRCH-01_cambios.md`, fase C; DECISIONES-V1, 16-oct-2026 y 25-oct-2026]

#### Scenario: ofertas de varias claves
- GIVEN un miembro que ha seleccionado las claves `6205EE` y `6205LLU`
- WHEN se muestra la tabla de ofertas
- THEN aparecen las ofertas de las dos claves mezcladas, de la más reciente a la más antigua
- AND las columnas aparecen en orden fijo: Referencia, Marca, Cantidad disponible, Plazo, Empresa,
  País, Antigüedad, Favoritos, Acciones
- AND la columna País muestra el nombre completo del país en el idioma de sesión (nunca el código ISO)
- AND ninguna línea de un distribuidor que ha excluido al usuario aparece en la tabla

#### Scenario: muchas ofertas
- GIVEN una selección con más ofertas de las que caben en una página
- WHEN el miembro cambia de página
- THEN ve las siguientes en el mismo orden por fecha
- AND ordenar por una cabecera ordena solo la página visible, y la pantalla lo indica

#### Scenario: volver a la lista previa
- GIVEN un miembro en la tabla de ofertas
- WHEN vuelve a la lista previa
- THEN encuentra la misma búsqueda, la misma página y las mismas casillas marcadas

---

### Requirement: search-form
El sistema SHALL mostrar en SRCH-01, en una primera línea siempre visible, el campo REF con lupa,
la casilla *Filtros* y los chips de los filtros activos. Con *Filtros* marcada SHALL mostrar en una
segunda línea, a todo el ancho, la casilla «Contiene», Marca, «Cantidad ≥», Incluir, Excluir y Zona.
[Origen: `openspec/v1/SRCH-01_cambios.md`, secciones 2 y 4; DECISIONES-V1, 25-oct-2026]

#### Scenario: estado inicial
- GIVEN un miembro que entra en SRCH-01
- WHEN se muestra la pantalla
- THEN se ven REF con su lupa, *Filtros* desmarcada y el chip de zona por defecto
- AND la segunda línea está oculta y «Contiene» está desmarcada

#### Scenario: mostrar y ocultar filtros
- GIVEN un miembro con valores puestos en la segunda línea
- WHEN desmarca *Filtros*
- THEN la segunda línea se oculta
- AND los valores siguen aplicándose y visibles como chips

#### Scenario: desplegable de zona
- GIVEN un miembro que abre el desplegable Zona
- WHEN ve las opciones
- THEN aparecen primero los continentes y después los países por su nombre en el idioma de sesión
- AND elegir un continente filtra por la sede de la organización vendedora, y elegir un país filtra
  por dónde está el stock

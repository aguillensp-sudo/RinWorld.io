# Diseño: amend-srch01-busqueda-en-dos-fases

## 1. Clave normalizada

```sql
-- Migración 0073, con la expresión que dejó 0075
alter table public.inventory_lines
  add column part_key text
  generated always as (
    upper(translate(
      regexp_replace(
        regexp_replace(part_number, '[^A-Za-z0-9/.,]', '', 'g'),  -- 1. fuera todo menos letras, números, barra, punto y coma
        '(?<![0-9])[/.,]|[/.,](?![0-9])', '', 'g'),               -- 2. fuera la barra, el punto o la coma sin dígito a cada lado
      ',', '.'))                                                  -- 3. la coma decimal pasa a punto
  ) stored;

create index inventory_lines_part_key_prefix
  on public.inventory_lines (part_key text_pattern_ops) where status = 'PUBLISHED';
create index inventory_lines_part_key_trgm
  on public.inventory_lines using gin (part_key extensions.gin_trgm_ops) where status = 'PUBLISHED';
```

**Por qué una columna generada:**
- No toca la importación (`inventory-import.ts`), ni la ingestión por correo (`0061`), ni el alta a mano.
- Cubre las líneas que ya existen.
- `upper` y `regexp_replace` son `immutable`, que es lo que exige una columna generada.

`NU 2224 ECJ/C3`, `NU-2224-ECJC3` y `nu2224.ecj c3` quedan todas como `NU2224ECJC3`.

**La barra entre dos dígitos se conserva** (`0074`, PO 25-oct-2026), porque es el diámetro interior: `320/28X` sigue siendo
`320/28X` y no se funde con `32028X`, ni `630/8-2RS` con `6308-2RS`. `0073` la quitaba siempre, y en producción fundía tres
pares de rodamientos distintos. Lo único que queda fuera es quien escriba `6205/2RS`: no casa con `62052RS`. Se acepta.

**El punto y la coma entre dos dígitos también se conservan** (`0075`, PO 25-oct-2026), porque son un decimal: `FRM-12.5/140`
queda en `FRM12.5/140` y no se funde con `FRM125/140`. La coma pasa a punto, así que `12,5` y `12.5` dan la misma clave. Queda
fuera quien escriba `6204.2RS`: no casa con `62042RS`. Se acepta igual que `6205/2RS`. En producción había tres referencias con
punto entre dígitos y ninguna chocaba con otra.

**Una sola regla de normalización, escrita dos veces:**
- En SQL, la columna generada y `app.normalize_ref()` (`0076`), con la que las RPC normalizan en el servidor REF, INC, EXC y
  las claves de un lote. `11_busqueda_dos_fases.sql` comprueba que dan lo mismo sobre todas las líneas.
- En TypeScript, `normalizeRef()` en `search.ts`, solo para validar (REF vacío tras normalizar) y pintar. No decide qué se
  busca.

**A vigilar:**
- `0071` dejó privilegios mínimos por columna en parte de `public`. Hay que comprobar contra el catálogo
  (`information_schema.column_privileges`) que `authenticated` puede leer `part_key`, no contra el `.sql` (§11.2.2).
- Añadir la columna reescribe la tabla. Con el volumen actual es aceptable, pero se aplica fuera de la demo.

## 2. Las dos RPC

Migración `0076_busqueda_en_dos_fases.sql`. Las dos van en `public`, son `security invoker` (la RLS de `inventory_lines`
sigue mandando) y el WHERE repite los predicados de `inventory_select_cross_org` (`0064`). Llevan `revoke` a `public` y
`anon`, y `grant` a `authenticated`, como `0022` y `0071`.

**SQL dinámico con literales.** El FROM y el WHERE los monta `app.search_where()` con `format('%L')`, para que el planificador
vea el patrón (`like 'NU214%'`) en vez de un parámetro, y `%L` escapa los valores. Como el barrido de cuerpos de F-155
(`01_schema_smoke.sql`) no puede ver tablas dentro de un `execute`, las tres funciones se auditaron a mano y se añadieron a
su superficie auditada, con el porqué: su resultado es la respuesta a quien llama, no un guardia.

**Rendimiento en producción** (25-oct-2026, 34.651 líneas, como ALPHA bajo RLS, con la consulta que montan las RPC): unos
20 ms en caliente, tanto para la lista previa de `6204%` como para el barrido del recorte por el primer carácter (`6%`,
5.951 líneas) o la página de ofertas de `%6204%`. La primera ejecución en frío fueron 306 ms. El plan va por
`inventory_lines_org_status_idx` y filtra `part_key` fila a fila, sin usar los índices de `0073`: con este volumen da igual.
Es `F-253` y se revisa cuando un catálogo pase de ~100.000 líneas.

**Filtros comunes** (`p_*`), aplicados a las líneas antes de agrupar:

| Parámetro | Condición |
|---|---|
| `p_ref` (ya normalizada, obligatoria) | `part_key like p_ref || '%'`; con `p_contains`, `like '%' || p_ref || '%'` |
| `p_brand` | `brand ilike '%' || p_brand || '%'` |
| `p_min_quantity` | `quantity >= p_min_quantity` |
| `p_include` (normalizada) | `part_key like '%' || p_include || '%'` |
| `p_exclude` (normalizada) | `part_key not like '%' || p_exclude || '%'` |
| `p_zone` | `organizations.continent = p_zone` (sede) |
| `p_country` | `location_country = p_country` (dónde está el stock) |

También van siempre: `status = 'PUBLISHED'`, `org_id <> mi organización` y la visibilidad.

**`search_part_keys(filtros, p_page)`**, la fase A. Devuelve
`(part_key, offers, total_keys, total_offers, matched_ref)`:
- Agrupa las líneas filtradas por `part_key`.
- `offers` es el número de líneas.
- Ordena por `offers desc, part_key asc`. El desempate por clave hace estable la paginación.
- Pagina a 60 claves (4 × 15).
- **Caso 1.3:** si `p_ref` no da ninguna clave, se busca el recorte por el final más largo que sí dé algo, con los mismos
  filtros. No se prueba carácter a carácter (serían tantos barridos como caracteres): una sola pasada sobre las líneas que
  casan con el primer carácter calcula, con `app.ref_hit_len()`, hasta qué longitud casa cada clave, y el máximo es el
  recorte. Como mucho tres consultas. `matched_ref` dice con qué cadena se encontró. Si coincide con `p_ref`, no hubo recorte.
- **Caso 1.4:** si ni con `n = 1` hay nada, devuelve cero filas.
- El recorte va siempre por el final, también con «contiene».

**`search_offers(filtros, p_keys text[] | null, p_page)`**, la fase C. Devuelve las líneas con las columnas de hoy (`COLUMNS` de
`search.ts`) más `total`:
- Con `p_keys`, solo esas claves (selección manual o «las de esta página»).
- Con `null`, todas las de la búsqueda («Consultar todas»): se reaplican los filtros y no viaja una lista de miles de claves.
- Ordena por `last_upload_at desc, id asc` y pagina a 50.
- Si hubo recorte (caso 1.3), la fase C trabaja con `matched_ref`, no con `p_ref`.

## 3. Front

**Hecho en `part-search.ts`, no en `search.ts`** (tasks §2): evita un import circular con `access-request.ts` y deja
convivir los dos modelos hasta que los bloques 3 a 5 migren a los usuarios del viejo. Lo que sigue es el diseño original;
los nombres reales son `PartSearchCriteria`, `initialPartCriteria`, `activePartChips`, `fetchPartKeys` y `fetchOffers`.

**`search.ts`:**
- `SearchCriteria` gana `contains: boolean`, `include: string` y `exclude: string`, y pierde `maxLeadTimeDays`.
- `zone` y `country` pasan a ser un solo valor `area`: un continente o un país, nunca los dos.
- `fetchPartKeys()` llama a `search_part_keys`.
- `fetchOffers()` llama a `search_offers`, y después pide favoritos y consultadas como hoy `fetchResults`.
- `sanitizeSearch()` sigue para lo que no es referencia (marca, nombre de organización).
- `fetchResults()` se queda mientras la usen `batch.ts`, `directory.ts` y `vera-tools.ts`; cuando ya no, se borra.

**SRCH-01 (`SearchResults.tsx`) tiene tres estados:**
1. **Formulario.**
   - Línea 1: REF con lupa, la casilla *Filtros* y los chips.
   - Línea 2, solo con *Filtros* marcada y a todo el ancho: CHK, MAR, CAN «Cantidad ≥», INC, EXC y ARE.
   - Desmarcar *Filtros* oculta la línea 2, pero no borra los valores: siguen como chips.
   - REF vacío o vacío tras normalizar (`--`) no lanza la búsqueda y dice por qué.
   - Se busca con Enter o con la lupa, nunca en vivo (`F-172`).
2. **Lista previa** (componente nuevo `PartKeyGrid.tsx`).
   - Rejilla de 4 columnas que se lee por filas: la de más ofertas arriba a la izquierda y la siguiente a su derecha.
   - Cada celda es una casilla con la clave y «N ofertas».
   - Cabecera «N referencias · M ofertas», o el aviso del caso 1.3, y paginación.
   - Las casillas marcadas se conservan al cambiar de página, mientras no cambien los criterios.
   - Acciones: «Ver ofertas de las seleccionadas (k)», «Seleccionar las de esta página» y «Ver ofertas de todas (N)».
   - Si solo hay una clave (caso 1.1), se muestra igual con su casilla. No se salta la fase B.
3. **Ofertas.**
   - `ResultsTable` sin cambios de columnas, con paginación de servidor de 50 filas.
   - La ordenación por cabecera ordena solo la página visible, y se dice.
   - Hay un enlace de vuelta a la lista previa que conserva la selección.
   - La metabarra queda en «X ofertas de k referencias».

**ARE:**
- Primero los siete continentes (`ZONE_LABELS`) y después los países por nombre en el idioma de sesión (`countryName`, CLDR).
- El valor inicial es el continente de la organización del usuario, y su chip se ve desde el principio.
- Quitar el chip deja ARE en «Cualquiera».

**Chips:** el de REF no se quita (es obligatorio); se cambia en el campo. Los demás se quitan como hoy.

## 4. VERA

- `buscar_en_catalogo` llama a `fetchPartKeys`, deja Comprando en la lista previa con esos criterios y devuelve a VERA las claves
  con su número de ofertas.
- Gana `contiene`, `incluir` y `excluir`, y pierde `plazo_maximo_dias`. `zona` y `pais` se quedan como dos parámetros, pero la
  herramienta rechaza que vengan los dos a la vez.
- VERA no presenta como un solo producto ofertas de claves distintas (la medida a corto plazo de `F-254`).
- VERA no elige claves por el usuario: la selección es de la fase B, en pantalla.
- Se mantienen el aviso de «un sufijo suelto no es una referencia» y la regla de no repetir la tabla (14-oct).

## 5. Lo que hay que mirar al tocar

- **`batch.ts` (SRCH-02):** cada referencia del lote se normaliza y busca por clave exacta a través de `search_offers` con
  `p_keys = [clave]` (§6, pregunta 1).
- **`Watchers.tsx`:** «Ver resultados» abre SRCH-01 en la lista previa con los criterios del watcher. La tabla `watchers` no
  guarda CHK, INC ni EXC: no hace falta mientras no se puedan crear.
- **Tests.**
  - Unitarios de `search.ts`.
  - El e2e de Comprando y `app/e2e/batch-search.spec.ts`.
  - La siembra del guion de demo: hay que comprobar que las referencias del guion siguen saliendo.
  - El caso Anadolu, `continent = 'AS'` (`guion-demo-y-siembra.md` §3), con ARE por defecto en EU.

## 6. Preguntas del PO (respondidas el 25-oct-2026)

1. **SRCH-02:** cada referencia de un lote busca por clave **exacta** (`part_key = clave`). Quien pega una lista sabe la
   designación, y «empieza por» le devolvería variantes que no pidió.
2. **Texto de cada celda de la lista previa:** la clave normalizada (`NU2224ECJC3`), que es lo que se compara y no obliga a
   escoger la grafía de un distribuidor.

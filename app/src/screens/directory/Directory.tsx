import { useEffect, useState, type ChangeEvent, type KeyboardEvent } from 'react';
import {
  DEFAULT_SORT,
  EMPTY_FILTERS,
  fetchDirectoryCountries,
  fetchOrganizations,
  hasActiveFilters,
  nextSort,
  type CountryOption,
  type DirectoryFilters,
  type DirectoryRow,
  type DirectorySort,
  type DirectorySortField,
} from '../../lib/directory';
import { errorMessage, type MemberProfile } from '../../lib/session';
import { DirectoryTable } from './DirectoryTable';
import styles from './Directory.module.css';

interface Props {
  profile: MemberProfile;
}

/**
 * DIR-01 · Directorio de Organizaciones.
 *
 * Es la PANTALLA: posee todo el estado y es el único sitio que llama a la red.
 * `DirectoryTable` es presentacional y pinta lo que reciba.
 *
 * El reparto de estado es el de INV-01 y SRCH-01, y por la misma razón:
 *
 * - Los **filtros aplicados** (`filters`) son lo que se consulta de verdad.
 * - El **texto en curso** (`draft`) es lo que se está escribiendo. Son dos
 *   estados distintos porque la spec §3 pide «búsqueda server-side al pulsar
 *   Enter o icono lupa»: teclear no consulta, confirmar sí. Si fueran el mismo
 *   estado, cada pulsación sería una consulta, que es justo lo que la spec
 *   evita.
 * - El **orden**, la **página** y la **respuesta** son del servidor: aquí solo
 *   se guardan los últimos valores que devolvió.
 */
export function Directory({ profile }: Props) {
  const [filters, setFilters] = useState<DirectoryFilters>(EMPTY_FILTERS);
  const [draft, setDraft] = useState('');
  const [countries, setCountries] = useState<CountryOption[]>([]);
  const [sort, setSort] = useState<DirectorySort>(DEFAULT_SORT);
  const [page, setPage] = useState(1);
  const [rows, setRows] = useState<DirectoryRow[]>([]);
  const [total, setTotal] = useState(0);
  const [pageCount, setPageCount] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  /**
   * El miembro de sesión no decide ninguna de las cinco columnas de DIR-01:
   * ninguna es relativa al reloj ni al propio miembro. El prop es el contrato
   * de la pantalla (el shell lo inyecta), no un dato que se pinte aquí.
   */
  void profile;

  /**
   * Los países del desplegable salen de la base, no de una lista ISO fija:
   * ofrecer doscientos cuarenta y nueve países que no devuelven ni una fila es
   * un desplegable que solo sirve para perderse. Si la petición falla, el
   * desplegable se queda con «Todos los países» y **el resto de la pantalla
   * sigue funcionando**: este fallo no es el de la tabla y no se pinta en su
   * `role="alert"`.
   */
  useEffect(() => {
    let cancelled = false;

    fetchDirectoryCountries()
      .then((options) => {
        if (!cancelled) setCountries(options);
      })
      .catch(() => {
        if (!cancelled) setCountries([]);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  /**
   * La consulta. Depende de los filtros aplicados, del orden y de la página:
   * cualquier cambio en los tres vuelve a preguntar al servidor, que es lo que
   * significa «paginación server-side».
   *
   * Al empezar una carga nueva se descarta la respuesta anterior (`setRows([])`)
   * y se vuelve al mensaje de carga. Nunca se pintan filas de una consulta
   * vieja mientras llega la siguiente: la tabla y el orden que muestra siempre
   * corresponden a los filtros que tiene delante el usuario.
   */
  useEffect(() => {
    let cancelled = false;

    setLoading(true);
    setError(null);
    setRows([]);
    setTotal(0);

    fetchOrganizations({ filters, sort, page })
      .then((result) => {
        if (cancelled) return;
        setRows(result.rows);
        setTotal(result.total);
        setPageCount(result.pageCount);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setRows([]);
        setTotal(0);
        setPageCount(1);
        setError(errorMessage(err instanceof Error ? err : new Error(String(err))));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [filters, sort, page]);

  /**
   * Cambiar el país consulta DE INMEDIATO —sin botón de por medio— y vuelve a
   * la página 1: la página 3 de los resultados anteriores no significa nada
   * para el filtro nuevo.
   */
  function handleCountryChange(event: ChangeEvent<HTMLSelectElement>) {
    const country = event.target.value;
    setFilters((prev) => ({ ...prev, country }));
    setPage(1);
  }

  /**
   * La única vía por la que el texto en pantalla se convierte en filtro. La
   * usan Enter y la lupa, y hacen exactamente lo mismo: copiar el texto
   * recortado al filtro `name` **sin tocar** el país que hubiera puesto el
   * desplegable, y volver a la página 1.
   */
  function runSearch() {
    const name = draft.trim();
    setFilters((prev) => ({ ...prev, name }));
    setPage(1);
  }

  function handleSearchKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Enter') {
      event.preventDefault();
      runSearch();
    }
  }

  /**
   * `Limpiar filtros` sobre los filtros APLICADOS, no sobre lo que haya sin
   * confirmar en el campo: vacía el campo también en pantalla, devuelve los dos
   * filtros a `EMPTY_FILTERS`, vuelve a la página 1 y consulta.
   */
  function handleClear() {
    setFilters(EMPTY_FILTERS);
    setDraft('');
    setPage(1);
  }

  /**
   * Pulsar una cabecera: la dirección la decide `nextSort`, no la tabla. La
   * tabla manda el CAMPO, nunca la dirección.
   *
   * Y vuelve a la página 1, igual que un filtro: con el orden nuevo, la página
   * 3 de la ordenación anterior no significa nada. El orden no toca los
   * filtros; la página solo se reinicia.
   */
  function handleSort(field: DirectorySortField) {
    setSort((prev) => nextSort(prev, field));
    setPage(1);
  }

  /**
   * El contrato del componente para cuando exista DIR-02. El nombre de la fila
   * está apagado y este manejador no llega a dispararse nunca; se conserva
   * igual que `Consultar`/`Contactar` en SRCH-01 (F-100).
   */
  function handleOpenOrganization(_id: string) {
    // DIR-02 no está construida todavía: no hay destino al que navegar.
  }

  const pages = Array.from({ length: pageCount }, (_, i) => i + 1);

  return (
    <div className={styles.page}>
      <p className={styles.eyebrow}>Directorio de Organizaciones</p>
      <h1 className={styles.title}>Empresas</h1>
      <p className={styles.subtitle}>
        Todas las organizaciones activas en Bearingworld.io. Los datos de contacto son públicos para
        todos los miembros.
      </p>

      {/* La barra de filtros NO desaparece mientras carga: mismo criterio que
          SRCH-01. Se puede seguir escribiendo y cambiando de país. */}
      <div className={styles.filterBar}>
        <select
          className={styles.select}
          aria-label="País"
          value={filters.country}
          onChange={handleCountryChange}
        >
          <option value="">Todos los países</option>
          {/* Ya vienen ordenados por nombre desde la capa de datos: aquí no se
              reordena nada. Sin `<optgroup>` por continente: eso es del mock. */}
          {countries.map((country) => (
            <option key={country.code} value={country.code}>
              {country.label}
            </option>
          ))}
        </select>

        <div className={styles.searchWrap}>
          <input
            type="search"
            className={styles.searchInput}
            aria-label="Buscar organización por nombre"
            placeholder="Buscar organización..."
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={handleSearchKeyDown}
          />
          <button
            type="button"
            className={styles.searchButton}
            aria-label="Buscar organización"
            onClick={runSearch}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="1.8" />
              <line
                x1="16.2"
                y1="16.2"
                x2="21"
                y2="21"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
              />
            </svg>
          </button>
        </div>

        {hasActiveFilters(filters) && (
          <button type="button" className={styles.clearButton} onClick={handleClear}>
            Limpiar filtros
          </button>
        )}
      </div>

      {loading ? (
        <div className={styles.loading} aria-busy="true">
          Cargando directorio…
        </div>
      ) : error !== null ? (
        <div className={styles.error} role="alert">
          {error}
        </div>
      ) : (
        <>
          <DirectoryTable
            rows={rows}
            sort={sort}
            onSort={handleSort}
            onOpenOrganization={handleOpenOrganization}
          />

          {/* La tabla y la paginación van SIEMPRE juntas: el estado de cero
              filas lo resuelve la tabla por dentro, no la pantalla. */}
          <nav className={styles.pagination} aria-label="Paginación del directorio">
            <span className={styles.pageInfo}>
              {`${total} ${total === 1 ? 'organización' : 'organizaciones'} · pág. ${page}/${pageCount}`}
            </span>
            <button
              type="button"
              className={styles.pageButton}
              aria-label="Página anterior"
              disabled={page <= 1}
              onClick={() => setPage(page - 1)}
            >
              ‹
            </button>
            {/* Un botón por página, todas seguidas: con el tamaño de V1 no hace
                falta la ventana con puntos suspensivos de INV-01, y añadirla
                sería inventar un requisito que la spec no pide. */}
            {pages.map((n) => (
              <button
                key={n}
                type="button"
                className={n === page ? `${styles.pageButton} ${styles.currentPage}` : styles.pageButton}
                aria-label={`Página ${n}`}
                aria-current={n === page ? 'page' : undefined}
                onClick={() => setPage(n)}
              >
                {n}
              </button>
            ))}
            <button
              type="button"
              className={styles.pageButton}
              aria-label="Página siguiente"
              disabled={page >= pageCount}
              onClick={() => setPage(page + 1)}
            >
              ›
            </button>
          </nav>
        </>
      )}
    </div>
  );
}

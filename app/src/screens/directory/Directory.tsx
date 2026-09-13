import { useEffect, useState } from 'react';
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
 * La pantalla posee TODO el estado: los filtros aplicados (país + nombre), el
 * texto en curso del buscador —que es estado de interfaz y no un filtro hasta que
 * se confirma con Enter o con la lupa—, los países del desplegable, el orden, la
 * página y las últimas filas/total/páginas que devolvió el servidor.
 *
 * Tres cosas del contrato que conviene tener presentes al leer el cuerpo:
 *
 * 1. **La búsqueda NO es reactiva.** Escribir en el campo no consulta nada (spec
 *    §3: «Búsqueda server-side al pulsar Enter o icono lupa»). El texto se copia
 *    al filtro `name` —recortado— en `runSearch`, y solo ahí. Ese filtro es
 *    aparte del `draft`: `Limpiar filtros` se decide sobre lo APLICADO, no sobre
 *    lo que haya sin confirmar en el campo.
 * 2. **Cambiar el país consulta de inmediato**, sin botón de por medio, y vuelve
 *    a la página 1. El filtro `country` no se toca al buscar por nombre, ni al
 *    revés: los dos controles son combinables (spec §3).
 * 3. **Ordenar y filtrar vuelven a la página 1.**
 */
export function Directory({ profile }: Props) {
  // El perfil llega por contrato de pantalla, pero DIR-01 no restringe nada por
  // miembro: la spec §7 dice que los datos de contacto son públicos para todos
  // los miembros, sin depender de la visibilidad de inventario de cada uno. No
  // condiciona ninguna consulta ni ninguna celda, y por eso no se usa.
  void profile;

  /** Filtros APLICADOS. `Limpiar filtros` se decide sobre esto. */
  const [filters, setFilters] = useState<DirectoryFilters>(EMPTY_FILTERS);
  /** Lo que hay escrito en el campo, todavía sin confirmar. */
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
   * Los países que de verdad hay en el directorio, no la lista ISO completa ni
   * agrupados por continente: eso era del mock. Ya vienen ordenados por la capa
   * de datos y aquí no se reordenan.
   *
   * Si esto rechaza, el desplegable se queda solo con «Todos los países» y el
   * resto de la pantalla sigue funcionando: este fallo NO se pinta en el
   * `role="alert"`, que es exclusivamente para el fallo de `fetchOrganizations`.
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
   * La consulta. Al empezar una carga nueva se descarta lo que había y se vuelve
   * al mensaje de carga: nunca se pintan filas de una respuesta anterior mientras
   * llega la siguiente.
   */
  useEffect(() => {
    let cancelled = false;

    setLoading(true);
    setError(null);
    setRows([]);

    fetchOrganizations({ filters, sort, page })
      .then((result) => {
        if (cancelled) return;
        setRows(result.rows);
        setTotal(result.total);
        setPageCount(result.pageCount);
        setLoading(false);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setError(errorMessage(err));
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [filters, sort, page]);

  /** Enter en el campo y la lupa hacen EXACTAMENTE lo mismo. */
  function runSearch() {
    // Sin tocar `filters.country`: los dos controles se combinan.
    setFilters((current) => ({ ...current, name: draft.trim() }));
    setPage(1);
  }

  function handleCountryChange(code: string) {
    setFilters((current) => ({ ...current, country: code }));
    setPage(1);
  }

  function clearFilters() {
    setFilters(EMPTY_FILTERS);
    // El campo se vacía también EN PANTALLA, no solo el filtro aplicado.
    setDraft('');
    setPage(1);
  }

  function handleSort(field: DirectorySortField) {
    // La dirección la decide `nextSort`, en la capa de datos: desde aquí nunca
    // viaja una dirección. Ordenar vuelve a la página 1 — el orden nuevo reordena
    // TODAS las filas, no solo las de la página en la que estaba el usuario.
    setSort((current) => nextSort(current, field));
    setPage(1);
  }

  /**
   * DIR-02 (la ficha pública de la organización) no está construida todavía y no
   * es una de las tres pantallas del H1: no hay destino al que navegar. El
   * handler existe igualmente porque es el contrato de `DirectoryTable` —igual
   * que `onConsult`/`onContact` en SRCH-01— y el día que exista DIR-02 solo
   * cambia este cuerpo.
   */
  function handleOpenOrganization(_id: string) {
    // Sin destino todavía.
  }

  const pages = Array.from({ length: pageCount }, (_, i) => i + 1);
  const countLabel = total === 1 ? `${total} organización` : `${total} organizaciones`;

  return (
    <div className={styles.screen}>
      <p className={styles.eyebrow}>Directorio de Organizaciones</p>
      <h1 className={styles.title}>Empresas</h1>
      <p className={styles.subtitle}>
        Todas las organizaciones activas en Bearingworld.io. Los datos de contacto son públicos para
        todos los miembros.
      </p>

      {/* La barra de filtros sigue montada y utilizable mientras carga. */}
      <div className={styles.filterBar}>
        <select
          className={styles.select}
          aria-label="País"
          value={filters.country}
          onChange={(event) => handleCountryChange(event.target.value)}
        >
          <option value="">Todos los países</option>
          {countries.map((country) => (
            <option key={country.code} value={country.code}>
              {country.label}
            </option>
          ))}
        </select>

        <input
          className={styles.searchInput}
          type="search"
          aria-label="Buscar organización por nombre"
          placeholder="Buscar organización..."
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') runSearch();
          }}
        />

        <button
          type="button"
          className={styles.searchButton}
          aria-label="Buscar organización"
          onClick={runSearch}
        >
          <svg
            width="15"
            height="15"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
            focusable="false"
          >
            <circle cx="11" cy="11" r="7" />
            <line x1="16.5" y1="16.5" x2="21" y2="21" />
          </svg>
        </button>

        {hasActiveFilters(filters) && (
          <button type="button" className={styles.clearButton} onClick={clearFilters}>
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

          <nav className={styles.pagination} aria-label="Paginación del directorio">
            <span className={styles.pageInfo}>
              {countLabel} · pág. {page}/{pageCount}
            </span>

            <button
              type="button"
              className={styles.pageButton}
              aria-label="Página anterior"
              onClick={() => setPage((current) => Math.max(1, current - 1))}
              disabled={page === 1}
            >
              ‹
            </button>

            {/* Una por página, de 1 a `pageCount`, sin ventana ni puntos
                suspensivos: el tamaño de V1 no los necesita. */}
            {pages.map((n) => (
              <button
                key={n}
                type="button"
                className={
                  n === page ? `${styles.pageButton} ${styles.pageButtonActive}` : styles.pageButton
                }
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
              onClick={() => setPage((current) => current + 1)}
              disabled={page >= pageCount}
            >
              ›
            </button>
          </nav>
        </>
      )}
    </div>
  );
}

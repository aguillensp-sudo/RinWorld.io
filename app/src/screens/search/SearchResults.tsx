import { useCallback, useEffect, useState } from 'react';
import type { MemberProfile } from '../../lib/session';
import {
  EMPTY_CRITERIA,
  consultSummary,
  fetchResults,
  meetsMinQuantity,
  metaCounterLabel,
  nextSort,
  sortRows,
  toggleFavorite,
  type SearchCriteria,
  type SearchPage,
  type Sort,
  type SortColumn,
} from '../../lib/search';
import { sendInquiries, type InquiryLine } from '../../lib/thread-detail';
import { FilterChips } from './FilterChips';
import { ResultsTable } from './ResultsTable';
import styles from './SearchResults.module.css';

interface Props {
  profile: MemberProfile;
  /** Inyectable para que los tests no dependan del reloj. */
  now?: Date;
  /**
   * Los criterios que acaba de escribir VERA, o `null` si no ha escrito ninguno.
   *
   * **Opcional a propósito.** `<SearchResults profile now />` a secas sigue
   * siendo válido, que es exactamente como lo monta el contrato de aceptación
   * del día 6. Un prop nuevo obligatorio lo habría roto desde fuera, y con él la
   * medida del objetivo 4 para esta pantalla.
   *
   * La pantalla **sigue siendo la dueña** de los criterios: esto es un empujón,
   * no una segunda fuente de verdad. Por eso el usuario puede quitar después el
   * chip que puso VERA, y por eso los chips se siguen derivando de los criterios
   * y no al revés — `search.ts:154`, escrito el día 6 previendo justo esto.
   */
  veraCriteria?: SearchCriteria | null;
}

/**
 * Pantalla SRCH-01 · Panel de Resultados de Búsqueda.
 *
 * Es la pantalla, no un componente de presentación: posee los criterios, el
 * orden, la selección, la carga y el error, y es quien decide que al alternar
 * un favorito se vuelve a consultar la base (`toggleFavorite` + `fetchResults`).
 * La tabla y los chips son presentacionales y no guardan estado de datos.
 */
export function SearchResults({ profile, now, veraCriteria }: Props) {
  const [criteria, setCriteria] = useState<SearchCriteria>(EMPTY_CRITERIA);
  const [sort, setSort] = useState<Sort | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [page, setPage] = useState<SearchPage | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  /** El resultado de la última tanda de "Consultar seleccionados" (GAP-004).
   *  `null` = no se ha lanzado ninguna todavía en esta pantalla. */
  const [consultBanner, setConsultBanner] = useState<string | null>(null);
  const [consulting, setConsulting] = useState(false);

  const load = useCallback(
    async (c: SearchCriteria) => {
      setLoading(true);
      setError(false);
      try {
        const p = await fetchResults({ orgId: profile.orgId, memberId: profile.id, criteria: c });
        setPage(p);
      } catch {
        setError(true);
        setPage(null);
      } finally {
        setLoading(false);
      }
    },
    [profile.orgId, profile.id],
  );

  /*
   * VERA escribe: se adoptan sus criterios y el efecto de abajo relanza la
   * consulta sola, porque `criteria` es la única entrada de esa consulta.
   *
   * Depende de la IDENTIDAD del objeto, no de su contenido: cada búsqueda de
   * VERA construye uno nuevo, así que dos búsquedas seguidas con los mismos
   * criterios vuelven a lanzarse — que es lo que se quiere cuando el usuario
   * repite la pregunta. Y `null` no borra nada: no escribir no es escribir vacío.
   */
  useEffect(() => {
    if (veraCriteria) setCriteria(veraCriteria);
  }, [veraCriteria]);

  useEffect(() => {
    void load(criteria);
  }, [criteria, load]);

  const handleSort = useCallback((column: SortColumn) => {
    setSort((current) => nextSort(current, column));
  }, []);

  const handleToggleRow = useCallback((lineId: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(lineId)) next.delete(lineId);
      else next.add(lineId);
      return next;
    });
  }, []);

  const handleToggleFavorite = useCallback(
    async (orgId: string) => {
      const row = page?.rows.find((r) => r.orgId === orgId);
      if (!row) return;
      try {
        // El recuento agregado lo mantiene el trigger de la base; al volver a
        // consultar vemos el número nuevo.
        await toggleFavorite(profile.id, orgId, !row.isFavorite);
        await load(criteria);
      } catch {
        setError(true);
      }
    },
    [page, profile.id, criteria, load],
  );

  // El destino de estos dos callbacks (abrir tarjeta de consulta / crear hilo)
  // es la fila del día 10 del Plan §3 (GAP-004). Hoy solo avisan, y el aviso lo
  // consume la pantalla cuando el wiring exista.
  const handleConsult = useCallback((_lineId: string) => {}, []);
  const handleContact = useCallback((_orgId: string) => {}, []);

  /**
   * "Consultar Seleccionados" (GAP-004, `Plan §3` día 10).
   *
   * El boundary de GAP-004 es literal: *"la selección y el disparo de la
   * acción pertenecen a conversational-search; la gestión del hilo, tarjeta de
   * consulta y cifrado E2EE pertenecen a messaging-and-negotiation"*. Esta
   * pantalla decide QUÉ se envía —las filas marcadas, sin las ya consultadas—
   * y `sendInquiries` (thread-detail.ts) hace el resto; SearchResults no toca
   * `threads` ni `thread_items` ni sabe si el hilo existía.
   *
   * `results-row-actions · consultar seleccionados en lote` no abre ningún
   * formulario ni redirige: *"el sistema envía... sin abrir ningún hilo en
   * pantalla"* y *"el usuario permanece en SRCH-01"*. Por eso esto no navega a
   * ningún sitio — solo recarga la tabla (que es de dónde sale de verdad el
   * estado "ya consultada", nunca de una marca puesta a mano en cliente) y
   * enseña el resultado.
   */
  const handleConsultSelected = useCallback(async () => {
    if (!page || consulting) return;

    // Defensivo, no solo cosmético: una fila ya consultada seguiría marcable
    // vía "Seleccionar todos", y create_inquiry la rechazaría con el aviso de
    // inquiry-card. Filtrar aquí evita mandar una llamada que se sabe inútil.
    const filas = page.rows.filter((r) => selected.has(r.id) && !r.consulted);
    if (filas.length === 0) {
      setConsultBanner('Las filas seleccionadas ya estaban consultadas.');
      return;
    }

    setConsulting(true);
    try {
      const lineas: InquiryLine[] = filas.map((r) => ({
        lineId: r.id,
        distributorOrgId: r.orgId,
        quantity: r.quantity,
      }));
      const resultados = await sendInquiries(lineas, profile.orgId);
      setConsultBanner(consultSummary(resultados));
      setSelected(new Set());
      await load(criteria);
    } finally {
      setConsulting(false);
    }
  }, [page, selected, consulting, criteria, load]);

  const allSelected = page !== null && page.rows.length > 0 && page.rows.every((r) => selected.has(r.id));

  const handleToggleSelectAll = useCallback(() => {
    if (!page) return;
    if (allSelected) setSelected(new Set());
    else setSelected(new Set(page.rows.map((r) => r.id)));
  }, [page, allSelected]);

  const rows = page ? sortRows(page.rows, sort) : [];
  const withStock = page ? page.rows.filter((r) => meetsMinQuantity(r.quantity, criteria.minQuantity)).length : 0;
  const reFetch = useCallback(() => {
    void load(criteria);
  }, [load, criteria]);

  return (
    <div className={styles.page}>
      <div className={styles.eyebrow}>Módulo 03 · Búsqueda Conversacional</div>
      <h1 className={styles.title}>Resultados de búsqueda</h1>

      <FilterChips criteria={criteria} onChange={setCriteria} />

      {error ? (
        <div className={styles.error} role="alert">
          <p>No se pudieron cargar los resultados. Inténtalo de nuevo.</p>
          <button type="button" className={styles.retry} onClick={reFetch}>
            Reintentar
          </button>
        </div>
      ) : (
        <>
          <div className={styles.metaBar}>
            {page && (
              <div className={styles.metaCount}>{metaCounterLabel(page.total, withStock, criteria.minQuantity)}</div>
            )}
            {page && page.rows.length > 0 && (
              <button type="button" className={styles.selectAll} onClick={handleToggleSelectAll}>
                {allSelected ? 'Deseleccionar todos' : 'Seleccionar todos'}
              </button>
            )}
            {/* F-039: la capability manda >=2, no el >=1 de la spec §3. Con una
                sola fila marcada la acción correcta es "Consultar" de esa fila. */}
            <button
              type="button"
              className={styles.consultSelected}
              disabled={selected.size < 2 || consulting}
              onClick={() => {
                void handleConsultSelected();
              }}
            >
              {consulting ? 'Enviando…' : 'Consultar seleccionados'}
            </button>
            {/* SRCH-03 está fuera del alcance (Plan §9): no existe tabla de
                watchers. El botón se pinta deshabilitado y con el motivo, como
                F-023 e. Un aviso que nadie va a mandar no es un botón vivo. */}
            <button
              type="button"
              className={styles.watcher}
              disabled
              title="Los watchers están fuera del alcance de esta versión"
            >
              <i className="ti ti-bell-plus" aria-hidden="true" />
              Crear watcher con estos criterios
            </button>
          </div>

          {consultBanner && (
            <div className={styles.consultBanner} role="status">
              {consultBanner}
            </div>
          )}

          <div className={styles.resultsArea} aria-busy={loading}>
            {loading ? (
              <div className={styles.spinner} role="status">
                <span className={styles.srOnly}>Buscando...</span>
              </div>
            ) : page ? (
              <ResultsTable
                rows={rows}
                sort={sort}
                selected={selected}
                minQuantity={criteria.minQuantity}
                now={now ?? new Date()}
                onSort={handleSort}
                onToggleRow={handleToggleRow}
                onToggleFavorite={handleToggleFavorite}
                onConsult={handleConsult}
                onContact={handleContact}
              />
            ) : null}
          </div>

          {page?.capped && (
            <div className={styles.cappedNotice}>
              Mostrando los primeros 200 resultados. Afina los filtros para verlos todos.
            </div>
          )}
        </>
      )}
    </div>
  );
}

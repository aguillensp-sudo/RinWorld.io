import { useCallback, useEffect, useRef, useState } from 'react';
import { errorMessage, type MemberProfile } from '../../lib/session';
import {
  canSearch,
  fetchOffers,
  fetchPartKeys,
  initialPartCriteria,
  normalizeRef,
  withoutPartChip,
  type OffersPage,
  type OffersSelection,
  type PartChipKey,
  type PartKeysPage,
  type PartSearchCriteria,
} from '../../lib/part-search';
import {
  consultSummary,
  countryName,
  nextSort,
  quantityLabel,
  sortRows,
  toggleFavorite,
  type SearchResultRow,
  type Sort,
  type SortColumn,
} from '../../lib/search';
import { INQUIRY_FORM_TEXTS, type InquiryDraft } from '../../lib/inquiry-form';
import { sendInquiries, type InquiryOutcome } from '../../lib/thread-detail';
import { FavoriteConfirmDialog } from '../../components/FavoriteConfirmDialog';
import { InquiryFormModal } from '../messages/InquiryFormModal';
import { PartKeyGrid } from './PartKeyGrid';
import { PartSearchForm } from './PartSearchForm';
import { Pager } from './Pager';
import { ResultsTable } from './ResultsTable';
import base from './SearchResults.module.css';
import styles from './PartSearch.module.css';

interface Props {
  profile: MemberProfile;
  /** Inyectable para que los tests no dependan del reloj. */
  now?: Date;
  /**
   * Lo último que ha buscado VERA (`buscar_en_catalogo`) o pedido un watcher («Ver resultados»): se adopta y se
   * lanza la fase A. Depende de la identidad del objeto: dos búsquedas iguales seguidas se relanzan, y `null` no
   * borra nada.
   */
  veraCriteria?: PartSearchCriteria | null;
  onOpenWatchers?: () => void;
  onOpenBatch?: () => void;
  onOpenFavorites?: () => void;
  onContactOrganization?: (orgId: string) => void;
  /** Lo que hay en pantalla, para la pregunta siguiente de VERA (`F-101`) y para `F-258` (lo quitado a mano). */
  onCriteriaChange?: (criteria: PartSearchCriteria) => void;
}

interface ConsultQueue {
  rows: SearchResultRow[];
  index: number;
  omitidas: number;
  outcomes: InquiryOutcome[];
}

/**
 * SRCH-01 · búsqueda en dos fases (`openspec/changes/amend-srch01-busqueda-en-dos-fases/`).
 *
 *   1. El usuario escribe la referencia (y, con *Filtros*, el resto) y busca con Enter o la lupa.
 *   2. Fase A: la lista previa de claves con su número de ofertas (`PartKeyGrid`), paginada.
 *   3. Fase B: marca una o varias claves, las de la página o todas.
 *   4. Fase C: la tabla de ofertas de lo marcado (`ResultsTable`, sin cambios), de la más reciente a la más
 *      antigua y paginada en el servidor.
 *
 * Sustituyó a `SearchResults.tsx` (la pantalla de una sola tabla, retirada el 25-oct-2026). Las acciones de la
 * tabla (Consultar en cola, Contactar, Favoritos con confirmación) son las de allí, y sus tests vinieron con ellas
 * (`PartSearch.consultas.fuera-de-contrato.test.tsx`, `PartSearch.favoritos.fuera-de-contrato.test.tsx`).
 */
export function PartSearch({
  profile,
  now,
  veraCriteria,
  onOpenWatchers,
  onOpenBatch,
  onOpenFavorites,
  onContactOrganization,
  onCriteriaChange,
}: Props) {
  const [criteria, setCriteria] = useState<PartSearchCriteria>(() => initialPartCriteria(profile.orgContinent));
  /** Los criterios de la última búsqueda lanzada; `null` = todavía no se ha buscado nada. */
  const [searched, setSearched] = useState<PartSearchCriteria | null>(null);
  const [view, setView] = useState<'keys' | 'offers'>('keys');

  const [keysPage, setKeysPage] = useState<PartKeysPage | null>(null);
  const [keysLoading, setKeysLoading] = useState(false);
  const [keysError, setKeysError] = useState(false);
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set());

  const [selection, setSelection] = useState<OffersSelection | null>(null);
  const [offersPage, setOffersPage] = useState<OffersPage | null>(null);
  const [offersLoading, setOffersLoading] = useState(false);
  const [offersError, setOffersError] = useState(false);
  const [sort, setSort] = useState<Sort | null>(null);
  const [selectedRows, setSelectedRows] = useState<Set<string>>(new Set());

  const [favoritePending, setFavoritePending] = useState<{ orgId: string; orgName: string; adding: boolean } | null>(null);
  const [favoriteBusy, setFavoriteBusy] = useState(false);
  const [favoriteError, setFavoriteError] = useState<string | null>(null);
  const [consultBanner, setConsultBanner] = useState<string | null>(null);
  const [consulting, setConsulting] = useState(false);
  const [queue, setQueue] = useState<ConsultQueue | null>(null);
  const [failed, setFailed] = useState<InquiryOutcome | null>(null);

  /**
   * Solo la última carga lanzada escribe: la red no garantiza el orden, y una respuesta vieja que llega la última
   * pisaría la de los criterios nuevos (lo que ya pasó en la pantalla vieja con el chip `Ref 32007`).
   */
  const lastKeys = useRef(0);
  const lastOffers = useRef(0);

  // ---------------------------------------------------------------------------
  // Fase A
  // ---------------------------------------------------------------------------

  const loadKeys = useCallback(async (c: PartSearchCriteria, page: number) => {
    const mia = ++lastKeys.current;
    setKeysLoading(true);
    setKeysError(false);
    try {
      const p = await fetchPartKeys(c, page);
      if (mia !== lastKeys.current) return;
      setKeysPage(p);
    } catch {
      if (mia !== lastKeys.current) return;
      setKeysError(true);
      setKeysPage(null);
    } finally {
      if (mia === lastKeys.current) setKeysLoading(false);
    }
  }, []);

  /** Una búsqueda nueva: vuelve a la lista previa y olvida la selección (es de los criterios de antes). */
  const runSearch = useCallback(
    (c: PartSearchCriteria) => {
      setCriteria(c);
      if (!canSearch(c)) return;
      setSearched(c);
      setView('keys');
      setSelectedKeys(new Set());
      setSelection(null);
      setOffersPage(null);
      setConsultBanner(null);
      void loadKeys(c, 1);
    },
    [loadKeys],
  );

  useEffect(() => {
    if (veraCriteria) runSearch(veraCriteria);
  }, [veraCriteria, runSearch]);

  useEffect(() => {
    onCriteriaChange?.(criteria);
  }, [criteria, onCriteriaChange]);

  const handleRemoveChip = useCallback(
    (key: PartChipKey) => {
      const next = withoutPartChip(criteria, key);
      if (searched) runSearch(next);
      else setCriteria(next);
    },
    [criteria, searched, runSearch],
  );

  const toggleKey = useCallback((key: string) => {
    setSelectedKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);

  const pageKeys = keysPage?.keys.map((k) => k.key) ?? [];
  const allPageSelected = pageKeys.length > 0 && pageKeys.every((k) => selectedKeys.has(k));

  const togglePageKeys = useCallback(() => {
    setSelectedKeys((prev) => {
      const next = new Set(prev);
      if (allPageSelected) pageKeys.forEach((k) => next.delete(k));
      else pageKeys.forEach((k) => next.add(k));
      return next;
    });
  }, [allPageSelected, pageKeys]);

  // ---------------------------------------------------------------------------
  // Fase C
  // ---------------------------------------------------------------------------

  const loadOffers = useCallback(
    async (sel: OffersSelection, page: number) => {
      if (!searched) return;
      const mia = ++lastOffers.current;
      setOffersLoading(true);
      setOffersError(false);
      try {
        const p = await fetchOffers({ orgId: profile.orgId, memberId: profile.id, criteria: searched, selection: sel, page });
        if (mia !== lastOffers.current) return;
        setOffersPage(p);
      } catch {
        if (mia !== lastOffers.current) return;
        setOffersError(true);
        setOffersPage(null);
      } finally {
        if (mia === lastOffers.current) setOffersLoading(false);
      }
    },
    [searched, profile.orgId, profile.id],
  );

  const showOffers = useCallback(
    (sel: OffersSelection) => {
      setSelection(sel);
      setView('offers');
      setSort(null);
      setSelectedRows(new Set());
      setConsultBanner(null);
      void loadOffers(sel, 1);
    },
    [loadOffers],
  );

  const reloadOffers = useCallback(async () => {
    if (selection) await loadOffers(selection, offersPage?.page ?? 1);
  }, [selection, offersPage, loadOffers]);

  const handleSort = useCallback((column: SortColumn) => {
    setSort((current) => nextSort(current, column));
  }, []);

  const handleToggleRow = useCallback((lineId: string) => {
    setSelectedRows((prev) => {
      const next = new Set(prev);
      if (next.has(lineId)) next.delete(lineId);
      else next.add(lineId);
      return next;
    });
  }, []);

  const handleToggleFavorite = useCallback(
    (orgId: string) => {
      const row = offersPage?.rows.find((r) => r.orgId === orgId);
      if (!row) return;
      setFavoriteError(null);
      setFavoritePending({ orgId, orgName: row.orgName, adding: !row.isFavorite });
    },
    [offersPage],
  );

  const confirmFavorite = useCallback(async () => {
    if (!favoritePending) return;
    setFavoriteBusy(true);
    setFavoriteError(null);
    try {
      await toggleFavorite(profile.id, favoritePending.orgId, favoritePending.adding);
      await reloadOffers();
      setFavoritePending(null);
    } catch (err: unknown) {
      setFavoriteError(errorMessage(err instanceof Error ? err : new Error(String(err))));
    } finally {
      setFavoriteBusy(false);
    }
  }, [favoritePending, profile.id, reloadOffers]);

  const handleContact = useCallback((_orgId: string) => {}, []);

  /** «Consultar» y «Consultar seleccionados»: un formulario por fila, en cola (MSG-03 §3.2, F-249). */
  const consultRows = useCallback(
    (ids: Set<string>) => {
      if (!offersPage || consulting || queue) return;
      const filas = offersPage.rows.filter((r) => ids.has(r.id) && !r.consulted);
      const omitidas = offersPage.rows.filter((r) => ids.has(r.id) && r.consulted).length;
      if (filas.length === 0) {
        setConsultBanner('Las filas seleccionadas ya estaban consultadas.');
        return;
      }
      setConsultBanner(null);
      setFailed(null);
      setQueue({ rows: filas, index: 0, omitidas, outcomes: [] });
    },
    [offersPage, consulting, queue],
  );

  const finishQueue = useCallback(
    async (q: ConsultQueue, outcomes: InquiryOutcome[]) => {
      setQueue(null);
      setFailed(null);
      if (outcomes.length === 0) return;
      setConsultBanner(consultSummary(outcomes, q.omitidas));
      const enviadas = new Set(outcomes.filter((o) => o.ok).map((o) => o.lineId));
      if (enviadas.size === 0) return;
      setSelectedRows((prev) => {
        const resto = new Set(prev);
        for (const id of enviadas) resto.delete(id);
        return resto;
      });
      await reloadOffers();
    },
    [reloadOffers],
  );

  const advance = useCallback(
    async (q: ConsultQueue, outcomes: InquiryOutcome[]) => {
      setFailed(null);
      if (q.index + 1 >= q.rows.length) {
        await finishQueue(q, outcomes);
        return;
      }
      setQueue({ ...q, index: q.index + 1, outcomes });
    },
    [finishQueue],
  );

  const submitCurrent = useCallback(
    async (draft: InquiryDraft) => {
      if (!queue || consulting) return;
      const fila = queue.rows[queue.index];
      if (!fila) return;
      setConsulting(true);
      let resultado: InquiryOutcome;
      try {
        const [r] = await sendInquiries(
          [{ lineId: fila.id, distributorOrgId: fila.orgId, quantity: draft.quantity, notes: draft.notes }],
          profile.orgId,
        );
        resultado = r ?? { lineId: fila.id, distributorOrgId: fila.orgId, ok: false, error: 'No hubo respuesta del envío.' };
      } catch (err) {
        resultado = { lineId: fila.id, distributorOrgId: fila.orgId, ok: false, error: errorMessage(err) };
      } finally {
        setConsulting(false);
      }
      if (resultado.ok) await advance(queue, [...queue.outcomes, resultado]);
      else setFailed(resultado);
    },
    [queue, consulting, profile.orgId, advance],
  );

  const cancelCurrent = useCallback(() => {
    if (!queue || consulting) return;
    void advance(queue, failed ? [...queue.outcomes, failed] : queue.outcomes);
  }, [queue, consulting, failed, advance]);

  const filaActual = queue ? (queue.rows[queue.index] ?? null) : null;
  const duplicada = failed?.error === INQUIRY_FORM_TEXTS.duplicateWarning;
  const pageRows = offersPage?.rows ?? [];
  const allRowsSelected = pageRows.length > 0 && pageRows.every((r) => selectedRows.has(r.id));

  const toggleAllRows = useCallback(() => {
    if (allRowsSelected) setSelectedRows(new Set());
    else setSelectedRows(new Set(pageRows.map((r) => r.id)));
  }, [allRowsSelected, pageRows]);

  // ---------------------------------------------------------------------------
  // Pintado
  // ---------------------------------------------------------------------------

  const buscada = searched ? normalizeRef(searched.ref) : '';
  /** «No hay ninguna que EMPIECE POR… Se muestran las que EMPIEZAN POR…»: subjuntivo singular, luego plural. */
  const modo = searched?.contains ? 'contenga' : 'empiece por';
  const modoPlural = searched?.contains ? 'contienen' : 'empiezan por';
  const sinCoincidencias = !keysLoading && !keysError && keysPage !== null && keysPage.page === 1 && keysPage.totalKeys === 0;
  const clavesDeLaSeleccion = selection?.kind === 'keys' ? selection.keys.length : (keysPage?.totalKeys ?? 0);

  return (
    <div className={base.page}>
      <div className={styles.header}>
        <div>
          <div className={base.eyebrow}>Módulo 03 · Búsqueda Conversacional</div>
          <h1 className={base.title}>Búsqueda de referencias</h1>
        </div>
        <div className={styles.headerActions}>
          {onOpenBatch && (
            <button type="button" className={base.watcher} onClick={onOpenBatch}>
              <i className="ti ti-list-search" aria-hidden="true" />
              Búsqueda por lotes
            </button>
          )}
          {onOpenFavorites && (
            <button type="button" className={base.watcher} onClick={onOpenFavorites}>
              <i className="ti ti-star" aria-hidden="true" />
              Mis favoritos
            </button>
          )}
          {onOpenWatchers && (
            <button type="button" className={base.watcher} onClick={onOpenWatchers}>
              <i className="ti ti-bell" aria-hidden="true" />
              Mis watchers
            </button>
          )}
        </div>
      </div>

      <PartSearchForm criteria={criteria} onSubmit={runSearch} onRemoveChip={handleRemoveChip} />

      {!searched ? (
        <p className={styles.hint}>Escribe una referencia y pulsa Enter o la lupa.</p>
      ) : view === 'keys' ? (
        <div className={base.resultsArea} aria-busy={keysLoading}>
          {keysError ? (
            <div className={base.error} role="alert">
              <p>No se pudo cargar la lista de referencias. Inténtalo de nuevo.</p>
              <button type="button" className={base.retry} onClick={() => void loadKeys(searched, keysPage?.page ?? 1)}>
                Reintentar
              </button>
            </div>
          ) : keysLoading && !keysPage ? (
            <div className={base.spinner} role="status">
              <span className={base.srOnly}>Buscando...</span>
            </div>
          ) : sinCoincidencias ? (
            /* Caso 1.4: ni el primer carácter casa con nada visible. */
            <div className={styles.empty} role="status">
              <p className={styles.emptyTitle}>No hay coincidencias para «{buscada}».</p>
              <p className={styles.emptyText}>
                Puedes crear un watcher para que te avisemos cuando alguien la publique
                {searched.area ? ', o buscar también fuera de la zona.' : '.'}
              </p>
              <div className={styles.emptyActions}>
                <button
                  type="button"
                  className={base.watcher}
                  disabled
                  title="Crear watchers todavía no está disponible"
                >
                  <i className="ti ti-bell-plus" aria-hidden="true" />
                  Crear watcher con estos criterios
                </button>
                {searched.area && (
                  <button type="button" className={base.consultSelected} onClick={() => handleRemoveChip('area')}>
                    Buscar en todas las zonas
                  </button>
                )}
              </div>
            </div>
          ) : keysPage ? (
            <>
              {keysPage.truncated && keysPage.matchedRef && (
                /* Caso 1.3: se encontró recortando por el final. */
                <div className={base.cappedNotice} role="status">
                  No hay ninguna referencia que {modo} «{buscada}». Se muestran las que {modoPlural} «{keysPage.matchedRef}».
                </div>
              )}

              <div className={`${base.metaBar} ${styles.metaBarTop}`}>
                <div className={base.metaCount}>
                  {keysPage.totalKeys === 1 ? '1 referencia' : `${quantityLabel(keysPage.totalKeys)} referencias`} ·{' '}
                  {keysPage.totalOffers === 1 ? '1 oferta' : `${quantityLabel(keysPage.totalOffers)} ofertas`}
                </div>
                <button type="button" className={base.selectAll} onClick={togglePageKeys}>
                  {allPageSelected ? 'Quitar las de esta página' : 'Seleccionar las de esta página'}
                </button>
                <button
                  type="button"
                  className={base.consultSelected}
                  disabled={selectedKeys.size === 0}
                  onClick={() => showOffers({ kind: 'keys', keys: [...selectedKeys] })}
                >
                  Ver ofertas de las seleccionadas ({selectedKeys.size})
                </button>
                <button
                  type="button"
                  className={base.watcher}
                  onClick={() =>
                    keysPage.matchedRef && showOffers({ kind: 'all', matchedRef: keysPage.matchedRef })
                  }
                >
                  Ver ofertas de todas ({quantityLabel(keysPage.totalKeys)})
                </button>
              </div>

              {/* La rejilla lleva su propio scroll: con 60 claves no cabe, y sin esto el paginador quedaba debajo,
                  inalcanzable (el mismo problema de F-088 en la tabla vieja). */}
              <div className={styles.gridScroll}>
                <PartKeyGrid keys={keysPage.keys} selected={selectedKeys} onToggle={toggleKey} />
              </div>
              <Pager
                page={keysPage.page}
                pageCount={keysPage.pageCount}
                onPage={(p) => void loadKeys(searched, p)}
                label="Páginas de referencias"
              />
            </>
          ) : null}
        </div>
      ) : (
        <div className={base.resultsArea} aria-busy={offersLoading}>
          <button type="button" className={styles.back} onClick={() => setView('keys')}>
            ‹ Volver a la lista de referencias
          </button>

          {offersError ? (
            <div className={base.error} role="alert">
              <p>No se pudieron cargar las ofertas. Inténtalo de nuevo.</p>
              <button type="button" className={base.retry} onClick={() => void reloadOffers()}>
                Reintentar
              </button>
            </div>
          ) : (
            <>
              <div className={base.metaBar}>
                {offersPage && (
                  <div className={base.metaCount}>
                    {offersPage.total === 1 ? '1 oferta' : `${quantityLabel(offersPage.total)} ofertas`} de{' '}
                    {clavesDeLaSeleccion === 1 ? '1 referencia' : `${quantityLabel(clavesDeLaSeleccion)} referencias`}
                  </div>
                )}
                {pageRows.length > 0 && (
                  <button type="button" className={base.selectAll} onClick={toggleAllRows}>
                    {allRowsSelected ? 'Deseleccionar todos' : 'Seleccionar todos'}
                  </button>
                )}
                <button
                  type="button"
                  className={base.consultSelected}
                  disabled={selectedRows.size < 1 || consulting || queue !== null}
                  onClick={() => consultRows(selectedRows)}
                >
                  {consulting ? 'Enviando…' : 'Consultar seleccionados'}
                </button>
              </div>

              {consultBanner && (
                <div className={base.consultBanner} role="status">
                  {consultBanner}
                </div>
              )}

              {sort && offersPage && offersPage.pageCount > 1 && (
                <p className={styles.sortNote}>El orden por columna se aplica solo a esta página.</p>
              )}

              {offersLoading && !offersPage ? (
                <div className={base.spinner} role="status">
                  <span className={base.srOnly}>Buscando...</span>
                </div>
              ) : offersPage ? (
                <>
                  <ResultsTable
                    rows={sort ? sortRows(offersPage.rows, sort) : offersPage.rows}
                    sort={sort}
                    selected={selectedRows}
                    minQuantity={searched.minQuantity}
                    now={now ?? new Date()}
                    onSort={handleSort}
                    onToggleRow={handleToggleRow}
                    onToggleFavorite={handleToggleFavorite}
                    onConsult={(lineId) => consultRows(new Set([lineId]))}
                    onContact={handleContact}
                    onContactOrganization={onContactOrganization}
                  />
                  <Pager
                    page={offersPage.page}
                    pageCount={offersPage.pageCount}
                    onPage={(p) => selection && void loadOffers(selection, p)}
                    label="Páginas de ofertas"
                  />
                </>
              ) : null}
            </>
          )}
        </div>
      )}

      {favoritePending && (
        <FavoriteConfirmDialog
          orgName={favoritePending.orgName}
          adding={favoritePending.adding}
          busy={favoriteBusy}
          error={favoriteError}
          onConfirm={() => void confirmFavorite()}
          onCancel={() => {
            setFavoritePending(null);
            setFavoriteError(null);
          }}
        />
      )}

      {queue && filaActual && (
        <InquiryFormModal
          key={filaActual.id}
          index={queue.index}
          total={queue.rows.length}
          reference={filaActual.partNumber}
          brand={filaActual.brand}
          country={countryName(filaActual.country)}
          duplicate={duplicada}
          busy={consulting}
          error={duplicada ? null : (failed?.error ?? null)}
          onSubmit={(draft) => void submitCurrent(draft)}
          onCancel={cancelCurrent}
        />
      )}
    </div>
  );
}

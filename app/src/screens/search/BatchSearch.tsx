import { useCallback, useMemo, useState } from 'react';
import { errorMessage } from '../../lib/session';
import type { MemberProfile } from '../../lib/session';
import {
  MAX_BATCH,
  batchMetaLabel,
  buildSummaryCsv,
  fetchBatchResults,
  overLimitNotice,
  parseReferences,
  referenceCounterLabel,
  splitBatch,
  summaryFileName,
  type BatchResult,
} from '../../lib/batch';
import {
  nextSort,
  toggleFavorite,
  type SearchResultRow,
  type Sort,
  type SortColumn,
} from '../../lib/search';
import { BatchCard } from './BatchCard';
import styles from './BatchSearch.module.css';

interface Props {
  profile: MemberProfile;
  /** Inyectable para que los tests no dependan del reloj. */
  now?: Date;
}

/**
 * Pantalla SRCH-02 · Panel Consolidado de Búsqueda por Lotes.
 *
 * Es la pantalla, no un componente de presentación: posee el texto pegado, los
 * resultados por referencia, la tanda pendiente, la carga, el error, el
 * orden/selección/expansión por tarjeta y es quien decide que al alternar un
 * favorito se actualizan todas las filas de esa organización en todas las
 * tarjetas.
 *
 * No lleva migración ni consulta nueva: cada referencia se busca con
 * `fetchBatchResults` (que por dentro usa el mismo `fetchResults` de SRCH-01),
 * y la lógica pura de parseo/tope/cabeceras/CSV vive en `lib/batch.ts`. Aquí
 * solo se pinta y se orquesta.
 */
export function BatchSearch({ profile, now }: Props) {
  const [text, setText] = useState('');
  /** `null` = no se ha lanzado ninguna búsqueda todavía en esta pantalla. */
  const [results, setResults] = useState<BatchResult[] | null>(null);
  /** Las referencias que quedaron fuera de la tanda actual (spec §3: nunca se trunca en silencio). */
  const [pending, setPending] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /** Referencias expandidas: solo la primera arranca expandida, cada una se abre y se cierra por su cuenta. */
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(new Set<string>());
  /** Un `Sort | null` por referencia; todas arrancan en `null`. */
  const [sorts, setSorts] = useState<Record<string, Sort | null>>({});
  /** Un único conjunto de ids de línea compartido por todas las tarjetas. */
  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set<string>());

  const refs = useMemo(() => parseReferences(text), [text]);
  const overLimit = refs.length > MAX_BATCH;
  const currentTime = now ?? new Date();

  /**
   * Una búsqueda. `rest` son las referencias que NO entran en esta tanda: vacío
   * cuando el usuario descarta el resto ("Continuar con las primeras 50") y las
   * sobrantes cuando decide dividir en tandas.
   */
  const runSearch = useCallback(
    async (batchRefs: string[], rest: string[]) => {
      setLoading(true);
      setError(null);
      try {
        const batch = await fetchBatchResults(batchRefs, {
          orgId: profile.orgId,
          memberId: profile.id,
        });
        setResults(batch);
        setPending(rest);
        const first = batch[0];
        setExpanded(new Set(first ? [first.reference] : []));
        setSorts({});
        setSelected(new Set());
      } catch (e) {
        setResults(null);
        setError(errorMessage(e));
      } finally {
        setLoading(false);
      }
    },
    [profile.orgId, profile.id],
  );

  const handleSearch = useCallback(() => {
    void runSearch(refs, []);
  }, [runSearch, refs]);

  const handleFirstFifty = useCallback(() => {
    const { now: primeras } = splitBatch(refs);
    void runSearch(primeras, []);
  }, [runSearch, refs]);

  const handleSplit = useCallback(() => {
    const { now: primeras, rest } = splitBatch(refs);
    void runSearch(primeras, rest);
  }, [runSearch, refs]);

  const handleNextBatch = useCallback(() => {
    const { now: primeras, rest } = splitBatch(pending);
    void runSearch(primeras, rest);
  }, [runSearch, pending]);

  const handleToggleCard = useCallback((reference: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(reference)) next.delete(reference);
      else next.add(reference);
      return next;
    });
  }, []);

  const handleSort = useCallback((reference: string, column: SortColumn) => {
    setSorts((prev) => ({ ...prev, [reference]: nextSort(prev[reference] ?? null, column) }));
  }, []);

  const handleToggleRow = useCallback((lineId: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(lineId)) next.delete(lineId);
      else next.add(lineId);
      return next;
    });
  }, []);

  /**
   * Favorito (spec §3, igual que SRCH-01): la fila puede estar en cualquier
   * tarjeta, y el cambio se propaga a TODAS las filas de esa organización en
   * TODAS las tarjetas, porque es la misma organización.
   */
  const handleToggleFavorite = useCallback(
    async (orgId: string) => {
      const filas = (results ?? []).flatMap((r) => r.page?.rows ?? []);
      const fila = filas.find((r) => r.orgId === orgId);
      if (!fila) return;
      const next = !fila.isFavorite;
      try {
        await toggleFavorite(profile.id, orgId, next);
      } catch {
        // Un favorito que no se pudo guardar no cambia nada en pantalla.
        return;
      }
      setResults((prev) => {
        if (!prev) return prev;
        return prev.map((r) => {
          if (r.page === null) return r;
          let changed = false;
          const rows = r.page.rows.map((row): SearchResultRow => {
            if (row.orgId !== orgId) return row;
            changed = true;
            return {
              ...row,
              isFavorite: next,
              favoriteCount: Math.max(0, row.favoriteCount + (next ? 1 : -1)),
            };
          });
          return changed ? { ...r, page: { ...r.page, rows } } : r;
        });
      });
    },
    [results, profile.id],
  );

  /**
   * Exportar resumen (spec §3): solo CSV — el PDF necesita una dependencia que
   * el proyecto no tiene, y el mock no se reproduce.
   */
  const handleExport = useCallback(() => {
    if (!results) return;
    const blob = new Blob([buildSummaryCsv(results)], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = summaryFileName(now ?? new Date());
    link.click();
    URL.revokeObjectURL(url);
  }, [results, now]);

  // Igual que en SRCH-01: `Consultar` y `Contactar` por fila son manejadores
  // vacíos, y SRCH-02 no lleva `Consultar seleccionados` en su metabarra.
  const handleConsult = useCallback((_lineId: string) => {}, []);
  const handleContact = useCallback((_orgId: string) => {}, []);

  return (
    <div className={styles.screen}>
      <div className={styles.eyebrow}>Módulo 03 · Búsqueda Conversacional</div>
      <h1 className={styles.title}>Búsqueda por lotes</h1>
      <p className={styles.subtitle}>
        Consulta hasta 50 referencias a la vez. Pega la lista desde tu ERP, Excel o cualquier formato de texto.
      </p>

      <section className={styles.inputCard}>
        <label className={styles.label} htmlFor="batch-references">
          Lista de referencias
        </label>
        <textarea
          id="batch-references"
          className={styles.textarea}
          placeholder="Pega aquí tu lista de referencias — una por línea, separadas por comas o tabulaciones"
          value={text}
          onChange={(event) => setText(event.target.value)}
        />
        <p className={styles.hint}>Máx 50 referencias por tanda</p>
        <div className={styles.inputFooter}>
          <span className={styles.counter} data-testid="reference-counter">
            {referenceCounterLabel(refs.length)}
          </span>
          <button
            type="button"
            className={styles.primary}
            disabled={refs.length === 0 || overLimit || loading}
            onClick={handleSearch}
          >
            Buscar
          </button>
        </div>
      </section>

      {overLimit && (
        <div className={styles.brassBlock}>
          <p className={styles.brassText}>{overLimitNotice(refs.length)}</p>
          <div className={styles.brassActions}>
            <button type="button" className={styles.primary} disabled={loading} onClick={handleFirstFifty}>
              Continuar con las primeras 50
            </button>
            <button type="button" className={styles.plain} disabled={loading} onClick={handleSplit}>
              Dividir en tandas
            </button>
          </div>
        </div>
      )}

      <div className={styles.resultsArea} aria-busy={loading}>
        {loading && (
          <p className={styles.status} role="status">
            Buscando...
          </p>
        )}

        {error !== null && (
          <p className={styles.alert} role="alert">
            {error}
          </p>
        )}

        {!loading && error === null && results !== null && (
          <>
            <div className={styles.metaBar}>
              <div className={styles.metaLabel}>{batchMetaLabel(results)}</div>
              <button type="button" className={styles.primary} onClick={handleExport}>
                Exportar resumen
              </button>
              {/* Los watchers exigen la confirmación de VERA (spec §5), que no
                  está conectada: el botón se pinta, deshabilitado y con el motivo. */}
              <button
                type="button"
                className={styles.primary}
                disabled
                title="La creación de watchers necesita la confirmación de VERA, que todavía no está conectada."
              >
                Crear watchers para referencias sin stock
              </button>
            </div>

            {pending.length > 0 && (
              <div className={styles.pendingBlock}>
                <p className={styles.pendingText}>
                  {'Quedan ' + pending.length + ' referencias por procesar.'}
                </p>
                <button type="button" className={styles.primary} disabled={loading} onClick={handleNextBatch}>
                  Procesar la siguiente tanda
                </button>
              </div>
            )}

            <ul className={styles.list} aria-label="Resultados por referencia">
              {results.map((result) => (
                <li key={result.reference} className={styles.listItem}>
                  <BatchCard
                    result={result}
                    expanded={expanded.has(result.reference)}
                    sort={sorts[result.reference] ?? null}
                    selected={selected}
                    now={currentTime}
                    onToggle={() => handleToggleCard(result.reference)}
                    onSort={(column) => handleSort(result.reference, column)}
                    onToggleRow={handleToggleRow}
                    onToggleFavorite={(orgId) => {
                      void handleToggleFavorite(orgId);
                    }}
                    onConsult={handleConsult}
                    onContact={handleContact}
                  />
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    </div>
  );
}

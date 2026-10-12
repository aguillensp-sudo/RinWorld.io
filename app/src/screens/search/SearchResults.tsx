import { useCallback, useEffect, useRef, useState } from 'react';
import { errorMessage, type MemberProfile } from '../../lib/session';
import {
  EMPTY_CRITERIA,
  consultSummary,
  countryName,
  fetchResults,
  meetsMinQuantity,
  metaCounterLabel,
  nextSort,
  sortRows,
  toggleFavorite,
  type SearchCriteria,
  type SearchPage,
  type SearchResultRow,
  type Sort,
  type SortColumn,
} from '../../lib/search';
import { INQUIRY_FORM_TEXTS, type InquiryDraft } from '../../lib/inquiry-form';
import { sendInquiries, type InquiryOutcome } from '../../lib/thread-detail';
import { InquiryFormModal } from '../messages/InquiryFormModal';
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
  /**
   * Abre SRCH-03 (`Mis watchers`). **Opcional a propósito**, por lo mismo que
   * `veraCriteria`: `<SearchResults profile now />` a secas sigue siendo válido y
   * sin este prop no se pinta ningún botón. SRCH-03 comparte ítem de nav con
   * esta pantalla (`Comprando`, spec §2) y no tiene otra puerta de entrada.
   */
  onOpenWatchers?: () => void;
  /** Abre SRCH-02 (`Búsqueda por lotes`). Opcional por la misma razón que `onOpenWatchers`. */
  onOpenBatch?: () => void;
  /** Contactar la empresa de la fila. Opcional: sin él `Contactar` queda apagado. */
  onContactOrganization?: (orgId: string) => void;
}

interface ConsultQueue {
  rows: SearchResultRow[];
  index: number;
  /** Filas de la selección que ya tenían una consulta pendiente y no entran en la cola (F-087). */
  omitidas: number;
  outcomes: InquiryOutcome[];
}

/**
 * Pantalla SRCH-01 · Panel de Resultados de Búsqueda.
 *
 * Es la pantalla, no un componente de presentación: posee los criterios, el
 * orden, la selección, la carga y el error, y es quien decide que al alternar
 * un favorito se vuelve a consultar la base (`toggleFavorite` + `fetchResults`).
 * La tabla y los chips son presentacionales y no guardan estado de datos.
 */
export function SearchResults({ profile, now, veraCriteria, onOpenWatchers, onOpenBatch, onContactOrganization }: Props) {
  const [criteria, setCriteria] = useState<SearchCriteria>(EMPTY_CRITERIA);
  const [sort, setSort] = useState<Sort | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [page, setPage] = useState<SearchPage | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  /** El resultado de la última tanda de "Consultar seleccionados" (GAP-004).
   *  `null` = no se ha lanzado ninguna todavía en esta pantalla. */
  const [consultBanner, setConsultBanner] = useState<string | null>(null);
  /** Hay un envío en curso (el de la consulta que el formulario tiene delante). */
  const [consulting, setConsulting] = useState(false);
  /**
   * La cola de formularios de consulta (MSG-03 §3.2, F-249): uno por fila, en el orden de la tabla.
   * `outcomes` es lo ya resuelto —enviado o fallado— y alimenta el resumen final.
   */
  const [queue, setQueue] = useState<ConsultQueue | null>(null);
  /** El fallo del último intento sobre la fila actual; `null` si no ha habido o ya se resolvió. */
  const [failed, setFailed] = useState<InquiryOutcome | null>(null);

  /**
   * Número de la última carga lanzada. Dos cargas pueden estar en vuelo a la vez (la inicial y la de un
   * filtro que se añade nada más entrar), y la red no garantiza que lleguen en orden: si la vieja
   * llegaba la última, PISABA a la nueva y la pantalla enseñaba el chip `Ref 32007` sobre los 183
   * resultados sin filtrar. Solo la última carga lanzada puede escribir resultado, error o fin de carga.
   */
  const lastLoad = useRef(0);

  const load = useCallback(
    async (c: SearchCriteria) => {
      const mia = ++lastLoad.current;
      setLoading(true);
      setError(false);
      try {
        const p = await fetchResults({ orgId: profile.orgId, memberId: profile.id, criteria: c });
        if (mia !== lastLoad.current) return;
        setPage(p);
      } catch {
        if (mia !== lastLoad.current) return;
        setError(true);
        setPage(null);
      } finally {
        if (mia === lastLoad.current) setLoading(false);
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
  const handleContact = useCallback((_orgId: string) => {}, []);

  /**
   * "Consultar" de una fila y "Consultar seleccionados" (GAP-004, `Plan §3` día 10; F-249).
   *
   * El boundary de GAP-004 sigue siendo literal: *"la selección y el disparo de la acción
   * pertenecen a conversational-search; la gestión del hilo, tarjeta de consulta y cifrado E2EE
   * pertenecen a messaging-and-negotiation"*. Esta pantalla decide QUÉ se pregunta —las filas
   * marcadas, sin las que ya tienen una consulta pendiente— y `sendInquiries` hace el resto.
   *
   * **Cambio del 12-oct-2026 (decisión del PO, F-249).** `results-row-actions · consultar
   * seleccionados en lote` decía que no se abría ningún formulario y que se consultaba por la cantidad
   * publicada. `MSG-03` §3.2 dice lo contrario: `Consultar` abre el formulario, con la cantidad
   * solicitada obligatoria y las notas. El PO eligió el de `MSG-03`, **uno por fila y en cola**: cada
   * fila marcada abre su formulario en el orden de la tabla y se envía sola, con lo que el comprador
   * teclee. La capability cerrada no se toca. El usuario sigue en SRCH-01 y la tabla se relee al final
   * (de ahí sale de verdad "ya consultada", nunca de una marca puesta a mano en cliente).
   */
  const consultRows = useCallback(
    (ids: Set<string>) => {
      if (!page || consulting || queue) return;

      // Defensivo, no solo cosmético: una fila con consulta pendiente seguiría marcable vía
      // "Seleccionar todos", y create_inquiry la rechazaría. No se abre un formulario que se sabe inútil.
      const filas = page.rows.filter((r) => ids.has(r.id) && !r.consulted);
      /* F-087: lo que se descarta también se cuenta, y lo dice `consultSummary` al final. */
      const omitidas = page.rows.filter((r) => ids.has(r.id) && r.consulted).length;
      if (filas.length === 0) {
        setConsultBanner('Las filas seleccionadas ya estaban consultadas.');
        return;
      }

      setConsultBanner(null);
      setFailed(null);
      setQueue({ rows: filas, index: 0, omitidas, outcomes: [] });
    },
    [page, consulting, queue],
  );

  /** Cierra la cola: resumen de lo resuelto, deselecciona lo enviado y relee la tabla. */
  const finishQueue = useCallback(
    async (q: ConsultQueue, outcomes: InquiryOutcome[]) => {
      setQueue(null);
      setFailed(null);
      if (outcomes.length === 0) return;
      setConsultBanner(consultSummary(outcomes, q.omitidas));
      const enviadas = new Set(outcomes.filter((o) => o.ok).map((o) => o.lineId));
      if (enviadas.size === 0) return;
      setSelected((prev) => {
        const resto = new Set(prev);
        for (const id of enviadas) resto.delete(id);
        return resto;
      });
      await load(criteria);
    },
    [criteria, load],
  );

  /** Pasa a la fila siguiente o, si era la última, cierra la cola. */
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

  /** `Enviar consulta` del formulario de la fila actual: cifra y envía solo esa fila. */
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

  /**
   * `Cancelar`: descarta SOLO esta fila y sigue con la siguiente. Si ya había fallado, el fallo
   * queda en el resumen (no se esconde); si no se había intentado, no consta: el usuario decidió no
   * preguntar.
   */
  const cancelCurrent = useCallback(() => {
    if (!queue || consulting) return;
    void advance(queue, failed ? [...queue.outcomes, failed] : queue.outcomes);
  }, [queue, consulting, failed, advance]);

  const handleConsultSelected = useCallback(() => consultRows(selected), [consultRows, selected]);

  /** «Consultar» de una fila: solo se habilita con la fila marcada, y abre solo su formulario. */
  const handleConsult = useCallback((lineId: string) => consultRows(new Set([lineId])), [consultRows]);

  const filaActual = queue ? (queue.rows[queue.index] ?? null) : null;
  /** El servidor dice que ya hay una consulta pendiente: se pinta el aviso de la spec §6 y se bloquea. */
  const duplicada = failed?.error === INQUIRY_FORM_TEXTS.duplicateWarning;

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
            {/* F-100 · BAJA A >=1 EL 17-AGO, DECISIÓN DEL PO, Y REVIERTE F-039.
                El >=2 de la capability se sostenía sobre una frase —"con una sola
                fila marcada la acción correcta es «Consultar» de esa fila"— que
                remitía a un botón que no hacía nada. Apagado ese botón, mantener
                el >=2 dejaría una selección de una sola fila sin ninguna acción
                posible en toda la pantalla. Vuelve al >=1 de la spec §3. */}
            <button
              type="button"
              className={styles.consultSelected}
              disabled={selected.size < 1 || consulting || queue !== null}
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
            {onOpenBatch && (
              <button type="button" className={styles.watcher} onClick={onOpenBatch}>
                <i className="ti ti-list-search" aria-hidden="true" />
                Búsqueda por lotes
              </button>
            )}
            {onOpenWatchers && (
              <button type="button" className={styles.watcher} onClick={onOpenWatchers}>
                <i className="ti ti-bell" aria-hidden="true" />
                Mis watchers
              </button>
            )}
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
                onContactOrganization={onContactOrganization}
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

      {/* Un formulario por fila marcada, en cola (MSG-03 §3.2, F-249). La clave por fila hace que cada uno arranque vacío. */}
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

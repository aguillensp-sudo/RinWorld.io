import { useEffect, useState } from 'react';
import {
  NEW_THREAD_BODY_MAX,
  NEW_THREAD_BODY_MIN,
  NEW_THREAD_TITLE_MAX,
  NEW_THREAD_TITLE_MIN,
  createThread,
  fetchCategory,
  fetchForumRateLimitStatus,
  newThreadValid,
  rateLimitMinutesLabel,
  rateLimitReached,
  type Category,
  type ForumRateLimitStatus,
} from '../../lib/forum';
import { errorMessage, type MemberProfile } from '../../lib/session';
import styles from './ForumNewThread.module.css';

interface Props {
  profile: MemberProfile;
  slug: string;
  /** Vuelve a FORO-02 sin publicar nada (`Cancelar` y el enlace de la categoría). */
  onCancel: () => void;
  /** Vuelve a FORO-01. */
  onBackToForum: () => void;
  /** El hilo ya existe: abre FORO-03 sobre él. */
  onCreated: (threadId: string) => void;
  /** Borrador que VERA deja en el formulario (`preparar_hilo_foro`). Lo rellena; no publica. */
  draft?: { title: string; body: string; nonce: number } | null;
}

/** El `catch` de la casa: de aquí nunca sale un `unknown` sin ser un `Error`. */
function asError(e: unknown): Error {
  return e instanceof Error ? e : new Error(String(e));
}

/**
 * FORO-03 · modo creación de hilo (FL-FORO-01).
 *
 * Es la PANTALLA: posee el estado y es el único sitio que llama a la red. El hilo
 * nunca se publica sin la confirmación explícita del usuario (CA-FORO-04): el botón
 * `Publicar hilo` está apagado hasta que título (5-150) y cuerpo (10-10.000) cumplen
 * los mínimos, o mientras el límite de RNG-FORO-06 esté alcanzado. Si falla, los
 * campos se quedan como estaban: lo escrito no se pierde por un error de red.
 *
 * El límite lo dice el servidor (`fetchForumRateLimitStatus`), nunca un contador local;
 * y aunque el botón lo respete, la carrera entre pintar y pulsar la gana la base, que
 * rechaza la publicación 11 sin dejar un hilo vacío (`forum_create_thread`, 0078).
 */
export function ForumNewThread({ profile, slug, onCancel, onBackToForum, onCreated, draft }: Props) {
  void profile;

  const [category, setCategory] = useState<Category | null | undefined>(undefined);
  const [rateStatus, setRateStatus] = useState<ForumRateLimitStatus | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    setCategory(undefined);
    setRateStatus(null);
    setError(null);
    setTitle('');
    setBody('');
    setSubmitError(null);

    fetchCategory(slug)
      .then((found) => {
        if (!cancelled) setCategory(found);
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(errorMessage(asError(err)));
      });

    fetchForumRateLimitStatus()
      .then((status) => {
        if (!cancelled) setRateStatus(status);
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(errorMessage(asError(err)));
      });

    return () => {
      cancelled = true;
    };
  }, [slug]);

  // El borrador de VERA se aplica DESPUÉS del reinicio de arriba, que corre con el montaje y con cada categoría.
  useEffect(() => {
    if (!draft) return;
    setTitle(draft.title);
    setBody(draft.body);
    // Por `nonce`: pedir el mismo borrador dos veces vuelve a rellenar el formulario.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft?.nonce]);

  const limitReached = rateStatus !== null && rateLimitReached(rateStatus);
  const canSubmit =
    category !== null &&
    category !== undefined &&
    rateStatus !== null &&
    !limitReached &&
    !submitting &&
    newThreadValid(title, body);

  async function handleSubmit() {
    if (!canSubmit || category === null || category === undefined) return;

    setSubmitting(true);
    setSubmitError(null);

    let threadId: string;
    try {
      threadId = await createThread(category.id, title.trim(), body.trim());
    } catch (err: unknown) {
      setSubmitError(errorMessage(asError(err)));
      setSubmitting(false);
      return;
    }

    setSubmitting(false);
    onCreated(threadId);
  }

  const loading = error === null && (category === undefined || rateStatus === null);

  return (
    <div className={styles.page} data-testid="forum-new-thread" data-slug={slug}>
      <p className={styles.eyebrow}>Módulo 08 · Foro de la Comunidad</p>

      <nav className={styles.breadcrumb} aria-label="Breadcrumb">
        <button type="button" className={styles.breadcrumbLink} onClick={onBackToForum}>
          Foros
        </button>
        {category !== null && category !== undefined && (
          <>
            <span className={styles.breadcrumbSeparator} aria-hidden="true">
              ›
            </span>
            <button type="button" className={styles.breadcrumbLink} onClick={onCancel}>
              {category.name}
            </button>
          </>
        )}
      </nav>

      {category !== null && category !== undefined && (
        <h1 className={styles.title}>{`Nuevo hilo en ${category.name}`}</h1>
      )}

      {/* El aviso de confidencialidad es permanente (spec §7), y aquí es el más
          importante: el usuario está a punto de publicar contenido. */}
      <div className={styles.notice}>
        <i className={`ti ti-alert-circle ${styles.noticeIcon}`} aria-hidden="true" />
        <p className={styles.noticeText}>
          {'El contenido publicado en el Foro es texto plano, visible para todos los miembros de Bearingworld.io. '}
          <strong>Nada de lo escrito aquí tiene ninguna garantía de confidencialidad.</strong>
          {' Para conversaciones privadas, usa la mensajería cifrada.'}
        </p>
      </div>

      {loading ? (
        <p className={styles.loading} aria-busy="true">
          Cargando…
        </p>
      ) : error !== null ? (
        <div className={styles.error} role="alert">
          {error}
        </div>
      ) : category === null ? (
        <p className={styles.empty}>Esta categoría no existe.</p>
      ) : (
        <form
          className={styles.form}
          onSubmit={(event) => {
            event.preventDefault();
            void handleSubmit();
          }}
        >
          <label className={styles.label} htmlFor="forum-new-title">
            Título del hilo
          </label>
          <input
            id="forum-new-title"
            className={styles.input}
            type="text"
            placeholder="Escribe un título claro y descriptivo"
            value={title}
            maxLength={NEW_THREAD_TITLE_MAX}
            onChange={(event) => setTitle(event.target.value)}
          />
          <p className={styles.hint}>{`Mín ${NEW_THREAD_TITLE_MIN} / máx ${NEW_THREAD_TITLE_MAX} caracteres`}</p>

          <label className={styles.label} htmlFor="forum-new-body">
            Cuerpo del hilo
          </label>
          <textarea
            id="forum-new-body"
            className={styles.textarea}
            placeholder="Desarrolla tu pregunta o tema aquí..."
            value={body}
            rows={8}
            maxLength={NEW_THREAD_BODY_MAX}
            onChange={(event) => setBody(event.target.value)}
          />
          <p className={styles.hint}>
            {`Mín ${NEW_THREAD_BODY_MIN} / máx 10.000 caracteres · visible para todos los miembros`}
          </p>

          {limitReached && rateStatus !== null && (
            <p className={styles.limit}>
              {`Tu organización ha alcanzado el límite de 10 publicaciones por hora. Podrás publicar en ${rateLimitMinutesLabel(rateStatus.secondsUntilReset)}.`}
            </p>
          )}

          {submitError !== null && (
            <p className={styles.submitError} role="alert">
              {submitError}
            </p>
          )}

          <div className={styles.buttons}>
            <button type="submit" className={styles.submit} disabled={!canSubmit}>
              Publicar hilo
            </button>
            <button type="button" className={styles.cancel} disabled={submitting} onClick={onCancel}>
              Cancelar
            </button>
          </div>
        </form>
      )}
    </div>
  );
}

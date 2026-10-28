import { Fragment, useEffect, useState } from 'react';
import {
  deletePost,
  editPost,
  fetchForumRateLimitStatus,
  fetchThread,
  fetchThreadPosts,
  postReply,
  rateLimitMinutesLabel,
  rateLimitReached,
  reactToPost,
  reactionLabel,
  relativeShort,
  replyCountLabel,
  unreactToPost,
  type ForumPost,
  type ForumRateLimitStatus,
  type ThreadHeader,
} from '../../lib/forum';
import { errorMessage, type MemberProfile } from '../../lib/session';
import { ForumDeleteDialog } from './ForumDeleteDialog';
import styles from './ForumThread.module.css';

interface Props {
  profile: MemberProfile;
  threadId: string;
  onBackToForum: () => void;
  onBackToCategory: () => void;
  /** Inyectable para que el tiempo relativo sea determinista en los tests. */
  now?: Date;
}

/** El `catch` de la casa: de aquí nunca sale un `unknown` sin ser un `Error`. */
function asError(e: unknown): Error {
  return e instanceof Error ? e : new Error(String(e));
}

/**
 * Copia superficial de la lista de publicaciones.
 *
 * Se copia SIEMPRE, aunque la capa devuelva un array nuevo, porque puede
 * devolver el mismo con los objetos ya actualizados por dentro: con la misma
 * referencia React no volvería a pintar y el recuento de una reacción se
 * quedaría en el valor viejo.
 */
function snapshot(list: ForumPost[]): ForumPost[] {
  return list.map((post) => ({ ...post }));
}

/**
 * FORO-03 · Vista de un Hilo.
 *
 * Es la PANTALLA: posee todo el estado y es el único sitio que llama a la red.
 *
 * El reparto de estado es el de FORO-02, y por la misma razón:
 *
 * - `thread === undefined` significa «todavía no se sabe» (cargando o falló);
 *   `thread === null` significa «ese hilo no existe», que es un estado propio de
 *   la spec §6 y NO es un error de red. Con `null` no se piden ni las
 *   publicaciones ni el estado del límite: no hay nada que enseñar ni con qué
 *   comparar RNG-FORO-06.
 * - `posts === null` o `rateStatus === null` con el hilo ya conocido es «aún no
 *   han llegado»: el cuerpo los considera carga, porque un cuerpo a medias no es
 *   ninguno de los estados de la spec.
 *
 * Lo que esta pantalla NO hace, a propósito:
 *
 * - No calcula el recuento de reacciones en el cliente (CA-FORO-05: «actualiza
 *   inmediatamente» es el resultado de volver a consultar, no un optimista que
 *   pueda desincronizarse del servidor con dos reacciones simultáneas).
 * - No cuenta publicaciones para RNG-FORO-06: el límite lo dice el servidor
 *   (`fetchForumRateLimitStatus`), nunca un contador local de lo que se ve.
 * - Editar y Eliminar (own-content-editing, 0078) SOLO existen en las
 *   publicaciones de la propia organización (CA-FORO-06); en las ajenas no
 *   existen en el DOM. Editar abre un textarea en línea; Eliminar pregunta antes
 *   y es irreversible. La inicial de un hilo con respuestas se puede editar pero
 *   no eliminar (la base se niega, y aquí el botón se apaga con su motivo).
 * - No construye el modo creación de hilo (FL-FORO-01): FORO-03 se abre siempre
 *   sobre un hilo ya creado, el único camino de entrada es el título de una fila
 *   de FORO-02.
 *
 * El foro es común a todos los miembros: el perfil solo decide una cosa aquí,
 * cuáles de las publicaciones son de la propia organización.
 */
export function ForumThread({
  profile,
  threadId,
  onBackToForum,
  onBackToCategory,
  now = new Date(),
}: Props) {
  const [thread, setThread] = useState<ThreadHeader | null | undefined>(undefined);
  const [posts, setPosts] = useState<ForumPost[] | null>(null);
  const [rateStatus, setRateStatus] = useState<ForumRateLimitStatus | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [loadingThread, setLoadingThread] = useState(true);
  const [loadingPosts, setLoadingPosts] = useState(false);
  const [loadingRate, setLoadingRate] = useState(false);

  /** El borrador es lo que se está escribiendo; no se consulta ni se publica tal cual. */
  const [draft, setDraft] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [replyError, setReplyError] = useState<string | null>(null);

  /** Edición en línea: una sola publicación a la vez. */
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState('');
  const [savingEdit, setSavingEdit] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  /** Eliminación: el id que espera confirmación, y su propio estado. */
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  /**
   * La cabecera del hilo, y --solo si existe-- sus publicaciones y el estado del
   * límite de RNG-FORO-06, las dos a la vez y sin esperar una de la otra.
   *
   * `cancelled` descarta la respuesta que llega tarde: al cambiar de hilo, la
   * cabecera y las publicaciones del hilo anterior no pueden pintarse encima.
   */
  useEffect(() => {
    let cancelled = false;

    setThread(undefined);
    setPosts(null);
    setRateStatus(null);
    setError(null);
    setDraft('');
    setReplyError(null);
    setSubmitting(false);
    setEditingId(null);
    setEditError(null);
    setDeleteTargetId(null);
    setDeleteError(null);
    setLoadingThread(true);
    setLoadingPosts(false);
    setLoadingRate(false);

    fetchThread(threadId)
      .then((found) => {
        if (cancelled) return;
        setThread(found);
        setLoadingThread(false);

        // Un hilo inexistente no tiene publicaciones que pedir ni límite que
        // consultar: aquí se para, y el cuerpo lo dice con su propio texto.
        if (found === null) return;

        setLoadingPosts(true);
        setLoadingRate(true);

        fetchThreadPosts(threadId)
          .then((list) => {
            if (cancelled) return;
            setPosts(snapshot(list));
          })
          .catch((err: unknown) => {
            if (cancelled) return;
            setError(errorMessage(asError(err)));
          })
          .finally(() => {
            if (!cancelled) setLoadingPosts(false);
          });

        fetchForumRateLimitStatus()
          .then((status) => {
            if (cancelled) return;
            setRateStatus(status);
          })
          .catch((err: unknown) => {
            if (cancelled) return;
            setError(errorMessage(asError(err)));
          })
          .finally(() => {
            if (!cancelled) setLoadingRate(false);
          });
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setThread(undefined);
        setError(errorMessage(asError(err)));
        setLoadingThread(false);
      });

    return () => {
      cancelled = true;
    };
  }, [threadId]);

  /**
   * Reaccionar o quitar la reacción (CA-FORO-05). No se toca el contador en
   * memoria: se vuelve a preguntar por las publicaciones y se pinta lo que
   * devuelva la capa, que es la única cifra cierta.
   *
   * El botón de reacción NO se bloquea por RNG-FORO-06: la spec §6 dice que la
   * lectura y las reacciones no se ven afectadas por el límite de publicación.
   */
  async function handleReact(post: ForumPost) {
    try {
      if (post.reactedByMe) {
        await unreactToPost(post.id);
      } else {
        await reactToPost(post.id);
      }

      const list = await fetchThreadPosts(threadId);
      setPosts(snapshot(list));
    } catch (err: unknown) {
      setError(errorMessage(asError(err)));
    }
  }

  /**
   * Publicar la respuesta. El límite se comprueba contra el estado que ya
   * devolvió el servidor; el botón ya está bloqueado, esto es la red de
   * seguridad de la carrera entre pintar y pulsar.
   *
   * Si falla, el borrador se queda como estaba: lo que el usuario escribió no se
   * pierde por un error de red. Si tiene éxito, se vacía y se refrescan las dos
   * consultas --las publicaciones, para que la respuesta nueva aparezca, y el
   * estado del límite, para que el contador de la hora natural sea el real.
   */
  async function handleSubmit() {
    const body = draft.trim();
    if (body === '' || submitting) return;
    if (rateStatus === null || rateLimitReached(rateStatus)) return;

    setSubmitting(true);
    setReplyError(null);

    try {
      await postReply(threadId, body);
    } catch (err: unknown) {
      setReplyError(errorMessage(asError(err)));
      setSubmitting(false);
      return;
    }

    setDraft('');
    setSubmitting(false);

    try {
      const list = await fetchThreadPosts(threadId);
      setPosts(snapshot(list));
    } catch (err: unknown) {
      setError(errorMessage(asError(err)));
    }

    try {
      const status = await fetchForumRateLimitStatus();
      setRateStatus(status);
    } catch (err: unknown) {
      setError(errorMessage(asError(err)));
    }
  }

  /** Abrir la edición en línea con el texto actual. Cancelar no guarda nada. */
  function startEdit(post: ForumPost) {
    setEditingId(post.id);
    setEditDraft(post.body);
    setEditError(null);
  }

  function cancelEdit() {
    setEditingId(null);
    setEditError(null);
  }

  /**
   * Guardar el cambio (own-content-editing#1). El cambio «se refleja
   * inmediatamente para todos»: se vuelve a pedir la lista a la base, no se
   * pinta el texto local. Si falla, el borrador se queda abierto.
   */
  async function handleSaveEdit() {
    const body = editDraft.trim();
    if (editingId === null || body === '' || savingEdit) return;

    setSavingEdit(true);
    setEditError(null);

    try {
      await editPost(editingId, body);
    } catch (err: unknown) {
      setEditError(errorMessage(asError(err)));
      setSavingEdit(false);
      return;
    }

    setSavingEdit(false);
    setEditingId(null);

    try {
      const list = await fetchThreadPosts(threadId);
      setPosts(snapshot(list));
    } catch (err: unknown) {
      setError(errorMessage(asError(err)));
    }
  }

  /**
   * Eliminar tras la confirmación (own-content-editing#2). Si era la única
   * publicación, la base elimina también el hilo: no queda nada que enseñar y
   * se vuelve a la categoría.
   */
  async function handleConfirmDelete() {
    if (deleteTargetId === null || deleting) return;
    const onlyPost = posts !== null && posts.length === 1;

    setDeleting(true);
    setDeleteError(null);

    try {
      await deletePost(deleteTargetId);
    } catch (err: unknown) {
      setDeleteError(errorMessage(asError(err)));
      setDeleting(false);
      return;
    }

    setDeleting(false);
    setDeleteTargetId(null);

    if (onlyPost) {
      onBackToCategory();
      return;
    }

    try {
      const list = await fetchThreadPosts(threadId);
      setPosts(snapshot(list));
    } catch (err: unknown) {
      setError(errorMessage(asError(err)));
    }
  }

  const threadKnown = thread !== null && thread !== undefined;

  /**
   * El cuerpo es EXCLUYENTE. Además de los tres cargando, se considera carga el
   * hueco entre «ya sé el hilo» y «ya tengo publicaciones y límite»: sin eso,
   * ese instante pintaría un cuerpo vacío que no es ninguno de los estados.
   */
  const loading =
    loadingThread ||
    loadingPosts ||
    loadingRate ||
    (threadKnown && (posts === null || rateStatus === null) && error === null);

  return (
    <div className={styles.page} data-testid="forum-thread" data-thread-id={threadId}>
      <p className={styles.eyebrow}>Módulo 08 · Foro de la Comunidad</p>

      {/* El breadcrumb gana su segundo enlace cuando el hilo se conoce: antes no
          hay categoría que enlazar, y un hueco no es un enlace. */}
      <nav className={styles.breadcrumb} aria-label="Breadcrumb">
        <button type="button" className={styles.breadcrumbLink} onClick={onBackToForum}>
          Foros
        </button>
        {threadKnown && (
          <>
            <span className={styles.breadcrumbSeparator} aria-hidden="true">
              ›
            </span>
            <button type="button" className={styles.breadcrumbLink} onClick={onBackToCategory}>
              {thread.categoryName}
            </button>
          </>
        )}
      </nav>

      {threadKnown && <h1 className={styles.title}>{thread.title}</h1>}

      {/* El aviso de confidencialidad es permanente (spec §7), y en esta pantalla
          es el más importante: el usuario está a punto de publicar contenido.
          No lleva cierre ni estado, porque el foro es la única parte NO cifrada
          del producto. */}
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
          Cargando publicaciones…
        </p>
      ) : error !== null ? (
        <div className={styles.error} role="alert">
          {error}
        </div>
      ) : thread === null ? (
        <p className={styles.empty}>Este hilo no existe.</p>
      ) : posts !== null && rateStatus !== null ? (
        <>
          <div className={styles.posts}>
            {/* En el orden en que llegan: la capa ya las da cronológicas, y la
                primera ES la publicación inicial. No hay nada que decidir aquí. */}
            {posts.map((post, index) => (
              <Fragment key={post.id}>
                {/* El contador va sobre la lista de respuestas, es decir, entre
                    la inicial y la primera respuesta; no hay un contenedor
                    aparte para «solo respuestas» porque la lista ya es completa. */}
                {index === 1 && posts.length > 1 && (
                  <p className={styles.replyCount}>{replyCountLabel(posts.length - 1)}</p>
                )}

                <div
                  className={
                    post.authorOrgId === profile.orgId ? `${styles.post} ${styles.ownPost}` : styles.post
                  }
                  data-testid={`forum-post-${post.id}`}
                >
                  <div className={styles.postHead}>
                    <span className={styles.postOrg}>{post.authorOrgName}</span>
                    <span className={styles.postCountry}>{post.authorOrgCountry}</span>
                    <span className={styles.postTime}>{relativeShort(post.createdAt, now)}</span>
                  </div>

                  {editingId === post.id ? (
                    <div className={styles.editForm}>
                      <textarea
                        className={styles.replyInput}
                        aria-label="Editar publicación"
                        value={editDraft}
                        rows={4}
                        onChange={(event) => setEditDraft(event.target.value)}
                      />
                      {editError !== null && (
                        <p className={styles.replyError} role="alert">
                          {editError}
                        </p>
                      )}
                      <div className={styles.editButtons}>
                        <button
                          type="button"
                          className={styles.replySubmit}
                          disabled={editDraft.trim() === '' || savingEdit}
                          onClick={() => void handleSaveEdit()}
                        >
                          Guardar cambios
                        </button>
                        <button type="button" className={styles.postAction} disabled={savingEdit} onClick={cancelEdit}>
                          Cancelar
                        </button>
                      </div>
                    </div>
                  ) : (
                    <p className={styles.postBody}>{post.body}</p>
                  )}

                  <div className={styles.postActions}>
                    <button
                      type="button"
                      className={post.reactedByMe ? `${styles.react} ${styles.reacted}` : styles.react}
                      aria-pressed={post.reactedByMe}
                      onClick={() => void handleReact(post)}
                    >
                      {reactionLabel(post.reactionCount)}
                    </button>

                    {/* Editar y Eliminar SOLO en las publicaciones de la propia
                        organización (CA-FORO-06). La inicial de un hilo con
                        respuestas no se elimina (0078): botón apagado, con su motivo. */}
                    {post.authorOrgId === profile.orgId && editingId !== post.id && (
                      <span className={styles.ownActions}>
                        <button type="button" className={styles.postAction} onClick={() => startEdit(post)}>
                          Editar
                        </button>
                        <button
                          type="button"
                          className={styles.postAction}
                          disabled={index === 0 && posts.length > 1}
                          title={
                            index === 0 && posts.length > 1
                              ? 'La publicación inicial no se puede eliminar mientras el hilo tenga respuestas.'
                              : undefined
                          }
                          onClick={() => {
                            setDeleteError(null);
                            setDeleteTargetId(post.id);
                          }}
                        >
                          Eliminar
                        </button>
                      </span>
                    )}
                  </div>
                </div>
              </Fragment>
            ))}

            {posts.length === 1 && (
              <p className={styles.noReplies}>Todavía no hay respuestas. Sé el primero en responder.</p>
            )}
          </div>

          {/* El formulario está SIEMPRE visible, con o sin respuestas previas. */}
          <div className={styles.replyForm}>
            <textarea
              className={styles.replyInput}
              placeholder="Escribe tu respuesta..."
              value={draft}
              rows={4}
              onChange={(event) => setDraft(event.target.value)}
            />

            <p className={styles.replyHint}>
              Tu respuesta será visible para todos los miembros con la identidad de tu organización.
            </p>

            {rateLimitReached(rateStatus) && (
              <p className={styles.replyLimit}>
                {`Tu organización ha alcanzado el límite de 10 publicaciones por hora. Podrás publicar en ${rateLimitMinutesLabel(rateStatus.secondsUntilReset)}.`}
              </p>
            )}

            {replyError !== null && (
              <p className={styles.replyError} role="alert">
                {replyError}
              </p>
            )}

            <button
              type="button"
              className={styles.replySubmit}
              disabled={draft.trim() === '' || rateLimitReached(rateStatus) || submitting}
              onClick={() => void handleSubmit()}
            >
              Publicar respuesta
            </button>
          </div>

          {deleteTargetId !== null && (
            <ForumDeleteDialog
              busy={deleting}
              error={deleteError}
              onConfirm={() => void handleConfirmDelete()}
              onCancel={() => {
                setDeleteTargetId(null);
                setDeleteError(null);
              }}
            />
          )}
        </>
      ) : null}
    </div>
  );
}

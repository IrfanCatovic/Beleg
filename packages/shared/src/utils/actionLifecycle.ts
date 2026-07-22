/** Minimalni action shape za lifecycle helperе (list/detail/embedded). */
export type ActionLifecycleFields = {
  isCompleted?: boolean | null
  isCancelled?: boolean | null
}

/**
 * Da li je akcija otkazana.
 * `undefined` / stari cache bez polja → false (backward compatible).
 */
export function isActionCancelled(
  action: Pick<ActionLifecycleFields, 'isCancelled'> | null | undefined,
): boolean {
  return action?.isCancelled === true
}

/**
 * Terminalno lifecycle stanje: completed ili cancelled.
 * Datum akcije nije autoritet.
 */
export function isActionTerminal(
  action: ActionLifecycleFields | null | undefined,
): boolean {
  return action?.isCompleted === true || action?.isCancelled === true
}

/**
 * Aktivna za mutacije (signup, finish, edit izbora, invite…).
 * Semantika: !isCompleted && !isCancelled.
 */
export function isActionLifecycleActive(
  action: ActionLifecycleFields | null | undefined,
): boolean {
  return !isActionTerminal(action)
}

export type ActionLifecycleBadge = 'cancelled' | 'completed' | null

/**
 * Prioritet prikaza badge-a:
 * cancelled → completed → (null = aktivna / bez terminalnog badge-a).
 * Za kontradiktorno isCancelled+isCompleted → cancelled.
 */
export function getActionLifecycleBadge(
  action: ActionLifecycleFields | null | undefined,
): ActionLifecycleBadge {
  if (isActionCancelled(action)) return 'cancelled'
  if (action?.isCompleted === true) return 'completed'
  return null
}

/** Trimovan razlog ili fallback; nikad "undefined"/"null". */
export function getCancellationReasonDisplay(
  reason: string | null | undefined,
  fallback = 'Razlog nije naveden.',
): string {
  const trimmed = typeof reason === 'string' ? reason.trim() : ''
  return trimmed || fallback
}

const DATE_LOCALE = 'sr-Latn-RS'

/**
 * Formatira cancelledAt u lokalnoj zoni.
 * Nevažeći / prazan → fallback (default prazan string — ne prikazuj lažni datum).
 */
export function formatActionCancelledAt(
  value: string | number | Date | null | undefined,
  fallback = '',
): string {
  if (value == null || value === '') return fallback
  const d = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(d.getTime())) return fallback
  return d.toLocaleString(DATE_LOCALE, {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

/** Filtrira stale cancelled redove iz active/completed lista (cache otpornost). */
export function excludeCancelledActions<T extends ActionLifecycleFields>(
  items: T[] | null | undefined,
): T[] {
  if (!items?.length) return items ?? []
  return items.filter((a) => !isActionCancelled(a))
}

/**
 * Signals the practitioner has waved away.
 *
 * The attention column is *derived* from clinic data, so "done" is the wrong
 * verb for it: ticking "invoice overdue" does not pay the invoice, and the
 * signal reappears the moment the board re-derives. Dismissal is the honest
 * action — "I've seen this, stop showing it" — and it has to persist, or the
 * next refresh undoes it.
 *
 * Dismissals are self-cleaning: a signal that stops being derived (the invoice
 * got paid) drops out of the record, so if the same condition returns later it
 * is shown again rather than staying silently suppressed.
 */

const KEY = "clinic.dismissed-signals.v1"

export const DISMISSED_SIGNALS_EVENT = "dismissed-signals-changed"

type Dismissals = Record<string, string>

function read(): Dismissals {
  if (typeof window === "undefined") return {}
  try {
    const raw = window.localStorage.getItem(KEY)
    return raw ? (JSON.parse(raw) as Dismissals) : {}
  } catch {
    return {}
  }
}

function write(next: Dismissals): void {
  if (typeof window === "undefined") return
  try {
    window.localStorage.setItem(KEY, JSON.stringify(next))
    window.dispatchEvent(new Event(DISMISSED_SIGNALS_EVENT))
  } catch {
    /* quota / private mode */
  }
}

export function dismissSignal(id: string): void {
  write({ ...read(), [id]: new Date().toISOString() })
}

export function restoreSignal(id: string): void {
  const current = read()
  delete current[id]
  write(current)
}

export function isDismissed(id: string): boolean {
  return id in read()
}

/**
 * Drop dismissals whose signal no longer exists, and return the live set.
 *
 * Called with the ids currently being derived. Without this the record grows
 * forever and, worse, a condition that recurs months later would arrive
 * pre-silenced.
 */
export function pruneDismissals(liveIds: string[]): Set<string> {
  const current = read()
  const live = new Set(liveIds)
  const kept: Dismissals = {}
  let changed = false

  for (const [id, at] of Object.entries(current)) {
    if (live.has(id)) kept[id] = at
    else changed = true
  }
  if (changed) write(kept)

  return new Set(Object.keys(kept))
}

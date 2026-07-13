/**
 * Tiny IndexedDB blob store for session audio recordings.
 *
 * localStorage cannot hold multi-megabyte audio, so recordings live here
 * instead. This is the local-only home until Supabase Storage is wired
 * (mirrors how mock data stands in for the DB elsewhere in the app).
 *
 * Keys used by the patient cockpit:
 *   audio-active:<patientId>   — the in-progress recording for the open chart
 *   audio-session:<sessionId>  — an immutable recording attached to a session
 */

const DB_NAME = "ob-audio"
const STORE = "clips"
const DB_VERSION = 1

function openDb(): Promise<IDBDatabase | null> {
  if (typeof indexedDB === "undefined") return Promise.resolve(null)
  return new Promise((resolve) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(STORE)) {
        req.result.createObjectStore(STORE)
      }
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => resolve(null)
  })
}

export async function putAudio(key: string, blob: Blob): Promise<void> {
  const db = await openDb()
  if (!db) return
  await new Promise<void>((resolve) => {
    const tx = db.transaction(STORE, "readwrite")
    tx.objectStore(STORE).put(blob, key)
    tx.oncomplete = () => resolve()
    tx.onerror = () => resolve()
    tx.onabort = () => resolve()
  })
  db.close()
}

export async function getAudio(key: string): Promise<Blob | null> {
  const db = await openDb()
  if (!db) return null
  const blob = await new Promise<Blob | null>((resolve) => {
    const tx = db.transaction(STORE, "readonly")
    const req = tx.objectStore(STORE).get(key)
    req.onsuccess = () => resolve((req.result as Blob | undefined) ?? null)
    req.onerror = () => resolve(null)
  })
  db.close()
  return blob
}

export async function deleteAudio(key: string): Promise<void> {
  const db = await openDb()
  if (!db) return
  await new Promise<void>((resolve) => {
    const tx = db.transaction(STORE, "readwrite")
    tx.objectStore(STORE).delete(key)
    tx.oncomplete = () => resolve()
    tx.onerror = () => resolve()
    tx.onabort = () => resolve()
  })
  db.close()
}

/** Move a clip to a new key (e.g. active → session). Returns the new key or null. */
export async function moveAudio(from: string, to: string): Promise<string | null> {
  const blob = await getAudio(from)
  if (!blob) return null
  await putAudio(to, blob)
  await deleteAudio(from)
  return to
}

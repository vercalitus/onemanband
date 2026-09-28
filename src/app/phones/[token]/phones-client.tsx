"use client"

import { useEffect, useMemo, useState } from "react"

/**
 * Filling in the phone numbers the clinic never captured.
 *
 * Written for a practitioner holding a phone between patients, so every answer
 * is one tap and is saved the moment it is given — there is no submit button
 * to forget and nothing to copy anywhere. English, because this screen is his
 * and he reads it faster than Hebrew.
 *
 * The list is ordered by who was seen most recently: those are the people a
 * reminder will actually reach in time to matter.
 */

type Candidate = { label: string; phone: string }
type Row = {
  id: string
  name: string
  lastVisit: string | null
  done: boolean
  saved: string | null
  candidates: Candidate[]
}

const formatVisit = (iso: string | null) => {
  if (!iso) return "no visit on record"
  const d = new Date(`${iso}T00:00:00`)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })
}

export function PhonesClient({ token }: { token: string }) {
  const [rows, setRows] = useState<Row[] | null>(null)
  const [error, setError] = useState("")
  const [typingFor, setTypingFor] = useState<string | null>(null)
  const [typed, setTyped] = useState("")
  const [busy, setBusy] = useState<string | null>(null)
  const [hideDone, setHideDone] = useState(true)

  useEffect(() => {
    let cancelled = false
    void fetch(`/api/phones/list?token=${encodeURIComponent(token)}`, { cache: "no-store" })
      .then((r) => r.json())
      .then((body) => {
        if (cancelled) return
        if (!body.ok) { setError(body.reason === "expired" ? "This link has expired." : "This link is not valid."); return }
        setRows(body.patients)
      })
      .catch(() => { if (!cancelled) setError("Could not load the list. Check your connection.") })
    return () => { cancelled = true }
  }, [token])

  const answer = async (row: Row, answerKind: "picked" | "typed" | "unknown", phone?: string) => {
    setBusy(row.id)
    try {
      const res = await fetch("/api/phones/set", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, patientId: row.id, answer: answerKind, phone }),
      })
      const body = await res.json()
      if (!body.ok) {
        setError(body.reason === "not an israeli mobile" ? "That does not look like an Israeli mobile number." : "Not saved. Try again.")
        return
      }
      setError("")
      setRows((prev) => (prev ?? []).map((r) => (r.id === row.id ? { ...r, done: true, saved: body.saved } : r)))
      setTypingFor(null)
      setTyped("")
    } catch {
      setError("Not saved. Check your connection.")
    } finally {
      setBusy(null)
    }
  }

  const { done, total, visible } = useMemo(() => {
    const all = rows ?? []
    return {
      done: all.filter((r) => r.done).length,
      total: all.length,
      visible: hideDone ? all.filter((r) => !r.done) : all,
    }
  }, [rows, hideDone])

  if (error && !rows) {
    return (
      <main style={S.page}>
        <p style={S.notice}>{error}</p>
      </main>
    )
  }

  if (!rows) {
    return (
      <main style={S.page}>
        <p style={S.muted}>Loading…</p>
      </main>
    )
  }

  return (
    <main style={S.page}>
      <header style={S.header}>
        <h1 style={S.h1}>Missing phone numbers</h1>
        <p style={S.lead}>
          These patients have no number on file, so no reminder can reach them.
          Tap the right one, or type it in. Every answer saves on its own.
        </p>
        <div style={S.progressRow}>
          <strong style={S.count}>{done} of {total}</strong>
          <button type="button" style={S.toggle} onClick={() => setHideDone((v) => !v)}>
            {hideDone ? "Show answered" : "Hide answered"}
          </button>
        </div>
        <div style={S.bar}><div style={{ ...S.barFill, width: total ? `${(done / total) * 100}%` : 0 }} /></div>
      </header>

      {error ? <p style={S.error}>{error}</p> : null}

      {visible.length === 0 ? (
        <p style={S.done}>All done. Thank you — that is the whole list.</p>
      ) : null}

      {visible.map((row) => (
        <section key={row.id} style={{ ...S.card, opacity: row.done ? 0.55 : 1 }}>
          <div style={S.name}>{row.name}</div>
          <div style={S.meta}>Last visit: {formatVisit(row.lastVisit)}</div>

          {row.done ? (
            <div style={S.savedLine}>{row.saved ? `Saved: ${row.saved}` : "Marked as unknown"}</div>
          ) : (
            <>
              {row.candidates.map((c) => (
                <button
                  key={c.phone}
                  type="button"
                  style={S.option}
                  disabled={busy === row.id}
                  onClick={() => answer(row, "picked", c.phone)}
                >
                  <span style={S.optionLabel}>{c.label}</span>
                  <span style={S.optionPhone}>{c.phone}</span>
                </button>
              ))}

              {typingFor === row.id ? (
                <div style={S.typeRow}>
                  <input
                    id={`phone-${row.id}`}
                    style={S.input}
                    inputMode="numeric"
                    autoComplete="tel"
                    placeholder="05X XXX XXXX"
                    value={typed}
                    onChange={(e) => setTyped(e.target.value)}
                    autoFocus
                  />
                  <button
                    type="button"
                    style={S.save}
                    disabled={busy === row.id}
                    onClick={() => answer(row, "typed", typed)}
                  >
                    Save
                  </button>
                </div>
              ) : (
                <button type="button" style={S.secondary} onClick={() => { setTypingFor(row.id); setTyped("") }}>
                  Type the number myself
                </button>
              )}

              <button
                type="button"
                style={S.skip}
                disabled={busy === row.id}
                onClick={() => answer(row, "unknown")}
              >
                I don&apos;t know this one
              </button>
            </>
          )}
        </section>
      ))}
    </main>
  )
}

const S: Record<string, React.CSSProperties> = {
  page: { maxWidth: 560, margin: "0 auto", padding: "20px 16px 60px", fontFamily: "system-ui, -apple-system, Segoe UI, sans-serif", color: "#16211e" },
  header: { marginBottom: 20 },
  h1: { fontSize: 22, margin: "0 0 6px", fontWeight: 700 },
  lead: { fontSize: 14.5, lineHeight: 1.6, color: "#5d6c68", margin: 0 },
  progressRow: { display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 14 },
  count: { fontSize: 15, fontVariantNumeric: "tabular-nums" },
  toggle: { border: "1px solid #dde4e1", background: "#fff", borderRadius: 8, padding: "5px 10px", fontSize: 12.5, cursor: "pointer" },
  bar: { height: 6, background: "#e6ebe9", borderRadius: 99, overflow: "hidden", marginTop: 8 },
  barFill: { height: "100%", background: "#0e6f63", borderRadius: 99, transition: "width .3s ease" },
  card: { background: "#fff", border: "1px solid #dde4e1", borderRadius: 14, padding: 14, marginBottom: 12 },
  name: { fontWeight: 700, fontSize: 16 },
  meta: { color: "#8b9894", fontSize: 12.5, marginBottom: 10 },
  option: { display: "flex", width: "100%", justifyContent: "space-between", gap: 10, alignItems: "center", textAlign: "left", border: "1px solid #dde4e1", background: "#fff", borderRadius: 10, padding: "11px 12px", marginBottom: 7, fontSize: 15, cursor: "pointer" },
  optionLabel: { fontWeight: 500 },
  optionPhone: { fontFamily: "ui-monospace, Menlo, monospace", color: "#5d6c68", fontSize: 14 },
  secondary: { width: "100%", border: "1px dashed #c7d2ce", background: "#fff", borderRadius: 10, padding: "10px 12px", marginBottom: 7, fontSize: 14.5, color: "#0e6f63", cursor: "pointer" },
  skip: { width: "100%", border: "none", background: "transparent", color: "#8b9894", fontSize: 13.5, padding: "6px 0 0", cursor: "pointer" },
  typeRow: { display: "flex", gap: 8, marginBottom: 7 },
  input: { flex: 1, border: "1px solid #dde4e1", borderRadius: 10, padding: "10px 12px", fontSize: 16 },
  save: { border: "none", background: "#0e6f63", color: "#fff", borderRadius: 10, padding: "10px 16px", fontSize: 15, fontWeight: 600, cursor: "pointer" },
  savedLine: { fontSize: 14, color: "#0e6f63", fontFamily: "ui-monospace, Menlo, monospace" },
  muted: { color: "#8b9894" },
  notice: { background: "#fff", border: "1px solid #dde4e1", borderRadius: 12, padding: 16, fontSize: 15 },
  error: { background: "#fdecec", border: "1px solid #f0c9c9", color: "#a33", borderRadius: 10, padding: "10px 12px", fontSize: 14, marginBottom: 12 },
  done: { background: "#e2efec", border: "1px solid #bcdcd6", borderRadius: 12, padding: 16, fontSize: 15, color: "#0e6f63" },
}

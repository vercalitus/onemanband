"use client"

import { useEffect, useRef, useState } from "react"
import { Mic, Square, Trash2 } from "lucide-react"

import { useLocale } from "@/components/providers/locale-provider"
import { cn } from "@/lib/utils"

/** Hard cap on a single recording, in seconds. */
const MAX_SECONDS = 300

interface Props {
  /** Object URL of an already-recorded clip for this session (null = none). */
  audioUrl: string | null
  /** Called with the recorded blob when the user stops recording. */
  onRecorded: (blob: Blob) => void
  /** Remove the current recording. */
  onDelete: () => void
  className?: string
}

function formatTime(total: number): string {
  const m = Math.floor(total / 60)
  const s = total % 60
  return `${m}:${s.toString().padStart(2, "0")}`
}

/**
 * Voice-memo recorder for a treatment session. Uses the browser MediaRecorder
 * API, caps a single clip at 5 minutes, and hands the finished blob to the
 * parent (which stores it in IndexedDB — audio is far too large for
 * localStorage). Playback uses a native <audio> element.
 */
export function SessionAudio({ audioUrl, onRecorded, onDelete, className }: Props) {
  const { t } = useLocale()
  const recorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const streamRef = useRef<MediaStream | null>(null)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const [recording, setRecording] = useState(false)
  const [elapsed, setElapsed] = useState(0)
  const [error, setError] = useState<string | null>(null)

  const stopTracks = () => {
    streamRef.current?.getTracks().forEach((tr) => tr.stop())
    streamRef.current = null
  }

  const clearTimer = () => {
    if (timerRef.current) clearInterval(timerRef.current)
    timerRef.current = null
  }

  // Clean up stream/timer if the component unmounts mid-recording.
  useEffect(() => {
    return () => {
      clearTimer()
      stopTracks()
    }
  }, [])

  const stop = () => {
    if (recorderRef.current && recorderRef.current.state !== "inactive") {
      recorderRef.current.stop()
    }
    clearTimer()
    setRecording(false)
  }

  const start = async () => {
    setError(null)
    if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      setError(t("patientChart.audio.unsupported"))
      return
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream
      const recorder = new MediaRecorder(stream)
      chunksRef.current = []
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data)
      }
      recorder.onstop = () => {
        stopTracks()
        const blob = new Blob(chunksRef.current, {
          type: recorder.mimeType || "audio/webm",
        })
        if (blob.size > 0) onRecorded(blob)
      }
      recorder.start()
      recorderRef.current = recorder
      setRecording(true)
      setElapsed(0)
      timerRef.current = setInterval(() => {
        setElapsed((prev) => {
          const next = prev + 1
          if (next >= MAX_SECONDS) stop()
          return next
        })
      }, 1000)
    } catch {
      setError(t("patientChart.audio.denied"))
      stopTracks()
    }
  }

  return (
    <div className={cn("rounded-2xl border border-slate-100 bg-slate-50 p-4", className)}>
      <div className="flex items-center gap-2">
        <Mic className="size-4 text-slate-400" aria-hidden />
        <p className="text-sm font-semibold text-slate-700">{t("patientChart.audio.title")}</p>
        {recording ? (
          <span className="ms-auto flex items-center gap-2 font-mono text-xs tabular-nums text-rose-600">
            <span className="inline-block size-2 animate-pulse rounded-full bg-rose-500" aria-hidden />
            {formatTime(elapsed)} / {formatTime(MAX_SECONDS)}
          </span>
        ) : (
          <span className="ms-auto text-[11px] text-slate-400">{t("patientChart.audio.hint")}</span>
        )}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        {!recording ? (
          <button
            type="button"
            onClick={start}
            className="flex items-center gap-1.5 rounded-lg border border-sky-200 bg-sky-50 px-3 py-1.5 text-xs font-semibold text-sky-700 transition-colors hover:bg-sky-100"
          >
            <Mic className="size-3.5" aria-hidden />
            {audioUrl ? t("patientChart.audio.reRecord") : t("patientChart.audio.record")}
          </button>
        ) : (
          <button
            type="button"
            onClick={stop}
            className="flex items-center gap-1.5 rounded-lg border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs font-semibold text-rose-700 transition-colors hover:bg-rose-100"
          >
            <Square className="size-3.5" aria-hidden />
            {t("patientChart.audio.stop")}
          </button>
        )}

        {audioUrl && !recording && (
          <>
            <audio
              controls
              src={audioUrl}
              className="h-9 min-w-0 flex-1"
              aria-label={t("patientChart.audio.playbackAria")}
            />
            <button
              type="button"
              onClick={onDelete}
              className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-semibold text-slate-500 transition-colors hover:bg-rose-50 hover:text-rose-700"
              aria-label={t("patientChart.audio.deleteAria")}
            >
              <Trash2 className="size-3.5" aria-hidden />
            </button>
          </>
        )}
      </div>

      {error && <p className="mt-2 text-xs font-medium text-rose-600">{error}</p>}
    </div>
  )
}

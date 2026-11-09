"use client"

import { useEffect, useRef, useState } from "react"
import { Mic, Square, Trash2 } from "lucide-react"

import { useLocale } from "@/components/providers/locale-provider"
import { Button } from "@/components/ui/button"
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
export function SessionAudio({
  audioUrl,
  onRecorded,
  onDelete,
  className,
  compact = false,
}: Props & {
  /** In the canvas toolbar row: no box, no title, no hint. */
  compact?: boolean
}) {
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
    <div className={cn(!compact && "rounded-md border border-hair bg-paper px-3 py-2", className)}>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        {!compact && (
          <p className="flex items-center gap-2 text-sm font-medium text-ink">
            <Mic className="size-5 text-mute" aria-hidden />
            {t("patientChart.audio.title")}
          </p>
        )}

        {!recording ? (
          <Button
            variant="outline"
            onClick={start}
            className="text-sm"
            aria-label={compact ? t("patientChart.audio.title") : undefined}
          >
            {compact ? (
              <Mic className="size-4" aria-hidden />
            ) : (
              <span className="size-3 rounded-full border-2 border-ink" aria-hidden />
            )}
            {audioUrl ? t("patientChart.audio.reRecord") : t("patientChart.audio.record")}
          </Button>
        ) : (
          <Button variant="outline" onClick={stop} className="border-2 border-signal text-sm">
            <Square className="size-4 fill-current" aria-hidden />
            {t("patientChart.audio.stop")}
          </Button>
        )}

        {recording ? (
          <span className="flex items-center gap-2 text-sm font-medium tabular-nums text-ink">
            <span className="inline-block size-2.5 animate-pulse rounded-full bg-signal" aria-hidden />
            {formatTime(elapsed)} / {formatTime(MAX_SECONDS)}
          </span>
        ) : (
          !audioUrl && !compact && <span className="text-sm text-mute">{t("patientChart.audio.hint")}</span>
        )}

        {audioUrl && !recording && (
          <>
            <audio
              controls
              src={audioUrl}
              className="h-11 min-w-0 flex-1"
              aria-label={t("patientChart.audio.playbackAria")}
            />
            <Button
              variant="outline"
              size="icon"
              onClick={onDelete}
              className="text-mute"
              aria-label={t("patientChart.audio.deleteAria")}
            >
              <Trash2 className="size-4" aria-hidden />
            </Button>
          </>
        )}
      </div>

      {error && <p className="mt-2 text-sm font-medium text-ink">{error}</p>}
    </div>
  )
}

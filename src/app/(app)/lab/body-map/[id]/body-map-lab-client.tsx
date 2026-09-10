"use client"

import dynamic from "next/dynamic"
import Link from "next/link"
import { ArrowLeft } from "lucide-react"
import { useCallback, useEffect, useState } from "react"

import { useLocale } from "@/components/providers/locale-provider"
import { useMergedPatients } from "@/components/providers/patient-extras-provider"
import type { Annotation } from "@/features/body-map-3d/components/skeleton-viewer"

/**
 * three.js is ~170 KB and has no business in the bundle of a chart that does
 * not use it. Loaded when this page is opened, and only then.
 */
const SkeletonViewer = dynamic(
  () => import("@/features/body-map-3d/components/skeleton-viewer").then((m) => m.SkeletonViewer),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-[560px] items-center justify-center rounded-2xl border border-slate-200 bg-slate-50 text-sm text-slate-400">
        …
      </div>
    ),
  },
)

const storageKey = (patientId: string) => `lab.bodymap3d.${patientId}`

export function BodyMapLabClient({ patientId }: { patientId: string }) {
  const { t } = useLocale()
  const patients = useMergedPatients()
  const patient = patients.find((p) => p.id === patientId)
  const [annotations, setAnnotations] = useState<Annotation[]>([])
  const [hydrated, setHydrated] = useState(false)

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(storageKey(patientId))
      const stored = raw ? (JSON.parse(raw) as Annotation[]) : []
      /*
       * Strokes used to be screen coordinates and are now positions on the
       * bone. A mark made before that change keeps its bones and its note —
       * the part that is actually a record — and loses only the ink, which
       * has no place to go: nothing in a pair of pixels says where on the
       * skeleton it was. Silently keeping it would draw a line through the
       * middle of the body.
       */
      setAnnotations(
        stored.map((a) => ({
          ...a,
          strokes: (a.strokes ?? []).filter((s) => s.every((p) => p?.length === 3)),
        })),
      )
    } catch {
      setAnnotations([])
    }
    setHydrated(true)
  }, [patientId])

  const persist = useCallback(
    (next: Annotation[]) => {
      setAnnotations(next)
      try {
        window.localStorage.setItem(storageKey(patientId), JSON.stringify(next))
      } catch {
        /* private mode — the prototype still works for this session */
      }
    },
    [patientId],
  )

  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-amber-200 bg-amber-50/70 px-4 py-3">
        <p className="text-sm font-semibold text-amber-900">{t("bodyMap3d.lab.badge")}</p>
        <p className="mt-0.5 text-xs leading-relaxed text-amber-800">{t("bodyMap3d.lab.badgeBody")}</p>
      </div>

      <div className="flex flex-wrap items-baseline gap-3">
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
          {t("bodyMap3d.lab.heading")}
        </h1>
        {patient && (
          <Link
            href={`/patients/${patientId}`}
            className="inline-flex items-center gap-1.5 text-sm font-medium text-sky-700 hover:underline"
          >
            <ArrowLeft className="size-3.5 rtl:rotate-180" aria-hidden />
            {patient.fullName}
          </Link>
        )}
      </div>

      {hydrated && (
        <SkeletonViewer
          annotations={annotations}
          onSave={(draft) =>
            persist([
              {
                ...draft,
                id: `ann-${Date.now()}`,
                createdAt: new Date().toISOString(),
              },
              ...annotations,
            ])
          }
          onDelete={(id) => persist(annotations.filter((a) => a.id !== id))}
          onUpdateNote={(id, note) =>
            persist(annotations.map((a) => (a.id === id ? { ...a, note: note || undefined } : a)))
          }
        />
      )}

      <div className="rounded-2xl border border-slate-200 bg-white p-4 text-sm leading-relaxed text-slate-600">
        <p className="font-semibold text-slate-800">{t("bodyMap3d.lab.checkTitle")}</p>
        <ul className="mt-2 list-disc space-y-1 ps-5">
          <li>{t("bodyMap3d.lab.check1")}</li>
          <li>{t("bodyMap3d.lab.check2")}</li>
          <li>{t("bodyMap3d.lab.check3")}</li>
          <li>{t("bodyMap3d.lab.check4")}</li>
          <li>{t("bodyMap3d.lab.check5")}</li>
        </ul>
      </div>
    </div>
  )
}

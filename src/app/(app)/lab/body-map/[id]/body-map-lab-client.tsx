"use client"

import dynamic from "next/dynamic"
import Link from "next/link"
import { ArrowLeft } from "lucide-react"
import { useCallback, useEffect, useState } from "react"

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
      <div className="flex h-[540px] items-center justify-center rounded-2xl border border-slate-200 bg-slate-50 text-sm text-slate-400">
        טוען את המודל…
      </div>
    ),
  },
)

const storageKey = (patientId: string) => `lab.bodymap3d.${patientId}`

export function BodyMapLabClient({ patientId }: { patientId: string }) {
  const patients = useMergedPatients()
  const patient = patients.find((p) => p.id === patientId)
  const [annotations, setAnnotations] = useState<Annotation[]>([])
  const [hydrated, setHydrated] = useState(false)

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(storageKey(patientId))
      setAnnotations(raw ? (JSON.parse(raw) as Annotation[]) : [])
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
        <p className="text-sm font-semibold text-amber-900">אב־טיפוס — לא חלק מהתיק</p>
        <p className="mt-0.5 text-xs leading-relaxed text-amber-800">
          השלד נבנה בקוד, לא הורד: סכמטי בכוונה, אבל כל חוליה נושאת את שמה מהרגע
          הראשון. הסימונים נשמרים בדפדפן הזה בלבד ולא נוגעים ברשומה של המטופל.
        </p>
      </div>

      <div className="flex flex-wrap items-baseline gap-3">
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">מפת גוף תלת־ממדית</h1>
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
        />
      )}

      <div className="rounded-2xl border border-slate-200 bg-white p-4 text-sm leading-relaxed text-slate-600">
        <p className="font-semibold text-slate-800">מה לבדוק</p>
        <ul className="mt-2 list-disc space-y-1 ps-5">
          <li>לגרור לסיבוב 360°, שתי אצבעות לזום. מרחפים מעל עצם — שמה מופיע מימין.</li>
          <li>
            «סימון בעט» מקפיא את התצוגה. אז מציירים חופשי — אזור שלם או נקודה קטנה
            — והמערכת רושמת על אילו עצמות העט עבר.
          </li>
          <li>
            «שמירת סימון» זוכר גם את הזווית. הקשה על סימון שמור מחזירה את השלד
            בדיוק לזווית שבה צויר.
          </li>
          <li>כף היד על המסך לא מציירת ברגע שהעט זוהה — אותו כלל כמו בקנבס הסשן.</li>
        </ul>
      </div>
    </div>
  )
}

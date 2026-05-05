import Link from "next/link"
import { notFound } from "next/navigation"
import { Activity, FileText, StickyNote, Wallet } from "lucide-react"

import { documentsByPatient, financesByPatient, patients, treatmentsByPatient } from "@/lib/mock-data"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { darkCardHeaderClass, elevatedCardBodyClass, elevatedCardClass } from "@/lib/clinic-card-styles"
import { getNavItemByHref, navBadgeCaption } from "@/lib/navigation"

const statusTone = {
  active: "default",
  frozen: "secondary",
  past: "outline",
} as const

export default async function PatientDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ tab?: string }>
}) {
  const { id } = await params
  const { tab } = await searchParams
  const patient = patients.find((entry) => entry.id === id)
  const patientsNav = getNavItemByHref("/patients")!

  if (!patient) {
    notFound()
  }

  const treatmentRecords = treatmentsByPatient[id] ?? []
  const documentRecords = documentsByPatient[id] ?? []
  const financeRecords = financesByPatient[id] ?? []
  const activeTab = ["records", "documents", "finances", "notes"].includes(tab ?? "") ? tab! : "records"

  return (
    <div className="space-y-8">
      <Card className={`mt-6 ${elevatedCardClass}`}>
        <CardHeader className={darkCardHeaderClass}>
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="space-y-3">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-4">
                <Link
                  href="/patients"
                  className="text-sm font-medium text-sky-400 transition-colors hover:text-sky-300"
                >
                  {patientsNav.label}
                </Link>
                <Badge variant="outline" className="w-fit border-white/20 bg-white/10 text-slate-200">
                  {navBadgeCaption(patientsNav.description)}
                </Badge>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <h1 className="text-3xl font-semibold tracking-[-0.05em] text-white md:text-4xl">{patient.fullName}</h1>
                <Badge variant={statusTone[patient.status]} className="border-0">
                  {patient.status}
                </Badge>
              </div>
              <p className="max-w-3xl text-sm leading-6 text-slate-300">{patient.medicalHistorySummary}</p>
            </div>

            <div className="shrink-0 rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm">
              <p className="font-medium text-white">Contact</p>
              <p className="mt-1 text-slate-300">{patient.phone}</p>
              <p className="text-slate-300">{patient.email}</p>
            </div>
          </div>
        </CardHeader>
      </Card>

      <Tabs defaultValue={activeTab}>
        <TabsList variant="line">
          <TabsTrigger value="records">Medical Records</TabsTrigger>
          <TabsTrigger value="documents">Documents</TabsTrigger>
          <TabsTrigger value="finances">Financial History</TabsTrigger>
          <TabsTrigger value="notes">General Notes</TabsTrigger>
        </TabsList>

        <TabsContent value="records" className="mt-6">
          <div className="grid gap-4">
            {treatmentRecords.map((record) => (
              <Card key={record.id} className={elevatedCardClass}>
                <CardHeader className={darkCardHeaderClass}>
                  <div className="flex items-center gap-2.5">
                    <Activity className="size-5 stroke-[1.6] text-sky-400" />
                    <CardTitle className="text-lg font-bold tracking-tight text-white">{record.title}</CardTitle>
                  </div>
                  <CardDescription className="text-slate-400">
                    {record.recordedAt} · {record.practitioner}
                  </CardDescription>
                </CardHeader>
                <CardContent className={`${elevatedCardBodyClass} text-sm leading-6 text-slate-500`}>{record.note}</CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="documents" className="mt-6">
          <div className="grid gap-4 md:grid-cols-2">
            {documentRecords.map((document) => (
              <Card key={document.id} className={elevatedCardClass}>
                <CardHeader className={darkCardHeaderClass}>
                  <div className="flex items-center gap-2.5">
                    <FileText className="size-5 stroke-[1.6] text-sky-400" />
                    <CardTitle className="text-lg font-bold tracking-tight text-white">{document.name}</CardTitle>
                  </div>
                  <CardDescription className="text-slate-400">
                    {document.type.toUpperCase()} · uploaded {document.uploadedAt}
                  </CardDescription>
                </CardHeader>
                <CardContent className={`${elevatedCardBodyClass} text-sm leading-6 text-slate-500`}>{document.source}</CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="finances" className="mt-6">
          <div className="grid gap-4">
            {financeRecords.map((record) => (
              <Card key={record.id} className={elevatedCardClass}>
                <CardHeader className={darkCardHeaderClass}>
                  <div className="flex items-center gap-2.5">
                    <Wallet className="size-5 stroke-[1.6] text-sky-400" />
                    <CardTitle className="text-lg font-bold tracking-tight text-white">{record.description}</CardTitle>
                  </div>
                  <CardDescription className="text-slate-400">{record.issuedAt}</CardDescription>
                </CardHeader>
                <CardContent className={`${elevatedCardBodyClass} flex items-center justify-between gap-3`}>
                  <span className="font-mono text-sm font-medium tabular-nums text-slate-900">{record.amount}</span>
                  <div className="flex gap-2">
                    <Badge variant="outline">{record.invoiceStatus}</Badge>
                    <Badge variant="secondary">{record.paymentStatus.replace("_", " ")}</Badge>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="notes" className="mt-6">
          <Card className={elevatedCardClass}>
            <CardHeader className={darkCardHeaderClass}>
              <div className="flex items-center gap-2.5">
                <StickyNote className="size-5 stroke-[1.6] text-sky-400" />
                <CardTitle className="text-xl font-bold tracking-tight text-white">General Notes</CardTitle>
              </div>
            </CardHeader>
            <CardContent className={`${elevatedCardBodyClass} text-sm leading-6 text-slate-500`}>{patient.generalNotes}</CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}

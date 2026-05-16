import type {
  ClinicalSource,
  DocumentRecord,
  FinanceRecord,
  NewsArticle,
  PatientSummary,
  PulseMetric,
  ScheduleItem,
  TodoItem,
  TreatmentRecord,
} from "@/types/domain"

export const dashboardMetrics: PulseMetric[] = [
  { id: "visits", label: "Monthly Visits", value: "342", delta: "+11%", trend: "up" },
  {
    id: "capacity",
    label: "Treatment Capacity",
    value: "78%",
    delta: "+4 pp MoM",
    trend: "up",
  },
  { id: "revenue", label: "Monthly Revenue", value: "$74.2k", delta: "+9%", trend: "up" },
  { id: "debt", label: "Open Debt (month)", value: "$8.9k", delta: "-6%", trend: "down" },
]

/**
 * Local-time ISO date for "today". We freeze it at module import so every mock
 * appointment that says "today" lines up with the same calendar day across the
 * app (avoids edge cases when tabs are open past midnight).
 */
const TODAY_ISO = (() => {
  const d = new Date()
  const yyyy = d.getFullYear()
  const mm = String(d.getMonth() + 1).padStart(2, "0")
  const dd = String(d.getDate()).padStart(2, "0")
  return `${yyyy}-${mm}-${dd}`
})()

const TOMORROW_ISO = (() => {
  const d = new Date()
  d.setDate(d.getDate() + 1)
  const yyyy = d.getFullYear()
  const mm = String(d.getMonth() + 1).padStart(2, "0")
  const dd = String(d.getDate()).padStart(2, "0")
  return `${yyyy}-${mm}-${dd}`
})()

export const todaySchedule: ScheduleItem[] = [
  {
    id: "apt-1",
    patientId: "pt-001",
    patientName: "Maya Green",
    date: TODAY_ISO,
    dayLabel: "Today",
    provider: "",
    start: "08:00",
    end: "08:35",
    status: "completed",
    treatment: "New patient intake — cervical and upper thoracic history",
    appointmentType: "first",
  },
  {
    id: "apt-2",
    patientId: "pt-002",
    patientName: "Noah Stone",
    date: TODAY_ISO,
    dayLabel: "Today",
    provider: "",
    start: "08:40",
    end: "08:45",
    status: "completed",
    treatment: "Cervical segmental check — tolerated well",
    appointmentType: "adjustments",
  },
  {
    id: "apt-3",
    patientId: "pt-003",
    patientName: "Ava Hart",
    date: TODAY_ISO,
    dayLabel: "Today",
    provider: "",
    start: "08:50",
    end: "09:05",
    status: "completed",
    treatment: "Kupa visit — lumbar flexion/extension review",
    appointmentType: "kupa",
  },
  {
    id: "apt-4",
    patientId: "pt-004",
    patientName: "Liam Carter",
    date: TODAY_ISO,
    dayLabel: "Today",
    provider: "",
    start: "09:10",
    end: "09:40",
    status: "confirmed",
    treatment: "Thoracic extension + rib mobility protocol",
    appointmentType: "adjustments",
  },
  {
    id: "apt-5",
    patientId: "pt-005",
    patientName: "Sofia Reed",
    date: TODAY_ISO,
    dayLabel: "Today",
    provider: "",
    start: "09:45",
    end: "09:55",
    status: "confirmed",
    treatment: "Kupa — pelvic alignment paperwork + quick scan",
    appointmentType: "kupa",
  },
  {
    id: "apt-6",
    patientId: "pt-006",
    patientName: "Ethan Blake",
    date: TODAY_ISO,
    dayLabel: "Today",
    provider: "",
    start: "10:00",
    end: "10:05",
    status: "scheduled",
    treatment: "SI joint reassessment brief",
    appointmentType: "kupa",
  },
  {
    id: "apt-7",
    patientId: "pt-001",
    patientName: "Maya Green",
    date: TODAY_ISO,
    dayLabel: "Today",
    provider: "",
    start: "10:10",
    end: "10:35",
    status: "scheduled",
    treatment: "Plan of care revisit — ergonomics counselling",
    appointmentType: "adjustments",
  },
  {
    id: "apt-8",
    patientId: "pt-003",
    patientName: "Ava Hart",
    date: TODAY_ISO,
    dayLabel: "Today",
    provider: "",
    start: "10:40",
    end: "11:35",
    status: "confirmed",
    treatment: "Comprehensive cervical + lumbar first follow-up bundle",
    appointmentType: "first",
  },
  {
    id: "apt-9",
    patientId: "pt-004",
    patientName: "Liam Carter",
    date: TODAY_ISO,
    dayLabel: "Today",
    provider: "",
    start: "11:40",
    end: "11:55",
    status: "scheduled",
    treatment: "Post-MRI guarded adjustments — lumbar",
    appointmentType: "adjustments",
  },
  {
    id: "apt-10",
    patientId: "pt-002",
    patientName: "Noah Stone",
    date: TODAY_ISO,
    dayLabel: "Today",
    provider: "",
    start: "12:00",
    end: "12:05",
    status: "confirmed",
    treatment: "Quick posture screen before travel",
    appointmentType: "kupa",
  },
  {
    id: "apt-11",
    patientId: "pt-005",
    patientName: "Sofia Reed",
    date: TODAY_ISO,
    dayLabel: "Today",
    provider: "",
    start: "12:10",
    end: "12:25",
    status: "scheduled",
    treatment: "Hip hinge patterning + pelvic floor cueing",
    appointmentType: "adjustments",
  },
  {
    id: "apt-12",
    patientId: "pt-006",
    patientName: "Ethan Blake",
    date: TODAY_ISO,
    dayLabel: "Today",
    provider: "",
    start: "12:30",
    end: "13:30",
    status: "checked_in",
    treatment: "Rehab milestone — resisted rotation + gait check",
    appointmentType: "first",
  },
  {
    id: "apt-13",
    patientId: "pt-004",
    patientName: "Liam Carter",
    date: TODAY_ISO,
    dayLabel: "Today",
    provider: "",
    start: "13:35",
    end: "14:05",
    status: "scheduled",
    treatment: "Kupa — thoracic unloading + seated posture drill",
    appointmentType: "kupa",
  },
  {
    id: "apt-14",
    patientId: "pt-001",
    patientName: "Maya Green",
    date: TODAY_ISO,
    dayLabel: "Today",
    provider: "",
    start: "14:10",
    end: "14:55",
    status: "scheduled",
    treatment: "Return visit intake — cervical extension intolerance",
    appointmentType: "first",
  },
  {
    id: "apt-15",
    patientId: "pt-003",
    patientName: "Ava Hart",
    date: TODAY_ISO,
    dayLabel: "Today",
    provider: "",
    start: "15:00",
    end: "15:05",
    status: "confirmed",
    treatment: "Cervical distraction quick session",
    appointmentType: "adjustments",
  },
  {
    id: "apt-16",
    patientId: "pt-005",
    patientName: "Sofia Reed",
    date: TODAY_ISO,
    dayLabel: "Today",
    provider: "",
    start: "15:10",
    end: "15:45",
    status: "cancelled",
    treatment: "Full spine maintenance — cancelled by patient",
    appointmentType: "adjustments",
  },
]

/** A few illustrative visits scheduled on the next working day so the week/month
 * views show data outside today. Mock-only — production swaps for real data. */
export const weeklySchedule: ScheduleItem[] = [
  {
    id: "week-1",
    patientId: "pt-004",
    patientName: "Liam Carter",
    date: TOMORROW_ISO,
    dayLabel: "Tomorrow",
    provider: "",
    start: "09:00",
    end: "09:30",
    status: "scheduled",
    treatment: "MRI review",
    appointmentType: "first",
  },
  {
    id: "week-2",
    patientId: "pt-005",
    patientName: "Sofia Reed",
    date: TOMORROW_ISO,
    dayLabel: "Tomorrow",
    provider: "",
    start: "11:00",
    end: "11:45",
    status: "confirmed",
    treatment: "Pelvic alignment",
    appointmentType: "adjustments",
  },
  {
    id: "week-3",
    patientId: "pt-006",
    patientName: "Ethan Blake",
    date: TOMORROW_ISO,
    dayLabel: "Tomorrow",
    provider: "",
    start: "15:30",
    end: "16:00",
    status: "scheduled",
    treatment: "Rehabilitation checkpoint",
    appointmentType: "kupa",
  },
]

export const dashboardTodos: TodoItem[] = [
  {
    id: "todo-1",
    title: "Verify three unsigned consent forms",
    due: "09:30",
    priority: "high",
    overdue: true,
    kind: "reactive",
  },
  {
    id: "todo-2",
    title: "Review overdue invoices before billing run",
    due: "12:00",
    priority: "medium",
    kind: "reactive",
  },
  {
    id: "todo-3",
    title: "Approve tomorrow's reminder queue",
    due: "16:00",
    priority: "low",
    kind: "reactive",
  },
]

export const patients: PatientSummary[] = [
  {
    id: "pt-001",
    fullName: "Maya Green",
    status: "active",
    phone: "+1 (555) 104-2201",
    email: "maya.green@example.com",
    address: "14 Sycamore Lane, Tel Aviv",
    lastVisit: "2026-04-02",
    balance: "$120",
    tags: ["Cervical Spine", "Insurance"],
    medicalHistorySummary: "Recurring cervical pain after remote-work strain. No allergies reported.",
    generalNotes: "Prefers reminder messages by WhatsApp and early morning appointment slots.",
  },
  {
    id: "pt-002",
    fullName: "Noah Stone",
    status: "frozen",
    phone: "+1 (555) 204-1108",
    email: "noah.stone@example.com",
    address: "38 HaYarkon St, Tel Aviv",
    lastVisit: "2026-03-11",
    balance: "$460",
    tags: ["Debt Watch", "Lumbar"],
    medicalHistorySummary: "Intermittent lumbar pain with prior MRI on file. Follow-up paused due to travel.",
    generalNotes: "Resume care plan once insurance approval clears.",
  },
  {
    id: "pt-003",
    fullName: "Ava Hart",
    status: "past",
    phone: "+1 (555) 338-5099",
    email: "ava.hart@example.com",
    address: "7 Dizengoff Circle, Tel Aviv",
    lastVisit: "2025-12-18",
    balance: "$0",
    tags: ["Discharged"],
    medicalHistorySummary: "Completed six-session treatment plan with improved range of motion.",
    generalNotes: "Archive after final document retention review.",
  },
  {
    id: "pt-004",
    fullName: "Liam Carter",
    status: "active",
    phone: "+1 (555) 418-2214",
    email: "liam.carter@example.com",
    address: "22 Ben Yehuda St, Haifa",
    lastVisit: "2026-04-01",
    balance: "$180",
    tags: ["MRI", "Follow-up"],
    medicalHistorySummary: "Recent MRI review requested for thoracic discomfort with posture-related aggravation.",
    generalNotes: "Likes concise summaries after visits and midday scheduling windows.",
  },
  {
    id: "pt-005",
    fullName: "Sofia Reed",
    status: "active",
    phone: "+1 (555) 672-8810",
    email: "sofia.reed@example.com",
    address: "55 Rothschild Blvd, Tel Aviv",
    lastVisit: "2026-03-29",
    balance: "$90",
    tags: ["Pelvic Alignment"],
    medicalHistorySummary: "Ongoing pelvic alignment treatment plan with strong adherence to home exercises.",
    generalNotes: "Reminder preference is email first, then SMS fallback.",
  },
  {
    id: "pt-006",
    fullName: "Ethan Blake",
    status: "frozen",
    phone: "+1 (555) 800-2331",
    email: "ethan.blake@example.com",
    address: "3 Allenby St, Jerusalem",
    lastVisit: "2026-03-03",
    balance: "$320",
    tags: ["Rehab", "Debt Watch"],
    medicalHistorySummary: "Paused rehabilitation checkpoint sequence while travel schedule is unstable.",
    generalNotes: "Re-engage when availability stabilizes; prefers WhatsApp check-ins.",
  },
]

export const treatmentsByPatient: Record<string, TreatmentRecord[]> = {
  "pt-001": [
    {
      id: "tr-001",
      recordedAt: "2026-04-02 09:02",
      practitioner: "Dr. Rivera",
      title: "Initial cervical assessment",
      note: "Restricted left rotation, tenderness around C5-C7, home exercise plan prescribed.",
    },
    {
      id: "tr-002",
      recordedAt: "2026-04-03 08:58",
      practitioner: "Dr. Rivera",
      title: "Manual therapy follow-up",
      note: "Pain reduced from 7/10 to 4/10. Continue ergonomic adjustments and mobility drills.",
    },
  ],
  "pt-002": [
    {
      id: "tr-003",
      recordedAt: "2026-03-11 11:12",
      practitioner: "Dr. Sloan",
      title: "Lumbar review",
      note: "Symptoms stable. Treatment paused pending insurer confirmation.",
    },
  ],
  "pt-003": [
    {
      id: "tr-004",
      recordedAt: "2025-12-18 10:05",
      practitioner: "Dr. Rivera",
      title: "Discharge summary",
      note: "Patient completed treatment plan with sustained mobility improvement.",
    },
  ],
}

export const documentsByPatient: Record<string, DocumentRecord[]> = {
  "pt-001": [
    {
      id: "doc-001",
      name: "Cervical X-Ray - Apr 2026",
      type: "xray",
      uploadedAt: "2026-04-02",
      source: "Supabase Storage / imaging",
    },
    {
      id: "doc-002",
      name: "Insurance Authorization",
      type: "insurance",
      uploadedAt: "2026-04-01",
      source: "Supabase Storage / billing",
    },
  ],
  "pt-002": [
    {
      id: "doc-003",
      name: "Lumbar MRI - Feb 2026",
      type: "mri",
      uploadedAt: "2026-02-19",
      source: "Supabase Storage / imaging",
    },
  ],
  "pt-003": [
    {
      id: "doc-004",
      name: "Signed Discharge Note",
      type: "other",
      uploadedAt: "2025-12-18",
      source: "Supabase Storage / records",
    },
  ],
}

export const financesByPatient: Record<string, FinanceRecord[]> = {
  "pt-001": [
    {
      id: "fin-001",
      issuedAt: "2026-04-02",
      description: "Visit invoice INV-2402",
      amount: "$120",
      invoiceStatus: "issued",
      paymentStatus: "pending",
    },
  ],
  "pt-002": [
    {
      id: "fin-002",
      issuedAt: "2026-03-11",
      description: "Care package INV-2390",
      amount: "$460",
      invoiceStatus: "overdue",
      paymentStatus: "partially_paid",
    },
  ],
  "pt-003": [
    {
      id: "fin-003",
      issuedAt: "2025-12-18",
      description: "Final consultation INV-2281",
      amount: "$0",
      invoiceStatus: "paid",
      paymentStatus: "paid",
    },
  ],
}

/**
 * Curated list of clinical sources surfaced in the Clinical Feed sidebar.
 * In production these would come from Supabase and include a feed URL the
 * backend polls; for now they're static and drive UI filtering only.
 */
export const clinicalSources: ClinicalSource[] = [
  { id: "src-pubmed", name: "PubMed", url: "https://pubmed.ncbi.nlm.nih.gov" },
  { id: "src-cochrane", name: "Cochrane Library", url: "https://www.cochranelibrary.com" },
  { id: "src-jospt", name: "JOSPT", url: "https://www.jospt.org" },
  { id: "src-bjsm", name: "British Journal of Sports Medicine", url: "https://bjsm.bmj.com" },
  { id: "src-ops", name: "Practice Operations Digest" },
]

export const newsFeed: NewsArticle[] = [
  {
    id: "news-1",
    title: "Cervical Spine Loading Patterns in Hybrid Workflows",
    source: "PubMed",
    sourceId: "src-pubmed",
    url: "https://example.com/cervical-spine-loading",
    keyword: "Cervical Spine",
    publishedAt: "2026-03-28",
    summary:
      "A six-month cohort study examined how neck positioning habits shift after long-term hybrid work adoption, with implications for cervical treatment planning.",
    readingMinutes: 6,
  },
  {
    id: "news-2",
    title: "Osteopathic Treatment Sequencing for Persistent Lumbar Pain",
    source: "JOSPT",
    sourceId: "src-jospt",
    url: "https://example.com/lumbar-sequencing",
    keyword: "Lumbar",
    publishedAt: "2026-03-24",
    summary:
      "Highlights sequencing strategies that improve patient tolerance across six-week care plans, with recommended progression cues.",
    readingMinutes: 8,
  },
  {
    id: "news-3",
    title: "Insurance Documentation Trends for Imaging Approvals",
    source: "Practice Operations Digest",
    sourceId: "src-ops",
    url: "https://example.com/imaging-approvals",
    keyword: "Insurance",
    publishedAt: "2026-03-20",
    summary:
      "Checklist-based submission packages are reducing repeat insurer requests and shortening time-to-approval on routine MRI authorisations.",
    readingMinutes: 4,
  },
  {
    id: "news-4",
    title: "Manual Therapy vs. Exercise-Only for Mid-Range Lumbar Discomfort",
    source: "Cochrane Library",
    sourceId: "src-cochrane",
    url: "https://example.com/manual-vs-exercise",
    keyword: "Lumbar",
    publishedAt: "2026-03-15",
    summary:
      "Systematic review across 14 RCTs comparing manual therapy alone, exercise alone, and combined approaches for non-radicular lumbar pain.",
    readingMinutes: 12,
  },
  {
    id: "news-5",
    title: "Return-to-Sport Criteria After Lateral Ankle Sprain",
    source: "British Journal of Sports Medicine",
    sourceId: "src-bjsm",
    url: "https://example.com/ankle-sprain-rts",
    keyword: "Rehab",
    publishedAt: "2026-03-12",
    summary:
      "Updated consensus statement on objective return-to-sport criteria following grade I–II lateral ankle injuries in recreational athletes.",
    readingMinutes: 7,
  },
  {
    id: "news-6",
    title: "Thoracic Mobility Drills and Overhead Function in Office Workers",
    source: "PubMed",
    sourceId: "src-pubmed",
    url: "https://example.com/thoracic-mobility",
    keyword: "Thoracic",
    publishedAt: "2026-03-08",
    summary:
      "A randomised trial of three thoracic mobility protocols and their effect on shoulder overhead range in sedentary adults.",
    readingMinutes: 5,
  },
  {
    id: "news-7",
    title: "Pelvic Alignment Assessment: Reliability Between Clinicians",
    source: "JOSPT",
    sourceId: "src-jospt",
    url: "https://example.com/pelvic-alignment",
    keyword: "Pelvic",
    publishedAt: "2026-03-02",
    summary:
      "Inter-rater reliability findings for common pelvic alignment tests, with practical implications for solo practitioners.",
    readingMinutes: 9,
  },
]

export const debtorSnapshot = patients
  .filter((patient) => patient.balance !== "$0")
  .map((patient) => ({
    id: patient.id,
    name: patient.fullName,
    balance: patient.balance,
    status: patient.status,
    lastVisit: patient.lastVisit,
  }))

export const invoiceArchive = [
  { id: "INV-2402", patient: "Maya Green", status: "issued", amount: "$120", provider: "Morning" },
  { id: "INV-2390", patient: "Noah Stone", status: "overdue", amount: "$460", provider: "Invoice4U" },
  { id: "INV-2281", patient: "Ava Hart", status: "paid", amount: "$0", provider: "Morning" },
]

/**
 * Patients waiting to be slotted into an opening. Visible in the scheduler
 * sidebar; future iteration will support drag-and-drop onto the grid.
 */
export interface WaitlistEntry {
  id: string
  patientId: string
  patientName: string
  reason: string
  /** Patient-supplied availability window, free text for now. */
  availability: string
  /** Soft priority used to order/sort and tint the row. */
  priority: "high" | "medium" | "low"
}

export const waitlistEntries: WaitlistEntry[] = [
  {
    id: "wl-001",
    patientId: "pt-002",
    patientName: "Noah Stone",
    reason: "Lumbar follow-up",
    availability: "Mon–Wed mornings",
    priority: "high",
  },
  {
    id: "wl-002",
    patientId: "pt-005",
    patientName: "Sofia Reed",
    reason: "Pelvic alignment recheck",
    availability: "Any weekday afternoon",
    priority: "medium",
  },
  {
    id: "wl-003",
    patientId: "pt-004",
    patientName: "Liam Carter",
    reason: "Thoracic adjustments",
    availability: "Thu evenings",
    priority: "medium",
  },
  {
    id: "wl-004",
    patientId: "pt-006",
    patientName: "Ethan Blake",
    reason: "Rehab re-engagement",
    availability: "Open availability",
    priority: "low",
  },
]

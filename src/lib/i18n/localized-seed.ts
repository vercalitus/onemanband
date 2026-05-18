import type { TranslateFn } from "@/lib/i18n/dictionary"
import type { Locale } from "@/lib/i18n/types"
import type {
  AppointmentType,
  DocumentRecord,
  FinanceRecord,
  NewsArticle,
  PatientSummary,
  PulseMetric,
  ScheduleItem,
  TodoItem,
  TreatmentRecord,
} from "@/types/domain"
import type { WaitlistEntry } from "@/lib/mock-data"

type SchedPatch = Partial<Pick<ScheduleItem, "patientName" | "treatment" | "dayLabel">>

const HE_SCHEDULE: Record<string, SchedPatch> = {
  "apt-1": {
    patientName: "מאיה כהן",
    treatment: "קבלת מטופל חדש — אנמנזה צווארית ובית־חזה עליון",
    dayLabel: "היום",
  },
  "apt-2": {
    patientName: "נח שחר",
    treatment: "בדיקת מקטעים צוואריים — התקבל טוב",
    dayLabel: "היום",
  },
  "apt-3": {
    patientName: "אביגיל לוי",
    treatment: "ביקור קופה — סקירת כיפוף/יישור מותני",
    dayLabel: "היום",
  },
  "apt-4": {
    patientName: "ניר כהן",
    treatment: "יישור בית־חזה + פרוטוקול ניידות צלעות",
    dayLabel: "היום",
  },
  "apt-5": {
    patientName: "סופיה ריד",
    treatment: "קופה — ניירת יישור אגן וסריקה קצרה",
    dayLabel: "היום",
  },
  "apt-6": {
    patientName: "איתמר ברק",
    treatment: "הערכת מפרק מותן־עצם הזנב — קצר",
    dayLabel: "היום",
  },
  "apt-7": {
    patientName: "מאיה כהן",
    treatment: "מעקב תוכנית טיפול — ייעוץ ארגונומיה",
    dayLabel: "היום",
  },
  "apt-8": {
    patientName: "אביגיל לוי",
    treatment: "מעקב צווארי־מותני מקיף אחרי ביקור ראשון",
    dayLabel: "היום",
  },
  "apt-9": {
    patientName: "ניר כהן",
    treatment: "התאמות זהירות אחרי MRI — מותני",
    dayLabel: "היום",
  },
  "apt-10": {
    patientName: "נח שחר",
    treatment: "בדיקת יציבה קצרה לפני נסיעה",
    dayLabel: "היום",
  },
  "apt-11": {
    patientName: "סופיה ריד",
    treatment: "דפוס כיפוף מפרק הירך + הנחיות רצפת אגן",
    dayLabel: "היום",
  },
  "apt-12": {
    patientName: "איתמר ברק",
    treatment: "אבן דרך שיקום — סיבוב נגד עומס והליכה",
    dayLabel: "היום",
  },
  "apt-13": {
    patientName: "ניר כהן",
    treatment: "קופה — פריקת בית־חזה בישיבה ותרגיל יציבה",
    dayLabel: "היום",
  },
  "apt-14": {
    patientName: "מאיה כהן",
    treatment: "ביקור חוזר — אי־סבילות ליישור צווארי",
    dayLabel: "היום",
  },
  "apt-15": {
    patientName: "אביגיל לוי",
    treatment: "מושכות צוואר קצרות",
    dayLabel: "היום",
  },
  "apt-16": {
    patientName: "סופיה ריד",
    treatment: "תחזוקת עמוד שדרה — בוטל על ידי המטופלת",
    dayLabel: "היום",
  },
  "week-1": { patientName: "ניר כהן", treatment: "סקירת MRI", dayLabel: "מחר" },
  "week-2": { patientName: "סופיה ריד", treatment: "יישור אגן", dayLabel: "מחר" },
  "week-3": { patientName: "איתמר ברק", treatment: "נקודת שיקום", dayLabel: "מחר" },
}

const HE_PATIENT: Record<string, Partial<PatientSummary>> = {
  "pt-001": {
    fullName: "מאיה כהן",
    phone: "+972-50-104-2201",
    email: "maya.cohen@example.co.il",
    address: "הסידק 14, תל אביב",
    tags: ["עמוד צווארי", "ביטוח"],
    medicalHistorySummary:
      "כאב צוואר חוזר אחרי מאמץ ממושך בעבודה מרחוק; מוצג בעיקר כמתיחה צד ימני בצוואר ובשריר ה‑טרפז הצווארי עם הפניות לאזור התת־עֶרק. בדימות קודמת (צילום צוואר, אפריל 2026): צנחן קלה ב‑C5–C6 ללא ממצאים חריגים חדים. דיווח על ללא אלרגיות. המטופלת פעילה, ללא רקע לבבי או מערכתי מהותי, ומגיבה היטב למוביליזציה ידנית בשילוב תרגילי תנועה ביתיים.",
    generalNotes:
      "מעדיפה תזכורות בוואטסאפ ותורים בוקר מוקדם. בשליחת תרגילי הבית הבאים יש להביא את דף ההתעמלות מהביקור.",
  },
  "pt-002": {
    fullName: "נח שחר",
    phone: "+972-50-204-1108",
    email: "noah.shahar@example.co.il",
    address: "הירקון 38, תל אביב",
    tags: ["מעקב חוב", "מותני"],
    medicalHistorySummary: "כאב מותני עם MRI בקובץ. ההמשך הושהה בגלל נסיעות.",
    generalNotes: "לחדש טיפול כשאישור הביטוח יתקבל.",
  },
  "pt-003": {
    fullName: "אווה הרט",
    phone: "+972-50-338-5099",
    email: "ava.hart@example.co.il",
    address: "כיכר דיזנגוף 7, תל אביב",
    tags: ["שוחרר"],
    medicalHistorySummary: "סדרת שישה טיפולים הושלמה עם שיפור מתמשך בטווח תנועה.",
    generalNotes: "להשלים בדיקת שמירת מסמכים לפני ארכוב.",
  },
  "pt-004": {
    fullName: "ליעם כרטר",
    phone: "+972-52-418-2214",
    email: "liam.carter@example.co.il",
    address: "בן יהודה 22, חיפה",
    tags: ["MRI", "מעקב"],
    medicalHistorySummary: "ביקור לסקירת MRI בשל אי־נוחות בית־חזה המחמירה ביציבה.",
    generalNotes: "מעדיף סיכומים קצרים אחרי ביקורים וזמני תורים בצהריים.",
  },
  "pt-005": {
    fullName: "סופיה ריד",
    phone: "+972-50-672-8810",
    email: "sofia.reed@example.co.il",
    address: "רוטשילד 55, תל אביב",
    tags: ["יישור אגן"],
    medicalHistorySummary: "תוכנית יישור אגן מתמשכת עם מצוינות בביצוע תרגילי בית.",
    generalNotes: "תזכורות: תחילה דואל, ואם אין מענה — SMS.",
  },
  "pt-006": {
    fullName: "איתמר בלייק",
    phone: "+972-50-800-2331",
    email: "ethan.blake@example.co.il",
    address: "אלנבי 3, ירושלים",
    tags: ["שיקום", "מעקב חוב"],
    medicalHistorySummary: "רצף נקודות השיקום הופסק כל עוד לוח הזמנים אינו יציב.",
    generalNotes: "לחדש קשר כשמתפנה; מעדיף צ׳ק־אין בוואטסאפ.",
  },
}

/** Demo treatment rows — localized copy for Hebrew UI only */
const HE_TREATMENT: Record<string, Partial<Pick<TreatmentRecord, "title" | "note" | "practitioner">>> = {
  "tr-001": {
    practitioner: "ד\"ר ריברה",
    title: "הערכה צווארית ראשונית",
    note: "הגבלה בסיבוב שמאל, רגישות סביב C5–C7; נקבע תוכנית תרגילי בית.",
  },
  "tr-002": {
    practitioner: "ד\"ר ריברה",
    title: "מעקב טיפול ידני",
    note: "הכאב ירד מ־7/10 ל־4/10. להמשיך התאמות ארגונומיות וחימום תנועתי.",
  },
  "tr-003": {
    practitioner: "ד\"ר סלואן",
    title: "סקירת מותני",
    note: "תסמינים יציבים. הטיפול מושהה עד לאישור מבוטח.",
  },
  "tr-004": {
    practitioner: "ד\"ר ריברה",
    title: "סיכום שיחרור",
    note: "המטופלת השלימה תוכנית עם שיפור מתמשך בניידות.",
  },
}

const HE_DOC: Record<string, Partial<Pick<DocumentRecord, "name" | "source">>> = {
  "doc-001": {
    name: "צילום צוואר — אפריל 2026",
    source: "אחסון — הדמיה",
  },
  "doc-002": {
    name: "אישור ביטוח",
    source: "אחסון — גבייה",
  },
  "doc-003": {
    name: "MRI מותני — פברואר 2026",
    source: "אחסון — הדמיה",
  },
  "doc-004": {
    name: "הערת שיחרור חתומה",
    source: "אחסון — תיעוד",
  },
}

const HE_FIN: Record<string, Partial<Pick<FinanceRecord, "description">>> = {
  "fin-001": { description: "חשבונית ביקור INV-2402" },
  "fin-002": { description: "חבילת טיפול INV-2390" },
  "fin-003": { description: "יעוץ סיום INV-2281" },
}

const HE_NEWS: Record<string, Partial<Pick<NewsArticle, "title" | "summary" | "keyword">>> = {
  "news-1": {
    title: "דפוסי עומס בעמוד הצווארי בעבודה היברידית",
    keyword: "צוואר",
    summary: "קבוצת מעקב בחנה שינויי הרגלים בתנוחת הצוואר לאחר משמרת היברידית מתמשכת.",
  },
  "news-2": {
    title: "סדר טיפול אוסטיאופתי לכאב מותני מתמשך",
    keyword: "מותני",
    summary: "אסטרטגיות להקלה על מתח במשמרות ארוכות ותוכניות קצב פרוגרסיביות.",
  },
  "news-3": {
    title: "תיעוד ביטוח למימון הדמיה",
    keyword: "ביטוח",
    summary: "חבילות מסודרות מזרזות אישורים ופחות בקשות חוזרות מביטוח.",
  },
  "news-4": {
    title: "טיפול ידני מול התעמלות בלבד למותני",
    keyword: "מותני",
    summary: "סיקור על 14 RCTs בהשוואת טיפול ידני, התעמלות בלבד, ומשולב למטופלים לא־קרינתיים.",
  },
  "news-5": {
    title: "חזרה לספורט אחרי נקע קרסול",
    keyword: "שיקום",
    summary: "עדכון קונצנזוס לקריטריונים לחזרה לפעילות בספורט חובבני.",
  },
  "news-6": {
    title: "תנועתיות בית־חזה וטווח מעלייה לראש בעובדי משרד",
    keyword: "בית חזה",
    summary: "השפעת שלושה פרוטוקולים על טווח הכתף בקרב חוסר תנועה.",
  },
  "news-7": {
    title: "מהימנות בוחני יישור אגן",
    keyword: "אגן",
    summary: "דיוק בין־משתבים לבוחנים סטנדרטיים לעושים לבד בשטח הקליני.",
  },
}

const HE_WAIT: Record<
  string,
  Partial<Pick<WaitlistEntry, "patientName" | "reason" | "availability">>
> = {
  "wl-001": { patientName: "נח שחר", reason: "מעקב מותני", availability: "בוקר ימים ב׳–ד׳" },
  "wl-002": {
    patientName: "סופיה ריד",
    reason: "ביקור יישור אגן",
    availability: "אחרי הצהריים בכל יום עבודה",
  },
  "wl-003": {
    patientName: "ניר כהן",
    reason: "התאמות בית־חזה",
    availability: "ערבי חמישי",
  },
  "wl-004": {
    patientName: "איתמר בלייק",
    reason: "חידוש שיקום",
    availability: "גמיש",
  },
}

export function localizeScheduleRow(item: ScheduleItem, locale: Locale): ScheduleItem {
  if (locale !== "he") return item
  const o = HE_SCHEDULE[item.id]
  return o ? { ...item, ...o } : item
}

export function localizePatient(row: PatientSummary, locale: Locale): PatientSummary {
  if (locale !== "he") return row
  const o = HE_PATIENT[row.id]
  return o ? { ...row, ...o } : row
}

export function localizeTreatmentRecord(row: TreatmentRecord, locale: Locale): TreatmentRecord {
  if (locale !== "he") return row
  const o = HE_TREATMENT[row.id]
  return o ? { ...row, ...o } : row
}

export function localizeDocumentRecord(row: DocumentRecord, locale: Locale): DocumentRecord {
  if (locale !== "he") return row
  const o = HE_DOC[row.id]
  return o ? { ...row, ...o } : row
}

export function localizeFinanceRecord(row: FinanceRecord, locale: Locale): FinanceRecord {
  if (locale !== "he") return row
  const o = HE_FIN[row.id]
  return o ? { ...row, ...o } : row
}

const COMPLETED_SESSION_TITLE_EN = /^Session (\d+) of (\d+) — (.+)$/u

const SESSION_TYPE_LABEL_TO_KEY: Record<string, AppointmentType> = {
  "First Visit": "first",
  Adjustments: "adjustments",
  Kupa: "kupa",
}

/**
 * Completed sessions persist their title string; remap saved English headings
 * to Hebrew using the billing type labels when locale is Hebrew.
 */
export function localizeCompletedSessionTitle(
  title: string,
  locale: Locale,
  t: TranslateFn,
): string {
  if (locale !== "he") return title
  const m = COMPLETED_SESSION_TITLE_EN.exec(title.trim())
  if (!m) return title
  const n = Number(m[1])
  const total = Number(m[2])
  const rawType = m[3].trim()
  const ap = SESSION_TYPE_LABEL_TO_KEY[rawType]
  const typeLabel = ap ? t(`billing.treatment.${ap}`) : rawType
  return t("patientChart.sessionCompleteTitle", { n, total, type: typeLabel })
}

export function localizeNewsArticle(row: NewsArticle, locale: Locale): NewsArticle {
  if (locale !== "he") return row
  const o = HE_NEWS[row.id]
  return o ? { ...row, ...o } : row
}

export function localizeWaitlistEntry(row: WaitlistEntry, locale: Locale): WaitlistEntry {
  if (locale !== "he") return row
  const o = HE_WAIT[row.id]
  return o ? { ...row, ...o } : row
}

export function localizeTodoTitle(row: TodoItem, locale: Locale, tr: (k: string) => string): TodoItem {
  if (locale !== "he") return row
  const key = `todo.${row.id}`
  const next = tr(key)
  return next === key ? row : { ...row, title: next }
}

export function localizedPulseMetrics(
  metrics: PulseMetric[],
  _locale: Locale,
  tr: (k: string) => string,
): PulseMetric[] {
  return metrics.map((m) => {
    const lk = `metric.${m.id}.label`
    const vk = `metric.${m.id}.value`
    const dk = `metric.${m.id}.delta`
    const label = tr(lk)
    const value = tr(vk)
    const delta = tr(dk)
    return {
      ...m,
      label: label === lk ? m.label : label,
      value: value === vk ? m.value : value,
      delta: delta === dk ? m.delta : delta,
    }
  })
}

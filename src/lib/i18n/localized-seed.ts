import type { Locale } from "@/lib/i18n/types"
import type {
  NewsArticle,
  PatientSummary,
  PulseMetric,
  ScheduleItem,
  TodoItem,
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
    patientName: "סופיה רוזן",
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
    patientName: "סופיה רוזן",
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
    patientName: "סופיה רוזן",
    treatment: "תחזוקת עמוד שדרה — בוטל על ידי המטופלת",
    dayLabel: "היום",
  },
  "week-1": { patientName: "ניר כהן", treatment: "סקירת MRI", dayLabel: "מחר" },
  "week-2": { patientName: "סופיה רוזן", treatment: "יישור אגן", dayLabel: "מחר" },
  "week-3": { patientName: "איתמר ברק", treatment: "נקודת שיקום", dayLabel: "מחר" },
}

const HE_PATIENT: Record<string, Partial<PatientSummary>> = {
  "pt-001": {
    fullName: "מאיה כהן",
    address: "הסידק 14, תל אביב",
    tags: ["עמוד צווארי", "ביטוח"],
    medicalHistorySummary:
      "כאב צוואר חוזר אחרי עבודה מרחוק; מתיחה מימין בצוואר ושלד עליון. צילום צוואר (אפריל 2026): צמצום קל C5–C6. ללא אלרגיות. משקיע טוב במוביליזציה ותרגילי בית.",
    generalNotes: "תזכורות בוואטסאפ ובוקר.",
  },
  "pt-002": {
    fullName: "נח שחר",
    address: "הירקון 38, תל אביב",
    tags: ["מעקב חוב", "מותני"],
    medicalHistorySummary: "כאב מותני עם MRI בקובץ. המשך הושהה בגלל נסיעות.",
    generalNotes: "לחדש כשהביטוח מאשר.",
  },
  "pt-003": {
    fullName: "ליה ארז",
    address: "כיכר דיזנגוף 7, תל אביב",
    tags: ["שוחרר"],
    medicalHistorySummary: "סדרת שישה טיפולים הושלמה עם הרחבת טווח תנועה.",
    generalNotes: "להשלים בדיקת שמירת מסמכים.",
  },
  "pt-004": {
    fullName: "ניר לוי",
    address: "בן יהודה 22, חיפה",
    tags: ["MRI", "מעקב"],
    medicalHistorySummary: "MRI לביקור אי־נוחות בית־חזה ויציבה.",
    generalNotes: "מעדיף סיכומים קצרים וזמני צהריים.",
  },
  "pt-005": {
    fullName: "סופיה רוזן",
    address: "רוטשילד 55, תל אביב",
    tags: ["יישור אגן"],
    medicalHistorySummary: "תוכנית יישור אגן מתמשכת עם מעקב אחר תרגילי בית.",
    generalNotes: "תזכורת: דואל ואז SMS.",
  },
  "pt-006": {
    fullName: "איתמר ברק",
    address: "אלנבי 3, ירושלים",
    tags: ["שיקום", "מעקב חוב"],
    medicalHistorySummary: "שיקום הופסק בגלל לוח לא יציב.",
    generalNotes: "לחזור כשמתפנה; וואטסאפ מתאים.",
  },
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
    patientName: "סופיה רוזן",
    reason: "ביקור יישור אגן",
    availability: "אחרי הצהריים בכל יום עבודה",
  },
  "wl-003": {
    patientName: "ניר כהן",
    reason: "התאמות בית־חזה",
    availability: "ערבי חמישי",
  },
  "wl-004": {
    patientName: "איתמר ברק",
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

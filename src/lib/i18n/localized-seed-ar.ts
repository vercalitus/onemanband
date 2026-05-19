import type {
  DocumentRecord,
  FinanceRecord,
  NewsArticle,
  PatientSummary,
  ScheduleItem,
  TreatmentRecord,
} from "@/types/domain"
import type { WaitlistEntry } from "@/lib/mock-data"

type SchedPatch = Partial<Pick<ScheduleItem, "patientName" | "treatment" | "dayLabel">>

/** Demo schedule — Arabic names and clinical copy for ar locale */
export const AR_SCHEDULE: Record<string, SchedPatch> = {
  "apt-1": {
    patientName: "فاطمة حسن",
    treatment: "استقبال مريض جديد — تاريخ عنقي وصدر علوي",
    dayLabel: "اليوم",
  },
  "apt-2": {
    patientName: "أحمد شاكر",
    treatment: "فحص مقاطع عنقية — تحمّل جيد",
    dayLabel: "اليوم",
  },
  "apt-3": {
    patientName: "ليلى حارت",
    treatment: "زيارة صندوق — مراجعة ثني/امتداد قطني",
    dayLabel: "اليوم",
  },
  "apt-4": {
    patientName: "كريم جابر",
    treatment: "امتداد صدر + بروتوكول حركة الأضلاع",
    dayLabel: "اليوم",
  },
  "apt-5": {
    patientName: "سارة رشيد",
    treatment: "صندوق — أوراق مواءمة الحوض وفحص سريع",
    dayLabel: "اليوم",
  },
  "apt-6": {
    patientName: "عمر بليك",
    treatment: "تقييم مفصل عجزي–عظم عجز — مختصر",
    dayLabel: "اليوم",
  },
  "apt-7": {
    patientName: "فاطمة حسن",
    treatment: "متابعة خطة العلاج — استشارة وضعية العمل",
    dayLabel: "اليوم",
  },
  "apt-8": {
    patientName: "ليلى حارت",
    treatment: "متابعة عنقية–قطنية شاملة بعد الزيارة الأولى",
    dayLabel: "اليوم",
  },
  "apt-9": {
    patientName: "كريم جابر",
    treatment: "مواءمات حذرة بعد MRI — قطني",
    dayLabel: "اليوم",
  },
  "apt-10": {
    patientName: "أحمد شاكر",
    treatment: "فحص وضعية سريع قبل السفر",
    dayLabel: "اليوم",
  },
  "apt-11": {
    patientName: "سارة رشيد",
    treatment: "نمط ثني مفصل الورك + إرشادات قاع الحوض",
    dayLabel: "اليوم",
  },
  "apt-12": {
    patientName: "عمر بليك",
    treatment: "معلم إعادة تأهيل — دوران مقاوم ومشي",
    dayLabel: "اليوم",
  },
  "apt-13": {
    patientName: "كريم جابر",
    treatment: "صندوق — تفريغ صدر جالس وتمرين وضعية",
    dayLabel: "اليوم",
  },
  "apt-14": {
    patientName: "فاطمة حسن",
    treatment: "زيارة متابعة — عدم تحمّل امتداد عنقي",
    dayLabel: "اليوم",
  },
  "apt-15": {
    patientName: "ليلى حارت",
    treatment: "شدّ عنق قصير",
    dayLabel: "اليوم",
  },
  "apt-16": {
    patientName: "سارة رشيد",
    treatment: "صيانة العمود الفقري — ألغته المريضة",
    dayLabel: "اليوم",
  },
  "week-1": { patientName: "كريم جابر", treatment: "مراجعة MRI", dayLabel: "غداً" },
  "week-2": { patientName: "سارة رشيد", treatment: "مواءمة الحوض", dayLabel: "غداً" },
  "week-3": { patientName: "عمر بليك", treatment: "نقطة إعادة تأهيل", dayLabel: "غداً" },
}

export const AR_PATIENT: Record<string, Partial<PatientSummary>> = {
  "pt-001": {
    fullName: "فاطمة حسن",
    phone: "+972-50-104-2201",
    email: "fatima.hassan@example.co.il",
    address: "شارع السدق 14، تل أبيب",
    tags: ["عنق", "تأمين"],
    medicalHistorySummary:
      "ألم عنقي متكرر بعد إجهاد طويل الأمد في العمل عن بُعد؛ يظهر أساساً كشدّ في الجانب الأيمن من الرقبة والعضلة شبه المنحرفة العلوية مع إحالة نحو المنطقة تحت القذالية. تصوير سابق (أشعة عنق، أبريل 2026): تضيّق خفيف C5–C6 دون نتائج حادة. لا حساسية مُبلّغ عنها. المريضة نشطة، بلا تاريخ قلبي أو جهازي جوهري، وتستجيب جيداً للتحريك اليدوي مع تمارين منزلية.",
    generalNotes:
      "تفضّل التذكيرات عبر واتساب ومواعيد الصباح الباكر. عند إرسال تمارين المنزل التالية يُرجى إحضار ورقة التمارين من الزيارة.",
  },
  "pt-002": {
    fullName: "أحمد شاكر",
    phone: "+972-50-204-1108",
    email: "ahmad.shakir@example.co.il",
    address: "شارع اليركون 38، تل أبيب",
    tags: ["متابعة دين", "قطني"],
    medicalHistorySummary: "ألم قطني مع MRI في الملف. أُوقف المتابعة بسبب السفر.",
    generalNotes: "استئناف العلاج عند موافقة التأمين.",
  },
  "pt-003": {
    fullName: "ليلى حارت",
    phone: "+972-50-338-5099",
    email: "layla.hart@example.co.il",
    address: "دوار ديزِنغوف 7، تل أبيب",
    tags: ["مُخرَج"],
    medicalHistorySummary: "أُكملت سلسلة من ست جلسات مع تحسّن مستمر في مدى الحركة.",
    generalNotes: "إكمال مراجعة الاحتفاظ بالمستندات قبل الأرشفة.",
  },
  "pt-004": {
    fullName: "كريم جابر",
    phone: "+972-52-418-2214",
    email: "karim.jaber@example.co.il",
    address: "شارع بن يهودا 22، حيفا",
    tags: ["MRI", "متابعة"],
    medicalHistorySummary: "زيارة لمراجعة MRI بسبب عدم راحة صدرية تتفاقم مع الوضعية.",
    generalNotes: "يفضّل ملخصات قصيرة بعد الزيارات ومواعيد بعد الظهر.",
  },
  "pt-005": {
    fullName: "سارة رشيد",
    phone: "+972-50-672-8810",
    email: "sara.rashid@example.co.il",
    address: "شارع روتشيلد 55، تل أبيب",
    tags: ["مواءمة الحوض"],
    medicalHistorySummary: "خطة مواءمة حوض مستمرة مع التزام ممتاز بتمارين المنزل.",
    generalNotes: "التذكيرات: بريد إلكتروني أولاً، ثم SMS عند عدم الرد.",
  },
  "pt-006": {
    fullName: "عمر بليك",
    phone: "+972-50-800-2331",
    email: "omar.blake@example.co.il",
    address: "شارع ألنبي 3، القدس",
    tags: ["إعادة تأهيل", "متابعة دين"],
    medicalHistorySummary: "توقّف تسلسل نقاط إعادة التأهيل ما دام الجدول غير مستقر.",
    generalNotes: "إعادة التواصل عند التفرغ؛ يفضّل متابعة عبر واتساب.",
  },
}

export const AR_TREATMENT: Record<
  string,
  Partial<Pick<TreatmentRecord, "title" | "note" | "practitioner">>
> = {
  "tr-001": {
    practitioner: "د. ريفيرا",
    title: "تقييم عنقي أولي",
    note: "قيود في الدوران يساراً، حساسية حول C5–C7؛ وُضعت خطة تمارين منزلية.",
  },
  "tr-002": {
    practitioner: "د. ريفيرا",
    title: "متابعة علاج يدوي",
    note: "انخفض الألم من 7/10 إلى 4/10. متابعة تعديلات ergonomics والإحماء الحركي.",
  },
  "tr-003": {
    practitioner: "د. سلوان",
    title: "مراجعة قطنية",
    note: "الأعراض مستقرة. العلاج مؤجل حتى تأكيد المؤمّن.",
  },
  "tr-004": {
    practitioner: "د. ريفيرا",
    title: "ملخص الخروج",
    note: "أكملت المريضة الخطة مع تحسّن مستمر في الحركة.",
  },
}

export const AR_DOC: Record<string, Partial<Pick<DocumentRecord, "name" | "source">>> = {
  "doc-001": { name: "أشعة عنق — أبريل 2026", source: "تخزين — تصوير" },
  "doc-002": { name: "موافقة التأمين", source: "تخزين — فوترة" },
  "doc-003": { name: "MRI قطني — فبراير 2026", source: "تخزين — تصوير" },
  "doc-004": { name: "ملاحظة خروج موقّعة", source: "تخزين — سجلات" },
}

export const AR_FIN: Record<string, Partial<Pick<FinanceRecord, "description">>> = {
  "fin-001": { description: "فاتورة زيارة INV-2402" },
  "fin-002": { description: "باقة علاج INV-2390" },
  "fin-003": { description: "استشارة نهائية INV-2281" },
}

export const AR_NEWS: Record<string, Partial<Pick<NewsArticle, "title" | "summary" | "keyword">>> = {
  "news-1": {
    title: "أنماط حمل العمود الفقري العنقي في العمل الهجين",
    keyword: "عنق",
    summary: "دراسة متابعة فحصت تغيّر عادات وضعية الرقبة بعد اعتماد عمل هجين طويل الأمد.",
  },
  "news-2": {
    title: "تسلسل علاج استئصالي لألم قطني مستمر",
    keyword: "قطني",
    summary: "استراتيجيات لتخفيف التوتر في المناوبات الطويلة وخطط تقدم تدريجية.",
  },
  "news-3": {
    title: "توثيق التأمين لتمويل التصوير",
    keyword: "تأمين",
    summary: "حزم منظّمة تُسرّع الموافقات وتقلّل طلبات التأمين المتكررة.",
  },
  "news-4": {
    title: "العلاج اليدوي مقابل التمارين فقط للألم القطني",
    keyword: "قطني",
    summary: "مراجعة 14 تجربة عشوائية مقارنة العلاج اليدوي والتمارين والمزيج لدى المرضى غير الإشعاعيين.",
  },
  "news-5": {
    title: "معايير العودة للرياضة بعد التواء الكاحل",
    keyword: "إعادة تأهيل",
    summary: "بيان توافق محدّث لمعايير العودة للنشاط في الرياضة الترفيهية.",
  },
  "news-6": {
    title: "حركة الصدر ومدى الرفع فوق الرأس لموظفي المكاتب",
    keyword: "صدر",
    summary: "تأثير ثلاثة بروتوكولات على مدى الكتف لدى قلة الحركة.",
  },
  "news-7": {
    title: "موثوقية فحوص مواءمة الحوض",
    keyword: "حوض",
    summary: "اتساق بين المُقيّمين للفحوص الشائعة في الميدان السريري.",
  },
}

export const AR_WAIT: Record<
  string,
  Partial<Pick<WaitlistEntry, "patientName" | "reason" | "availability">>
> = {
  "wl-001": { patientName: "أحمد شاكر", reason: "متابعة قطنية", availability: "صباحاً الاثنين–الأربعاء" },
  "wl-002": {
    patientName: "سارة رشيد",
    reason: "زيارة مواءمة الحوض",
    availability: "بعد الظهر أي يوم عمل",
  },
  "wl-003": {
    patientName: "كريم جابر",
    reason: "مواءمات صدرية",
    availability: "مساء الخميس",
  },
  "wl-004": {
    patientName: "عمر بليك",
    reason: "استئناف إعادة التأهيل",
    availability: "مرن",
  },
}

export const AR_CLINICAL_SOURCE_DISPLAY: Record<string, string> = {
  "src-pubmed": "PubMed",
  "src-cochrane": "مكتبة كوكران",
  "src-jospt": "JOSPT",
  "src-bjsm": "المجلة البريطانية لطب الرياضة",
  "src-ops": "ملخص تشغيل العيادة",
}

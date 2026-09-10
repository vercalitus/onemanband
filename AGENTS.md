# OneManBand — Agent Guide

This document orients AI coding agents (Cursor, Claude Code, Codex, etc.) to the **onemanband** repository. Read this before making changes.

## Product

**OneManBand** is a single-provider chiropractic clinic operations workspace: patient CRM, daily schedule, calendar, billing, clinical news feed, and practice settings. The UI is trilingual (English, Hebrew, Arabic) with full RTL support for Hebrew and Arabic.

**Production:** https://onemanband.vercel.app/  
**Local dev:** http://localhost:3000 (or port 3003 via `npm run dev:3003`)

---

## Stack

| Layer | Choice |
|-------|--------|
| Framework | Next.js 15 (App Router), React 19, TypeScript |
| Styling | Tailwind CSS 4, shadcn/ui (`base-nova` style), `@base-ui/react` |
| Data | Supabase (Postgres + RLS + private storage). The mock dataset is a fallback, not the source |
| Clinic settings | `localStorage` under `clinic.settings.v1` — still the one thing that is browser-only |
| Forms / validation | react-hook-form, Zod 4 |
| Client state | React Context providers, TanStack Query (light usage) |
| i18n | Custom dictionary in `src/lib/i18n/` — English is authoritative |
| Deploy | Vercel (auto-deploy from `main`) |

### Next.js version note

This is **not** the Next.js version from most training data. Before writing framework code, check `node_modules/next/dist/docs/` for current APIs and heed deprecation notices.

---

## Repository layout

```
src/
  app/                    # Next.js App Router pages
    (app)/                # Authenticated shell (sidebar, header, providers)
      dashboard/
      patients/           # List + [id] detail
      calendar/
      finances/
      clinical-feed/      # Formerly /news (redirect preserved)
      settings/
  components/
    layout/               # Sidebar, header, mobile nav
    providers/            # Locale, todos, schedule, patients, React Query
    ui/                   # shadcn primitives (Button, Dialog, Tabs, …)
  features/               # Domain modules — prefer adding code here
    dashboard/
    patients/
    calendar/
    finances/
    clinical-feed/
    settings/
  lib/                    # Shared utilities, mock data, i18n, Supabase clients
  types/                  # domain.ts, clinic-settings.ts
supabase/
  migrations/             # Ordered DDL — single source of truth (schema, RLS, storage, audit, consent)
  seed.sql
scripts/
  clean-all.mjs           # Deep clean for Windows dev cache issues
```

**Path alias:** `@/*` → `./src/*`

---

## Routes and features

| Route | Module | Purpose |
|-------|--------|---------|
| `/` | — | Redirects to `/dashboard` |
| `/dashboard` | `features/dashboard` | Today's schedule, todos, pulse metrics |
| `/patients` | `features/patients` | Patient library (search, filters, add patient) |
| `/patients/[id]` | `features/patients` | Patient cockpit: timeline, documents, session canvas |
| `/calendar` | `features/calendar` | Week/month views, waitlist, appointment grid |
| `/finances` | `features/finances` | Billing KPIs, pending/history, export hooks |
| `/clinical-feed` | `features/clinical-feed` | Curated clinical headlines and sources |
| `/settings` | `features/settings` | Profile, hours, treatment types, integrations, notifications, automations |
| `/book/[token]` | `features/automations` | **Public** — patient self-registration, document upload, slot picking |
| `/r/[token]` | `features/automations` | **Public** — confirm / cancel / reschedule from a reminder |
| `/q/[token]` | `features/automations` | **Public** — progress questionnaire |
| `/api/automations/tick` | — | Cron entry point: deliver due messages |
| `/api/automations/webhook/whatsapp` | — | Inbound WhatsApp taps. Refuses unsigned requests in production |
| `/api/automations/public/token/[token]` | — | **Public** — resolve a capability link |
| `/api/automations/public/respond` | — | **Public** — write a patient's tap |
| `/api/automations/public/busy` | — | **Public** — busy times for the booking pages. Times only: no patient, no id |
| `/api/documents/signed-url` | — | A short-lived link to one document. Takes a document **id**, never a path |
| `/api/billing/issue`, `/ping` | — | Issue a tax document; check the provider |
| `/api/calendar-feed/[token]` | — | **Public** — the clinic's ICS feed. Its own prefix on purpose |
| `/api/calendar/subscription` | — | Session-gated: hands out and rotates that token |
| `/api/account/verify-password` | — | Confirms the current password before a change |

Navigation labels and descriptions live in `src/lib/navigation.ts`.

---

## Data layer — critical

### The app runs on Postgres. The mock file is a fallback.

Production holds a real clinic: patients, their documents, their treatment
records, the diary, the ledger, tasks. Everything a practitioner writes is a
row. Reads and writes go through the **browser** client on the practitioner's
own session, so row-level security decides what comes back — the service-role
client exists only for the patient-facing routes, which have no session at all.

- Env vars (see `.env.example`): `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
- Clients: `src/lib/supabase/client.ts` (browser), `server.ts` (cookies), `admin.ts` (service role — read its header before using it). All return `null` when env is missing.
- Schema: `supabase/migrations/`, an ordered chain starting at `*_init_schema.sql`. Apply with `supabase db push`; never edit an applied migration.

**Repositories are the seam.** One per area, each a thin translation between a
Postgres row and the types in `src/types/domain.ts`:

| Area | File |
|---|---|
| Patients | `features/patients/lib/patient-repository.ts` |
| Treatment records | `features/patients/lib/treatment-repository.ts` |
| Documents | `features/patients/lib/document-repository.ts` |
| Appointments | `features/calendar/lib/appointment-repository.ts` |
| Invoices | `features/finances/lib/finance-repository.ts` |
| Tasks | `features/dashboard/lib/task-repository.ts` |

### The demo dataset, and the one rule that governs it

`src/lib/mock-data.ts` still exists so an unconfigured deploy is demonstrable.
It is reached only when the clinic has **no patients** — `clinicHasPatients()`
in the patient repository, cached for the page's lifetime.

**Patients are the anchor for every area, deliberately.** Each area used to
decide on its own table — schedule empty means show the demo day, ledger empty
means show the demo figures — which was right until the day patients arrived
and the others had not. The dashboard then offered visits by people who do not
exist, linking to records that were never there. Do not reintroduce per-area
checks.

Two rules follow, and both were learned by getting them wrong:

- **A failed read is not an empty clinic.** Repositories return `null` or an
  `unavailable` result for "could not ask" and a real empty list for "has
  none". Conflating them blanks a chart because a request timed out.
- **Never derive a number from the demo file while showing real data.** The
  dashboard displayed "₪74.2k monthly revenue" as a constant, in the place a
  business reads its revenue. Everything on screen is now computed from records
  or is visibly absent.

The clinical news feed is the one screen still on seed content: it has no
backend, and there is nothing to be live against.

---

## Domain rules

### Appointments

Defined in `src/types/domain.ts` and enforced in Postgres:

- **Slot grid:** 5-minute steps (`APPOINTMENT_SLOT_MINUTES = 5`)
- **Duration:** 5–60 minutes, multiples of 5
- **Types:** `first` | `adjustments` | `kupa`
- **Statuses:** `scheduled`, `confirmed`, `uncertain`, `completed`, `cancelled`, `no_show` — the Postgres enum and `AppointmentStatus` agree; there is no `checked_in`
- **No overlap** per clinic (Postgres `EXCLUDE` constraint on `tstzrange`)
- Helpers: `src/lib/appointment-time.ts`, `src/lib/appointment-types.ts`
- **Every change to a booking goes through `commitAppointment`** in
  `schedule-day-provider.tsx` — create, edit, move, cancel, complete. It writes
  the row, then hands the *saved* row to the automation engine under the id the
  database minted. There used to be three paths: two updated the screen and
  never the database, the third wrote the row and never told the engine. Do not
  call `setAppointments` or `useAppointmentAutomations` from a calendar view.

### Patients

- Statuses: `active` | `frozen` | `past`
- Treatment records are **immutable** after creation (DB trigger)

### Billing

- Currency display: ILS formatting via `src/lib/format-ils.ts` and locale formatters
- Treatment prices and care plans come from `ClinicSettings.treatmentTypes` / `carePlans`
- Mock billing data: `src/lib/mock-finances.ts`, derived logic in `features/finances/lib/`
- Money is stored in agorot (`finances.amount_cents`) and worked with in shekels. The conversion lives only in `finance-repository.ts` — a float a hundredth off is a rounding error in a VAT return.

#### This app is not the book of record

**SUMIT is.** A `finances` row exists for two reasons, and neither is "keeping a copy of an invoice":

1. **A debt.** The clinic bills on a cash basis, so a tax document is only issued once the money arrives — which means SUMIT never hears about a visit that was not paid for. An unpaid visit exists *nowhere else*. Without this row there is nothing to chase, no outstanding balance, and no payment reminder.
2. **A pointer.** After payment the row keeps `documentId`, the document number and a link. That is a reference, not a copy: the document itself, with its legal weight, lives at SUMIT and only there. It is needed to show a practitioner the receipt for a visit, and to issue a credit note — an issued invoice-receipt cannot be deleted, and the only lawful undo references the original document id.

So:

- **Never store the document itself.** No PDF, no rendered copy, no second version of anything the accountant relies on. Store the pointer.
- **Do not import historical invoices.** Documents from before this app existed have neither job — they are paid, and nothing here will credit them. A local copy would just be a second record that can disagree with the accountant's.
- **Do not make this configurable.** A mode that skips the local row does not degrade debt collection, it removes it, and two modes means two behaviours to keep correct.

What a settled row holds, in full: who, how much, when, whether it was paid, and the SUMIT document id.

#### One patient, one customer card — `patients.sumit_customer_id`

A patient created here does **not** create a SUMIT customer. The card comes
into existence when the first document for that patient is filed, and which
card it lands on is decided by two fields on the request:

| `sumit_customer_id` | What is sent | What SUMIT does |
|---|---|---|
| set | `SearchMode: None` + `ID` | files onto that card |
| null | `SearchMode: ExternalIdentifier` + our patient UUID | finds the card it made earlier, or makes one |

The identifier is sent either way, so the link exists on SUMIT's side too, and
`linkSumitCustomer()` records the id SUMIT returns the first time — never
overwriting one that is already set.

Why the column exists, verified against the live account on 2026-09-10:
SUMIT held **521 cards** across 2,050 historical documents and **519 of the
1,181 patients already had one**, from before this app existed. Those cards
carry no `ExternalIdentifier`, so a search on our UUID could never match them
and the first invoice for any of those patients would have opened a duplicate
and split their bookkeeping history. Proven both ways with draft documents for
an invented patient: searching by identifier created a card and then reused it,
and `None` + `ID` filed onto an existing card without creating another.

**520 links are backfilled.** One patient is deliberately unlinked — two cards
share that name, and choosing between them is a person's job. The pairing used
is at `C:\Users\verca\onemanband-sumit-link-review.json`, outside the repo
because it holds names.

### The patient chart

Everything a practitioner writes on `/patients/[id]` is a row: the status line,
the contact card, the notes, the marks on the body diagram, and the session
itself. Two things are deliberately not:

- **The session in progress** — strokes still on the canvas, a memo still
  recording, a note being typed — stays in that browser. It is a draft, and a
  draft belongs to the machine it is being written on until the session closes.
- **A saved session is a `treatments` row and cannot be changed or deleted.** A
  database trigger refuses both. That is why the chart offers no delete on one:
  a record that can be quietly rewritten is not a record, and a correction is a
  new entry saying so. It also means a patient with clinical history cannot be
  deleted — the cascade hits the same trigger.

**The status line carries its origin and its date.** It shipped as a hard-coded
sentence, so all 1,178 patients displayed the same "clinical finding" about
themselves. It is a column now; left empty the chart falls back to the last
treatment note, labelled with that visit's date. Never show a claim about a
patient without saying where it came from and when.

### Dashboard signals

`features/dashboard/lib/reactive-signals.ts` derives the "needs attention"
column from clinic records; `automation-signals.ts` does the same for things a
patient did. Nothing is stored — a saved copy is how a board starts telling you
to chase an invoice that was paid last week.

A signal earns its place by passing three tests, and rows have been removed for
failing each:

1. **It is true** — derived from a record, never a guess.
2. **Somebody has to act** — if the system can handle it, the system should.
3. **It ends** — a permanent state is not a signal. "Patient is frozen" never
   resolved. "Follow up, 12 weeks since last visit" was 174 people at once with
   no completion other than the patient happening to return.

Every derived row carries **one** action (`TodoAction` in `types/domain.ts`) and
lands on the record, not the page containing it. A row with three buttons has
not decided what it is for; a row with none makes the reader do the finding.

### Automations

Patient-facing reminders, self-service links and questionnaires live in `src/features/automations/`. The design separates three concerns and you should keep them separate:

| Concern | Module | Note |
|---------|--------|------|
| **What** message should exist and **when** | `lib/plan-messages.ts` | Pure function. No I/O, no clock beyond the `now` you pass — testable without any provider. |
| **Where** it is stored | `lib/automation-store.ts` (browser) and `lib/server-store.ts` (Postgres, server-only) | The server store is what makes a patient's tap on their phone reach the practitioner's dashboard |
| **How** it is delivered | `lib/dispatcher.ts` → `lib/live-dispatcher.ts` | Twilio and Resend over plain `fetch`. A channel with no provider **fails loudly** rather than reporting success |

Rules that matter:

- **Clinic timezone (`Asia/Jerusalem`) is authoritative.** Wall-clock rules like "18:00 the evening before" resolve through `lib/clinic-time.ts`, never through the viewer's clock or a fixed offset — Israel observes DST.
- **Patients are reached on WhatsApp (SMS as fallback), never by email.** `PATIENT_CHANNELS` in `plan-messages.ts` enforces it in the planner, not in settings — a settings blob stored on one device would otherwise keep email on. The clinic mailbox is the practitioner's. The tax document SUMIT mails a patient is not this: it is sent by the bookkeeping provider and is the receipt they are owed.
- Feature code must call `lib/events.ts` (`onAppointmentBooked`, `onTreatmentCompleted`, `onNoShow`, …), never the planner or the store directly.
- Patients have no accounts. The token in the URL *is* the authorisation — see `lib/tokens.ts`. Public routes are exempted in `lib/supabase/middleware.ts`.
- A token carries a snapshot of what the message said (`AccessTokenContext`), so public pages never read clinic records.
- `simulated` is a real terminal state, not a fake success. Do not make it report `sent`.
- Self-registration lands as `PatientIntake`, **not** as a patient record — it is unverified data until approved.

Defaults for the whole playbook are seeded in `lib/default-sequences.ts` and become editable under Settings → Automations.

### Clinic settings

Type: `src/types/clinic-settings.ts` — profile, weekday hours, treatment type labels/colors/prices, care plans, integration placeholders, notification templates. Defaults: `src/lib/clinic-settings-defaults.ts`. Hook: `features/settings/lib/use-clinic-settings.ts`.

Visual presets for appointment types merge settings with `mergeAppointmentTypeVisuals()` in `clinic-settings-storage.ts`.

---

## Internationalization (i18n)

- **Locales:** `en` (default), `he`, `ar` — see `src/lib/i18n/types.ts`
- **Storage key:** `ob:locale` in `localStorage`
- **RTL:** Hebrew and Arabic set `dir="rtl"` on `<html>` via `LocaleProvider`
- **Translations:** `translations-en.ts` (full), `translations-he.ts`, `translations-ar.ts` (partial overlays)
- **Dictionary:** `src/lib/i18n/dictionary.ts` — missing keys fall back to English
- **Localized mock seed:** `localized-seed.ts`, `localized-seed-ar.ts` for demo content per locale
- **Clinic settings overlay:** locale-specific labels applied in `localized-clinic-settings.ts`

Always use `useLocale()` → `t("key")` for user-visible strings. Do not hardcode English in new UI unless it is dev-only.

---

## UI conventions

- Use existing shadcn components from `src/components/ui/` before adding new primitives
- Feature components go under `src/features/<area>/components/`
- Shared hooks go in `src/features/<area>/lib/` or `src/lib/`
- Icons: `lucide-react`
- Class merging: `cn()` from `src/lib/utils.ts`
- App shell providers are composed in `src/app/(app)/layout.tsx` (todos, schedule day, add patient, add task, patient extras)
- Root providers (locale + React Query): `src/components/providers/app-providers.tsx`
- Responsive: sidebar on desktop, `MobileNav` on small screens
- RTL-aware shadows and spacing use `rtl:` Tailwind variants where needed

---

## Commands

```bash
npm run dev              # Dev server (Turbopack)
npm run dev:3003         # Dev on port 3003
npm run dev:fresh        # Clean .next then dev (fixes stale cache on Windows)
npm run build            # Production build
npm run lint             # ESLint
npm run deploy:prod      # Vercel production deploy (CLI)
```

If you see `Cannot find module './611.js'` in dev on Windows, run `npm run dev:fresh` or `npm run clean:all`.

---

## Environment and deploy

1. Copy `.env.example` → `.env.local` for local Supabase (optional until wired)
2. On Vercel: Project → Settings → Environment Variables (same names)
3. **Production updates only after `git push` to `origin/main`** (Vercel tracks `main`)
4. After implementation work intended for production: commit, push, verify at https://onemanband.vercel.app/

`next.config.ts` notes:
- `/dashboard` has `Cache-Control: no-store`
- Permanent redirect `/news` → `/clinical-feed`
- Webpack filesystem cache disabled in dev (Windows stability)

---

## What to do / what to avoid

### Do

- Match existing patterns in the nearest feature folder
- Keep changes minimal and scoped to the request
- Preserve RTL and i18n when touching UI copy or layout
- Use types from `src/types/domain.ts` and `src/types/clinic-settings.ts`
- Add comments for non-obvious business rules (why, not how)
- Run `npm run build` before declaring large changes done

### Avoid

- Introducing new dependencies without strong reason
- Hardcoding English strings in user-facing components
- Breaking the 5-minute appointment grid or overlap rules
- Assuming the demo dataset is the source — it is the fallback; check the repository
- Large refactors unrelated to the task
- Deleting mock data or settings storage without a migration path to real data

---

## Common tasks — where to look

| Task | Start here |
|------|------------|
| Add a nav item | `src/lib/navigation.ts`, new page under `src/app/(app)/` |
| Change schedule UI | `features/dashboard`, `features/calendar`, `schedule-day-provider.tsx` |
| Patient record UI | `features/patients/`, `use-patient-cockpit.ts` |
| Billing logic | `features/finances/lib/derive-billing.ts`, `use-billing.ts` |
| Settings field | `types/clinic-settings.ts`, defaults, settings tabs |
| New translation | `translations-en.ts` first, then he/ar overlays |
| A new field on a record | migration → the area's repository → the type in `types/domain.ts` → the UI |
| A new dashboard signal | `features/dashboard/lib/reactive-signals.ts` — read the three tests first |
| Appointment validation | `lib/appointment-time.ts`, `appointment-edit-dialog.tsx` |

---

## File index (high-signal)

| File | Role |
|------|------|
| `src/lib/mock-data.ts` | Demo dataset. Reached only when the clinic has no patients |
| `src/features/patients/lib/patient-repository.ts` | Patients, and `clinicHasPatients()` — the anchor that retires the demo everywhere |
| `src/features/patients/lib/use-patient-cockpit.ts` | The chart's state: what is a row, what is a draft |
| `src/features/dashboard/lib/reactive-signals.ts` | What the practitioner is told to do, and why each row exists |
| `src/lib/mock-finances.ts` | Billing mock records and KPI inputs |
| `src/lib/clinic-settings-defaults.ts` | Default practice configuration |
| `src/lib/env.ts` | Zod-validated env (optional Supabase keys) |
| `src/types/domain.ts` | Core enums and interfaces |
| `src/types/automation.ts` | Sequences, outbox, tokens, intakes, questionnaires |
| `src/features/automations/lib/default-sequences.ts` | The out-of-the-box reminder playbook |
| `supabase/migrations/` | Ordered DDL: schema + RLS, storage, audit, consent (source of truth) |
| `components.json` | shadcn config (`base-nova`, `@/` aliases) |

---

## Status snapshot

- ✅ Live on real clinic data — patients, documents, treatment records, tasks
- ✅ Auth wall, MFA (TOTP) and password change under Settings → Security
- ✅ Patient chart writes to Postgres; treatment records immutable by trigger
- ✅ Billing against SUMIT — credentials are in production as of 2026-09-10 and the ping answers `live: true, vatRate: 18`. Still **drafts only** until `SUMIT_LIVE_DOCUMENTS=1`; while drafting, every document is redirected to `BILLING_TEST_EMAIL` so no patient receives one
- ✅ Handwriting on a closed session is transcribed into the treatment note (`/api/treatments/transcribe`, Claude vision, `ANTHROPIC_API_KEY`), labelled as automatic, beside the image it was read from
- ✅ Automation engine, patient self-service pages, message queue
- ✅ Dashboard signals and KPIs derived from clinic records
- ✅ Exports and whole-clinic backup read the real clinic and state their source
- ✅ Per-clinic ICS calendar subscription (one-way; no Google OAuth)
- ✅ Vercel Cron hits `/api/automations/tick` every five minutes (`vercel.json`), gated by `CRON_SECRET`
- ⬜ **No messaging provider in production.** The cron runs and the queue drains, but Vercel holds no Twilio or Resend credentials, so every message ends `simulated`. Scheduled is not the same as delivered
- ⬜ Live WhatsApp / SMS — the number is in regulatory approval
- ⬜ Email to patients — Resend can only reach the account owner until a domain is verified
- ✅ Self-registration reaches the clinic and is reviewed in one place: `/book/[token]` uploads each file to `patient-media` under `<clinic>/intakes/<token>/` and posts the intake to `/api/automations/public/intake`; the dashboard's "Review & add" opens the new-patient form pre-filled, with the requested slot and the attached files (signed through `/api/automations/intakes/file`); saving creates the patient, moves the files into their folder as `documents` rows, and books the slot through `commitAppointment`
- ✅ Failed sends reach the board from the server queue (`GET /api/automations/outbox`), not the browser's copy
- ⬜ Clinic settings still live in `localStorage`, not the database

When in doubt, read the closest `features/*` module and follow its patterns.

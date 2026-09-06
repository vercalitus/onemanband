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
| Data (current) | In-memory mock data + `localStorage` for clinic settings |
| Data (planned) | Supabase (schema + client helpers exist; app not wired yet) |
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
| `/api/automations/webhook/whatsapp` | — | Inbound WhatsApp button taps (provider stub) |

Navigation labels and descriptions live in `src/lib/navigation.ts`.

---

## Data layer — critical

### Current state: mock-first

Most of the app reads from **`src/lib/mock-data.ts`** (patients, schedule, todos, documents, finances, news). Clinic configuration persists in **`localStorage`** under key `clinic.settings.v1` via `src/lib/clinic-settings-storage.ts`.

There is **no auth UI**, **no API routes**, and **no live Supabase queries** in application code yet.

### Supabase (prepared, not primary)

- Env vars (see `.env.example`): `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
- Clients: `src/lib/supabase/client.ts`, `src/lib/supabase/server.ts` — return `null` when env is missing (graceful no-op)
- Schema: `supabase/migrations/` (ordered chain, `*_init_schema.sql` first) — clinics, profiles, patients, appointments, treatments, documents, finances, news_feed, audit_log, patient_consents; plus RLS helpers `current_user_clinic_id()` / `is_admin()` / `is_clinician()`, private `patient-media` storage, and audit triggers. `supabase db reset` builds it all.

When wiring Supabase, match existing TypeScript types in `src/types/domain.ts` and respect DB constraints (see below).

---

## Domain rules

### Appointments

Defined in `src/types/domain.ts` and enforced in Postgres:

- **Slot grid:** 5-minute steps (`APPOINTMENT_SLOT_MINUTES = 5`)
- **Duration:** 5–60 minutes, multiples of 5
- **Types:** `first` | `adjustments` | `kupa`
- **Statuses:** `scheduled`, `confirmed`, `checked_in`, `completed`, `cancelled`, `no_show`
- **No overlap** per clinic (Postgres `EXCLUDE` constraint on `tstzrange`)
- Helpers: `src/lib/appointment-time.ts`, `src/lib/appointment-types.ts`

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

### Automations

Patient-facing reminders, self-service links and questionnaires live in `src/features/automations/`. The design separates three concerns and you should keep them separate:

| Concern | Module | Note |
|---------|--------|------|
| **What** message should exist and **when** | `lib/plan-messages.ts` | Pure function. No I/O, no clock beyond the `now` you pass — testable without any provider. |
| **Where** it is stored | `lib/automation-store.ts` | localStorage in the browser, module memory on the server. **The only file to rewrite for Supabase.** |
| **How** it is delivered | `lib/dispatcher.ts` | `MessageDispatcher` interface. Only `SimulatedDispatcher` exists today. **The only file to rewrite for a real provider.** |

Rules that matter:

- **Clinic timezone (`Asia/Jerusalem`) is authoritative.** Wall-clock rules like "18:00 the evening before" resolve through `lib/clinic-time.ts`, never through the viewer's clock or a fixed offset — Israel observes DST.
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
- Assuming Supabase is live — check imports; mock data may still be the source
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
| Wire Supabase read | `lib/supabase/*`, align with `supabase/migrations/*_init_schema.sql`, replace mock imports gradually |
| Appointment validation | `lib/appointment-time.ts`, `appointment-edit-dialog.tsx` |

---

## File index (high-signal)

| File | Role |
|------|------|
| `src/lib/mock-data.ts` | Primary demo dataset for the whole app |
| `src/lib/mock-finances.ts` | Billing mock records and KPI inputs |
| `src/lib/clinic-settings-defaults.ts` | Default practice configuration |
| `src/lib/env.ts` | Zod-validated env (optional Supabase keys) |
| `src/types/domain.ts` | Core enums and interfaces |
| `src/types/automation.ts` | Sequences, outbox, tokens, intakes, questionnaires |
| `src/features/automations/lib/default-sequences.ts` | The out-of-the-box reminder playbook |
| `supabase/migrations/` | Ordered DDL: schema + RLS, storage, audit, consent (source of truth) |
| `components.json` | shadcn config (`base-nova`, `@/` aliases) |

---

## Status snapshot (as of repo state)

- ✅ Polished clinic UI with mock data
- ✅ Trilingual shell + RTL
- ✅ Clinic settings persisted locally
- ✅ Supabase schema and client scaffolding
- ⬜ Auth / login flow
- ⬜ Live Supabase CRUD in the app
- ⬜ API routes / server actions for backend operations
- ✅ Automation engine, patient self-service pages, message queue (delivery simulated)
- ⬜ Google Calendar / billing integrations (UI placeholders in settings)
- ⬜ Live WhatsApp / email provider behind `MessageDispatcher`
- ⬜ Vercel Cron hitting `/api/automations/tick`

When in doubt, read the closest `features/*` module and follow its patterns.

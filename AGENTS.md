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
| `/settings` | `features/settings` | Profile, hours, treatment types, integrations, notifications |

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
- ⬜ Google Calendar / billing integrations (UI placeholders in settings)

When in doubt, read the closest `features/*` module and follow its patterns.

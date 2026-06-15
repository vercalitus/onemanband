# OneManBand

Single-provider chiropractic clinic workspace — patient records, scheduling, billing, and practice settings. Trilingual UI (English, Hebrew, Arabic) with RTL support.

**Live:** https://onemanband.vercel.app/

## Features

- **Dashboard** — today's schedule, tasks, clinic pulse metrics
- **Patients** — CRM, treatment timeline, documents, session notes
- **Calendar** — week/month views, waitlist, 5-minute appointment grid
- **Billing** — invoices, balances, revenue insights (ILS)
- **Clinical Feed** — curated clinical headlines and sources
- **Settings** — practice profile, hours, treatment types, integration placeholders

## Stack

Next.js 15 · React 19 · TypeScript · Tailwind CSS 4 · shadcn/ui · Supabase (schema ready; app currently uses mock data)

## Getting started

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

Optional: copy `.env.example` to `.env.local` and add Supabase keys when working on backend integration.

### Other commands

```bash
npm run dev:3003       # Dev on port 3003
npm run dev:fresh      # Clean cache + dev (helps on Windows)
npm run build          # Production build
npm run lint           # ESLint
```

## Project structure

```
src/app/(app)/     # Routes (dashboard, patients, calendar, …)
src/features/      # Domain modules (components + hooks)
src/components/    # Shared layout, providers, UI primitives
src/lib/           # Mock data, i18n, utilities, Supabase clients
src/types/         # Domain and settings types
supabase/          # Postgres schema, migrations, seed
```

## For AI agents

See **[AGENTS.md](./AGENTS.md)** for architecture, data-layer status, domain rules, i18n, deploy workflow, and conventions. That file is the canonical onboarding doc for coding agents.

## Deploy

Pushes to `main` deploy automatically to Vercel. Manual CLI deploy:

```bash
npm run deploy:prod
```

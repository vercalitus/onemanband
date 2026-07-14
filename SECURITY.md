# Security & Data Protection Plan

**Scope:** OneManBand handles medical files, skeletal imaging (X-ray/MRI), diagnoses, and
progress questionnaires for a single-provider clinic. This document maps each data-protection
requirement to a concrete implementation in our stack (Next.js 15 on Vercel + Supabase).

**Status:** The app currently runs on **mock data** — no real patient data, no auth, no live
Supabase reads. That means nothing here is urgent *yet*, but every item below must be **done and
verified before real patient data is entered**. Build against this as a checklist while wiring
Supabase.

> ⚠️ **Legal disclaimer:** This is a technical plan, not legal advice. The specific obligations
> under Israeli medical-privacy law must be confirmed with a privacy attorney / compliance advisor
> before go-live. Engineering implements the controls; a professional signs off on the requirements.

---

## Priority 0 — Must exist before real patient data

| # | Control | Where it lives in our stack | Status |
|---|---------|-----------------------------|--------|
| 0.1 | **Authentication** — email + strong password, **MFA** for the practitioner, short session timeout, no self-serve signup | Supabase Auth; `middleware.ts` gate; `/login`; TOTP MFA (`/mfa` + Settings → Security) with enforced step-up | ✅ Built + verified (password + TOTP MFA) |
| 0.2 | **Row-Level Security (RLS)** enforced on every table — DB refuses cross-clinic / cross-patient reads even if app code has a bug | `supabase/schema.sql` (RLS + helpers + role GRANTs) | ✅ Active + verified (2-clinic isolation test) |
| 0.3 | **Service-role key never reaches the browser** | `src/lib/supabase/server.ts` (server-only); client returns `null` when key absent — **already correct**, keep it so | ✅ In place |
| 0.4 | **Private imaging storage** — X-ray/MRI in a **private** Supabase Storage bucket, served only via **short-lived signed URLs** (minutes, not public links) | `supabase/storage.sql` (private `patient-media` bucket + clinic-scoped RLS); `src/lib/supabase/storage.ts` (signed URLs, 60s TTL) | ✅ Built + verified (isolation + private-access test) |
| 0.5 | **HTTPS/TLS everywhere** (in transit) | Vercel default | ✅ In place |
| 0.6 | **Encryption at rest** | Supabase encrypts DB + Storage at rest by default | ✅ Provider default |

## Priority 1 — Before go-live

| # | Control | Where it lives in our stack | Status |
|---|---------|-----------------------------|--------|
| 1.1 | **Audit log** — who viewed/edited which patient record, when | New `audit_log` table + write on sensitive reads/writes | ⬜ Not built |
| 1.2 | **Field-level encryption** for the most sensitive free-text (diagnoses, questionnaire answers) so a DB dump alone is unreadable | App-layer encrypt/decrypt or Postgres `pgcrypto`; key in Vercel env, **not** in the DB | ⬜ Decide approach |
| 1.3 | **Data region + DPA** — choose Supabase region deliberately; sign Data Processing Agreements with Supabase and Vercel | Supabase project settings; vendor contracts | ⬜ Not done |
| 1.4 | **Retention & deletion policy** — medical records must be retained for the period Israeli law requires; define hard-delete vs. archive | Documented policy + DB constraints | ⬜ Not defined |
| 1.5 | **Encrypted, tested backups** with a restore drill | Supabase automated backups (verify tier) | ⬜ Verify |
| 1.6 | **Breach-notification runbook** — who does what, within what window | This repo / ops doc | ⬜ Not written |
| 1.7 | **Patient consent capture** for storing/processing medical data | Intake flow | ⬜ Not built |

## Priority 2 — Ongoing hygiene

- **Least privilege:** each Supabase role gets only the access it needs; review RLS policies on schema changes.
- **Secrets:** all keys in Vercel env vars; rotate on staff change; never commit `.env.local`.
- **Dependencies:** keep Next.js/Supabase patched; watch for advisories.
- **No PII in logs or URLs:** never put patient identifiers in query strings, analytics, or error logs.
- **Input validation:** Zod schemas on every write path (already the project convention).

---

## Compliance map (Israel)

The clinic operates in Israel (health-fund / *kupa* context). Relevant frameworks to confirm with counsel:

- **Privacy Protection Law**, including **Amendment 13** (tightened obligations, effective Aug 2025).
- **Ministry of Health** medical-records rules — retention periods, access, and safekeeping.
- **Patient's Rights Law** (חוק זכויות החולה) — confidentiality of medical information.
- If any EU data subjects: **GDPR**. (HIPAA applies only to US-regulated entities — likely N/A.)

Each Priority 0/1 control above is the technical means of satisfying these; the attorney maps the
legal duty to the control and confirms nothing is missing.

---

## Why the current architecture is a good starting point

- RLS and a multi-tenant, `clinic_id`-scoped schema are **already designed** — the hardest security
  decision (enforce isolation at the database, not just the app) is made correctly.
- The service-role key is **already** kept off the client.
- There is **no real data yet**, so we can turn these controls on before the first record — no risky
  retrofit, no migration of exposed data.

## Suggested build order

1. ~~Auth (0.1) + turn on & **test** RLS (0.2)~~ — ✅ done (password + TOTP MFA, RLS verified).
2. ~~Private imaging buckets + signed URLs (0.4)~~ — ✅ done.
3. Audit log (1.1) — **next**.
4. Field-level encryption decision (1.2) + region/DPA (1.3).
5. Retention, backups, breach runbook, consent (1.4–1.7).

**Also outstanding (infra):** wire `schema.sql` + `storage.sql` into the migration
chain so `supabase start` / a fresh deploy builds the whole DB (currently the lone
migration ALTERs tables the chain never creates — applied manually for now). And
these were verified on **local** Supabase; a real hosted project + its secrets are
provisioned by the practitioner, not the agent.

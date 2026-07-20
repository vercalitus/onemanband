# Security Go-Live Runbook

Operational procedures for the remaining SECURITY.md items. The technical
controls (auth, MFA, RLS, private storage, audit log, field encryption, consent
schema) are built; this file closes out the **policy, legal, and hosted-setup**
items — several of which only the practitioner (or a lawyer) can execute.

> ⚠️ Not legal advice. Confirm Israeli-law specifics (retention periods, breach
> timelines, consent wording) with a privacy attorney before go-live.

---

## 1.2 — Field encryption (built; how to use)

The helper is `src/lib/crypto/field-encryption.ts` (AES-256-GCM, verified:
roundtrip, tamper-detection, wrong-key rejection).

**To turn it on:**
1. Generate a key: `openssl rand -base64 32`
2. Set `APP_ENCRYPTION_KEY` in `.env.local` (local) and in Vercel env (prod).
   **Never commit it. Never put it in the database.**
3. When live DB writes are wired, wrap the most sensitive free-text before
   storing and unwrap after reading:
   ```ts
   import { encryptField, decryptField } from "@/lib/crypto/field-encryption"
   // write: encryptField(notes)   read: decryptField(row.notes)
   ```
   Apply to: clinical notes, diagnoses, questionnaire answers.
   Leave searchable/indexed fields (name, phone) in plaintext — RLS protects them.

**Key rotation:** the payload is versioned (`v1:`). To rotate, add `v2` with a
new key, decrypt-old/encrypt-new on next write. Losing the key = losing the data.

---

## 1.3 — Data region + processor agreements  *(practitioner action)*

1. **Region:** when creating the hosted Supabase project, pick an EU region
   (e.g. `eu-central-1`) unless counsel specifies Israel-only hosting. Region
   **cannot be changed after creation** — get this right the first time.
2. **DPA (Data Processing Agreement):** sign one with each processor:
   - Supabase — request via their dashboard / support.
   - Vercel — enable/sign the DPA in team settings.
3. Keep signed copies with clinic records.

---

## 1.4 — Retention & deletion policy

**Policy (confirm exact years with counsel):**
- Medical records are retained per Israeli Ministry of Health guidance — this is
  **many years** (often the patient's lifetime + a period). Do **not** hard-delete
  active or recent records.
- **Withdrawal of consent ≠ deletion** of medical records already created; it
  stops future processing (e.g. marketing). Record it in `patient_consents`.

**Technical approach:**
- Prefer **archive/soft-delete** over hard delete: patients already carry a
  `status` (`active`/`frozen`/`past`); treatments are immutable by DB trigger.
- Any real deletion must be admin-only and is captured by the audit log.
- Set a calendar review (e.g. annual) to purge only records past the legal
  retention window.

---

## 1.5 — Backups & restore drill  *(practitioner action)*

1. **Enable backups** on the hosted project: daily backups on Pro; enable
   **Point-in-Time Recovery (PITR)** for finer-grained restore if available.
2. **Test the restore** (do this at least once, then quarterly):
   - Restore the latest backup into a **separate** temporary project.
   - Confirm patients, appointments, documents, and audit_log came back intact.
   - Delete the temporary project.
3. A backup you have never restored is not a backup — the drill is the point.

---

## 1.6 — Breach-notification runbook

If patient data may have been exposed (lost device, leaked key, unauthorized
access, mis-sent file):

1. **Contain (immediately):**
   - Rotate secrets: `SUPABASE_SERVICE_ROLE_KEY`, `APP_ENCRYPTION_KEY` handling,
     Supabase DB password, and any exposed user passwords.
   - Revoke sessions (Supabase Auth) and disable compromised accounts.
2. **Assess (same day):** use the **audit log** to determine what was accessed,
   whose data, and over what window.
3. **Notify:** follow Israeli Privacy Protection Law breach-notification duties —
   confirm the trigger threshold and timeline with counsel; notify the Privacy
   Protection Authority and affected patients as required.
4. **Record:** write an incident note (what, when, scope, actions, notifications).
5. **Remediate:** fix the root cause; add a control so it can't recur.

Keep this list where it's reachable without system access (it may be down).

---

## Status of the whole plan

Built + verified in code: **0.1** auth+MFA, **0.2** RLS, **0.3** server-only key,
**0.4** private imaging, **1.1** audit log, **1.2** field encryption, **1.7**
consent schema.

Policy/procedure written here: **1.3, 1.4, 1.5, 1.6** — with the practitioner /
legal actions marked above.

Remaining engineering follow-ups (not blockers for the security model, but needed
for a clean production deploy):
- ✅ The DB is now built from an ordered migration chain in `supabase/migrations/`
  (`init_schema` → `patient_media_storage` → `audit_log` → `patient_consents`), so
  `supabase db reset` / `supabase db push` builds everything in one command.
- Run `supabase db reset` once locally to confirm the chain end-to-end, and the
  audit-log live verification, once Docker/Supabase is back up.
- Provision the real hosted Supabase project and set its secrets (practitioner).

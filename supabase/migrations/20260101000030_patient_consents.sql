-- ===========================================================================
-- Patient consent capture (SECURITY.md control 1.7)
--
-- Records the patient's consent to treatment and to processing/storing their
-- medical data — a legal prerequisite under Israeli privacy law. One row per
-- consent decision so the history (grant, later withdrawal) is preserved.
--
-- The intake UI wires into this table when the app moves off mock data; the
-- schema + isolation are laid down now so consent exists before real data does.
--
-- Apply after schema.sql (needs current_user_clinic_id / is_clinician).
-- ===========================================================================

create table if not exists public.patient_consents (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null default public.current_user_clinic_id()
    references public.clinics (id) on delete cascade,
  patient_id uuid not null references public.patients (id) on delete cascade,
  -- What was consented to.
  consent_type text not null,     -- 'treatment' | 'data_processing' | 'imaging' | 'marketing'
  granted boolean not null,       -- true = given, false = withdrawn/declined
  -- Optional link to a signed consent form in patient-media / documents.
  document_id uuid references public.documents (id) on delete set null,
  notes text not null default '',
  recorded_by uuid default auth.uid() references public.profiles (id) on delete set null,
  recorded_at timestamptz not null default timezone('utc', now())
);

create index if not exists patient_consents_patient_idx
  on public.patient_consents (patient_id, consent_type, recorded_at desc);

alter table public.patient_consents enable row level security;

drop policy if exists "clinic_members_can_view_consents" on public.patient_consents;
create policy "clinic_members_can_view_consents"
on public.patient_consents for select to authenticated
using (public.can_access_clinic(clinic_id));

drop policy if exists "clinicians_can_record_consents" on public.patient_consents;
create policy "clinicians_can_record_consents"
on public.patient_consents for insert to authenticated
with check (public.can_access_clinic(clinic_id) and public.is_clinician());

-- Consents are a running history: no update/delete (withdraw = insert granted=false).

grant select, insert on public.patient_consents to authenticated;

-- Audit writes to this table too (see audit.sql).
drop trigger if exists audit_patient_consents on public.patient_consents;
create trigger audit_patient_consents
  after insert or update or delete on public.patient_consents
  for each row execute function public.log_audit_event();

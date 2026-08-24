-- Automations: patient reminders, self-service links, intakes, questionnaires.
--
-- Mirrors src/types/automation.ts. The app currently runs the same model over
-- a browser-local store (features/automations/lib/automation-store.ts); moving
-- to live data means reimplementing that one module against these tables.
--
-- Every table is clinic-scoped and carries the same RLS shape as the rest of
-- the schema: members of a clinic see only their clinic's rows, via
-- public.current_user_clinic_id().

create type public.message_channel as enum ('whatsapp', 'email', 'sms');

create type public.outbox_status as enum (
  'pending',
  'simulated',
  'sent',
  'failed',
  'cancelled'
);

create type public.access_token_kind as enum ('book', 'respond', 'questionnaire', 'invoice');

create type public.intake_status as enum ('invited', 'submitted', 'approved');

create type public.patient_response_kind as enum (
  'confirmed',
  'cancelled',
  'rescheduled',
  'questionnaire'
);

-- ---------------------------------------------------------------------------
-- Outbox: one row per message the engine decided should exist.
-- ---------------------------------------------------------------------------
create table public.automation_outbox (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics (id) on delete restrict,
  patient_id uuid references public.patients (id) on delete cascade,
  appointment_id uuid references public.appointments (id) on delete cascade,
  finance_id uuid references public.finances (id) on delete set null,
  sequence_id text not null,
  step_id text not null,
  trigger text not null,
  channel public.message_channel not null,
  recipient text not null,
  subject text,
  body text not null,
  actions text[] not null default '{}',
  access_token text,
  -- Run index for recurring steps (dunning); null for one-shot steps.
  run_index integer,
  scheduled_for timestamptz not null,
  status public.outbox_status not null default 'pending',
  sent_at timestamptz,
  error text,
  created_at timestamptz not null default timezone('utc', now()),
  -- Replanning the same event must not double-send. Matches the dedupe key
  -- used by enqueueMessages() in the mock store.
  constraint automation_outbox_unique_step unique nulls not distinct (
    clinic_id, step_id, channel, appointment_id, finance_id, run_index
  )
);

-- The tick loop only ever asks "what is due now", so index exactly that.
create index automation_outbox_due_idx
  on public.automation_outbox (clinic_id, scheduled_for)
  where status = 'pending';

create index automation_outbox_patient_idx
  on public.automation_outbox (clinic_id, patient_id, created_at desc);

-- ---------------------------------------------------------------------------
-- Capability tokens behind every patient-facing link.
-- ---------------------------------------------------------------------------
create table public.automation_access_tokens (
  token text primary key,
  clinic_id uuid not null references public.clinics (id) on delete restrict,
  kind public.access_token_kind not null,
  patient_id uuid references public.patients (id) on delete cascade,
  appointment_id uuid references public.appointments (id) on delete cascade,
  finance_id uuid references public.finances (id) on delete set null,
  questionnaire_id uuid,
  single_use boolean not null default false,
  expires_at timestamptz not null,
  used_at timestamptz,
  created_at timestamptz not null default timezone('utc', now())
);

create index automation_access_tokens_expiry_idx
  on public.automation_access_tokens (expires_at)
  where used_at is null;

-- ---------------------------------------------------------------------------
-- Self-registration submissions. Deliberately NOT public.patients: this is
-- unverified, patient-supplied data until a clinician approves it.
-- ---------------------------------------------------------------------------
create table public.patient_intakes (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics (id) on delete restrict,
  token text references public.automation_access_tokens (token) on delete set null,
  full_name text not null,
  phone text not null,
  email text,
  date_of_birth date,
  reason text not null default '',
  document_paths text[] not null default '{}',
  requested_type public.appointment_type,
  requested_start timestamptz,
  status public.intake_status not null default 'submitted',
  -- Set when a clinician turns the intake into a real patient record.
  approved_patient_id uuid references public.patients (id) on delete set null,
  approved_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  submitted_at timestamptz
);

create index patient_intakes_pending_idx
  on public.patient_intakes (clinic_id, created_at desc)
  where status = 'submitted';

-- ---------------------------------------------------------------------------
-- Progress questionnaires. Answers are jsonb because the question set is a
-- product decision that will change more often than the schema should.
-- ---------------------------------------------------------------------------
create table public.progress_questionnaires (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics (id) on delete restrict,
  patient_id uuid not null references public.patients (id) on delete cascade,
  session_number integer not null check (session_number > 0),
  answers jsonb not null default '[]'::jsonb,
  -- Set when the answers are folded into the patient's treatment timeline.
  treatment_id uuid references public.treatments (id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  completed_at timestamptz
);

create index progress_questionnaires_patient_idx
  on public.progress_questionnaires (clinic_id, patient_id, created_at desc);

-- ---------------------------------------------------------------------------
-- Inbound patient actions (link clicks and WhatsApp button taps).
-- ---------------------------------------------------------------------------
create table public.patient_responses (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics (id) on delete restrict,
  patient_id uuid references public.patients (id) on delete cascade,
  appointment_id uuid references public.appointments (id) on delete cascade,
  questionnaire_id uuid references public.progress_questionnaires (id) on delete set null,
  kind public.patient_response_kind not null,
  new_start timestamptz,
  handled boolean not null default false,
  received_at timestamptz not null default timezone('utc', now())
);

create index patient_responses_open_idx
  on public.patient_responses (clinic_id, received_at desc)
  where handled = false;

-- ---------------------------------------------------------------------------
-- RLS — same clinic-scoping as every other table in this schema.
-- ---------------------------------------------------------------------------
alter table public.automation_outbox enable row level security;
alter table public.automation_access_tokens enable row level security;
alter table public.patient_intakes enable row level security;
alter table public.progress_questionnaires enable row level security;
alter table public.patient_responses enable row level security;

create policy automation_outbox_clinic_access on public.automation_outbox
  for all using (clinic_id = public.current_user_clinic_id())
  with check (clinic_id = public.current_user_clinic_id());

create policy automation_access_tokens_clinic_access on public.automation_access_tokens
  for all using (clinic_id = public.current_user_clinic_id())
  with check (clinic_id = public.current_user_clinic_id());

create policy patient_intakes_clinic_access on public.patient_intakes
  for all using (clinic_id = public.current_user_clinic_id())
  with check (clinic_id = public.current_user_clinic_id());

create policy progress_questionnaires_clinic_access on public.progress_questionnaires
  for all using (clinic_id = public.current_user_clinic_id())
  with check (clinic_id = public.current_user_clinic_id());

create policy patient_responses_clinic_access on public.patient_responses
  for all using (clinic_id = public.current_user_clinic_id())
  with check (clinic_id = public.current_user_clinic_id());

-- Patients are never authenticated, so `anon` gets nothing here. Public pages
-- must reach these tables through a server route holding the service-role key,
-- which resolves the URL token itself before touching any row. Granting anon
-- read on tokens would leak every live link in the clinic.
grant select, insert, update, delete on
  public.automation_outbox,
  public.automation_access_tokens,
  public.patient_intakes,
  public.progress_questionnaires,
  public.patient_responses
to authenticated;

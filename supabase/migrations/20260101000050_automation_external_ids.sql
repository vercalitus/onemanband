-- Let the automation tables hold a patient the database does not know yet.
--
-- The app still runs on mock data: a patient id is `pt-001`, text, with no row
-- in public.patients. The automation tables reference patients and
-- appointments as UUID foreign keys, so as things stand a patient's own tap on
-- "I've already paid" cannot be written down at all — which is the one thing
-- that has to cross from their phone to the practitioner's dashboard.
--
-- So a text column sits beside each UUID reference. While mock data reigns the
-- UUID stays null and the text carries the id; once patients, appointments and
-- finances live in Postgres these are backfilled into the real foreign keys
-- and dropped.
--
-- THIS IS A BRIDGE AND IS MEANT TO BE REMOVED. It exists because the
-- alternative was to migrate the whole application's data model first, which
-- is a project, not a step. Do not build anything new on these columns, and do
-- not let real patient data arrive while they are still load-bearing.

alter table public.automation_outbox
  add column if not exists external_patient_id text,
  add column if not exists external_appointment_id text,
  add column if not exists external_invoice_id text;

alter table public.automation_access_tokens
  add column if not exists external_patient_id text,
  add column if not exists external_appointment_id text,
  add column if not exists external_invoice_id text;

alter table public.patient_responses
  add column if not exists external_patient_id text,
  add column if not exists external_appointment_id text,
  add column if not exists external_invoice_id text,
  -- The token snapshot carries the patient's name, so a response can be shown
  -- to the practitioner without resolving a patient record that may not exist.
  add column if not exists patient_name text;

-- A payment claim is a response kind the enum predates.
alter type public.patient_response_kind add value if not exists 'payment_claimed';

-- The dashboard asks one question of this table — "what is still open?" — and
-- asks it on every load.
create index if not exists patient_responses_open_external_idx
  on public.patient_responses (clinic_id, received_at desc)
  where handled = false;

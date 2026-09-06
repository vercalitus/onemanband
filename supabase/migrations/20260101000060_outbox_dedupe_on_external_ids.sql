-- Move the outbox's no-double-send rule onto the ids that are actually filled.
--
-- `automation_outbox_unique_step` dedupes on (clinic, step, channel,
-- appointment_id, finance_id, run_index) with NULLS NOT DISTINCT — which was
-- right when those columns held real foreign keys. While the app runs on mock
-- data they are all null, so the key collapses to (clinic, step, channel,
-- run_index) and two different patients queued for the same reminder look like
-- the same row. The second patient's message is rejected as a duplicate and
-- silently never sent.
--
-- A dropped reminder is the worst failure this table has, so the rule moves to
-- the bridge columns that carry the ids today. When patients become real rows
-- this reverts along with the rest of the bridge.

alter table public.automation_outbox
  drop constraint if exists automation_outbox_unique_step;

create unique index if not exists automation_outbox_unique_step_external
  on public.automation_outbox (
    clinic_id,
    step_id,
    channel,
    coalesce(external_patient_id, ''),
    coalesce(external_appointment_id, ''),
    coalesce(external_invoice_id, ''),
    coalesce(run_index, -1)
  );

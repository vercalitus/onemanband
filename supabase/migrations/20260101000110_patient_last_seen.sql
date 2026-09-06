-- When the clinic last saw this patient.
--
-- Not a copy of anything: a derived fact, kept on the row because the two
-- things it derives from are incomplete. Appointments only go back as far as
-- this app does, and the bookkeeping account holds documents rather than
-- visits. Most patients here pay at the session, so the date of their last
-- document is a good approximation of their last visit — and it is the only
-- real evidence that exists for the years before this system.
--
-- It is a floor, not the answer. The repository reads the latest of: a real
-- appointment, a real payment, and this. Every new visit or settlement
-- overtakes it, so the imported value quietly stops mattering.

alter table public.patients
  add column if not exists last_seen_at date;

comment on column public.patients.last_seen_at is
  'Best known date of the last visit. Backfilled from bookkeeping history at import; superseded by real appointments and payments as they accumulate.';

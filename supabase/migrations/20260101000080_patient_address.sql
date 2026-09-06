-- The patient's address.
--
-- Present in PatientSummary and on screen since the first version, and absent
-- from this table — an oversight that only shows up when the app stops reading
-- mock data. It is not decorative: it goes on the customer card at the
-- bookkeeping provider, and a tax document is addressed with it.

alter table public.patients
  add column if not exists address text;

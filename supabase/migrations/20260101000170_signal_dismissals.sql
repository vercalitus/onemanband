-- "I've seen this, stop showing it."
--
-- The attention column is derived from clinic records, so ticking a row off is
-- the wrong verb — marking "invoice overdue" done does not pay the invoice, and
-- the row returns the moment the board re-derives. Dismissal is the honest
-- action, and until now it was kept in localStorage: waving a signal away on a
-- phone left it standing on the clinic machine, and the same alert had to be
-- dismissed once per device, forever.
--
-- Keyed by the signal's derived id (`rx-overdue-<invoice>`), which is stable
-- for as long as the underlying condition is.
--
-- Self-cleaning by design, not by cron: the board deletes rows whose signal is
-- no longer being derived. Without that this table grows forever and, worse, a
-- condition that recurs months later would arrive pre-silenced — the patient
-- falls behind again and nobody is told, because somebody dismissed it once in
-- the spring.

create table if not exists public.signal_dismissals (
  clinic_id uuid not null references public.clinics (id) on delete cascade,
  signal_id text not null,
  dismissed_at timestamptz not null default timezone('utc', now()),
  dismissed_by uuid references public.profiles (id) on delete set null,
  primary key (clinic_id, signal_id)
);

alter table public.signal_dismissals enable row level security;

drop policy if exists "clinic_members_can_view_dismissals" on public.signal_dismissals;
drop policy if exists "clinicians_can_insert_dismissals" on public.signal_dismissals;
drop policy if exists "clinicians_can_delete_dismissals" on public.signal_dismissals;

create policy "clinic_members_can_view_dismissals"
on public.signal_dismissals
for select
using (public.can_access_clinic(clinic_id));

create policy "clinicians_can_insert_dismissals"
on public.signal_dismissals
for insert
with check (public.can_access_clinic(clinic_id) and public.is_clinician());

-- Deleting one un-silences a signal, which is the safe direction: the worst
-- case is being shown something again.
create policy "clinicians_can_delete_dismissals"
on public.signal_dismissals
for delete
using (public.can_access_clinic(clinic_id) and public.is_clinician());

comment on table public.signal_dismissals is
  'Derived dashboard signals the practitioner has waved away. Pruned by the board once a signal stops being derived.';

-- A treatment record saved in error can be marked as such — and nothing else.
--
-- The immutability rule stands: a record that can be quietly rewritten is not
-- a record. But the first week of real use produced the case the rule did not
-- cover: a practitioner closed a session halfway by mistake and closed it
-- again at the end, so the chart holds two records for one visit, counts two
-- sessions against the care plan, and offers no way to say which one is real.
-- Deleting either would be exactly the quiet rewrite the rule forbids.
--
-- So the record stays, in full, and gains one permitted change: a timestamp
-- saying it was saved in error, set once, by a clinician. Every other column
-- is still frozen, and the mark itself cannot be removed.

alter table public.treatments
  add column if not exists voided_at timestamptz,
  add column if not exists void_reason text,
  add column if not exists voided_by uuid references public.profiles (id) on delete set null;

create or replace function public.prevent_treatment_mutation()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'DELETE' then
    raise exception 'Treatment records are immutable after creation.';
  end if;

  -- The one permitted update: an unvoided record becomes voided, and nothing
  -- but the three void columns differs between the old row and the new.
  if old.voided_at is null
     and new.voided_at is not null
     and (to_jsonb(old) - 'voided_at' - 'void_reason' - 'voided_by')
       = (to_jsonb(new) - 'voided_at' - 'void_reason' - 'voided_by') then
    return new;
  end if;

  raise exception 'Treatment records are immutable after creation.';
end;
$$;

-- There was no update policy at all — the trigger made one pointless. The
-- trigger still decides what an update may change; this decides who may ask.
drop policy if exists "clinicians_can_void_treatments" on public.treatments;
create policy "clinicians_can_void_treatments"
on public.treatments
for update
using (public.can_access_clinic(clinic_id) and public.is_clinician())
with check (public.can_access_clinic(clinic_id) and public.is_clinician());

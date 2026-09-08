-- The practitioner's own to-do list.
--
-- It had no storage at all. A task typed into the dashboard lived in React
-- state and nowhere else, so it survived clicking between pages and did not
-- survive a refresh — "call the insurer about the plan approval" was gone on
-- reload, on a second tab, and every morning. Ticking one off was lost the
-- same way. Of everything in this app that was keeping data in the wrong
-- place, this was the only thing keeping it nowhere.
--
-- The derived "needs attention" rows are not stored here and must not be:
-- those are computed from the clinic's records every time the board is built,
-- and a saved copy would be a second version of a fact that can go stale. This
-- table is only for what a person wrote down themselves.
--
-- `due_label` is text, not a date, because that is what the box asks for and
-- what a practitioner actually types — "before Thursday", "when the lab
-- calls". Parsing it into a timestamp would throw away the ones that are not
-- dates and invent precision for the ones that are.

create table if not exists public.tasks (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics (id) on delete restrict,
  title text not null,
  due_label text not null default '',
  completed_at timestamptz,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists tasks_clinic_open_idx
  on public.tasks (clinic_id, completed_at, created_at desc);

drop trigger if exists tasks_set_updated_at on public.tasks;
create trigger tasks_set_updated_at
before update on public.tasks
for each row
execute function public.set_updated_at();

alter table public.tasks enable row level security;

drop policy if exists "clinic_members_can_view_tasks" on public.tasks;
drop policy if exists "clinicians_can_insert_tasks" on public.tasks;
drop policy if exists "clinicians_can_update_tasks" on public.tasks;
drop policy if exists "clinicians_can_delete_tasks" on public.tasks;

create policy "clinic_members_can_view_tasks"
on public.tasks
for select
using (public.can_access_clinic(clinic_id));

create policy "clinicians_can_insert_tasks"
on public.tasks
for insert
with check (public.can_access_clinic(clinic_id) and public.is_clinician());

create policy "clinicians_can_update_tasks"
on public.tasks
for update
using (public.can_access_clinic(clinic_id) and public.is_clinician())
with check (public.can_access_clinic(clinic_id) and public.is_clinician());

-- Deletable by any clinician rather than admins only, unlike patient records:
-- a note somebody wrote to themselves is theirs to throw away, and it is not
-- part of anybody's medical history.
create policy "clinicians_can_delete_tasks"
on public.tasks
for delete
using (public.can_access_clinic(clinic_id) and public.is_clinician());

comment on table public.tasks is
  'Tasks the practitioner wrote themselves. Derived "needs attention" signals are computed, never stored here.';

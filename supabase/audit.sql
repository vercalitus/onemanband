-- ===========================================================================
-- Audit log (SECURITY.md control 1.1)
--
-- Records who did what to which record, and when. Two sources feed it:
--   1. Database triggers  — automatically log every INSERT/UPDATE/DELETE on the
--      sensitive tables. Tamper-proof: fires even if the app has a bug, and
--      writes via a SECURITY DEFINER function so RLS can't suppress a log.
--   2. App-level logging   — `logAudit()` records reads/views (SELECTs don't
--      fire triggers) once the app reads live data. See src/lib/supabase/audit.ts.
--
-- The table is append-only: no UPDATE/DELETE policies, so entries can't be
-- altered or erased through the API. Reads are admin-only, per clinic.
--
-- Apply after schema.sql (needs public.current_user_clinic_id / is_admin).
-- ===========================================================================

create table if not exists public.audit_log (
  id uuid primary key default gen_random_uuid(),
  -- Defaults let app-level inserts omit these; triggers set them explicitly.
  clinic_id uuid not null default public.current_user_clinic_id()
    references public.clinics (id) on delete cascade,
  actor_id uuid default auth.uid() references auth.users (id) on delete set null,
  action text not null,          -- 'view' | 'insert' | 'update' | 'delete' | 'export'
  entity_type text not null,     -- table / resource name, e.g. 'patients'
  entity_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists audit_log_clinic_time_idx
  on public.audit_log (clinic_id, created_at desc);
create index if not exists audit_log_entity_idx
  on public.audit_log (entity_type, entity_id);

alter table public.audit_log enable row level security;

-- Reads: admins only, own clinic. (Single-provider practitioner is admin.)
drop policy if exists "admins_can_view_audit_log" on public.audit_log;
create policy "admins_can_view_audit_log"
on public.audit_log for select to authenticated
using (public.can_access_clinic(clinic_id) and public.is_admin());

-- App-level inserts (views/exports): any clinic member, own clinic only.
drop policy if exists "members_can_insert_audit_log" on public.audit_log;
create policy "members_can_insert_audit_log"
on public.audit_log for insert to authenticated
with check (public.can_access_clinic(clinic_id));

-- No update/delete policies → append-only.

grant select, insert on public.audit_log to authenticated;

-- ---------------------------------------------------------------------------
-- Trigger function: log every write on an audited table.
-- SECURITY DEFINER so the insert always succeeds regardless of the caller's
-- RLS. search_path pinned to avoid function-hijacking on a definer function.
-- ---------------------------------------------------------------------------
create or replace function public.log_audit_event()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  affected record;
  op text;
begin
  if (TG_OP = 'DELETE') then
    affected := OLD;
    op := 'delete';
  elsif (TG_OP = 'UPDATE') then
    affected := NEW;
    op := 'update';
  else
    affected := NEW;
    op := 'insert';
  end if;

  insert into public.audit_log (clinic_id, actor_id, action, entity_type, entity_id)
  values (affected.clinic_id, auth.uid(), op, TG_TABLE_NAME, affected.id);

  return case when TG_OP = 'DELETE' then OLD else NEW end;
end;
$$;

-- Attach to every sensitive table (all have clinic_id + id).
drop trigger if exists audit_patients on public.patients;
create trigger audit_patients after insert or update or delete on public.patients
  for each row execute function public.log_audit_event();

drop trigger if exists audit_treatments on public.treatments;
create trigger audit_treatments after insert or update or delete on public.treatments
  for each row execute function public.log_audit_event();

drop trigger if exists audit_appointments on public.appointments;
create trigger audit_appointments after insert or update or delete on public.appointments
  for each row execute function public.log_audit_event();

drop trigger if exists audit_documents on public.documents;
create trigger audit_documents after insert or update or delete on public.documents
  for each row execute function public.log_audit_event();

drop trigger if exists audit_finances on public.finances;
create trigger audit_finances after insert or update or delete on public.finances
  for each row execute function public.log_audit_event();

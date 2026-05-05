create extension if not exists pgcrypto;
create extension if not exists btree_gist;

create type public.app_role as enum ('admin', 'doctor');
create type public.patient_status as enum ('active', 'frozen', 'past');
create type public.appointment_status as enum (
  'scheduled',
  'confirmed',
  'checked_in',
  'completed',
  'cancelled',
  'no_show'
);
create type public.appointment_type as enum ('first', 'adjustments', 'kupa');
create type public.document_type as enum ('xray', 'mri', 'insurance', 'lab', 'consent', 'other');
create type public.invoice_status as enum ('draft', 'issued', 'paid', 'overdue', 'void');
create type public.payment_status as enum ('pending', 'partially_paid', 'paid', 'refunded', 'failed');

create table public.clinics (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  timezone text not null default 'UTC',
  created_at timestamptz not null default timezone('utc', now())
);

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  clinic_id uuid not null references public.clinics (id) on delete restrict,
  role public.app_role not null,
  full_name text not null,
  phone text,
  is_active boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table public.patients (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics (id) on delete restrict,
  full_name text not null,
  preferred_name text,
  email text,
  phone text,
  date_of_birth date,
  status public.patient_status not null default 'active',
  medical_history_summary text not null default '',
  general_notes text not null default '',
  emergency_contact jsonb not null default '{}'::jsonb,
  tags text[] not null default '{}',
  created_by uuid references public.profiles (id) on delete set null,
  updated_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table public.treatments (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics (id) on delete restrict,
  patient_id uuid not null references public.patients (id) on delete cascade,
  provider_id uuid not null references public.profiles (id) on delete restrict,
  title text not null,
  treatment_type text,
  note text not null,
  metadata jsonb not null default '{}'::jsonb,
  recorded_at timestamptz not null default timezone('utc', now()),
  created_at timestamptz not null default timezone('utc', now())
);

create table public.appointments (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics (id) on delete restrict,
  patient_id uuid not null references public.patients (id) on delete cascade,
  provider_id uuid references public.profiles (id) on delete set null,
  start_time timestamptz not null,
  end_time timestamptz not null,
  status public.appointment_status not null default 'scheduled',
  appointment_type public.appointment_type not null default 'adjustments',
  google_calendar_event_id text,
  location text,
  notes text,
  reminder_channel text,
  reminder_status text not null default 'pending',
  reminder_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint appointments_time_check check (end_time > start_time),
  constraint appointments_duration_min check (end_time >= start_time + interval '5 minutes'),
  constraint appointments_duration_max check (end_time <= start_time + interval '60 minutes'),
  constraint appointments_duration_five_step check (
    mod(extract(epoch from (end_time - start_time))::bigint, 300) = 0
  ),
  constraint appointments_start_second_zero check (extract(second from start_time) = 0),
  constraint appointments_start_five_minute_step check (
    mod(extract(minute from start_time)::integer, 5) = 0
  ),
  constraint appointments_no_overlap_per_clinic exclude using gist (
    clinic_id with =,
    tstzrange(start_time, end_time, '[)') with &&
  )
);

create table public.documents (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics (id) on delete restrict,
  patient_id uuid not null references public.patients (id) on delete cascade,
  uploaded_by uuid references public.profiles (id) on delete set null,
  bucket text not null default 'patient-documents',
  storage_path text not null,
  file_name text not null,
  mime_type text,
  file_size_bytes bigint,
  document_type public.document_type not null default 'other',
  source_label text,
  tags text[] not null default '{}',
  created_at timestamptz not null default timezone('utc', now())
);

create table public.finances (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics (id) on delete restrict,
  patient_id uuid not null references public.patients (id) on delete cascade,
  appointment_id uuid references public.appointments (id) on delete set null,
  amount_cents integer not null check (amount_cents >= 0),
  currency char(3) not null default 'USD',
  payment_status public.payment_status not null default 'pending',
  invoice_status public.invoice_status not null default 'draft',
  balance_cents integer not null default 0,
  due_date date,
  paid_at timestamptz,
  billing_provider text,
  external_invoice_id text,
  external_sync_payload jsonb not null default '{}'::jsonb,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table public.news_feed (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics (id) on delete cascade,
  title text not null,
  source text not null,
  url text not null,
  category text,
  keywords text[] not null default '{}',
  excerpt text,
  published_at timestamptz,
  cached_at timestamptz not null default timezone('utc', now()),
  created_at timestamptz not null default timezone('utc', now()),
  unique (clinic_id, url)
);

create index patients_clinic_status_idx on public.patients (clinic_id, status);
create index patients_search_idx on public.patients using gin (to_tsvector('simple', coalesce(full_name, '') || ' ' || coalesce(email, '') || ' ' || coalesce(phone, '')));
create index treatments_patient_recorded_idx on public.treatments (patient_id, recorded_at desc);
create index appointments_clinic_start_idx on public.appointments (clinic_id, start_time);
create index appointments_google_event_idx on public.appointments (google_calendar_event_id);
create index documents_patient_created_idx on public.documents (patient_id, created_at desc);
create index finances_patient_due_idx on public.finances (patient_id, due_date);
create index news_feed_keywords_idx on public.news_feed using gin (keywords);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

create or replace function public.prevent_treatment_mutation()
returns trigger
language plpgsql
as $$
begin
  raise exception 'Treatment records are immutable after creation.';
end;
$$;

create or replace function public.current_user_clinic_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select clinic_id
  from public.profiles
  where id = auth.uid();
$$;

create or replace function public.current_user_role()
returns public.app_role
language sql
stable
security definer
set search_path = public
as $$
  select role
  from public.profiles
  where id = auth.uid();
$$;

create or replace function public.can_access_clinic(target_clinic_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select auth.uid() is not null
    and exists (
      select 1
      from public.profiles
      where id = auth.uid()
        and clinic_id = target_clinic_id
        and is_active = true
    );
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.current_user_role() = 'admin';
$$;

create or replace function public.is_clinician()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.current_user_role() in ('admin', 'doctor');
$$;

create trigger profiles_set_updated_at
before update on public.profiles
for each row
execute function public.set_updated_at();

create trigger patients_set_updated_at
before update on public.patients
for each row
execute function public.set_updated_at();

create trigger appointments_set_updated_at
before update on public.appointments
for each row
execute function public.set_updated_at();

create trigger finances_set_updated_at
before update on public.finances
for each row
execute function public.set_updated_at();

create trigger treatments_immutable
before update or delete on public.treatments
for each row
execute function public.prevent_treatment_mutation();

alter table public.clinics enable row level security;
alter table public.profiles enable row level security;
alter table public.patients enable row level security;
alter table public.treatments enable row level security;
alter table public.appointments enable row level security;
alter table public.documents enable row level security;
alter table public.finances enable row level security;
alter table public.news_feed enable row level security;

create policy "clinic_members_can_view_clinic"
on public.clinics
for select
using (public.can_access_clinic(id));

create policy "clinic_admins_can_update_clinic"
on public.clinics
for update
using (public.can_access_clinic(id) and public.is_admin())
with check (public.can_access_clinic(id) and public.is_admin());

create policy "clinic_members_can_view_profiles"
on public.profiles
for select
using (public.can_access_clinic(clinic_id));

create policy "admins_can_insert_profiles"
on public.profiles
for insert
with check (public.can_access_clinic(clinic_id) and public.is_admin());

create policy "admins_or_self_can_update_profiles"
on public.profiles
for update
using (public.can_access_clinic(clinic_id) and (public.is_admin() or auth.uid() = id))
with check (public.can_access_clinic(clinic_id) and (public.is_admin() or auth.uid() = id));

create policy "clinic_members_can_view_patients"
on public.patients
for select
using (public.can_access_clinic(clinic_id));

create policy "clinicians_can_insert_patients"
on public.patients
for insert
with check (public.can_access_clinic(clinic_id) and public.is_clinician());

create policy "clinicians_can_update_patients"
on public.patients
for update
using (public.can_access_clinic(clinic_id) and public.is_clinician())
with check (public.can_access_clinic(clinic_id) and public.is_clinician());

create policy "admins_can_delete_patients"
on public.patients
for delete
using (public.can_access_clinic(clinic_id) and public.is_admin());

create policy "clinic_members_can_view_treatments"
on public.treatments
for select
using (public.can_access_clinic(clinic_id));

create policy "clinicians_can_insert_treatments"
on public.treatments
for insert
with check (public.can_access_clinic(clinic_id) and public.is_clinician());

create policy "clinic_members_can_view_appointments"
on public.appointments
for select
using (public.can_access_clinic(clinic_id));

create policy "clinicians_can_insert_appointments"
on public.appointments
for insert
with check (public.can_access_clinic(clinic_id) and public.is_clinician());

create policy "clinicians_can_update_appointments"
on public.appointments
for update
using (public.can_access_clinic(clinic_id) and public.is_clinician())
with check (public.can_access_clinic(clinic_id) and public.is_clinician());

create policy "admins_can_delete_appointments"
on public.appointments
for delete
using (public.can_access_clinic(clinic_id) and public.is_admin());

create policy "clinic_members_can_view_documents"
on public.documents
for select
using (public.can_access_clinic(clinic_id));

create policy "clinicians_can_insert_documents"
on public.documents
for insert
with check (public.can_access_clinic(clinic_id) and public.is_clinician());

create policy "clinicians_can_update_documents"
on public.documents
for update
using (public.can_access_clinic(clinic_id) and public.is_clinician())
with check (public.can_access_clinic(clinic_id) and public.is_clinician());

create policy "admins_can_delete_documents"
on public.documents
for delete
using (public.can_access_clinic(clinic_id) and public.is_admin());

create policy "clinic_members_can_view_finances"
on public.finances
for select
using (public.can_access_clinic(clinic_id));

create policy "admins_can_insert_finances"
on public.finances
for insert
with check (public.can_access_clinic(clinic_id) and public.is_admin());

create policy "admins_can_update_finances"
on public.finances
for update
using (public.can_access_clinic(clinic_id) and public.is_admin())
with check (public.can_access_clinic(clinic_id) and public.is_admin());

create policy "admins_can_delete_finances"
on public.finances
for delete
using (public.can_access_clinic(clinic_id) and public.is_admin());

create policy "clinic_members_can_view_news_feed"
on public.news_feed
for select
using (public.can_access_clinic(clinic_id));

create policy "clinicians_can_insert_news_feed"
on public.news_feed
for insert
with check (public.can_access_clinic(clinic_id) and public.is_clinician());

create policy "clinicians_can_update_news_feed"
on public.news_feed
for update
using (public.can_access_clinic(clinic_id) and public.is_clinician())
with check (public.can_access_clinic(clinic_id) and public.is_clinician());

comment on column public.appointments.reminder_payload is
'Placeholder payload for Twilio or AISensy reminder jobs.';

comment on column public.finances.external_sync_payload is
'Placeholder payload for Morning or Invoice4U billing synchronization metadata.';

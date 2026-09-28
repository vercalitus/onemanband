-- Phone numbers the clinic is missing, and the guesses waiting to be confirmed.
--
-- 480 of 1,127 patients have no phone, which is the ceiling on every reminder
-- the system can ever send. Their numbers do exist — in the practitioner's own
-- address book — but under names nobody else can resolve: a nickname, a first
-- name alone, "Ima Shel Beri", "Bettie Kibbutz". Matching by name got us from
-- 302 reachable to 647 and then stopped, because the remaining link lives in
-- one person's head.
--
-- So the guesses are parked here, the practitioner is handed a link, and each
-- tap writes the number onto the patient. The table is scaffolding for that
-- one job: it holds no clinical information, and it can be dropped once the
-- phone book is filled.
--
-- Nobody reads it from the browser. There are no policies and RLS is on, so
-- only the service role — the public route that serves the link — can see it.

create table if not exists public.phone_candidates (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics (id) on delete cascade,
  patient_id uuid not null references public.patients (id) on delete cascade,
  -- How the number is saved in the practitioner's phone, shown as-is so he
  -- recognises his own wording.
  label text not null,
  phone text not null,
  -- Ordering of the guesses, best first.
  rank smallint not null default 0,
  -- Set when the practitioner picks this one, so a second visit to the link
  -- shows what he already decided.
  chosen_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  constraint phone_candidates_phone_shape check (phone ~ '^05[0-9]{8}$')
);

create index if not exists phone_candidates_patient_idx
  on public.phone_candidates (patient_id, rank);

create unique index if not exists phone_candidates_unique
  on public.phone_candidates (patient_id, phone);

alter table public.phone_candidates enable row level security;

-- One row per patient the link should ask about, so the list survives a
-- refresh and the page can show progress. `answered_at` is set both when a
-- number is chosen and when the practitioner says he does not know.
create table if not exists public.phone_requests (
  patient_id uuid primary key references public.patients (id) on delete cascade,
  clinic_id uuid not null references public.clinics (id) on delete cascade,
  answered_at timestamptz,
  -- 'picked' — one of the guesses; 'typed' — he wrote the number himself;
  -- 'unknown' — he does not know it.
  answer text check (answer in ('picked', 'typed', 'unknown')),
  created_at timestamptz not null default timezone('utc', now())
);

alter table public.phone_requests enable row level security;

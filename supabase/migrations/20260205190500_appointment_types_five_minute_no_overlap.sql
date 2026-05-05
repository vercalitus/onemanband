-- Visit types, 5–60 minute five-minute grid, and hard no-overlap per clinic (single-provider schedule).
-- Safe to re-run: drops named constraints before re-adding.

CREATE EXTENSION IF NOT EXISTS btree_gist;

DO $$
BEGIN
  CREATE TYPE public.appointment_type AS ENUM ('first', 'adjustments', 'kupa');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$$;

ALTER TABLE public.appointments
  ADD COLUMN IF NOT EXISTS appointment_type public.appointment_type NOT NULL DEFAULT 'adjustments';

ALTER TABLE public.appointments DROP CONSTRAINT IF EXISTS appointments_duration_min;
ALTER TABLE public.appointments DROP CONSTRAINT IF EXISTS appointments_duration_max;
ALTER TABLE public.appointments DROP CONSTRAINT IF EXISTS appointments_duration_five_step;
ALTER TABLE public.appointments DROP CONSTRAINT IF EXISTS appointments_start_second_zero;
ALTER TABLE public.appointments DROP CONSTRAINT IF EXISTS appointments_start_five_minute_step;
ALTER TABLE public.appointments DROP CONSTRAINT IF EXISTS appointments_no_overlap_per_clinic;

ALTER TABLE public.appointments
  ADD CONSTRAINT appointments_duration_min CHECK (end_time >= start_time + interval '5 minutes');

ALTER TABLE public.appointments
  ADD CONSTRAINT appointments_duration_max CHECK (end_time <= start_time + interval '60 minutes');

ALTER TABLE public.appointments
  ADD CONSTRAINT appointments_duration_five_step CHECK (
    mod(extract(epoch from (end_time - start_time))::bigint, 300) = 0
  );

ALTER TABLE public.appointments
  ADD CONSTRAINT appointments_start_second_zero CHECK (extract(second FROM start_time) = 0);

ALTER TABLE public.appointments
  ADD CONSTRAINT appointments_start_five_minute_step CHECK (
    mod(extract(minute FROM start_time)::integer, 5) = 0
  );

ALTER TABLE public.appointments
  ADD CONSTRAINT appointments_no_overlap_per_clinic EXCLUDE USING gist (
    clinic_id WITH =,
    tstzrange(start_time, end_time, '[)') WITH &&
  );

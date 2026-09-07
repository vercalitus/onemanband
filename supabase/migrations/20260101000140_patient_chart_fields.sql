-- The last two things the patient chart kept only in a browser.
--
-- The chart was built as a demo: every field a practitioner could edit on it —
-- the status line, the marks on the body diagram, the contact details, the
-- notes — was written to localStorage under `patient.<id>.<field>`. That is
-- fine for a demo and wrong for a medical record. It means the same patient
-- reads differently on the clinic machine and on a phone, that clearing a
-- browser destroys clinical notes with no backup, and that a phone number
-- corrected on the chart never reaches the reminder engine, which reads this
-- table.
--
-- The contact fields and the notes already had columns here and simply were not
-- being written to. These two did not exist at all.
--
-- `clinical_status` is a one-line "where are we with this person", read at a
-- glance before the patient walks in. It carries its own timestamp because a
-- status with no date is the hazard it is meant to remove: a sentence written
-- eight months ago reads exactly like one written this morning. When it is
-- empty the chart falls back to the last treatment note, labelled with that
-- treatment's date — so the line is either something the practitioner wrote, or
-- something that visibly came from a visit, and never a claim with no origin.
--
-- `body_map_marks` holds where on the body this patient has been treated, with
-- an optional note per mark. Kept as jsonb rather than a table because it is
-- always read and written whole, as one patient's diagram, and never queried
-- across patients.

alter table public.patients
  add column if not exists clinical_status text not null default '',
  add column if not exists clinical_status_updated_at timestamptz,
  add column if not exists body_map_marks jsonb not null default '[]'::jsonb;

comment on column public.patients.clinical_status is
  'One-line clinical status shown at the top of the chart. Empty means the chart shows the last treatment note instead.';

comment on column public.patients.clinical_status_updated_at is
  'When the status line was last written. Displayed with it — an undated status is indistinguishable from a current one.';

comment on column public.patients.body_map_marks is
  'Treatment marks on the body diagram: [{id, view, x, y, note?, createdAt}]. Read and written whole.';

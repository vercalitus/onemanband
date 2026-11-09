-- Where on the spine a session's work was done, tapped on the spine model.
--
-- The practitioner wrote this by hand in every note ("C2 left", "L4/L5"). A
-- tap on the same flat spine the body map uses now names it instead, and the
-- names are stored as data rather than prose so they can be counted later:
-- which levels a patient has been adjusted at, and how often.
--
-- What is stored is the spine model's own vocabulary, in English whatever the
-- app's language: `C2`, `C2 L`, `L4/L5`, `Sacrum`, `SI R`, `Coccyx`. Top to
-- bottom. An empty array means nothing was marked, which is most visits until
-- the habit forms — not "no spinal work".
--
-- It is part of the record and as immutable as the rest of the row: the
-- `treatments_immutable` trigger compares the whole row, so this column is
-- covered without changing it.
--
-- Not the body map. That is one picture of the patient, kept current; this is
-- what happened at one visit, and stays as it was.

alter table public.treatments
  add column if not exists spine_levels text[] not null default '{}';

comment on column public.treatments.spine_levels is
  'Spinal levels worked on at this visit, from the spine model: C2, C2 L, L4/L5, Sacrum, SI R, Coccyx. Top to bottom; empty means none marked.';

-- Marks on the body map's two figures — Servier's musculature, front and back.
--
-- The rotatable skeleton is retired as the place a finding is marked: a body
-- with muscles, seen from the front and from behind, is what a practitioner
-- and a patient both read at a glance, and naming an area is one tap rather
-- than a hunt for the right angle.
--
-- What is stored is still anatomy, not pixels: the areas a mark covers by id
-- (`buttock:r`, `sacrum`), the spinal levels by name (`L4`), the kinds of
-- finding, and a note. The ink is kept too, as fractions of the figure it was
-- drawn on — safe only because a figure never moves, and never the record.
--
-- Its own column. body_map_3d keeps the skeleton's marks exactly as they were
-- made; the chart shows them, read-only, as earlier findings.

alter table public.patients
  add column if not exists body_map jsonb;

comment on column public.patients.body_map is
  'Marks on the front/back body figures: areas by id, spinal levels, kinds of finding, a note, and strokes as fractions of the figure. Null means none.';

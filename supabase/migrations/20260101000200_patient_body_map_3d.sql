-- Marks made on the rotatable skeleton, on the patient's own record.
--
-- The three static diagrams stored a dot as a percentage inside one of three
-- fixed pictures: `{view: "back", x: 41.2, y: 63.8}`. That is a position on a
-- drawing, and it only means something because the drawing never moves. There
-- is no drawing here — the practitioner turns the body to whatever angle the
-- finding is visible from — so a percentage of a viewport would mean nothing
-- the moment the model was turned again.
--
-- What is stored instead is anatomy: the bones a mark covers, by name, and the
-- ink as positions on the skeleton's own surface. `Scapula L, Rib 6L, T5` is
-- readable years later by a person who never saw the screen it was drawn on,
-- and survives the model being redrawn — which a pixel offset would not.
--
-- Its own column, not an extension of body_map_marks: the two hold different
-- things, and three patients already have 2D marks that must keep rendering
-- exactly as they were made.

alter table public.patients
  add column if not exists body_map_3d jsonb;

comment on column public.patients.body_map_3d is
  'Marks on the 3D skeleton: bones by name, strokes as positions on the bone surface, a note, and the camera the mark was made from. Null means none.';

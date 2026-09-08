-- How many sessions this patient's course of treatment is meant to run to.
--
-- The chart showed "0 / 10" for every patient in the clinic. The ten was the
-- practice-wide default from the settings file, not a plan anybody had agreed
-- with the person whose chart it was — so the progress bar measured real visits
-- against an invented target, and a patient booked for three sessions read as
-- 30% of the way through a course nobody had prescribed.
--
-- Null means no plan has been set, and the chart then falls back to the
-- practice default rather than inventing a target of its own. That distinction
-- is the point of the column: "nobody has decided yet" and "the plan is ten"
-- look identical in a number and mean different things to a practitioner.

alter table public.patients
  add column if not exists care_plan_sessions integer
    check (care_plan_sessions is null or care_plan_sessions between 1 and 200);

comment on column public.patients.care_plan_sessions is
  'Sessions this patient''s care plan runs to. Null means none set; the chart falls back to the clinic default.';

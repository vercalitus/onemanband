-- Where an imported patient came from.
--
-- The clinic's history is split across two systems that never knew about each
-- other: a bookkeeping account that only knows who was invoiced, and a folder
-- of treatment files that only knows who was treated. Neither holds an id the
-- other would recognise, so the records are joined on the one thing they share
-- — a person's name — and a name is a guess, not a key.
--
-- So each imported patient carries the evidence it was built from: which source
-- named them, exactly how that source spelled it, and how confident the match
-- was. When someone later asks why two records were merged, or why a treatment
-- file is attached to this patient, the answer is on the row rather than in
-- somebody's memory of a migration.
--
-- Expected shape:
--   { "sumitName": "...", "driveFile": "...", "match": "exact|near|none",
--     "importedAt": "..." }

alter table public.patients
  add column if not exists import_source jsonb;

-- Finding a patient by the name a source used, which is what the later steps
-- (phone numbers, treatment files) have to do.
create index if not exists patients_import_source_idx
  on public.patients using gin (import_source);

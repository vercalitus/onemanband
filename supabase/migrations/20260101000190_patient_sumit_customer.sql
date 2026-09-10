-- Which customer card in the bookkeeping system this patient is.
--
-- The app matches a patient to a SUMIT customer with
-- `SearchMode: ExternalIdentifier` and our patient UUID, which works perfectly
-- from the first document onwards — SUMIT writes the identifier onto the card
-- it creates and finds it every time after. It cannot work for anyone Martin
-- billed before this app existed: 519 of the 1,181 patients already have a
-- card, none of them carries our identifier, and the first invoice for any of
-- them would have opened a second card and split their history.
--
-- So the link is stored. Filled from SUMIT's own document history for the
-- patients who already have a card, and captured from the response the first
-- time a document is filed for anyone who does not.
--
-- `bigint`: SUMIT customer ids are past 2^31 (the QA card that proved this was
-- 2,355,169,959).

alter table public.patients
  add column if not exists sumit_customer_id bigint;

comment on column public.patients.sumit_customer_id is
  'SUMIT customer card id. Sent as Customer.ID with SearchMode None so an '
  'existing card is used instead of a duplicate being created. Null means no '
  'card is known and SUMIT will create one on the first document.';

-- Two patients pointing at one card would mean two people sharing a
-- bookkeeping file — a worse failure than the duplicate this prevents.
create unique index if not exists patients_sumit_customer_id_key
  on public.patients (sumit_customer_id)
  where sumit_customer_id is not null;

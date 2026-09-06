-- Bring `finances` up to what a billing record in this clinic actually holds.
--
-- The table was designed before the bookkeeping integration existed, so it can
-- say how much is owed but not what was treated, how the money arrived, or
-- which tax document was filed against it — and that last one is the part that
-- must never be lost. A filed invoice-receipt cannot be deleted; the only
-- lawful undo is a credit note pointing back at it, so the link to the
-- document is the thing that makes a correction possible at all.

alter table public.finances
  -- Which kind of visit this bills. Kept on the row rather than joined from the
  -- appointment: an invoice can outlive the appointment it came from, and what
  -- was billed must not change when a diary entry is edited.
  add column if not exists treatment_type text,
  -- How the money actually arrived. This becomes the receipt half of the tax
  -- document, so it is a fact about the payment, not a preference.
  add column if not exists payment_method text,
  -- The date the invoice was issued, as distinct from the row's creation.
  add column if not exists issued_at date,
  -- Where the filing stands with the bookkeeping provider: pending, synced,
  -- failed, simulated. Mirrors InvoiceSyncStatus.
  add column if not exists sync_status text not null default 'pending',
  add column if not exists sync_error text,
  -- The filed document itself — provider, document id and number, customer
  -- card, download URL, whether it is still a draft. Stored whole because it is
  -- one artifact and its parts are meaningless apart.
  add column if not exists tax_document jsonb;

-- The clinic bills in shekels. USD was a scaffolding default and no row has
-- ever used it.
alter table public.finances
  alter column currency set default 'ILS';

-- The two questions the Billing page asks on every load: what is outstanding,
-- and what happened recently.
create index if not exists finances_clinic_open_idx
  on public.finances (clinic_id, due_date)
  where payment_status <> 'paid';

create index if not exists finances_clinic_recent_idx
  on public.finances (clinic_id, created_at desc);

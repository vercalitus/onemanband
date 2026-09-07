-- A calendar subscription secret per clinic.
--
-- The first version of this feature kept one token in an environment variable
-- and returned every appointment in the database. That is fine for one clinic
-- and wrong the moment there are two: the second practitioner's link would show
-- them the first one's day.
--
-- So the token belongs to the clinic, and the feed returns only that clinic's
-- appointments. It also makes the secret replaceable by the person who holds
-- it — a leaked link is fixed from Settings rather than by editing a deploy.
--
-- Null until someone asks for their link; the token is minted on first use
-- rather than handed to clinics that may never want one.

alter table public.clinics
  add column if not exists calendar_feed_token text;

-- Two clinics must never share a token: the feed identifies a clinic by it, so
-- a collision would be a data leak rather than an inconvenience.
create unique index if not exists clinics_calendar_feed_token_key
  on public.clinics (calendar_feed_token)
  where calendar_feed_token is not null;

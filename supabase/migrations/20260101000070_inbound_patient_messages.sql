-- Somewhere for a patient's own words to land.
--
-- The post-treatment message tells the patient "if anything feels sore or off
-- after the treatment, message me here directly". Until now the webhook
-- understood button taps and nothing else, so a reply in words was parsed,
-- found uninteresting, and acknowledged with a 200. A patient reporting sharp
-- pain reached no one.
--
-- That is not a missing feature, it is the clinic promising to listen and then
-- not listening, so an inbound message is stored exactly like any other thing
-- a patient did — as an open item only a person can close.

alter type public.patient_response_kind add value if not exists 'message';

alter table public.patient_responses
  -- What they actually wrote. Free text, and the only field in this schema
  -- that carries a patient's own voice, so it is never truncated or parsed
  -- into a category.
  add column if not exists body text,
  -- The number it came from, for the case where the message arrives before
  -- anything can be matched to a patient.
  add column if not exists from_address text;

-- A patient picking a time for a visit that does not exist yet.
--
-- The enum predates the case: until now every slot a patient could pick
-- belonged to a booking already in the diary, so the only kind available was
-- 'rescheduled'. Closing a session with nothing booked sends an invitation to
-- pick a first time, and recording that as a reschedule would have moved the
-- visit that had just ended.
alter type public.patient_response_kind add value if not exists 'booked';

-- Take the tables away from the anonymous role.
--
-- `init_schema` says plainly that `anon` gets no access, and grants nothing to
-- it. Supabase grants it anyway: the platform ships default privileges on the
-- public schema, so every table these migrations create inherits SELECT,
-- INSERT, UPDATE and DELETE for `anon` regardless of intent.
--
-- Nothing leaked. Row-level security refused every row, and an insert was
-- rejected — verified against the live project. But that leaves one mechanism
-- standing between an anonymous caller and 1,178 medical records, and a single
-- over-permissive policy written a year from now would be the whole story.
-- Grants are the second lock, and they were not locked.
--
-- Safe to revoke, because nothing anonymous reads a table:
--   * the patient-facing pages (/book, /r, /q) go through server routes that
--     check the capability token and use the service role
--   * login, MFA and sign-out talk to GoTrue, not to tables
--   * a signed-in practitioner is `authenticated`, not `anon`
--
-- Functions are deliberately left alone: without table access they return
-- nothing worth having, and revoking EXECUTE wholesale risks breaking policy
-- helpers for no gain.

revoke all on all tables in schema public from anon;
revoke all on all sequences in schema public from anon;

-- And for tables created after this migration, which is where the original
-- intent was lost.
alter default privileges in schema public revoke all on tables from anon;
alter default privileges in schema public revoke all on sequences from anon;

-- `usage` on the schema stays: PostgREST needs it to answer at all, and
-- answering "you may not" is better than failing to answer.

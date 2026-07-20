-- ===========================================================================
-- Private patient-media storage (X-ray / MRI / documents)
--
-- Highest-risk data in the system. This bucket is PRIVATE: files are never
-- served by public URL — the app hands out short-lived signed URLs instead.
-- Access is clinic-scoped, mirroring the row-level security on the tables.
--
-- Path convention (enforced by the policies below):
--     <clinic_id>/<patient_id>/<filename>
-- The first path segment is the clinic id, so a user can only reach files
-- under their own clinic's folder.
--
-- Apply after schema.sql (needs public.current_user_clinic_id / is_clinician /
-- is_admin). Like schema.sql, this is applied outside the migration chain for
-- now — see the migration-chain note in the repo.
-- ===========================================================================

-- Private bucket (public = false). Idempotent.
insert into storage.buckets (id, name, public)
values ('patient-media', 'patient-media', false)
on conflict (id) do update set public = false;

-- storage.objects already has RLS enabled by Supabase; (re)create our policies.
drop policy if exists "patient_media_select" on storage.objects;
drop policy if exists "patient_media_insert" on storage.objects;
drop policy if exists "patient_media_update" on storage.objects;
drop policy if exists "patient_media_delete" on storage.objects;

-- Read: any clinic member, own clinic's folder only.
create policy "patient_media_select"
on storage.objects for select to authenticated
using (
  bucket_id = 'patient-media'
  and (storage.foldername(name))[1] = public.current_user_clinic_id()::text
);

-- Upload: clinicians, into their own clinic's folder.
create policy "patient_media_insert"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'patient-media'
  and (storage.foldername(name))[1] = public.current_user_clinic_id()::text
  and public.is_clinician()
);

-- Update (e.g. re-upload/replace): clinicians, own clinic's folder.
create policy "patient_media_update"
on storage.objects for update to authenticated
using (
  bucket_id = 'patient-media'
  and (storage.foldername(name))[1] = public.current_user_clinic_id()::text
)
with check (
  bucket_id = 'patient-media'
  and (storage.foldername(name))[1] = public.current_user_clinic_id()::text
);

-- Delete: admins only, own clinic's folder.
create policy "patient_media_delete"
on storage.objects for delete to authenticated
using (
  bucket_id = 'patient-media'
  and (storage.foldername(name))[1] = public.current_user_clinic_id()::text
  and public.is_admin()
);

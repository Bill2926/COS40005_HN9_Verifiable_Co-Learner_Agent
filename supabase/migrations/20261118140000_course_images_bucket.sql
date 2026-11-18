-- Images the lecturer uploads into a course's materials. Students read them;
-- only the course's lecturer writes them, under a folder named for the course.

-- plpgsql, so the body is not checked until it runs and auth.jwt() need not exist at migration time.
create function public.owns_course(course_key text)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  return exists (
    select 1 from public.courses
    where id = course_key
      and lower(owner_email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  );
end;
$$;

revoke all on function public.owns_course(text) from public, anon;
grant execute on function public.owns_course(text) to authenticated, service_role;

-- Present only on Supabase, which has Storage.
do $$
begin
  if exists (
    select 1 from information_schema.tables
    where table_schema = 'storage' and table_name = 'buckets'
  ) then
    -- Public so a stored image address stays valid in the course spec.
    insert into storage.buckets (id, name, public)
    values ('course-images', 'course-images', true)
    on conflict (id) do nothing;
  end if;

  if exists (
    select 1 from information_schema.tables
    where table_schema = 'storage' and table_name = 'objects'
  ) then
    execute 'drop policy if exists course_images_select on storage.objects';
    execute 'drop policy if exists course_images_insert_owner on storage.objects';
    execute 'drop policy if exists course_images_update_owner on storage.objects';
    execute 'drop policy if exists course_images_delete_owner on storage.objects';
    execute $policy$
      create policy course_images_select on storage.objects
      for select to authenticated
      using (bucket_id = 'course-images')
    $policy$;
    execute $policy$
      create policy course_images_insert_owner on storage.objects
      for insert to authenticated
      with check (
        bucket_id = 'course-images'
        and public.owns_course((storage.foldername(name))[1])
      )
    $policy$;
    execute $policy$
      create policy course_images_update_owner on storage.objects
      for update to authenticated
      using (
        bucket_id = 'course-images'
        and public.owns_course((storage.foldername(name))[1])
      )
    $policy$;
    execute $policy$
      create policy course_images_delete_owner on storage.objects
      for delete to authenticated
      using (
        bucket_id = 'course-images'
        and public.owns_course((storage.foldername(name))[1])
      )
    $policy$;
  end if;
end;
$$;

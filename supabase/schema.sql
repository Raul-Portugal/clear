-- Clear sync schema (only touches clear_tasks, clear_tags, clear_dumps and the clear-audio storage bucket; additive and idempotent). Paste into Supabase -> SQL Editor -> Run. Safe to re-run.

do $$
declare t text;
begin
  foreach t in array array['clear_tasks','clear_tags','clear_dumps'] loop
    execute format($f$
      create table if not exists public.%1$I (
        user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
        id text not null,
        data jsonb not null,
        updated_at bigint not null,
        primary key (user_id, id)
      )$f$, t);
    execute format('create index if not exists %I on public.%I (user_id, updated_at)', t || '_user_updated_idx', t);
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists %I on public.%I', t || '_own', t);
    execute format($f$
      create policy %I on public.%I for all to authenticated
      using ((select auth.uid()) = user_id)
      with check ((select auth.uid()) = user_id)$f$, t || '_own', t);
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;

-- Voice recordings: a private bucket, one folder per user (<user_id>/<audio id>).
insert into storage.buckets (id, name, public)
values ('clear-audio', 'clear-audio', false)
on conflict (id) do nothing;

drop policy if exists clear_audio_own on storage.objects;
create policy clear_audio_own on storage.objects for all to authenticated
  using (bucket_id = 'clear-audio' and (storage.foldername(name))[1] = (select auth.uid())::text)
  with check (bucket_id = 'clear-audio' and (storage.foldername(name))[1] = (select auth.uid())::text);

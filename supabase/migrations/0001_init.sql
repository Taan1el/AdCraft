-- AdCraft schema. Run this once in the Supabase SQL editor after creating the project.
-- Sets up the analyses table, RLS so users only see their own rows, a Storage bucket
-- for ad images, and a trigger that keeps each user's history capped at 10 rows.

-- 1. Table -------------------------------------------------------------------
create table if not exists public.analyses (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  created_at   timestamptz not null default now(),
  file_name    text,
  image_path   text,                        -- key inside the 'ads' storage bucket
  ad_type      text not null,
  overall      int  not null,
  scores       jsonb not null,              -- CategoryScores
  metrics      jsonb not null,              -- whitespace, density, contrast, ctaSaliency
  summary      text,
  source       text not null default 'local'  -- 'local' | 'gemini'
);

create index if not exists analyses_user_created_idx
  on public.analyses (user_id, created_at desc);

-- 2. Row Level Security ------------------------------------------------------
alter table public.analyses enable row level security;

create policy "users read own analyses"
  on public.analyses for select
  using (auth.uid() = user_id);

create policy "users insert own analyses"
  on public.analyses for insert
  with check (auth.uid() = user_id);

create policy "users delete own analyses"
  on public.analyses for delete
  using (auth.uid() = user_id);

-- 3. Storage bucket for ad images -------------------------------------------
insert into storage.buckets (id, name, public)
  values ('ads', 'ads', false)
  on conflict (id) do nothing;

create policy "owners read ad images"
  on storage.objects for select
  using (bucket_id = 'ads' and auth.uid()::text = (storage.foldername(name))[1]);

create policy "owners write ad images"
  on storage.objects for insert
  with check (bucket_id = 'ads' and auth.uid()::text = (storage.foldername(name))[1]);

create policy "owners delete ad images"
  on storage.objects for delete
  using (bucket_id = 'ads' and auth.uid()::text = (storage.foldername(name))[1]);

-- 4. Cap each user at 10 rows -----------------------------------------------
-- After insert, delete this user's oldest rows so only 10 remain. The image
-- objects in Storage are NOT auto-deleted; your app code should also clean them
-- when it deletes a row (or set up a Storage lifecycle rule).
create or replace function public.trim_analyses_to_10()
returns trigger
language plpgsql
security definer
as $$
begin
  delete from public.analyses
  where id in (
    select id
    from public.analyses
    where user_id = new.user_id
    order by created_at desc
    offset 10
  );
  return new;
end
$$;

drop trigger if exists trim_analyses_after_insert on public.analyses;
create trigger trim_analyses_after_insert
  after insert on public.analyses
  for each row execute function public.trim_analyses_to_10();

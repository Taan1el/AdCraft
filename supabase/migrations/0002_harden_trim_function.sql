-- Pin the SECURITY DEFINER function's object lookup path on existing projects.
create or replace function public.trim_analyses_to_10()
returns trigger
language plpgsql
security definer
set search_path = ''
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

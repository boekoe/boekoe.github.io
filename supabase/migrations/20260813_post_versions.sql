create table if not exists public.post_versions (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts(id) on delete cascade,
  body text not null check (char_length(body) <= 2000),
  created_at timestamptz not null default now()
);

create index if not exists post_versions_post_id_idx on public.post_versions(post_id, created_at desc);

create or replace function public.capture_post_version()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  if old.body is distinct from new.body then
    insert into post_versions (post_id, body) values (old.id, old.body);
  end if;
  return new;
end;
$$;

drop trigger if exists posts_capture_version on public.posts;
create trigger posts_capture_version before update of body on public.posts for each row execute procedure public.capture_post_version();

alter table public.post_versions enable row level security;

drop policy if exists "Versions follow post visibility" on public.post_versions;
create policy "Versions follow post visibility" on public.post_versions for select to authenticated using (
  exists (select 1 from public.posts p where p.id = post_versions.post_id)
);

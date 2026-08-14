alter table public.posts add column if not exists poll_data jsonb;

create table if not exists public.poll_votes (
  post_id uuid not null references public.posts(id) on delete cascade,
  option_id uuid not null,
  user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);

alter table public.poll_votes enable row level security;
grant select, insert, delete on public.poll_votes to authenticated;

drop policy if exists "Poll votes are readable" on public.poll_votes;
create policy "Poll votes are readable" on public.poll_votes for select to authenticated using (true);
drop policy if exists "Users vote in polls" on public.poll_votes;
create policy "Users vote in polls" on public.poll_votes for insert to authenticated with check (user_id = auth.uid());
drop policy if exists "Users change poll vote" on public.poll_votes;
create policy "Users change poll vote" on public.poll_votes for delete to authenticated using (user_id = auth.uid());

create index if not exists poll_votes_post_id_idx on public.poll_votes(post_id);

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'poll_votes'
  ) then
    alter publication supabase_realtime add table public.poll_votes;
  end if;
end $$;

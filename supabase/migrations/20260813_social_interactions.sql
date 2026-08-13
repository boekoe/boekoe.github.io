alter table public.posts add column if not exists poll_data jsonb;
alter table public.comments add column if not exists parent_id uuid references public.comments(id) on delete cascade;
alter table public.likes add column if not exists reaction_type text not null default 'like';

alter table public.posts drop constraint if exists posts_visibility_check;
update public.posts set visibility = 'friends' where visibility = 'followers';
alter table public.posts add constraint posts_visibility_check check (visibility in ('public', 'private', 'friends'));
alter table public.posts drop constraint if exists posts_check;
alter table public.posts drop constraint if exists posts_content_check;
alter table public.posts add constraint posts_content_check check (char_length(body) > 0 or image_url is not null or poll_data is not null);

alter table public.likes drop constraint if exists likes_reaction_type_check;
alter table public.likes add constraint likes_reaction_type_check check (reaction_type in ('like','love','laugh','wow','sad','fire'));

create table if not exists public.comment_likes (
  comment_id uuid not null references public.comments(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (comment_id, user_id)
);

create table if not exists public.poll_votes (
  post_id uuid not null references public.posts(id) on delete cascade,
  option_id uuid not null,
  user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);

alter table public.comment_likes enable row level security;
alter table public.poll_votes enable row level security;

drop policy if exists "Users see blocks involving them" on public.blocks;
create policy "Users see blocks involving them" on public.blocks for select to authenticated using (blocker_id = auth.uid() or blocked_id = auth.uid());

drop policy if exists "Profiles are visible to signed-in users" on public.profiles;
create policy "Profiles are visible to signed-in users" on public.profiles for select to authenticated using (
  id = auth.uid() or not exists (select 1 from public.blocks b where (b.blocker_id = auth.uid() and b.blocked_id = profiles.id) or (b.blocker_id = profiles.id and b.blocked_id = auth.uid()))
);

drop policy if exists "Visible posts can be read" on public.posts;
create policy "Visible posts can be read" on public.posts for select to authenticated using (
  user_id = auth.uid() or
  (not exists (select 1 from public.blocks b where (b.blocker_id = auth.uid() and b.blocked_id = posts.user_id) or (b.blocker_id = posts.user_id and b.blocked_id = auth.uid())) and (
    visibility = 'public' or
    (visibility = 'friends'
      and exists (select 1 from public.follows f where f.follower_id = auth.uid() and f.following_id = posts.user_id)
      and exists (select 1 from public.follows f where f.follower_id = posts.user_id and f.following_id = auth.uid()))
  ))
);

drop policy if exists "Users change reactions" on public.likes;
create policy "Users change reactions" on public.likes for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "Comment likes are readable" on public.comment_likes;
create policy "Comment likes are readable" on public.comment_likes for select to authenticated using (true);
drop policy if exists "Users like comments" on public.comment_likes;
create policy "Users like comments" on public.comment_likes for insert to authenticated with check (user_id = auth.uid());
drop policy if exists "Users remove comment likes" on public.comment_likes;
create policy "Users remove comment likes" on public.comment_likes for delete to authenticated using (user_id = auth.uid());

drop policy if exists "Poll votes are readable" on public.poll_votes;
create policy "Poll votes are readable" on public.poll_votes for select to authenticated using (true);
drop policy if exists "Users vote in polls" on public.poll_votes;
create policy "Users vote in polls" on public.poll_votes for insert to authenticated with check (user_id = auth.uid());
drop policy if exists "Users change poll vote" on public.poll_votes;
create policy "Users change poll vote" on public.poll_votes for delete to authenticated using (user_id = auth.uid());

create index if not exists comments_parent_id_idx on public.comments(parent_id);
create index if not exists comment_likes_comment_id_idx on public.comment_likes(comment_id);
create index if not exists poll_votes_post_id_idx on public.poll_votes(post_id);

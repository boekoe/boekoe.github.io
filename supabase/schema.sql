-- Boekoe database schema for Supabase
-- Run this entire file once in Supabase > SQL Editor.

create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text not null unique check (username ~ '^[a-zA-Z0-9_.]{3,30}$'),
  full_name text not null check (char_length(full_name) between 2 and 80),
  bio text not null default '' check (char_length(bio) <= 160),
  location text not null default 'Suriname' check (char_length(location) <= 80),
  avatar_url text not null default '',
  cover_url text not null default '',
  verified boolean not null default false,
  is_admin boolean not null default false,
  followers_count integer not null default 0,
  following_count integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.posts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  body text not null default '' check (char_length(body) <= 2000),
  image_url text,
  visibility text not null default 'public' check (visibility in ('public', 'followers')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (char_length(body) > 0 or image_url is not null)
);

create table if not exists public.comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 1000),
  created_at timestamptz not null default now()
);

create table if not exists public.likes (
  post_id uuid not null references public.posts(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);

create table if not exists public.follows (
  follower_id uuid not null references public.profiles(id) on delete cascade,
  following_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (follower_id, following_id),
  check (follower_id <> following_id)
);

create table if not exists public.blocks (
  blocker_id uuid not null references public.profiles(id) on delete cascade,
  blocked_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  check (blocker_id <> blocked_id)
);

create table if not exists public.reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references public.profiles(id) on delete cascade,
  reporter_name text not null default 'Gebruiker',
  post_id uuid not null references public.posts(id) on delete cascade,
  reason text not null check (char_length(reason) between 3 and 120),
  details text not null default '' check (char_length(details) <= 1000),
  status text not null default 'open' check (status in ('open', 'reviewed', 'removed')),
  created_at timestamptz not null default now(),
  unique (reporter_id, post_id)
);

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  actor_id uuid references public.profiles(id) on delete cascade,
  kind text not null check (kind in ('like', 'comment', 'follow', 'system')),
  text text not null check (char_length(text) <= 240),
  post_id uuid references public.posts(id) on delete cascade,
  read boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists posts_created_at_idx on public.posts(created_at desc);
create index if not exists posts_user_id_idx on public.posts(user_id);
create index if not exists comments_post_id_idx on public.comments(post_id, created_at);
create index if not exists notifications_user_id_idx on public.notifications(user_id, created_at desc);
create index if not exists reports_status_idx on public.reports(status, created_at desc);

-- Automatically create a safe profile for every new account.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public
as $$
declare
  requested_username text;
begin
  requested_username := regexp_replace(lower(coalesce(new.raw_user_meta_data ->> 'username', split_part(new.email, '@', 1))), '[^a-z0-9_.]', '', 'g');
  if char_length(requested_username) < 3 then requested_username := 'user_' || substr(new.id::text, 1, 8); end if;
  if exists (select 1 from public.profiles where username = requested_username) then requested_username := requested_username || '_' || substr(new.id::text, 1, 5); end if;
  insert into public.profiles (id, username, full_name)
  values (new.id, requested_username, left(coalesce(nullif(new.raw_user_meta_data ->> 'full_name', ''), 'Boekoe gebruiker'), 80));
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users for each row execute procedure public.handle_new_user();

-- Keep follower counters correct without trusting the browser.
create or replace function public.update_follow_counts()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    update profiles set following_count = following_count + 1 where id = new.follower_id;
    update profiles set followers_count = followers_count + 1 where id = new.following_id;
  elsif tg_op = 'DELETE' then
    update profiles set following_count = greatest(0, following_count - 1) where id = old.follower_id;
    update profiles set followers_count = greatest(0, followers_count - 1) where id = old.following_id;
  end if;
  return coalesce(new, old);
end;
$$;

drop trigger if exists follows_update_counts on public.follows;
create trigger follows_update_counts after insert or delete on public.follows for each row execute procedure public.update_follow_counts();

-- Create private in-app notifications.
create or replace function public.create_social_notification()
returns trigger language plpgsql security definer set search_path = public
as $$
declare target_user uuid;
begin
  if tg_table_name = 'likes' then
    select user_id into target_user from posts where id = new.post_id;
    if target_user <> new.user_id then insert into notifications(user_id, actor_id, kind, text, post_id) values(target_user, new.user_id, 'like', 'vindt je bericht leuk', new.post_id); end if;
  elsif tg_table_name = 'comments' then
    select user_id into target_user from posts where id = new.post_id;
    if target_user <> new.user_id then insert into notifications(user_id, actor_id, kind, text, post_id) values(target_user, new.user_id, 'comment', 'reageerde op je bericht', new.post_id); end if;
  elsif tg_table_name = 'follows' then
    insert into notifications(user_id, actor_id, kind, text) values(new.following_id, new.follower_id, 'follow', 'is je gaan volgen');
  end if;
  return new;
end;
$$;

drop trigger if exists likes_notify on public.likes;
create trigger likes_notify after insert on public.likes for each row execute procedure public.create_social_notification();
drop trigger if exists comments_notify on public.comments;
create trigger comments_notify after insert on public.comments for each row execute procedure public.create_social_notification();
drop trigger if exists follows_notify on public.follows;
create trigger follows_notify after insert on public.follows for each row execute procedure public.create_social_notification();

-- Row Level Security: the anon key is safe in the web app because every write is checked here.
alter table public.profiles enable row level security;
alter table public.posts enable row level security;
alter table public.comments enable row level security;
alter table public.likes enable row level security;
alter table public.follows enable row level security;
alter table public.blocks enable row level security;
alter table public.reports enable row level security;
alter table public.notifications enable row level security;

create policy "Profiles are visible to signed-in users" on public.profiles for select to authenticated using (true);
create policy "Users edit their profile" on public.profiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid());
-- Do not let a browser promote itself to admin or verified by calling the API directly.
revoke update on public.profiles from authenticated;
grant update (username, full_name, bio, location, avatar_url, cover_url) on public.profiles to authenticated;

create policy "Visible posts can be read" on public.posts for select to authenticated using (
  user_id = auth.uid() or
  (visibility = 'public' and not exists (select 1 from public.blocks b where b.blocker_id = auth.uid() and b.blocked_id = posts.user_id)) or
  (visibility = 'followers' and exists (select 1 from public.follows f where f.follower_id = auth.uid() and f.following_id = posts.user_id))
);
create policy "Users create their own posts" on public.posts for insert to authenticated with check (user_id = auth.uid());
create policy "Authors update posts" on public.posts for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "Authors or admins delete posts" on public.posts for delete to authenticated using (user_id = auth.uid() or exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin));

create policy "Comments are readable" on public.comments for select to authenticated using (exists (select 1 from public.posts p where p.id = comments.post_id));
create policy "Users create comments" on public.comments for insert to authenticated with check (user_id = auth.uid());
create policy "Authors delete comments" on public.comments for delete to authenticated using (user_id = auth.uid());

create policy "Likes are readable" on public.likes for select to authenticated using (true);
create policy "Users create likes" on public.likes for insert to authenticated with check (user_id = auth.uid());
create policy "Users remove likes" on public.likes for delete to authenticated using (user_id = auth.uid());

create policy "Follows are readable" on public.follows for select to authenticated using (true);
create policy "Users create follows" on public.follows for insert to authenticated with check (follower_id = auth.uid());
create policy "Users remove follows" on public.follows for delete to authenticated using (follower_id = auth.uid());

create policy "Users manage own blocks" on public.blocks for all to authenticated using (blocker_id = auth.uid()) with check (blocker_id = auth.uid());
create policy "Users file reports" on public.reports for insert to authenticated with check (reporter_id = auth.uid());
create policy "Users and admins see relevant reports" on public.reports for select to authenticated using (reporter_id = auth.uid() or exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin));
create policy "Admins update reports" on public.reports for update to authenticated using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin));

create policy "Users read notifications" on public.notifications for select to authenticated using (user_id = auth.uid());
create policy "Users update notifications" on public.notifications for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Public media bucket. File ownership and an 8 MB browser limit are enforced by the app and folder policy.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('post-media', 'post-media', true, 8388608, array['image/jpeg','image/png','image/webp','image/gif'])
on conflict (id) do update set public = excluded.public, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

create policy "Public post media can be viewed" on storage.objects for select using (bucket_id = 'post-media');
create policy "Users upload to own folder" on storage.objects for insert to authenticated with check (bucket_id = 'post-media' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "Users delete own media" on storage.objects for delete to authenticated using (bucket_id = 'post-media' and owner_id = auth.uid()::text);

-- Enable Postgres Changes for the live feed (safe to run repeatedly).
do $$
begin
  if not exists (
    select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'posts'
  ) then
    alter publication supabase_realtime add table public.posts;
  end if;
end $$;

-- Optional: make your first account an admin after signing up.
-- update public.profiles set is_admin = true, verified = true where username = 'jouw_gebruikersnaam';

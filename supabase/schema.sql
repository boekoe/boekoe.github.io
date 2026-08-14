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
  image_urls text[] not null default '{}',
  visibility text not null default 'public' check (visibility in ('public', 'private', 'friends')),
  poll_data jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (char_length(body) > 0 or image_url is not null or poll_data is not null)
);

create table if not exists public.comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  parent_id uuid references public.comments(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 1000),
  created_at timestamptz not null default now()
);

create table if not exists public.likes (
  post_id uuid not null references public.posts(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  reaction_type text not null default 'like' check (reaction_type in ('like','love','laugh','wow','sad','fire')),
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);

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

create table if not exists public.post_versions (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts(id) on delete cascade,
  body text not null check (char_length(body) <= 2000),
  created_at timestamptz not null default now()
);

-- Preserve the old text automatically so edit history cannot be forged by the browser.
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

create table if not exists public.direct_messages (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid not null references public.profiles(id) on delete cascade,
  recipient_id uuid not null references public.profiles(id) on delete cascade,
  body text,
  reply_to uuid references public.direct_messages(id) on delete set null,
  attachment_path text,
  edited_at timestamptz,
  deleted_at timestamptz,
  reactions jsonb not null default '{}'::jsonb check (jsonb_typeof(reactions) = 'object'),
  read boolean not null default false,
  created_at timestamptz not null default now(),
  check (sender_id <> recipient_id),
  constraint direct_messages_content_check check (
    coalesce(char_length(body), 0) <= 2000 and
    (deleted_at is not null or coalesce(char_length(btrim(body)), 0) > 0 or attachment_path is not null)
  )
);

create index if not exists posts_created_at_idx on public.posts(created_at desc);
create index if not exists posts_user_id_idx on public.posts(user_id);
create index if not exists post_versions_post_id_idx on public.post_versions(post_id, created_at desc);
create index if not exists comments_post_id_idx on public.comments(post_id, created_at);
create index if not exists notifications_user_id_idx on public.notifications(user_id, created_at desc);
create index if not exists reports_status_idx on public.reports(status, created_at desc);
create index if not exists direct_messages_sender_idx on public.direct_messages(sender_id, created_at desc);
create index if not exists direct_messages_recipient_idx on public.direct_messages(recipient_id, created_at desc);
create index if not exists direct_messages_reply_to_idx on public.direct_messages(reply_to) where reply_to is not null;

create or replace function public.direct_message_reply_matches(message_id uuid, message_sender uuid, message_recipient uuid)
returns boolean language sql stable security definer set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.direct_messages parent
    where parent.id = message_id and (
      (parent.sender_id = message_sender and parent.recipient_id = message_recipient) or
      (parent.sender_id = message_recipient and parent.recipient_id = message_sender)
    )
  );
$$;

revoke all on function public.direct_message_reply_matches(uuid, uuid, uuid) from public;
grant execute on function public.direct_message_reply_matches(uuid, uuid, uuid) to authenticated;

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
alter table public.comment_likes enable row level security;
alter table public.poll_votes enable row level security;
alter table public.post_versions enable row level security;
alter table public.follows enable row level security;
alter table public.blocks enable row level security;
alter table public.reports enable row level security;
alter table public.notifications enable row level security;
alter table public.direct_messages enable row level security;
grant select, insert on public.direct_messages to authenticated;

create policy "Profiles are visible to signed-in users" on public.profiles for select to authenticated using (
  id = auth.uid() or not exists (select 1 from public.blocks b where (b.blocker_id = auth.uid() and b.blocked_id = profiles.id) or (b.blocker_id = profiles.id and b.blocked_id = auth.uid()))
);
create policy "Users edit their profile" on public.profiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid());
-- Do not let a browser promote itself to admin or verified by calling the API directly.
revoke update on public.profiles from authenticated;
grant update (username, full_name, bio, location, avatar_url, cover_url) on public.profiles to authenticated;

create policy "Visible posts can be read" on public.posts for select to authenticated using (
  user_id = auth.uid() or
  (not exists (select 1 from public.blocks b where (b.blocker_id = auth.uid() and b.blocked_id = posts.user_id) or (b.blocker_id = posts.user_id and b.blocked_id = auth.uid())) and (
    visibility = 'public' or
    (visibility = 'friends' and exists (select 1 from public.follows f where f.follower_id = auth.uid() and f.following_id = posts.user_id) and exists (select 1 from public.follows f where f.follower_id = posts.user_id and f.following_id = auth.uid()))
  ))
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
create policy "Users change reactions" on public.likes for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "Comment likes are readable" on public.comment_likes for select to authenticated using (true);
create policy "Users like comments" on public.comment_likes for insert to authenticated with check (user_id = auth.uid());
create policy "Users remove comment likes" on public.comment_likes for delete to authenticated using (user_id = auth.uid());

create policy "Poll votes are readable" on public.poll_votes for select to authenticated using (true);
create policy "Users vote in polls" on public.poll_votes for insert to authenticated with check (user_id = auth.uid());
create policy "Users change poll vote" on public.poll_votes for delete to authenticated using (user_id = auth.uid());

create policy "Versions follow post visibility" on public.post_versions for select to authenticated using (
  exists (select 1 from public.posts p where p.id = post_versions.post_id)
);

create policy "Follows are readable" on public.follows for select to authenticated using (true);
create policy "Users create follows" on public.follows for insert to authenticated with check (follower_id = auth.uid());
create policy "Users remove follows" on public.follows for delete to authenticated using (follower_id = auth.uid());

create policy "Users manage own blocks" on public.blocks for all to authenticated using (blocker_id = auth.uid()) with check (blocker_id = auth.uid());
create policy "Users see blocks involving them" on public.blocks for select to authenticated using (blocker_id = auth.uid() or blocked_id = auth.uid());
create policy "Users file reports" on public.reports for insert to authenticated with check (reporter_id = auth.uid());
create policy "Users and admins see relevant reports" on public.reports for select to authenticated using (reporter_id = auth.uid() or exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin));
create policy "Admins update reports" on public.reports for update to authenticated using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin));

create policy "Users read notifications" on public.notifications for select to authenticated using (user_id = auth.uid());
create policy "Users update notifications" on public.notifications for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "Participants read private messages" on public.direct_messages for select to authenticated using (
  (sender_id = auth.uid() or recipient_id = auth.uid()) and
  not exists (
    select 1 from public.blocks b
    where (b.blocker_id = auth.uid() and b.blocked_id in (direct_messages.sender_id, direct_messages.recipient_id))
       or (b.blocked_id = auth.uid() and b.blocker_id in (direct_messages.sender_id, direct_messages.recipient_id))
  )
);
create policy "Users send private messages" on public.direct_messages for insert to authenticated with check (
  sender_id = auth.uid() and recipient_id <> auth.uid() and deleted_at is null and edited_at is null and
  (attachment_path is null or (
    (storage.foldername(attachment_path))[1] = auth.uid()::text and
    (storage.foldername(attachment_path))[2] = recipient_id::text
  )) and
  (reply_to is null or public.direct_message_reply_matches(reply_to, sender_id, recipient_id)) and
  not exists (
    select 1 from public.blocks b
    where (b.blocker_id = sender_id and b.blocked_id = recipient_id)
       or (b.blocker_id = recipient_id and b.blocked_id = sender_id)
  )
);
create policy "Recipients mark messages read" on public.direct_messages for update to authenticated using (recipient_id = auth.uid()) with check (recipient_id = auth.uid());
revoke update on public.direct_messages from authenticated;
grant update (read) on public.direct_messages to authenticated;

create or replace function public.edit_direct_message(message_id uuid, new_body text)
returns public.direct_messages language plpgsql security definer set search_path = public, pg_temp
as $$
declare updated public.direct_messages;
begin
  if coalesce(char_length(btrim(new_body)), 0) < 1 or char_length(new_body) > 2000 then raise exception 'Berichttekst moet tussen 1 en 2000 tekens zijn'; end if;
  update public.direct_messages set body = btrim(new_body), edited_at = now()
  where id = message_id and sender_id = auth.uid() and deleted_at is null returning * into updated;
  if not found then raise exception 'Bericht kan niet worden bewerkt'; end if;
  return updated;
end;
$$;

create or replace function public.delete_direct_message(message_id uuid)
returns public.direct_messages language plpgsql security definer set search_path = public, pg_temp
as $$
declare updated public.direct_messages;
begin
  update public.direct_messages set body = null, attachment_path = null, deleted_at = now(), edited_at = null, reactions = '{}'::jsonb
  where id = message_id and sender_id = auth.uid() and deleted_at is null returning * into updated;
  if not found then raise exception 'Bericht kan niet worden verwijderd'; end if;
  return updated;
end;
$$;

create or replace function public.toggle_direct_message_reaction(message_id uuid, reaction text)
returns public.direct_messages language plpgsql security definer set search_path = public, pg_temp
as $$
declare updated public.direct_messages;
declare current_reaction text;
begin
  if reaction not in ('👍', '❤️', '😂', '😮', '😢', '🙏') then raise exception 'Ongeldige reactie'; end if;
  select reactions ->> auth.uid()::text into current_reaction from public.direct_messages
  where id = message_id and deleted_at is null and auth.uid() in (sender_id, recipient_id);
  if not found then raise exception 'Bericht niet gevonden'; end if;
  update public.direct_messages set reactions = case
    when current_reaction = reaction then reactions - auth.uid()::text
    else reactions || jsonb_build_object(auth.uid()::text, reaction)
  end where id = message_id returning * into updated;
  return updated;
end;
$$;

revoke all on function public.edit_direct_message(uuid, text) from public;
revoke all on function public.delete_direct_message(uuid) from public;
revoke all on function public.toggle_direct_message_reaction(uuid, text) from public;
grant execute on function public.edit_direct_message(uuid, text) to authenticated;
grant execute on function public.delete_direct_message(uuid) to authenticated;
grant execute on function public.toggle_direct_message_reaction(uuid, text) to authenticated;

-- Public media bucket. File ownership and an 8 MB browser limit are enforced by the app and folder policy.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('post-media', 'post-media', true, 8388608, array['image/jpeg','image/png','image/webp','image/gif'])
on conflict (id) do update set public = excluded.public, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

create policy "Public post media can be viewed" on storage.objects for select using (bucket_id = 'post-media');
create policy "Users upload to own folder" on storage.objects for insert to authenticated with check (bucket_id = 'post-media' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "Users delete own media" on storage.objects for delete to authenticated using (bucket_id = 'post-media' and owner_id = auth.uid()::text);

-- Private chat media. Only both participants may read files; only the sender may upload/delete them.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('chat-media', 'chat-media', false, 8388608, array['image/jpeg','image/png','image/webp','image/gif'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

create policy "Chat participants view media" on storage.objects for select to authenticated using (
  bucket_id = 'chat-media' and auth.uid()::text in ((storage.foldername(name))[1], (storage.foldername(name))[2])
);
create policy "Chat users upload media" on storage.objects for insert to authenticated with check (
  bucket_id = 'chat-media' and (storage.foldername(name))[1] = auth.uid()::text
);
create policy "Chat senders delete media" on storage.objects for delete to authenticated using (
  bucket_id = 'chat-media' and owner_id = auth.uid()::text
);

-- Enable Postgres Changes for the live feed (safe to run repeatedly).
do $$
begin
  if not exists (
    select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'posts'
  ) then
    alter publication supabase_realtime add table public.posts;
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'direct_messages'
  ) then
    alter publication supabase_realtime add table public.direct_messages;
  end if;
end $$;

-- Optional: make your first account an admin after signing up.
-- update public.profiles set is_admin = true, verified = true where username = 'jouw_gebruikersnaam';

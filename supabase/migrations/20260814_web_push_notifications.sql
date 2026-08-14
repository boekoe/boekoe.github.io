-- Native Web Push subscriptions, preferences and private-message notifications.

alter table public.notifications drop constraint if exists notifications_kind_check;
alter table public.notifications drop constraint if exists notifications_target_url_check;
alter table public.notifications
  add column if not exists target_url text,
  add constraint notifications_kind_check check (kind in ('like', 'comment', 'follow', 'message', 'system')),
  add constraint notifications_target_url_check check (target_url is null or target_url ~ '^#/[a-z0-9/_%-]+$');

create table if not exists public.notification_preferences (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  push_enabled boolean not null default true,
  messages_enabled boolean not null default true,
  reactions_enabled boolean not null default true,
  comments_enabled boolean not null default true,
  follows_enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth_key text not null,
  expiration_time bigint,
  user_agent text not null default '',
  platform text not null default 'web',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_success_at timestamptz
);

create index if not exists push_subscriptions_user_id_idx on public.push_subscriptions(user_id);

alter table public.notification_preferences enable row level security;
alter table public.push_subscriptions enable row level security;

grant select, insert, update on public.notification_preferences to authenticated;
grant select, insert, update, delete on public.push_subscriptions to authenticated;

drop policy if exists "Users read own notification preferences" on public.notification_preferences;
create policy "Users read own notification preferences" on public.notification_preferences
  for select to authenticated using (user_id = auth.uid());
drop policy if exists "Users create own notification preferences" on public.notification_preferences;
create policy "Users create own notification preferences" on public.notification_preferences
  for insert to authenticated with check (user_id = auth.uid());
drop policy if exists "Users update own notification preferences" on public.notification_preferences;
create policy "Users update own notification preferences" on public.notification_preferences
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "Users read own push subscriptions" on public.push_subscriptions;
create policy "Users read own push subscriptions" on public.push_subscriptions
  for select to authenticated using (user_id = auth.uid());
drop policy if exists "Users create own push subscriptions" on public.push_subscriptions;
create policy "Users create own push subscriptions" on public.push_subscriptions
  for insert to authenticated with check (user_id = auth.uid());
drop policy if exists "Users update own push subscriptions" on public.push_subscriptions;
create policy "Users update own push subscriptions" on public.push_subscriptions
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists "Users delete own push subscriptions" on public.push_subscriptions;
create policy "Users delete own push subscriptions" on public.push_subscriptions
  for delete to authenticated using (user_id = auth.uid());

create or replace function public.create_social_notification()
returns trigger language plpgsql security definer set search_path = public
as $$
declare target_user uuid;
begin
  if tg_table_name = 'likes' then
    select user_id into target_user from posts where id = new.post_id;
    if target_user <> new.user_id then
      insert into notifications(user_id, actor_id, kind, text, post_id, target_url)
      values(target_user, new.user_id, 'like', 'vindt je bericht leuk', new.post_id, '#/post/' || new.post_id::text);
    end if;
  elsif tg_table_name = 'comments' then
    select user_id into target_user from posts where id = new.post_id;
    if target_user <> new.user_id then
      insert into notifications(user_id, actor_id, kind, text, post_id, target_url)
      values(target_user, new.user_id, 'comment', 'reageerde op je bericht', new.post_id, '#/post/' || new.post_id::text || '/comments');
    end if;
  elsif tg_table_name = 'follows' then
    insert into notifications(user_id, actor_id, kind, text, target_url)
    values(new.following_id, new.follower_id, 'follow', 'wil vrienden worden', '#/profile/' || (select username from profiles where id = new.follower_id));
  end if;
  return new;
end;
$$;

create or replace function public.create_message_notification()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  insert into public.notifications(user_id, actor_id, kind, text, target_url)
  values(new.recipient_id, new.sender_id, 'message', 'stuurde je een privébericht', '#/messages/' || new.sender_id::text);
  return new;
end;
$$;

drop trigger if exists direct_messages_notify on public.direct_messages;
create trigger direct_messages_notify
  after insert on public.direct_messages
  for each row execute procedure public.create_message_notification();

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'notifications'
  ) then
    alter publication supabase_realtime add table public.notifications;
  end if;
end $$;

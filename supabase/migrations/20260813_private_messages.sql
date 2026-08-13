create table if not exists public.direct_messages (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid not null references public.profiles(id) on delete cascade,
  recipient_id uuid not null references public.profiles(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 2000),
  read boolean not null default false,
  created_at timestamptz not null default now(),
  check (sender_id <> recipient_id)
);

create index if not exists direct_messages_sender_idx on public.direct_messages(sender_id, created_at desc);
create index if not exists direct_messages_recipient_idx on public.direct_messages(recipient_id, created_at desc);

alter table public.direct_messages enable row level security;
grant select, insert on public.direct_messages to authenticated;

drop policy if exists "Participants read private messages" on public.direct_messages;
create policy "Participants read private messages" on public.direct_messages for select to authenticated using (
  (sender_id = auth.uid() or recipient_id = auth.uid()) and
  not exists (
    select 1 from public.blocks b
    where (b.blocker_id = auth.uid() and b.blocked_id in (direct_messages.sender_id, direct_messages.recipient_id))
       or (b.blocked_id = auth.uid() and b.blocker_id in (direct_messages.sender_id, direct_messages.recipient_id))
  )
);

drop policy if exists "Users send private messages" on public.direct_messages;
create policy "Users send private messages" on public.direct_messages for insert to authenticated with check (
  sender_id = auth.uid() and recipient_id <> auth.uid() and
  not exists (
    select 1 from public.blocks b
    where (b.blocker_id = sender_id and b.blocked_id = recipient_id)
       or (b.blocker_id = recipient_id and b.blocked_id = sender_id)
  )
);

drop policy if exists "Recipients mark messages read" on public.direct_messages;
create policy "Recipients mark messages read" on public.direct_messages for update to authenticated using (recipient_id = auth.uid()) with check (recipient_id = auth.uid());

revoke update on public.direct_messages from authenticated;
grant update (read) on public.direct_messages to authenticated;

do $$
begin
  if not exists (
    select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'direct_messages'
  ) then
    alter publication supabase_realtime add table public.direct_messages;
  end if;
end $$;

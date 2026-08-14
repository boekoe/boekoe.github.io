-- Full-feature private chat: replies, photos, edits, soft deletion and reactions.
alter table public.direct_messages
  add column if not exists reply_to uuid references public.direct_messages(id) on delete set null,
  add column if not exists attachment_path text,
  add column if not exists edited_at timestamptz,
  add column if not exists deleted_at timestamptz,
  add column if not exists reactions jsonb not null default '{}'::jsonb;

alter table public.direct_messages alter column body drop not null;
alter table public.direct_messages drop constraint if exists direct_messages_body_check;
alter table public.direct_messages drop constraint if exists direct_messages_content_check;
alter table public.direct_messages add constraint direct_messages_content_check check (
  coalesce(char_length(body), 0) <= 2000 and
  (deleted_at is not null or coalesce(char_length(btrim(body)), 0) > 0 or attachment_path is not null)
);
alter table public.direct_messages drop constraint if exists direct_messages_reactions_check;
alter table public.direct_messages add constraint direct_messages_reactions_check check (jsonb_typeof(reactions) = 'object');

create index if not exists direct_messages_reply_to_idx on public.direct_messages(reply_to) where reply_to is not null;

create or replace function public.direct_message_reply_matches(message_id uuid, message_sender uuid, message_recipient uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
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

drop policy if exists "Users send private messages" on public.direct_messages;
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

revoke update on public.direct_messages from authenticated;
grant update (read) on public.direct_messages to authenticated;

create or replace function public.edit_direct_message(message_id uuid, new_body text)
returns public.direct_messages
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare updated public.direct_messages;
begin
  if coalesce(char_length(btrim(new_body)), 0) < 1 or char_length(new_body) > 2000 then
    raise exception 'Berichttekst moet tussen 1 en 2000 tekens zijn';
  end if;
  update public.direct_messages
  set body = btrim(new_body), edited_at = now()
  where id = message_id and sender_id = auth.uid() and deleted_at is null
  returning * into updated;
  if not found then raise exception 'Bericht kan niet worden bewerkt'; end if;
  return updated;
end;
$$;

create or replace function public.delete_direct_message(message_id uuid)
returns public.direct_messages
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare updated public.direct_messages;
begin
  update public.direct_messages
  set body = null, attachment_path = null, deleted_at = now(), edited_at = null, reactions = '{}'::jsonb
  where id = message_id and sender_id = auth.uid() and deleted_at is null
  returning * into updated;
  if not found then raise exception 'Bericht kan niet worden verwijderd'; end if;
  return updated;
end;
$$;

create or replace function public.toggle_direct_message_reaction(message_id uuid, reaction text)
returns public.direct_messages
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare updated public.direct_messages;
declare current_reaction text;
begin
  reaction := replace(reaction, chr(65039), '');
  if reaction not in ('👍', chr(10084), '😂', '😮', '😢', '🙏') then
    raise exception 'Ongeldige reactie';
  end if;
  select reactions ->> auth.uid()::text into current_reaction
  from public.direct_messages
  where id = message_id and deleted_at is null and auth.uid() in (sender_id, recipient_id);
  if not found then raise exception 'Bericht niet gevonden'; end if;

  update public.direct_messages
  set reactions = case
    when current_reaction = reaction then reactions - auth.uid()::text
    else reactions || jsonb_build_object(auth.uid()::text, reaction)
  end
  where id = message_id
  returning * into updated;
  return updated;
end;
$$;

revoke all on function public.edit_direct_message(uuid, text) from public;
revoke all on function public.delete_direct_message(uuid) from public;
revoke all on function public.toggle_direct_message_reaction(uuid, text) from public;
grant execute on function public.edit_direct_message(uuid, text) to authenticated;
grant execute on function public.delete_direct_message(uuid) to authenticated;
grant execute on function public.toggle_direct_message_reaction(uuid, text) to authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('chat-media', 'chat-media', false, 8388608, array['image/jpeg','image/png','image/webp','image/gif'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Chat participants view media" on storage.objects;
create policy "Chat participants view media" on storage.objects for select to authenticated using (
  bucket_id = 'chat-media' and auth.uid()::text in ((storage.foldername(name))[1], (storage.foldername(name))[2])
);
drop policy if exists "Chat users upload media" on storage.objects;
create policy "Chat users upload media" on storage.objects for insert to authenticated with check (
  bucket_id = 'chat-media' and (storage.foldername(name))[1] = auth.uid()::text
);
drop policy if exists "Chat senders delete media" on storage.objects;
create policy "Chat senders delete media" on storage.objects for delete to authenticated using (
  bucket_id = 'chat-media' and owner_id = auth.uid()::text
);

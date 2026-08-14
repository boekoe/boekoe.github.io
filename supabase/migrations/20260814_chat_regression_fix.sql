-- Avoid recursive RLS evaluation when validating message replies.
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

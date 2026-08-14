-- Accept both Unicode heart variants and store one canonical reaction value.
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

revoke all on function public.toggle_direct_message_reaction(uuid, text) from public;
grant execute on function public.toggle_direct_message_reaction(uuid, text) to authenticated;

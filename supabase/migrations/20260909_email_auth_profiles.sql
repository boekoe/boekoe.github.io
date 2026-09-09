-- Keep passwordless sign-ups usable even when the e-mail name is long or unusual,
-- and repair auth accounts that were created without a matching profile.

create or replace function public.profile_username(user_email text, user_id uuid)
returns text language plpgsql immutable set search_path = public
as $$
declare
  username_base text;
begin
  username_base := left(regexp_replace(lower(coalesce(split_part(user_email, '@', 1), 'user')), '[^a-z0-9_.]', '', 'g'), 21);
  if char_length(username_base) < 3 then username_base := 'user'; end if;
  return username_base || '_' || substr(user_id::text, 1, 8);
end;
$$;

revoke all on function public.profile_username(text, uuid) from public;

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  insert into public.profiles (id, username, full_name)
  values (
    new.id,
    public.profile_username(new.email, new.id),
    left(coalesce(nullif(new.raw_user_meta_data ->> 'full_name', ''), 'Boekoe gebruiker'), 80)
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute procedure public.handle_new_user();

create or replace function public.ensure_my_profile()
returns public.profiles language plpgsql security definer set search_path = public
as $$
declare
  auth_user auth.users%rowtype;
  result public.profiles%rowtype;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;

  select * into result from public.profiles where id = auth.uid();
  if found then return result; end if;

  select * into auth_user from auth.users where id = auth.uid();
  if not found then raise exception 'Account not found'; end if;

  insert into public.profiles (id, username, full_name)
  values (
    auth_user.id,
    public.profile_username(auth_user.email, auth_user.id),
    left(coalesce(nullif(auth_user.raw_user_meta_data ->> 'full_name', ''), 'Boekoe gebruiker'), 80)
  )
  on conflict (id) do nothing;

  select * into result from public.profiles where id = auth.uid();
  return result;
end;
$$;

revoke all on function public.ensure_my_profile() from public;
grant execute on function public.ensure_my_profile() to authenticated;

insert into public.profiles (id, username, full_name)
select
  users.id,
  public.profile_username(users.email, users.id),
  left(coalesce(nullif(users.raw_user_meta_data ->> 'full_name', ''), 'Boekoe gebruiker'), 80)
from auth.users as users
left join public.profiles as profiles on profiles.id = users.id
where profiles.id is null
on conflict (id) do nothing;

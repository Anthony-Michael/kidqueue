-- ============================================================
-- KidQueue — Profile Fix
-- Run this in: Supabase Dashboard → SQL Editor → New Query
-- ============================================================

-- 1. Create missing profile for any existing signed-up users
insert into public.profiles (id, email, full_name, city, province)
select
  id,
  email,
  coalesce(raw_user_meta_data->>'full_name', ''),
  coalesce(raw_user_meta_data->>'city', 'Port Coquitlam'),
  coalesce(raw_user_meta_data->>'province', 'BC')
from auth.users
on conflict (id) do nothing;

-- 2. Create a trigger so every future signup auto-creates a profile
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email, full_name, city, province)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', ''),
    coalesce(new.raw_user_meta_data->>'city', 'Port Coquitlam'),
    coalesce(new.raw_user_meta_data->>'province', 'BC')
  )
  on conflict (id) do nothing;
  return new;
end;
$$ language plpgsql security definer;

-- Drop trigger if it already exists, then recreate
drop trigger if exists on_auth_user_created on auth.users;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

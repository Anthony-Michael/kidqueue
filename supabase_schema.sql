-- ============================================================
-- KidQueue — Supabase Database Schema
-- Run this in: Supabase Dashboard → SQL Editor → New Query
-- ============================================================

-- Profiles (extends Supabase auth.users)
create table public.profiles (
  id uuid references auth.users on delete cascade primary key,
  email text not null,
  full_name text,
  city text default 'Port Coquitlam',
  province text default 'BC',
  push_token text,
  created_at timestamptz default now()
);
alter table public.profiles enable row level security;
create policy "Users can view own profile" on public.profiles
  for select using (auth.uid() = id);
create policy "Users can update own profile" on public.profiles
  for update using (auth.uid() = id);
create policy "Users can insert own profile" on public.profiles
  for insert with check (auth.uid() = id);

-- Kids
create table public.kids (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles on delete cascade not null,
  name text not null,
  birth_year int not null,
  created_at timestamptz default now()
);
alter table public.kids enable row level security;
create policy "Users can manage their own kids" on public.kids
  for all using (auth.uid() = user_id);

-- Activities
create table public.activities (
  id uuid default gen_random_uuid() primary key,
  name text not null,
  provider text not null,
  category text not null,
  description text default '',
  location text not null,
  city text not null,
  province text default 'BC',
  age_min int,
  age_max int,
  registration_opens_at date,
  activity_starts_at date,
  activity_ends_at date,
  signup_url text,
  submitted_by uuid references public.profiles,
  is_verified boolean default false,
  created_at timestamptz default now()
);
alter table public.activities enable row level security;
create policy "Anyone can read activities" on public.activities
  for select using (true);
create policy "Authenticated users can submit activities" on public.activities
  for insert with check (auth.uid() is not null);

-- Watchlist
create table public.watchlist (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles on delete cascade not null,
  activity_id uuid references public.activities on delete cascade not null,
  notify_days_before int default 3,
  notify_via_push boolean default true,
  notify_via_email boolean default true,
  created_at timestamptz default now(),
  unique(user_id, activity_id)
);
alter table public.watchlist enable row level security;
create policy "Users can manage their own watchlist" on public.watchlist
  for all using (auth.uid() = user_id);

-- ============================================================
-- Seed data: Sample Port Coquitlam activities
-- ============================================================
insert into public.activities
  (name, provider, category, description, location, city, province, age_min, age_max, registration_opens_at, activity_starts_at, signup_url, is_verified)
values
  (
    'Summer Swim Lessons',
    'City of Port Coquitlam - Centennial Pool',
    'swim',
    'Red Cross swim lessons for children of all skill levels. Sessions run Mon-Fri for 2 weeks.',
    '1414 Laurier Ave, Port Coquitlam',
    'Port Coquitlam', 'BC', 4, 12,
    '2026-06-01', '2026-07-07',
    'https://www.portcoquitlam.ca/recreation',
    true
  ),
  (
    'Summer Day Camp',
    'City of Port Coquitlam Recreation',
    'camps',
    'Full-day supervised summer camp with sports, crafts, swimming and field trips.',
    'Hyde Creek Recreation Centre, Port Coquitlam',
    'Port Coquitlam', 'BC', 5, 12,
    '2026-05-28', '2026-07-02',
    'https://www.portcoquitlam.ca/recreation',
    true
  ),
  (
    'Youth Soccer League',
    'Port Coquitlam Minor Soccer Association',
    'sports',
    'Spring/Summer soccer league for boys and girls. Games played on weekends.',
    'Gates Park, Port Coquitlam',
    'Port Coquitlam', 'BC', 5, 14,
    '2026-06-05', '2026-07-15',
    'https://www.pcmsa.ca',
    true
  ),
  (
    'Intro to Guitar',
    'Port Coquitlam Community Music School',
    'music',
    'Beginner guitar lessons in a group setting. No prior experience required.',
    '2253 Mary Hill Rd, Port Coquitlam',
    'Port Coquitlam', 'BC', 7, 14,
    '2026-06-10', '2026-07-05',
    null,
    false
  ),
  (
    'Kids Coding Camp',
    'Coquitlam School District 43',
    'stem',
    'A week-long coding bootcamp teaching Scratch and beginner Python. Limited spots!',
    'Terry Fox Secondary, Port Coquitlam',
    'Port Coquitlam', 'BC', 9, 14,
    '2026-05-30', '2026-08-11',
    null,
    false
  );

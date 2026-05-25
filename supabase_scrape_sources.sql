-- ============================================================
-- KidQueue — scrape_sources table
-- Stores all city/org sources for the automated scraper.
-- Add a new city by inserting rows here — no code changes needed.
-- ============================================================

create table if not exists public.scrape_sources (
  id          uuid primary key default gen_random_uuid(),
  city        text not null,
  province    text not null default 'BC',
  name        text not null,
  url         text not null unique,
  keywords    text[] not null default '{}',
  is_active   boolean not null default true,
  created_at  timestamptz default now()
);

-- Only admins / service role can manage sources
alter table public.scrape_sources enable row level security;
create policy "Public read" on public.scrape_sources for select using (true);
create policy "Service role full access" on public.scrape_sources
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

-- ============================================================
-- SEED: Tri-Cities sources
-- ============================================================

insert into public.scrape_sources (city, province, name, url, keywords) values

-- ── Port Coquitlam ──────────────────────────────────────────
('Port Coquitlam', 'BC', 'PoCo Media Centre',
 'https://www.portcoquitlam.ca/our-government/media-centre/',
 array['registration','camp','program','sign up','register','aquatic','swim','sport']),

('Port Coquitlam', 'BC', 'PoCo Youth Programs',
 'https://www.portcoquitlam.ca/recreation-parks/youth/',
 array['registration','camp','program','youth','teen']),

('Port Coquitlam', 'BC', 'PoCo Day Camps',
 'https://www.portcoquitlam.ca/recreation-parks/day-camps/',
 array['camp','registration','summer','spring break']),

('Port Coquitlam', 'BC', 'PoCo Arts Programs',
 'https://www.portcoquitlam.ca/recreation-parks/arts-culture/',
 array['art','music','dance','registration','program']),

('Port Coquitlam', 'BC', 'PoCo Recreation Programs',
 'https://www.portcoquitlam.ca/recreation-parks/',
 array['registration','program','camp','swim','sport','youth']),

-- ── Coquitlam ───────────────────────────────────────────────
('Coquitlam', 'BC', 'Coquitlam Recreation News',
 'https://www.coquitlam.ca/city-hall/news-releases',
 array['registration','camp','program','youth','swim','sport','register']),

('Coquitlam', 'BC', 'Coquitlam Parks & Recreation',
 'https://www.coquitlam.ca/parks-recreation-culture',
 array['registration','camp','program','youth','swim','sport']),

('Coquitlam', 'BC', 'Coquitlam Youth Programs',
 'https://www.coquitlam.ca/parks-recreation-culture/youth-programs',
 array['youth','registration','camp','program','teen']),

-- ── Port Moody ──────────────────────────────────────────────
('Port Moody', 'BC', 'Port Moody Recreation',
 'https://www.portmoody.ca/en/recreation-and-culture/recreation-programs.aspx',
 array['registration','camp','program','youth','swim','sport']),

('Port Moody', 'BC', 'Port Moody News',
 'https://www.portmoody.ca/en/news/default.aspx',
 array['registration','camp','program','youth','register']),

('Port Moody', 'BC', 'Port Moody Arts Centre',
 'https://www.portmoody.ca/en/recreation-and-culture/arts-centre.aspx',
 array['art','music','dance','class','registration','youth','kids']),

-- ── School District 43 ──────────────────────────────────────
('Coquitlam', 'BC', 'SD43 Community Education',
 'https://ce43.augusoft.net/index.cfm?method=ClassListing.ClassListingDisplay&int_category_id=1&int_sub_category_id=0&int_catalog_id=0',
 array['registration','program','youth','camp','kids','children']),

('Coquitlam', 'BC', 'SD43 News & Events',
 'https://www.sd43.bc.ca/Pages/newsarchive.aspx',
 array['registration','program','youth','camp','kids']),

-- ── YMCA ────────────────────────────────────────────────────
('Coquitlam', 'BC', 'YMCA BC Coquitlam Programs',
 'https://www.ymcabc.ca/programs/',
 array['registration','camp','swim','sport','youth','kids','children','program']),

-- ── PoCo Arts Centre ────────────────────────────────────────
('Port Coquitlam', 'BC', 'PoCo Arts Centre',
 'https://www.pocoartscentre.ca/',
 array['registration','class','workshop','art','music','dance','youth','kids']),

-- ── Hyde Creek / Poco Rec Facilities ────────────────────────
('Port Coquitlam', 'BC', 'Gates Park Programs',
 'https://www.portcoquitlam.ca/recreation-parks/facilities/gates-park/',
 array['registration','camp','program','sport','youth'])

on conflict (url) do nothing;

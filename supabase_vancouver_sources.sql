-- ============================================================
-- KidQueue — Vancouver sources
-- Run in: Supabase Dashboard → SQL Editor
-- ============================================================

insert into public.scrape_sources (city, province, name, url, keywords) values

('Vancouver', 'BC', 'Vancouver Recreation Programs',
 'https://vancouver.ca/parks-recreation-culture/find-programs.aspx',
 array['registration','camp','program','youth','kids','swim','sport']),

('Vancouver', 'BC', 'Vancouver Park Board News',
 'https://vancouver.ca/parks-recreation-culture/news-releases.aspx',
 array['registration','camp','program','youth','kids','register']),

('Vancouver', 'BC', 'Vancouver Aquatics',
 'https://vancouver.ca/parks-recreation-culture/public-pools.aspx',
 array['swim','registration','lessons','aquatic','kids']),

('Vancouver', 'BC', 'Vancouver Youth Programs',
 'https://vancouver.ca/parks-recreation-culture/youth-programs.aspx',
 array['youth','registration','camp','program','teen','kids']),

('Vancouver', 'BC', 'VSB Community Programs',
 'https://www.vsb.bc.ca/Community-Programs',
 array['registration','camp','program','youth','kids','children']),

('Vancouver', 'BC', 'YMCA Vancouver Programs',
 'https://www.ymcabc.ca/programs/',
 array['registration','camp','swim','sport','youth','kids','children','program'])

on conflict (url) do nothing;

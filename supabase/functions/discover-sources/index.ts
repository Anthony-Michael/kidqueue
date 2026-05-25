// Supabase Edge Function: discover-sources
// Given a city + province, uses Claude to discover official recreation/program
// websites, validates them, inserts into scrape_sources, then immediately
// scrapes them so new-city users see activities right away.

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY') ?? '';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface DiscoveredSource {
  name: string;
  url: string;
  keywords: string[];
}

async function discoverSourcesWithAI(city: string, province: string): Promise<DiscoveredSource[]> {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5',
      max_tokens: 1024,
      messages: [{
        role: 'user',
        content: `You are helping build a kids activity finder app for Canada.

List up to 8 real websites where kids program registrations would be announced for:
City: ${city}, ${province}, Canada

Return ONLY a valid JSON array — no explanation, no markdown:
[
  {
    "name": "Organization name",
    "url": "https://exact-real-url-to-programs-page-or-news-page",
    "keywords": ["registration", "camp", "program", "kids"]
  }
]

Include (if they exist for this city):
- City/municipality recreation programs page
- City news or press releases page
- Local school board community education (e.g. ce.schoolboard.net)
- YMCA location programs page
- Local arts or community centre
- Major local sports association (hockey, soccer, swim club)

Only include URLs you are confident actually exist. Use realistic, well-known URLs.`,
      }],
    }),
  });

  const data = await res.json();
  const text = data?.content?.[0]?.text?.trim() ?? '';

  try {
    const match = text.match(/\[[\s\S]*\]/);
    if (!match) return [];
    return JSON.parse(match[0]) as DiscoveredSource[];
  } catch {
    return [];
  }
}

async function validateUrl(url: string): Promise<boolean> {
  try {
    const res = await fetch(url, {
      method: 'HEAD',
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; KidQueue/1.0)' },
      signal: AbortSignal.timeout(8000),
    });
    // 200-399 = good, 405 = HEAD not allowed but server exists
    return res.status < 400 || res.status === 405;
  } catch {
    return false;
  }
}

function stripHtml(html: string): string {
  return html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<nav[^>]*>[\s\S]*?<\/nav>/gi, '')
    .replace(/<footer[^>]*>[\s\S]*?<\/footer>/gi, '')
    .replace(/<header[^>]*>[\s\S]*?<\/header>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

function extractLinks(html: string, baseUrl: string): string[] {
  const base = new URL(baseUrl);
  const matches = [...html.matchAll(/href="([^"]+)"/gi)];
  return matches
    .map(m => {
      const href = m[1];
      try {
        if (href.startsWith('http')) return href;
        if (href.startsWith('/')) return new URL(href, base.origin).href;
      } catch { /* ignore */ }
      return null;
    })
    .filter((h): h is string => h !== null);
}

async function extractActivityWithAI(
  pageText: string,
  url: string,
  city: string,
  province: string,
): Promise<object | null> {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5',
      max_tokens: 1024,
      messages: [{
        role: 'user',
        content: `Extract kids activity registration info from this webpage for ${city}, ${province}.
Return JSON or null if this page doesn't describe a specific registerable kids activity/program.

Today: ${new Date().toISOString().split('T')[0]}
URL: ${url}

Return ONLY this JSON (or "null"):
{
  "name": "Program name",
  "provider": "Organization name",
  "category": "sports|arts|swim|music|stem|camps|dance|tutoring|other",
  "description": "1-2 sentences",
  "location": "Venue or address",
  "city": "${city}",
  "province": "${province}",
  "age_min": null or number,
  "age_max": null or number,
  "registration_opens_at": null or "YYYY-MM-DD",
  "activity_starts_at": null or "YYYY-MM-DD",
  "activity_ends_at": null or "YYYY-MM-DD",
  "signup_url": "${url}"
}

Page content:
${pageText.slice(0, 6000)}`,
      }],
    }),
  });

  const data = await res.json();
  const text = data?.content?.[0]?.text?.trim() ?? '';
  if (text === 'null' || !text.includes('{')) return null;

  try {
    const match = text.match(/\{[\s\S]*\}/);
    return match ? JSON.parse(match[0]) : null;
  } catch {
    return null;
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS_HEADERS });
  }

  const { city, province } = await req.json();
  if (!city || !province) {
    return new Response(JSON.stringify({ error: 'city and province required' }), {
      status: 400, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    });
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
  const results = {
    city,
    province,
    sources_discovered: 0,
    sources_validated: 0,
    sources_inserted: 0,
    activities_inserted: 0,
    errors: [] as string[],
  };

  // 1. Check if we already have enough sources for this city
  const { data: existing } = await supabase
    .from('scrape_sources')
    .select('id')
    .ilike('city', city)
    .eq('is_active', true);

  if ((existing?.length ?? 0) >= 4) {
    return new Response(JSON.stringify({ ...results, message: 'Sources already exist for this city' }), {
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    });
  }

  // 2. Discover sources via Claude
  const discovered = await discoverSourcesWithAI(city, province);
  results.sources_discovered = discovered.length;

  // 3. Validate URLs and insert valid ones
  const validSources: DiscoveredSource[] = [];
  for (const source of discovered) {
    try {
      const isValid = await validateUrl(source.url);
      if (!isValid) continue;
      results.sources_validated++;

      const { error } = await supabase.from('scrape_sources').insert({
        city,
        province,
        name: source.name,
        url: source.url,
        keywords: source.keywords,
        is_active: true,
      });

      if (!error) {
        validSources.push(source);
        results.sources_inserted++;
      }
    } catch (e: any) {
      results.errors.push(`Validation error for ${source.url}: ${e?.message}`);
    }
  }

  // 4. Immediately scrape the new sources so users see activities right away
  for (const source of validSources) {
    try {
      const res = await fetch(source.url, {
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; KidQueue/1.0)' },
        signal: AbortSignal.timeout(15000),
      });
      if (!res.ok) continue;

      const html = await res.text();
      const text = stripHtml(html);
      const links = extractLinks(html, source.url);

      const relevantLinks = links.filter(link => {
        const lower = link.toLowerCase();
        return source.keywords.some(kw => lower.includes(kw.replace(' ', '-')) || lower.includes(kw));
      });

      const textLower = text.toLowerCase();
      const isRelevant = source.keywords.some(kw => textLower.includes(kw));
      const pagesToCheck = isRelevant
        ? [source.url, ...relevantLinks.slice(0, 4)]
        : relevantLinks.slice(0, 4);

      for (const pageUrl of pagesToCheck) {
        try {
          const pageHtml = pageUrl === source.url ? html : await (async () => {
            const r = await fetch(pageUrl, {
              headers: { 'User-Agent': 'Mozilla/5.0 (compatible; KidQueue/1.0)' },
              signal: AbortSignal.timeout(12000),
            });
            return r.ok ? await r.text() : '';
          })();
          if (!pageHtml) continue;

          const pageText = stripHtml(pageHtml);
          const activity = await extractActivityWithAI(pageText, pageUrl, city, province);
          if (!activity) continue;

          // Skip duplicates
          const { data: dup } = await supabase
            .from('activities')
            .select('id')
            .eq('signup_url', pageUrl)
            .maybeSingle();
          if (dup) continue;

          const { error } = await supabase.from('activities').insert({
            ...activity,
            is_verified: false,
            submitted_by: null,
          });
          if (!error) results.activities_inserted++;
        } catch (e: any) {
          results.errors.push(`Page error ${pageUrl}: ${e?.message}`);
        }
      }
    } catch (e: any) {
      results.errors.push(`Source scrape error ${source.url}: ${e?.message}`);
    }
  }

  return new Response(JSON.stringify(results), {
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  });
});

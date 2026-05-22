// Supabase Edge Function: scrape-poco
// Scrapes portcoquitlam.ca news/media-centre for registration announcements
// and auto-inserts new activities into the database.
// Schedule: run daily via Supabase cron (see supabase_cron.sql)

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY') ?? '';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Sources to scrape — all static HTML
const SOURCES = [
  {
    name: 'PoCo Media Centre',
    url: 'https://www.portcoquitlam.ca/our-government/media-centre/',
    keywords: ['registration', 'camp', 'program', 'sign up', 'register', 'aquatic', 'swim', 'sport'],
  },
  {
    name: 'PoCo Youth Programs',
    url: 'https://www.portcoquitlam.ca/recreation-parks/youth/',
    keywords: ['registration', 'camp', 'program', 'youth', 'teen'],
  },
  {
    name: 'PoCo Day Camps',
    url: 'https://www.portcoquitlam.ca/recreation-parks/day-camps',
    keywords: ['camp', 'registration', 'summer', 'spring break'],
  },
];

async function fetchPage(url: string): Promise<string> {
  const res = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (compatible; KidQueue/1.0)',
      'Accept': 'text/html',
    },
  });
  return await res.text();
}

function stripHtml(html: string): string {
  return html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<nav[^>]*>[\s\S]*?<\/nav>/gi, '')
    .replace(/<footer[^>]*>[\s\S]*?<\/footer>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

function extractLinks(html: string, baseUrl: string): string[] {
  const matches = [...html.matchAll(/href="([^"]+)"/gi)];
  return matches
    .map(m => {
      const href = m[1];
      if (href.startsWith('http')) return href;
      if (href.startsWith('/')) return new URL(href, baseUrl).href;
      return null;
    })
    .filter((href): href is string => href !== null);
}

async function extractActivityWithAI(pageText: string, url: string): Promise<object | null> {
  if (!ANTHROPIC_API_KEY) return null;

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
        content: `Extract kids activity registration info from this Port Coquitlam webpage.
Return JSON or null if this page doesn't describe a specific registerable kids activity/program.

Today: ${new Date().toISOString().split('T')[0]}
URL: ${url}

Return ONLY this JSON structure (or the word "null"):
{
  "name": "Program name",
  "provider": "Organization name",
  "category": "sports|arts|swim|music|stem|camps|dance|tutoring|other",
  "description": "1-2 sentences",
  "location": "Venue or address",
  "city": "Port Coquitlam",
  "province": "BC",
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

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
  const results = { checked: 0, found: 0, inserted: 0, errors: [] as string[] };

  for (const source of SOURCES) {
    try {
      const html = await fetchPage(source.url);
      const text = stripHtml(html);
      const links = extractLinks(html, source.url);

      // Find links that seem registration-related
      const relevantLinks = links.filter(link => {
        const lower = link.toLowerCase();
        return source.keywords.some(kw => lower.includes(kw.replace(' ', '-')) || lower.includes(kw));
      });

      // Also check if the source page itself has activity content
      const sourceText = text.toLowerCase();
      const isRelevant = source.keywords.some(kw => sourceText.includes(kw));

      const pagesToCheck = isRelevant
        ? [source.url, ...relevantLinks.slice(0, 5)]
        : relevantLinks.slice(0, 5);

      for (const pageUrl of pagesToCheck) {
        results.checked++;
        try {
          const pageHtml = pageUrl === source.url ? html : await fetchPage(pageUrl);
          const pageText = stripHtml(pageHtml);
          const activity = await extractActivityWithAI(pageText, pageUrl);

          if (!activity) continue;
          results.found++;

          // Check if this activity already exists (by name + signup_url)
          const { data: existing } = await supabase
            .from('activities')
            .select('id')
            .eq('signup_url', pageUrl)
            .maybeSingle();

          if (existing) continue; // Already in DB

          // Insert as unverified — admin reviews before going live
          const { error } = await supabase.from('activities').insert({
            ...activity,
            is_verified: false,
            submitted_by: null,
          });

          if (error) {
            results.errors.push(`Insert failed for ${pageUrl}: ${error.message}`);
          } else {
            results.inserted++;
          }
        } catch (e) {
          results.errors.push(`Page error ${pageUrl}: ${e.message}`);
        }
      }
    } catch (e) {
      results.errors.push(`Source error ${source.url}: ${e.message}`);
    }
  }

  return new Response(JSON.stringify(results), {
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  });
});

// Supabase Edge Function: scrape-sources
// Database-driven multi-city scraper.
// Reads source URLs from the scrape_sources table so new cities
// can be added by inserting a row — no redeploy needed.
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

interface ScrapeSource {
  id: string;
  city: string;
  province: string;
  name: string;
  url: string;
  keywords: string[];
}

async function fetchPage(url: string): Promise<string> {
  const res = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (compatible; KidQueue/1.0)',
      'Accept': 'text/html',
    },
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return await res.text();
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
        if (!href.startsWith('#') && !href.startsWith('mailto:')) {
          return new URL(href, baseUrl).href;
        }
      } catch { /* ignore malformed */ }
      return null;
    })
    .filter((href): href is string => href !== null);
}

async function extractActivityWithAI(
  pageText: string,
  url: string,
  city: string,
  province: string,
): Promise<object | null> {
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
        content: `Extract kids activity registration info from this webpage for ${city}, ${province}.
Return JSON or null if this page doesn't describe a specific registerable kids activity/program.

Today: ${new Date().toISOString().split('T')[0]}
URL: ${url}
City: ${city}, ${province}

Return ONLY this JSON structure (or the word "null"):
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

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
  const results = {
    sources_loaded: 0,
    checked: 0,
    found: 0,
    inserted: 0,
    skipped_existing: 0,
    errors: [] as string[],
  };

  // Load all active sources from the database
  const { data: sources, error: sourcesError } = await supabase
    .from('scrape_sources')
    .select('*')
    .eq('is_active', true);

  if (sourcesError) {
    return new Response(
      JSON.stringify({ error: `Failed to load sources: ${sourcesError.message}` }),
      { headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }, status: 500 },
    );
  }

  results.sources_loaded = sources?.length ?? 0;

  for (const source of (sources as ScrapeSource[])) {
    try {
      const html = await fetchPage(source.url);
      const text = stripHtml(html);
      const links = extractLinks(html, source.url);

      // Filter links that seem registration-related based on source keywords
      const relevantLinks = links.filter(link => {
        const lower = link.toLowerCase();
        return source.keywords.some(
          kw => lower.includes(kw.replace(' ', '-')) || lower.includes(kw),
        );
      });

      // Check if the source page itself has activity content
      const sourceText = text.toLowerCase();
      const isRelevant = source.keywords.some(kw => sourceText.includes(kw));

      const pagesToCheck = isRelevant
        ? [source.url, ...relevantLinks.slice(0, 3)]
        : relevantLinks.slice(0, 3);

      for (const pageUrl of pagesToCheck) {
        results.checked++;
        try {
          const pageHtml = pageUrl === source.url ? html : await fetchPage(pageUrl);
          const pageText = stripHtml(pageHtml);
          const activity = await extractActivityWithAI(
            pageText,
            pageUrl,
            source.city,
            source.province,
          );

          if (!activity) continue;
          results.found++;

          // Skip if already in DB (by signup_url)
          const { data: existing } = await supabase
            .from('activities')
            .select('id')
            .eq('signup_url', pageUrl)
            .maybeSingle();

          if (existing) {
            results.skipped_existing++;
            continue;
          }

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
        } catch (e: any) {
          results.errors.push(`Page error ${pageUrl}: ${e?.message ?? e}`);
        }
      }
    } catch (e: any) {
      results.errors.push(`Source error ${source.url}: ${e?.message ?? e}`);
    }
  }

  return new Response(JSON.stringify(results), {
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  });
});

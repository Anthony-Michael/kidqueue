// Supabase Edge Function: import-url
// Fetches a URL and uses Claude AI to extract activity details from it.
// Called from the app's Add Activity screen when a user pastes a URL.

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';

const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY') ?? '';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const EXTRACTION_PROMPT = `You are extracting structured data about a kids activity or program from a webpage.

Extract the following fields from the page content. Return ONLY valid JSON, no explanation:

{
  "name": "Full program name",
  "provider": "Organization running it (e.g. City of Port Coquitlam, Hyde Creek Recreation)",
  "category": "one of: sports | arts | swim | music | stem | camps | dance | tutoring | other",
  "description": "Brief 1-2 sentence description",
  "location": "Address or venue name",
  "city": "City name (default Port Coquitlam if not specified)",
  "province": "Province (default BC)",
  "age_min": null or number,
  "age_max": null or number,
  "registration_opens_at": null or "YYYY-MM-DD",
  "activity_starts_at": null or "YYYY-MM-DD",
  "activity_ends_at": null or "YYYY-MM-DD",
  "signup_url": "Direct registration URL if found, else null"
}

If a field is not mentioned, use null. For category, make your best guess based on the activity type.
Today's date is ${new Date().toISOString().split('T')[0]}.`;

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS_HEADERS });
  }

  try {
    const { url } = await req.json();
    if (!url) {
      return new Response(JSON.stringify({ error: 'url is required' }), {
        status: 400,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      });
    }

    // Fetch the target page
    let html = '';
    try {
      const res = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; KidQueue/1.0; +https://github.com/Anthony-Michael/kidqueue)',
          'Accept': 'text/html,application/xhtml+xml',
        },
      });
      html = await res.text();
    } catch (e) {
      return new Response(JSON.stringify({ error: `Could not fetch URL: ${e.message}` }), {
        status: 422,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      });
    }

    // Strip HTML down to readable text (remove scripts, styles, nav, footer)
    const text = html
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
      .replace(/<nav[^>]*>[\s\S]*?<\/nav>/gi, '')
      .replace(/<footer[^>]*>[\s\S]*?<\/footer>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s{2,}/g, ' ')
      .trim()
      .slice(0, 8000); // Keep to ~8k chars to stay within token limits

    if (!ANTHROPIC_API_KEY) {
      return new Response(JSON.stringify({ error: 'ANTHROPIC_API_KEY not configured' }), {
        status: 500,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      });
    }

    // Call Claude to extract structured activity data
    const claudeRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5',
        max_tokens: 1024,
        messages: [
          {
            role: 'user',
            content: `${EXTRACTION_PROMPT}\n\nPage URL: ${url}\n\nPage content:\n${text}`,
          },
        ],
      }),
    });

    const claudeData = await claudeRes.json();
    const rawText = claudeData?.content?.[0]?.text ?? '';

    // Parse JSON from Claude's response
    const jsonMatch = rawText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return new Response(JSON.stringify({ error: 'Could not extract activity data from this page', raw: rawText }), {
        status: 422,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      });
    }

    const activity = JSON.parse(jsonMatch[0]);

    return new Response(JSON.stringify({ activity }), {
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    });

  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    });
  }
});

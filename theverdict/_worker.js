/**
 * The Verdict — Cloudflare Pages _worker.js (Advanced Mode)
 * This file is picked up automatically by Cloudflare Pages direct upload.
 * It handles /api/verdict and serves all other requests as static assets.
 *
 * SETUP — add your API key secret:
 *   Cloudflare Dashboard → Workers & Pages → theverdict
 *   → Settings → Environment Variables → Add secret:
 *       Name:  ANTHROPIC_API_KEY
 *       Value: sk-ant-api03-xxxxxxxxxx
 */

const CORS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // ── Serve static assets for everything except /api/verdict ──
    if (url.pathname !== '/api/verdict') {
      return env.ASSETS.fetch(request);
    }

    // ── CORS preflight ───────────────────────────────────────────
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 200, headers: CORS });
    }

    // ── Only POST allowed on /api/verdict ────────────────────────
    if (request.method !== 'POST') {
      return new Response(JSON.stringify({ error: 'Use POST' }), {
        status: 405,
        headers: { 'Content-Type': 'application/json', ...CORS },
      });
    }

    // ── Parse body ───────────────────────────────────────────────
    let body;
    try {
      body = await request.json();
    } catch {
      return new Response(JSON.stringify({ error: 'Invalid JSON' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...CORS },
      });
    }

    const { question, options, factors } = body;

    if (!Array.isArray(options) || options.length < 2) {
      return new Response(JSON.stringify({ error: 'At least 2 options required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...CORS },
      });
    }

    // ── Build prompt ─────────────────────────────────────────────
    const optList = options.map((o, i) => `${i + 1}. ${o}`).join('\n');

    const prompt = `You are a sharp, empathetic decision analyst. A user needs a clear, justified verdict on a real decision.

DECISION: ${question || 'Not specified'}

OPTIONS:
${optList}

FACTORS & CONTEXT PROVIDED BY THE USER:
${factors || 'No specific factors provided — use general reasoning and common sense.'}

Your job: analyse all options against the user's context and deliver a reasoned verdict. Do NOT pick randomly. Weigh the factors. Think carefully.

Respond ONLY with a valid JSON object — no markdown, no commentary, no fences:

{
  "verdict": "exact text of the best option (must match one of the options listed)",
  "confidence": 85,
  "reasoning": "2-3 sentences explaining WHY this option wins given the user's specific situation. Be direct and specific.",
  "comparison": [
    { "option": "exact option text", "assessment": "1 sentence on how it fits the user's situation" }
  ],
  "pros": ["strength 1", "strength 2", "strength 3"],
  "cons": ["watch-out 1", "watch-out 2"],
  "next_step": "One concrete immediate action to move forward.",
  "caveat": "One honest sentence about when this verdict might not apply."
}

Rules:
- verdict must exactly match one of the listed options
- confidence is an integer 0-100
- be specific to THIS user's context, not generic`;

    // ── Call Anthropic ───────────────────────────────────────────
    let res;
    try {
      res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type':      'application/json',
          'x-api-key':         env.ANTHROPIC_API_KEY,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model:      'claude-sonnet-4-20250514',
          max_tokens: 1200,
          messages:   [{ role: 'user', content: prompt }],
        }),
      });
    } catch (err) {
      return new Response(JSON.stringify({ error: 'Upstream failed', detail: err.message }), {
        status: 502,
        headers: { 'Content-Type': 'application/json', ...CORS },
      });
    }

    if (!res.ok) {
      const text = await res.text();
      return new Response(JSON.stringify({ error: `Anthropic ${res.status}`, detail: text }), {
        status: res.status,
        headers: { 'Content-Type': 'application/json', ...CORS },
      });
    }

    // ── Parse and return ─────────────────────────────────────────
    const data  = await res.json();
    const raw   = (data.content ?? []).map(b => b.text ?? '').join('');
    const clean = raw.replace(/```json\n?|```/g, '').trim();

    let parsed;
    try {
      parsed = JSON.parse(clean);
    } catch {
      return new Response(JSON.stringify({ error: 'AI parse failed', raw }), {
        status: 502,
        headers: { 'Content-Type': 'application/json', ...CORS },
      });
    }

    return new Response(JSON.stringify(parsed), {
      status: 200,
      headers: { 'Content-Type': 'application/json', ...CORS },
    });
  },
};

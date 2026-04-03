/**
 * The Verdict — _worker.js
 * Handles: /api/verdict, /api/blog/*, /rss.xml, /sitemap.xml
 * + Cron trigger: daily blog post generation at 08:00 UTC
 *
 * Bindings required (wrangler.toml / Pages Settings → Functions):
 *   KV:  BLOG_KV   — stores posts, index, RSS, images
 *
 * Secrets required:
 *   ANTHROPIC_API_KEY  — your Anthropic key
 *
 * wrangler.toml additions:
 *   [[kv_namespaces]]
 *   binding = "BLOG_KV"
 *   id = "YOUR_KV_NAMESPACE_ID"
 *
 */

const CORS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

const SITE_URL  = 'https://theverdict.site';
const SITE_NAME = 'The Verdict';

// ── Daily topic seeds ──────────────────────────────────────────
// AI picks one each day based on the date
const TOPIC_SEEDS = [
  { category: 'career',        question: 'Should I stay in my current job or look for a new one?',           options: ['Stay and grow internally', 'Start actively job hunting', 'Go freelance or consult'],        factors: 'Current market uncertainty, skill development opportunities, compensation growth, work-life balance, career trajectory' },
  { category: 'money',         question: 'Should I invest my savings in index funds or pay off my debt first?', options: ['Invest in index funds (S&P 500)', 'Pay off high-interest debt first', 'Split 50/50 between both'], factors: 'Compound interest, interest rates, psychological peace of mind, emergency fund, long-term wealth building' },
  { category: 'tech',          question: 'Which JavaScript framework should a startup choose in 2026?',        options: ['Next.js', 'Remix', 'SvelteKit', 'Nuxt 3'],                                                  factors: 'Ecosystem maturity, hiring pool, performance, developer experience, community support, enterprise adoption' },
  { category: 'lifestyle',     question: 'Should I move to a new city or stay where I am?',                   options: ['Move to a new city', 'Stay and invest locally', 'Try a 3-month test move first'],           factors: 'Career opportunities, cost of living, social connections, personal growth, family ties, housing market' },
  { category: 'career',        question: 'MBA or coding bootcamp — which is better for career switching?',    options: ['Top-tier MBA', 'Intensive coding bootcamp', 'Self-study with portfolio projects'],           factors: 'ROI, time investment, networking, job market demand, cost, career goals, prior background' },
  { category: 'money',         question: 'Should I buy a home or continue renting in 2026?',                  options: ['Buy a home now', 'Keep renting and invest', 'Wait 12–18 months then reassess'],             factors: 'Interest rates, housing prices, job stability, down payment readiness, local market, flexibility needs' },
  { category: 'tech',          question: 'AI tools for productivity: which suite is best for individuals?',   options: ['Claude + Cursor', 'ChatGPT + Copilot', 'Gemini + Workspace AI', 'Local models (Ollama)'],   factors: 'Privacy, cost, coding capability, writing quality, integration, offline use, reasoning ability' },
  { category: 'relationships', question: 'Long-distance relationship: make it work or end it?',               options: ['Commit fully with a timeline to close the gap', 'End it and move on', 'Take a break and reassess in 6 months'], factors: 'Relationship duration, timeline to reunite, emotional cost, career constraints, trust, communication quality' },
  { category: 'lifestyle',     question: 'Side hustle or focus entirely on main job for financial growth?',   options: ['Build a side hustle', 'Double down on main career', 'Start a business full-time'],           factors: 'Current income, risk tolerance, time availability, skill transferability, market opportunity, energy levels' },
  { category: 'career',        question: 'Which programming language should a beginner learn first in 2026?', options: ['Python', 'JavaScript', 'TypeScript', 'Rust'],                                               factors: 'Job market, learning curve, versatility, AI/ML relevance, web development, community size, salary potential' },
  { category: 'money',         question: 'Bitcoin or gold as an inflation hedge in 2026?',                    options: ['Bitcoin (BTC)', 'Physical gold', 'Gold ETFs', 'Diversify across all three'],                factors: 'Volatility, liquidity, storage, regulatory risk, historical performance, institutional adoption, inflation rate' },
  { category: 'travel',        question: 'European city breaks: which capital is worth visiting right now?',  options: ['Lisbon', 'Budapest', 'Tallinn', 'Ljubljana'],                                               factors: 'Cost, crowds, food scene, culture, architecture, weather, flight connections, hidden gem factor' },
  { category: 'tech',          question: 'Mac or PC for a developer in 2026?',                               options: ['MacBook Pro (M-series)', 'Windows PC (custom build)', 'Linux ThinkPad'],                    factors: 'Unix environment, battery life, cost, gaming, software ecosystem, performance per dollar, build quality' },
  { category: 'lifestyle',     question: 'Gym membership or home gym — which delivers better results?',      options: ['Commercial gym membership', 'Build a home gym', 'Outdoor + bodyweight training'],            factors: 'Cost over 3 years, motivation, variety, commute, space, social aspect, long-term consistency' },
];

// ── Call Anthropic ─────────────────────────────────────────────
async function callAnthropic(prompt, apiKey, maxTokens = 1200) {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type':      'application/json',
      'x-api-key':         apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model:      'claude-opus-4-6',
      max_tokens: maxTokens,
      messages:   [{ role: 'user', content: prompt }],
    }),
  });
  if (!res.ok) throw new Error(`Anthropic ${res.status}: ${await res.text()}`);
  const data = await res.json();
  const raw  = (data.content ?? []).map(b => b.text ?? '').join('');
  return raw.replace(/```json\n?|```/g, '').trim();
}

// ── Generate blog post via AI ──────────────────────────────────
async function generateBlogPost(topic, apiKey, date) {
  const optList = topic.options.map((o, i) => `${i + 1}. ${o}`).join('\n');

  // Step 1: get verdict JSON
  const verdictPrompt = `You are a sharp decision analyst. Analyse this decision:

QUESTION: ${topic.question}
OPTIONS:\n${optList}
FACTORS: ${topic.factors}

Respond ONLY with valid JSON (no fences):
{
  "verdict": "exact option text",
  "confidence": 82,
  "reasoning": "2-3 specific sentences",
  "comparison": [{"option": "...", "assessment": "..."}],
  "pros": ["...", "...", "..."],
  "cons": ["...", "..."],
  "next_step": "one concrete action",
  "caveat": "one honest caveat"
}`;

  const verdictRaw = await callAnthropic(verdictPrompt, apiKey, 900);
  const verdict    = JSON.parse(verdictRaw);

  // Step 2: generate full SEO article
  const articlePrompt = `You are a sharp editorial writer for a decision-making publication. Write a full SEO blog article about this decision verdict.

DECISION: ${topic.question}
VERDICT: ${verdict.verdict}
REASONING: ${verdict.reasoning}
CATEGORY: ${topic.category}
PUBLISH DATE: ${date}

Write a 600-700 word article in HTML (only the inner body content, no <html>/<body> tags). Use:
- <h2> for section headings (2-3 sections)
- <p> for paragraphs
- <ul>/<li> for lists where appropriate
- <blockquote> for a key insight or quote
- <strong> for emphasis

The article should:
1. Open with a compelling hook about WHY this decision matters right now
2. Explain the context and why people face this choice
3. Walk through the key factors that drive the verdict
4. Reference the AI verdict naturally in the article
5. End with a forward-looking takeaway

Also return a JSON wrapper. Respond ONLY with valid JSON (no fences):
{
  "title": "SEO-optimised article title (max 65 chars, includes primary keyword)",
  "excerpt": "Meta description / excerpt (max 160 chars)",
  "keywords": ["keyword1", "keyword2", "keyword3", "keyword4", "keyword5"],
  "article_html": "<h2>Section One</h2><p>...</p>..."
}`;

  const articleRaw = await callAnthropic(articlePrompt, apiKey, 2000);
  const article    = JSON.parse(articleRaw);

  // Step 3: generate viral social posts
  const socialPrompt = `Generate viral social media posts for this article.
TITLE: ${article.title}
VERDICT: ${verdict.verdict}
CATEGORY: ${topic.category}
URL: https://theverdict.site/blog/

Respond ONLY with valid JSON (no fences):
{
  "twitter": "Tweet under 280 chars with verdict reveal + hook + URL placeholder. Use emojis. Should make people want to click.",
  "linkedin": "LinkedIn post 150-200 words. Professional tone. Starts with a bold hook. Ends with a question to drive comments.",
  "whatsapp": "WhatsApp-friendly short message with emoji. Max 3 lines. Feels like a friend sharing something interesting."
}`;

  const socialRaw = await callAnthropic(socialPrompt, apiKey, 600);
  const social    = JSON.parse(socialRaw);

  // Build slug
  const slug = article.title
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 60)
    .replace(/-$/, '');

  return {
    slug,
    date,
    category:    topic.category,
    question:    topic.question,
    title:       article.title,
    excerpt:     article.excerpt,
    keywords:    article.keywords,
    article_html: article.article_html,
    verdict:     verdict.verdict,
    confidence:  verdict.confidence,
    reasoning:   verdict.reasoning,
    comparison:  verdict.comparison,
    pros:        verdict.pros,
    cons:        verdict.cons,
    next_step:   verdict.next_step,
    caveat:      verdict.caveat,
    social,
  };
}

// ── Cron: daily post generation ────────────────────────────────
async function handleCron(env) {
  const today    = new Date().toISOString().slice(0, 10);
  const existing = await env.BLOG_KV.get(`post:${today}`);
  if (existing) return; // already generated today

  // Pick topic based on day-of-year
  const dayOfYear = Math.floor((Date.now() - new Date(new Date().getFullYear(), 0, 0)) / 86400000);
  const topic     = TOPIC_SEEDS[dayOfYear % TOPIC_SEEDS.length];

  const post = await generateBlogPost(topic, env.ANTHROPIC_API_KEY, today);

  // Save post to KV
  await env.BLOG_KV.put(`post:${today}:${post.slug}`, JSON.stringify(post), { expirationTtl: 60 * 60 * 24 * 365 });

  // Update index list
  const indexRaw = await env.BLOG_KV.get('index');
  const index    = indexRaw ? JSON.parse(indexRaw) : [];
  index.unshift({ slug: post.slug, date: post.date, title: post.title, excerpt: post.excerpt, category: post.category, verdict: post.verdict });
  if (index.length > 365) index.pop(); // keep 1 year
  await env.BLOG_KV.put('index', JSON.stringify(index));

  // Regenerate RSS
  await generateRSS(index, env);
}

// ── RSS feed ───────────────────────────────────────────────────
async function generateRSS(index, env) {
  const items = index.slice(0, 20).map(p => `
  <item>
    <title><![CDATA[${p.title}]]></title>
    <link>${SITE_URL}/blog/${p.slug}/</link>
    <guid isPermaLink="true">${SITE_URL}/blog/${p.slug}/</guid>
    <description><![CDATA[${p.excerpt}]]></description>
    <pubDate>${new Date(p.date).toUTCString()}</pubDate>
    <category>${p.category}</category>
  </item>`).join('');

  const rss = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:news="http://www.google.com/schemas/sitemap-news/0.9">
<channel>
  <title>${SITE_NAME} — Daily AI Verdicts</title>
  <link>${SITE_URL}</link>
  <description>Daily AI-powered verdicts on life's real decisions — careers, money, lifestyle, tech and more.</description>
  <language>en-gb</language>
  <managingEditor>hello@theverdict.site</managingEditor>
  <webMaster>hello@theverdict.site</webMaster>
  <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
  <atom:link href="${SITE_URL}/rss.xml" rel="self" type="application/rss+xml"/>
  <image>
    <url>${SITE_URL}/og-image.png</url>
    <title>${SITE_NAME}</title>
    <link>${SITE_URL}</link>
  </image>
  ${items}
</channel>
</rss>`;

  await env.BLOG_KV.put('rss', rss);
}

// ── Dynamic sitemap ────────────────────────────────────────────
async function buildSitemap(index) {
  const staticUrls = [
    { loc: `${SITE_URL}/`,      priority: '1.0', freq: 'daily'  },
    { loc: `${SITE_URL}/blog/`, priority: '0.9', freq: 'daily'  },
  ];
  const postUrls = index.map(p => ({
    loc:      `${SITE_URL}/blog/${p.slug}/`,
    lastmod:  p.date,
    priority: '0.8',
    freq:     'monthly',
  }));

  const urlsXml = [...staticUrls, ...postUrls].map(u => `
  <url>
    <loc>${u.loc}</loc>
    ${u.lastmod ? `<lastmod>${u.lastmod}</lastmod>` : ''}
    <changefreq>${u.freq}</changefreq>
    <priority>${u.priority}</priority>
  </url>`).join('');

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:news="http://www.google.com/schemas/sitemap-news/0.9">
  ${urlsXml}
</urlset>`;
}

// ── Save verdict as blog post (background, non-blocking) ────────
async function saveVerdictAsBlogPost(question, options, factors, verdict, env) {
  try {
    if (!env.BLOG_KV) return;

    // Build a URL-safe slug from the question
    const slug = (question || verdict.verdict || 'verdict')
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .slice(0, 60)
      .replace(/-$/, '');

    const date = new Date().toISOString().slice(0, 10);

    // Derive a readable title and excerpt from the question + verdict
    const title   = question
      ? `${question.slice(0, 80).replace(/\?$/, '')}? — The Verdict`
      : `AI Decision: ${verdict.verdict}`;
    const excerpt = `AI verdict: ${verdict.verdict}. ${verdict.reasoning ? verdict.reasoning.slice(0, 120) + '…' : ''}`;

    // Detect category from question keywords
    const q = (question || '').toLowerCase();
    const category =
      /job|career|salary|work|hire|promote|resign|freelance|startup/.test(q) ? 'career' :
      /invest|money|budget|debt|saving|stock|crypto|bitcoin|fund|rent|buy/.test(q) ? 'money' :
      /framework|code|software|app|tech|ai|tool|language|dev|cloud/.test(q) ? 'tech' :
      /travel|visit|trip|city|country|hotel|flight/.test(q) ? 'travel' :
      /relationship|partner|marriage|dating|family|friend/.test(q) ? 'relationships' :
      'lifestyle';

    // Build simple article HTML from verdict data
    const optList = options.map(o => `<li>${o}</li>`).join('');
    const prosHtml = (verdict.pros || []).map(p => `<li>${p}</li>`).join('');
    const consHtml = (verdict.cons || []).map(c => `<li>${c}</li>`).join('');
    const cmpRows  = (verdict.comparison || []).map(r =>
      `<tr><td><strong>${r.option}</strong></td><td>${r.assessment}</td></tr>`
    ).join('');

    const article_html = `
<h2>The Decision</h2>
<p>${question || 'A real-world decision was submitted to our AI decision engine.'}</p>
<p><strong>Options considered:</strong></p>
<ul>${optList}</ul>
${factors ? `<p><strong>Key factors:</strong> ${factors}</p>` : ''}

<h2>Why ${verdict.verdict} Wins</h2>
<p>${verdict.reasoning || ''}</p>

<h2>Full Analysis</h2>
<table style="width:100%;border-collapse:collapse">
  <thead><tr><th style="text-align:left;padding:6px 8px">Option</th><th style="text-align:left;padding:6px 8px">Assessment</th></tr></thead>
  <tbody>${cmpRows}</tbody>
</table>

<h2>Strengths &amp; Watch-outs</h2>
${prosHtml ? `<p><strong>Strengths:</strong></p><ul>${prosHtml}</ul>` : ''}
${consHtml ? `<p><strong>Watch-outs:</strong></p><ul>${consHtml}</ul>` : ''}

<blockquote>${verdict.next_step || ''}</blockquote>
<p><em>${verdict.caveat || ''}</em></p>`;

    const post = {
      slug, date, category, title, excerpt,
      question, options, factors,
      article_html,
      verdict:    verdict.verdict,
      confidence: verdict.confidence,
      reasoning:  verdict.reasoning,
      comparison: verdict.comparison,
      pros:       verdict.pros,
      cons:       verdict.cons,
      next_step:  verdict.next_step,
      caveat:     verdict.caveat,
      source:     'user',   // marks as user-submitted, not daily cron
    };

    // Save post
    await env.BLOG_KV.put(`post:${date}:${slug}`, JSON.stringify(post), {
      expirationTtl: 60 * 60 * 24 * 365,
    });

    // Update index
    const indexRaw = await env.BLOG_KV.get('index');
    const index    = indexRaw ? JSON.parse(indexRaw) : [];
    index.unshift({ slug, date, title, excerpt, category, verdict: verdict.verdict });
    if (index.length > 1000) index.pop();
    await env.BLOG_KV.put('index', JSON.stringify(index));

    // Invalidate RSS so it regenerates fresh next hit
    await env.BLOG_KV.delete('rss');

    return slug;
  } catch (e) {
    // Never let blog saving crash the verdict response
    console.error('saveVerdictAsBlogPost failed:', e.message);
    return null;
  }
}

// ── Verdict API ────────────────────────────────────────────────
async function handleVerdict(request, env) {
  if (request.method === 'OPTIONS') return new Response(null, { status: 200, headers: CORS });
  if (request.method !== 'POST') return json({ error: 'Use POST' }, 405);

  let body;
  try { body = await request.json(); }
  catch { return json({ error: 'Invalid JSON' }, 400); }

  const { question, options, factors } = body;
  if (!Array.isArray(options) || options.length < 2)
    return json({ error: 'At least 2 options required' }, 400);

  const optList = options.map((o, i) => `${i + 1}. ${o}`).join('\n');

  const prompt = `You are a sharp, empathetic decision analyst. Analyse this real decision.

DECISION: ${question || 'Not specified'}
OPTIONS:\n${optList}
FACTORS: ${factors || 'Use general reasoning and common sense.'}

Respond ONLY with valid JSON (no fences):
{
  "verdict": "exact option text",
  "confidence": 85,
  "reasoning": "2-3 specific sentences explaining why",
  "comparison": [{"option": "...", "assessment": "1 sentence"}],
  "pros": ["strength 1", "strength 2", "strength 3"],
  "cons": ["watch-out 1", "watch-out 2"],
  "next_step": "one concrete immediate action",
  "caveat": "one honest caveat"
}
Rules: verdict must exactly match one of the listed options. Be specific to this user's context.`;

  try {
    const raw    = await callAnthropic(prompt, env.ANTHROPIC_API_KEY);
    const parsed = JSON.parse(raw);

    // Save as blog post in the background — does NOT delay the verdict response
    let blogSlug = null;
    if (env.BLOG_KV && question) {
      blogSlug = await saveVerdictAsBlogPost(question, options, factors, parsed, env);
    }

    return json({ ...parsed, blog_slug: blogSlug }, 200);

  } catch (err) {
    return json({ error: err.message }, 502);
  }
}

// ── Helpers ────────────────────────────────────────────────────
function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS },
  });
}

function html(body, status = 200) {
  return new Response(body, {
    status,
    headers: { 'Content-Type': 'text/html;charset=UTF-8' },
  });
}

function xml(body, status = 200) {
  return new Response(body, {
    status,
    headers: { 'Content-Type': 'application/xml;charset=UTF-8' },
  });
}

// ── Main router ────────────────────────────────────────────────
export default {

  // HTTP requests
  async fetch(request, env) {
    const url  = new URL(request.url);
    const path = url.pathname.replace(/\/$/, '') || '/';

    console.log(`[Worker] ${request.method} ${path}`);

    // CORS preflight
    if (request.method === 'OPTIONS') return new Response(null, { status: 200, headers: CORS });

    // /api/verdict — main verdict tool
    if (path === '/api/verdict') return handleVerdict(request, env);

    // /api/blog/posts — list all posts
    if (path === '/api/blog/posts') {
      try {
        if (!env.BLOG_KV) return json({ error: 'KV store not configured' }, 500);
        const raw   = await env.BLOG_KV.get('index');
        const index = raw ? JSON.parse(raw) : [];
        return json(index);
      } catch (err) {
        console.error(`Error fetching blog posts: ${err.message}`);
        return json({ error: `Failed to fetch posts: ${err.message}` }, 500);
      }
    }

    // /api/blog/post/:slug — single post
    if (path.startsWith('/api/blog/post/')) {
      try {
        const slug  = path.replace('/api/blog/post/', '');
        if (!slug) return json({ error: 'Missing slug' }, 400);
        
        if (!env.BLOG_KV) return json({ error: 'KV store not configured' }, 500);
        
        const keys  = await env.BLOG_KV.list({ prefix: `post:` });
        let postRaw = null;
        
        if (keys && keys.keys) {
          for (const k of keys.keys) {
            if (k.name.endsWith(`:${slug}`)) { 
              postRaw = await env.BLOG_KV.get(k.name); 
              break; 
            }
          }
        }
        
        if (!postRaw) return json({ error: 'Post not found' }, 404);
        
        const post = JSON.parse(postRaw);
        return json(post);
      } catch (err) {
        console.error(`Error fetching blog post: ${err.message}`);
        return json({ error: `Failed to fetch post: ${err.message}` }, 500);
      }
    }


    // /api/blog/generate — manual trigger (GET, for testing)
    if (path === '/api/blog/generate' && request.method === 'GET') {
      const secret = url.searchParams.get('secret');
      if (secret !== env.CRON_SECRET) return json({ error: 'Unauthorized' }, 401);
      await handleCron(env);
      return json({ ok: true, message: 'Post generated' });
    }

    // /rss.xml
    if (path === '/rss.xml') {
      try {
        if (!env.BLOG_KV) {
          return xml('<?xml version="1.0"?><rss version="2.0"><channel><title>The Verdict</title></channel></rss>');
        }
        const rss = await env.BLOG_KV.get('rss');
        if (rss) return xml(rss);
        // generate on first hit
        const raw   = await env.BLOG_KV.get('index');
        const index = raw ? JSON.parse(raw) : [];
        await generateRSS(index, env);
        const rss2 = await env.BLOG_KV.get('rss');
        return xml(rss2 ?? '<?xml version="1.0"?><rss version="2.0"><channel></channel></rss>');
      } catch (err) {
        console.error(`Error generating RSS: ${err.message}`);
        return xml('<?xml version="1.0"?><rss version="2.0"><channel><title>The Verdict</title><description>Error generating feed</description></channel></rss>', 500);
      }
    }

    // /sitemap.xml — dynamic
    if (path === '/sitemap.xml') {
      try {
        if (!env.BLOG_KV) {
          return xml('<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"></urlset>');
        }
        const raw   = await env.BLOG_KV.get('index');
        const index = raw ? JSON.parse(raw) : [];
        const sitemap = await buildSitemap(index);
        return xml(sitemap);
      } catch (err) {
        console.error(`Error generating sitemap: ${err.message}`);
        return xml('<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"></urlset>', 500);
      }
    }

    // /blog/:slug — handled by ASSETS with SPA fallback (not in Worker routes)
    // All static files including /blog/* are served by ASSETS

    // All other routes — serve static assets via ASSETS
    try {
      console.log(`[ASSETS] Fetching ${path}`);
      const response = await env.ASSETS.fetch(request);
      console.log(`[ASSETS] Response: ${response.status} for ${path}`);
      return response;
    } catch (err) {
      console.error(`Error serving asset ${path}: ${err.message}`);
      return html(`<html><body><h1>Error</h1><p>Failed to serve: ${err.message}</p></body></html>`, 500);
    }
  },

  // Cron trigger — runs daily at 08:00 UTC
  // Add to wrangler.toml:
  //   [[triggers.crons]]
  //   cron = "0 8 * * *"
  async scheduled(event, env, ctx) {
    ctx.waitUntil(handleCron(env));
  },
};

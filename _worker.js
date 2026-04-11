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

// ── Inlined HTML pages (no env.ASSETS needed) ─────────────────
const BLOG_INDEX_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1.0"/>
<title>Verdict Blog — AI Decision Insights & Daily Verdicts | TheVerdict.site</title>
<meta name="description" content="Daily AI-powered verdicts on life's real decisions — careers, lifestyle, tech, money and more. Read the reasoning behind each verdict."/>
<link rel="canonical" href="https://theverdict.site/blog/"/>
<meta name="robots" content="index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1"/>
<meta name="news_keywords" content="AI decision, verdict, choice analysis, decision making, AI advice"/>

<!-- Google News / Discover -->
<meta property="og:type" content="website"/>
<meta property="og:url" content="https://theverdict.site/blog/"/>
<meta property="og:title" content="Verdict Blog — Daily AI Decision Insights"/>
<meta property="og:description" content="Daily AI-powered verdicts on life's real decisions. Read the full reasoning behind each choice."/>
<meta property="og:image" content="https://theverdict.site/og-image.png"/>
<meta property="og:site_name" content="The Verdict"/>
<meta name="twitter:card" content="summary_large_image"/>

<!-- RSS Feed for Google News -->
<link rel="alternate" type="application/rss+xml" title="The Verdict — Daily AI Verdicts" href="https://theverdict.site/rss.xml"/>
<link rel="sitemap" type="application/xml" href="/sitemap.xml"/>

<link href="https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,700;1,400&family=DM+Mono:wght@300;400;500&display=swap" rel="stylesheet"/>
<style>
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  :root {
    --ink: #1a1410; --paper: #f5f0e8; --cream: #ede6d6;
    --accent: #c0392b; --muted: #9e8f7d; --line: rgba(26,20,16,.13);
    --ai-bg: #0f1a0f; --ai-green: #5cb85c;
  }
  html, body { min-height: 100%; background: var(--paper); color: var(--ink); font-family: 'DM Mono', monospace; }
  body::before {
    content: ''; position: fixed; inset: 0; z-index: 0; pointer-events: none;
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='300' height='300'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.75' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='300' height='300' filter='url(%23n)' opacity='.04'/%3E%3C/svg%3E");
  }

  .wrap { position: relative; z-index: 1; max-width: 860px; margin: 0 auto; padding: 48px 24px 80px; }

  /* nav */
  nav { display: flex; align-items: center; justify-content: space-between; margin-bottom: 56px; padding-bottom: 20px; border-bottom: 1px solid var(--line); }
  .nav-logo { font-family: 'Playfair Display', serif; font-size: 18px; font-weight: 700; font-style: italic; color: var(--ink); text-decoration: none; }
  .nav-logo em { color: var(--accent); }
  .nav-links { display: flex; gap: 24px; }
  .nav-links a { font-size: 10px; letter-spacing: .16em; text-transform: uppercase; color: var(--muted); text-decoration: none; transition: color .2s; }
  .nav-links a:hover, .nav-links a.active { color: var(--ink); }

  /* header */
  .blog-header { margin-bottom: 48px; }
  .blog-eyebrow { font-size: 10px; letter-spacing: .24em; text-transform: uppercase; color: var(--muted); margin-bottom: 12px; }
  .blog-title { font-family: 'Playfair Display', serif; font-size: clamp(2rem, 5vw, 3.2rem); font-weight: 700; line-height: 1.1; }
  .blog-title em { color: var(--accent); font-style: italic; }
  .blog-sub { margin-top: 14px; font-size: 12px; color: var(--muted); line-height: 1.8; max-width: 540px; }

  /* filters */
  .filters { display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 36px; }
  .filter-btn { font-size: 10px; letter-spacing: .12em; text-transform: uppercase; padding: 6px 14px; border-radius: 20px; border: 1.5px solid var(--line); background: none; cursor: pointer; font-family: 'DM Mono', monospace; color: var(--muted); transition: all .2s; }
  .filter-btn:hover, .filter-btn.active { background: var(--ink); color: var(--paper); border-color: var(--ink); }

  /* post grid */
  .posts-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(360px, 1fr)); gap: 24px; }

  /* post card */
  .post-card { background: var(--cream); border: 1.5px solid rgba(26,20,16,.15); border-radius: 3px; padding: 28px; box-shadow: 4px 4px 0 rgba(26,20,16,.06); transition: transform .15s, box-shadow .15s; text-decoration: none; color: inherit; display: flex; flex-direction: column; }
  .post-card:hover { transform: translateY(-2px); box-shadow: 6px 8px 0 rgba(26,20,16,.08); }
  .post-card-meta { display: flex; align-items: center; gap: 10px; margin-bottom: 14px; }
  .post-category { font-size: 9px; letter-spacing: .18em; text-transform: uppercase; padding: 3px 9px; border-radius: 10px; background: var(--ink); color: var(--paper); }
  .post-date { font-size: 10px; color: var(--muted); }
  .post-card-title { font-family: 'Playfair Display', serif; font-size: 18px; font-weight: 700; line-height: 1.3; margin-bottom: 10px; }
  .post-card-excerpt { font-size: 12px; color: var(--muted); line-height: 1.75; flex: 1; }
  .post-verdict-pill { margin-top: 18px; display: inline-flex; align-items: center; gap: 8px; background: var(--ai-bg); color: #cde8cd; font-size: 11px; padding: 8px 14px; border-radius: 2px; }
  .post-verdict-pill .verdict-icon { color: var(--ai-green); }
  .post-read-more { margin-top: 16px; font-size: 10px; letter-spacing: .14em; text-transform: uppercase; color: var(--accent); display: flex; align-items: center; gap: 6px; }

  /* featured post */
  .post-card.featured { grid-column: 1 / -1; display: grid; grid-template-columns: 1fr 1fr; gap: 32px; align-items: center; padding: 36px; }
  .post-card.featured .post-card-title { font-size: 26px; }
  .post-card.featured .featured-badge { font-size: 9px; letter-spacing: .2em; text-transform: uppercase; color: var(--accent); margin-bottom: 8px; }

  /* loading / empty */
  .loading { text-align: center; padding: 80px 0; color: var(--muted); font-size: 12px; letter-spacing: .1em; }
  .loading-dots span { animation: dot-pulse 1.2s ease-in-out infinite; display: inline-block; }
  .loading-dots span:nth-child(2) { animation-delay: .2s; }
  .loading-dots span:nth-child(3) { animation-delay: .4s; }
  @keyframes dot-pulse { 0%,100%{opacity:.2} 50%{opacity:1} }

  /* pagination */
  .pagination { display: flex; justify-content: center; gap: 8px; margin-top: 48px; }
  .page-btn { font-family: 'DM Mono', monospace; font-size: 11px; letter-spacing: .1em; padding: 8px 16px; border: 1.5px solid var(--line); border-radius: 2px; background: none; cursor: pointer; color: var(--muted); transition: all .2s; }
  .page-btn:hover, .page-btn.active { background: var(--ink); color: var(--paper); border-color: var(--ink); }

  /* ad unit */
  .ad-unit { width: 100%; text-align: center; margin: 32px 0; }
  .ad-label { font-size: 9px; letter-spacing: .16em; text-transform: uppercase; color: var(--muted); opacity: .45; margin-bottom: 6px; }

  /* footer */
  footer { margin-top: 64px; padding-top: 24px; border-top: 1px solid var(--line); font-size: 10px; color: var(--muted); letter-spacing: .08em; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 12px; }
  footer a { color: var(--muted); text-decoration: none; }
  footer a:hover { color: var(--ink); }

  @media (max-width: 640px) {
    .posts-grid { grid-template-columns: 1fr; }
    .post-card.featured { grid-template-columns: 1fr; }
    nav { flex-direction: column; gap: 16px; align-items: flex-start; }
  }
</style>
</head>
<body>
<div class="wrap">
  <nav>
    <a href="/" class="nav-logo">The <em>Verdict</em></a>
    <div class="nav-links">
      <a href="/">Tool</a>
      <a href="/blog/" class="active">Blog</a>
      <a href="/rss.xml">RSS</a>
    </div>
  </nav>

  <header class="blog-header">
    <p class="blog-eyebrow">daily ai verdicts</p>
    <h1 class="blog-title">Decisions, <em>Decided.</em></h1>
    <p class="blog-sub">Every day our AI analyses real-world decisions across careers, money, lifestyle, and tech — and delivers a reasoned verdict with full explanation.</p>
  </header>

  <!-- Ad: Top leaderboard -->
  <div class="ad-unit">
    <p class="ad-label">Advertisement</p>
    <ins class="adsbygoogle" style="display:block" data-ad-client="ca-pub-XXXXXXXXXXXXXXXX" data-ad-slot="4444444444" data-ad-format="auto" data-full-width-responsive="true"></ins>
    <script>(adsbygoogle = window.adsbygoogle || []).push({});</script>
  </div>

  <div class="filters" id="filters">
    <button class="filter-btn active" data-cat="all">All</button>
    <button class="filter-btn" data-cat="career">Career</button>
    <button class="filter-btn" data-cat="money">Money</button>
    <button class="filter-btn" data-cat="lifestyle">Lifestyle</button>
    <button class="filter-btn" data-cat="tech">Tech</button>
    <button class="filter-btn" data-cat="travel">Travel</button>
    <button class="filter-btn" data-cat="relationships">Relationships</button>
  </div>

  <main id="posts-container">
    <div class="loading">
      <div class="loading-dots"><span>·</span><span>·</span><span>·</span></div>
      <p style="margin-top:12px">Loading verdicts</p>
    </div>
  </main>

  <div class="pagination" id="pagination"></div>

  <!-- Ad: Bottom banner -->
  <div class="ad-unit" style="margin-top:40px">
    <p class="ad-label">Advertisement</p>
    <ins class="adsbygoogle" style="display:block" data-ad-client="ca-pub-XXXXXXXXXXXXXXXX" data-ad-slot="5555555555" data-ad-format="auto" data-full-width-responsive="true"></ins>
    <script>(adsbygoogle = window.adsbygoogle || []).push({});</script>
  </div>

  <footer>
    <span>© 2026 <a href="/">theverdict.site</a></span>
    <span>AI-reasoned · not random · <a href="/rss.xml">RSS Feed</a></span>
  </footer>
</div>

<script>
const POSTS_PER_PAGE = 9;
let allPosts = [];
let currentPage = 1;
let currentCat = 'all';

// Fetch posts from KV via worker
async function fetchPosts() {
  try {
    const res = await fetch('/api/blog/posts');
    if (!res.ok) throw new Error('fetch failed');
    return await res.json();
  } catch {
    return [];
  }
}

function formatDate(iso) {
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
}

function renderPosts(posts, page) {
  const container = document.getElementById('posts-container');
  const filtered  = currentCat === 'all' ? posts : posts.filter(p => p.category === currentCat);
  const total     = filtered.length;
  const start     = (page - 1) * POSTS_PER_PAGE;
  const slice     = filtered.slice(start, start + POSTS_PER_PAGE);

  if (!slice.length) {
    container.innerHTML = '<div class="loading"><p>No verdicts yet in this category.</p></div>';
    return;
  }

  container.innerHTML = slice.map((post, i) => {
    const featured = i === 0 && page === 1 && currentCat === 'all';
    return \`
    <a href="/blog/\${post.slug}/" class="post-card\${featured ? ' featured' : ''}" aria-label="\${post.title}">
      \${featured ? '<div><p class="featured-badge">✦ Today\\'s Featured Verdict</p>' : '<div>'}
      <div class="post-card-meta">
        <span class="post-category">\${post.category}</span>
        <span class="post-date">\${formatDate(post.date)}</span>
      </div>
      <h2 class="post-card-title">\${post.title}</h2>
      <p class="post-card-excerpt">\${post.excerpt}</p>
      <div class="post-verdict-pill"><span class="verdict-icon">✦</span> Verdict: <strong>\${post.verdict}</strong></div>
      <p class="post-read-more">Read full analysis →</p>
      </div>
      \${featured ? '<div style="background:var(--ai-bg);border-radius:2px;padding:24px;color:#cde8cd;font-size:13px;line-height:1.8;opacity:.9;">' + post.excerpt + '</div>' : ''}
    </a>\`;
  }).join('');

  // Wrap in grid
  container.innerHTML = \`<div class="posts-grid">\${container.innerHTML}</div>\`;

  // Pagination
  const totalPages = Math.ceil(total / POSTS_PER_PAGE);
  const pag = document.getElementById('pagination');
  pag.innerHTML = '';
  if (totalPages > 1) {
    for (let p = 1; p <= totalPages; p++) {
      const btn = document.createElement('button');
      btn.className = 'page-btn' + (p === page ? ' active' : '');
      btn.textContent = p;
      btn.onclick = () => { currentPage = p; renderPosts(allPosts, p); window.scrollTo({top:0,behavior:'smooth'}); };
      pag.appendChild(btn);
    }
  }
}

// Filter buttons
document.getElementById('filters').addEventListener('click', e => {
  if (!e.target.matches('.filter-btn')) return;
  document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
  e.target.classList.add('active');
  currentCat = e.target.dataset.cat;
  currentPage = 1;
  renderPosts(allPosts, 1);
});

// Init
(async () => {
  allPosts = await fetchPosts();
  if (!allPosts.length) {
    document.getElementById('posts-container').innerHTML =
      '<div class="loading"><p style="color:var(--muted)">First verdicts publishing soon. Check back tomorrow!</p></div>';
    return;
  }
  renderPosts(allPosts, 1);
})();
</script>
</body>
</html>
`;
const BLOG_POST_HTML  = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1.0"/>
<!-- Dynamic meta filled by JS below -->
<title id="page-title">Loading verdict… | TheVerdict.site</title>
<meta name="robots" content="index, follow, max-image-preview:large, max-snippet:-1"/>
<link rel="canonical" id="page-canonical" href="https://theverdict.site/blog/"/>
<link rel="alternate" type="application/rss+xml" title="The Verdict" href="https://theverdict.site/rss.xml"/>
<meta property="og:site_name" content="The Verdict"/>
<meta property="og:type" content="article"/>
<meta id="og-title"       property="og:title" content=""/>
<meta id="og-desc"        property="og:description" content=""/>
<meta id="og-url"         property="og:url" content=""/>
<meta id="twitter-title"  name="twitter:title" content=""/>
<meta id="twitter-desc"   name="twitter:description" content=""/>
<meta name="twitter:card" content="summary_large_image"/>
<script id="ld-article" type="application/ld+json">{}</script>

<link href="https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,700;1,400&family=DM+Mono:wght@300;400;500&display=swap" rel="stylesheet"/>
<style>
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  :root {
    --ink: #1a1410; --paper: #f5f0e8; --cream: #ede6d6;
    --accent: #c0392b; --muted: #9e8f7d; --line: rgba(26,20,16,.13);
    --ai-bg: #0f1a0f; --ai-border: rgba(92,184,92,.2);
    --ai-fg: #cde8cd; --ai-green: #5cb85c;
  }
  html, body { min-height: 100%; background: var(--paper); color: var(--ink); font-family: 'DM Mono', monospace; }
  body::before {
    content: ''; position: fixed; inset: 0; z-index: 0; pointer-events: none;
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='300' height='300'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.75' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='300' height='300' filter='url(%23n)' opacity='.04'/%3E%3C/svg%3E");
  }
  .wrap { position: relative; z-index: 1; max-width: 720px; margin: 0 auto; padding: 48px 24px 80px; }

  nav { display: flex; align-items: center; justify-content: space-between; margin-bottom: 56px; padding-bottom: 20px; border-bottom: 1px solid var(--line); }
  .nav-logo { font-family: 'Playfair Display', serif; font-size: 18px; font-weight: 700; font-style: italic; color: var(--ink); text-decoration: none; }
  .nav-logo em { color: var(--accent); }
  .nav-links { display: flex; gap: 24px; }
  .nav-links a { font-size: 10px; letter-spacing: .16em; text-transform: uppercase; color: var(--muted); text-decoration: none; transition: color .2s; }
  .nav-links a:hover { color: var(--ink); }

  /* article header */
  .article-header { margin-bottom: 40px; }
  .article-meta { display: flex; align-items: center; gap: 12px; margin-bottom: 18px; flex-wrap: wrap; }
  .cat-badge { font-size: 9px; letter-spacing: .18em; text-transform: uppercase; padding: 4px 10px; border-radius: 10px; background: var(--ink); color: var(--paper); }
  .article-date { font-size: 10px; color: var(--muted); }
  .read-time { font-size: 10px; color: var(--muted); }
  h1.article-title { font-family: 'Playfair Display', serif; font-size: clamp(1.8rem, 5vw, 2.8rem); font-weight: 700; line-height: 1.2; margin-bottom: 18px; }
  .article-excerpt { font-size: 14px; color: var(--muted); line-height: 1.85; border-left: 3px solid var(--accent); padding-left: 18px; }

  /* verdict hero */
  .verdict-hero { background: var(--ink); color: var(--paper); border-radius: 3px; padding: 32px 36px; margin: 36px 0; position: relative; overflow: hidden; }
  .verdict-hero::before { content: '"'; font-family: 'Playfair Display', serif; font-size: 140px; line-height: 1; position: absolute; top: -20px; left: 16px; color: rgba(255,255,255,.05); pointer-events: none; }
  .verdict-hero-label { font-size: 9px; letter-spacing: .24em; text-transform: uppercase; color: rgba(255,255,255,.4); margin-bottom: 10px; }
  .verdict-hero-choice { font-family: 'Playfair Display', serif; font-size: clamp(1.6rem, 4vw, 2.4rem); font-weight: 700; font-style: italic; position: relative; z-index: 1; }
  .verdict-confidence { margin-top: 12px; font-size: 10px; color: rgba(255,255,255,.45); display: flex; align-items: center; gap: 10px; }
  .conf-bar { height: 3px; width: 120px; background: rgba(255,255,255,.1); border-radius: 2px; overflow: hidden; }
  .conf-fill { height: 100%; background: var(--ai-green); border-radius: 2px; }

  /* article body */
  .article-body { font-size: 14px; line-height: 1.9; }
  .article-body h2 { font-family: 'Playfair Display', serif; font-size: 22px; font-weight: 700; margin: 36px 0 14px; }
  .article-body h3 { font-family: 'Playfair Display', serif; font-size: 17px; font-weight: 700; font-style: italic; margin: 28px 0 10px; }
  .article-body p { margin-bottom: 18px; color: rgba(26,20,16,.87); }
  .article-body ul, .article-body ol { padding-left: 22px; margin-bottom: 18px; }
  .article-body li { margin-bottom: 8px; color: rgba(26,20,16,.85); }
  .article-body strong { color: var(--ink); font-weight: 600; }
  .article-body blockquote { border-left: 3px solid var(--accent); padding: 12px 20px; margin: 24px 0; background: var(--cream); border-radius: 0 2px 2px 0; font-style: italic; color: var(--muted); }

  /* analysis sections */
  .analysis-box { background: var(--ai-bg); border: 1px solid var(--ai-border); border-radius: 3px; padding: 28px 32px; margin: 32px 0; }
  .analysis-section { margin-bottom: 22px; }
  .analysis-section:last-child { margin-bottom: 0; }
  .analysis-head { font-size: 9px; letter-spacing: .2em; text-transform: uppercase; color: var(--ai-green); margin-bottom: 10px; display: flex; align-items: center; gap: 8px; }
  .analysis-body { font-size: 13px; color: var(--ai-fg); line-height: 1.85; }
  .analysis-body li { padding-left: 16px; position: relative; margin-bottom: 6px; list-style: none; }
  .analysis-body li::before { content: '→'; position: absolute; left: 0; color: var(--ai-green); font-size: 11px; }
  .pro { color: var(--ai-green) !important; }
  .con { color: rgba(192,57,43,.8) !important; }

  /* cmp table */
  .cmp-table { width: 100%; border-collapse: collapse; margin-top: 8px; }
  .cmp-table th { font-size: 9px; letter-spacing: .16em; text-transform: uppercase; color: var(--ai-green); padding: 8px 10px; text-align: left; border-bottom: 1px solid var(--ai-border); }
  .cmp-table td { font-size: 12px; color: var(--ai-fg); padding: 10px 10px; border-bottom: 1px solid rgba(92,184,92,.06); vertical-align: top; line-height: 1.6; }
  .cmp-table tr.winner td { background: rgba(92,184,92,.06); }
  .cmp-table tr.winner td:first-child { border-left: 2px solid var(--ai-green); padding-left: 8px; }

  /* next step */
  .next-step { background: rgba(92,184,92,.07); border-left: 2px solid var(--ai-green); padding: 14px 18px; border-radius: 0 2px 2px 0; font-size: 13px; color: var(--ai-fg); line-height: 1.75; margin-top: 10px; }

  /* share */
  .share-row { display: flex; gap: 10px; flex-wrap: wrap; margin: 40px 0 32px; align-items: center; }
  .share-label { font-size: 10px; letter-spacing: .16em; text-transform: uppercase; color: var(--muted); }
  .share-btn { font-size: 11px; font-family: 'DM Mono', monospace; letter-spacing: .1em; padding: 8px 16px; border-radius: 2px; border: 1.5px solid var(--line); background: none; cursor: pointer; text-decoration: none; color: var(--ink); transition: all .2s; display: inline-flex; align-items: center; gap: 6px; }
  .share-btn:hover { background: var(--ink); color: var(--paper); border-color: var(--ink); }

  /* CTA */
  .cta-box { background: var(--cream); border: 1.5px solid rgba(26,20,16,.15); border-radius: 3px; padding: 32px; text-align: center; margin: 40px 0; }
  .cta-box h3 { font-family: 'Playfair Display', serif; font-size: 22px; font-weight: 700; margin-bottom: 10px; }
  .cta-box p { font-size: 12px; color: var(--muted); margin-bottom: 20px; }
  .cta-btn { display: inline-block; background: var(--ink); color: var(--paper); padding: 14px 28px; border-radius: 2px; font-family: 'DM Mono', monospace; font-size: 11px; letter-spacing: .18em; text-transform: uppercase; text-decoration: none; transition: background .2s; }
  .cta-btn:hover { background: #2d2520; }

  /* ad */
  .ad-unit { width: 100%; text-align: center; margin: 32px 0; }
  .ad-label { font-size: 9px; letter-spacing: .16em; text-transform: uppercase; color: var(--muted); opacity: .45; margin-bottom: 6px; }

  /* loading */
  .loading { text-align: center; padding: 80px 0; color: var(--muted); font-size: 13px; }

  footer { margin-top: 64px; padding-top: 24px; border-top: 1px solid var(--line); font-size: 10px; color: var(--muted); letter-spacing: .08em; display: flex; justify-content: space-between; gap: 12px; flex-wrap: wrap; }
  footer a { color: var(--muted); text-decoration: none; }

  @media (max-width: 600px) {
    .verdict-hero { padding: 24px 20px; }
    .analysis-box { padding: 20px 18px; }
  }
</style>
</head>
<body>
<div class="wrap">
  <nav>
    <a href="/" class="nav-logo">The <em>Verdict</em></a>
    <div class="nav-links">
      <a href="/">Tool</a>
      <a href="/blog/">Blog</a>
      <a href="/rss.xml">RSS</a>
    </div>
  </nav>

  <div id="article-root">
    <div class="loading">Loading verdict…</div>
  </div>

  <footer>
    <span>© 2026 <a href="/">theverdict.site</a></span>
    <span>AI-reasoned · not random · <a href="/rss.xml">RSS</a></span>
  </footer>
</div>

<script>
const esc = s => String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');

function slug() {
  const parts = location.pathname.replace(/\\/+$/,'').split('/');
  return parts[parts.length - 1];
}

function setMeta(post) {
  const title = \`\${post.title} | TheVerdict.site\`;
  const url   = \`https://theverdict.site/blog/\${post.slug}/\`;
  document.getElementById('page-title').textContent     = title;
  document.getElementById('page-canonical').href        = url;
  document.getElementById('og-title').content           = post.title;
  document.getElementById('og-desc').content            = post.excerpt;
  document.getElementById('og-url').content             = url;
  document.getElementById('twitter-title').content      = post.title;
  document.getElementById('twitter-desc').content       = post.excerpt;
  document.querySelector('meta[name="description"]') && (document.querySelector('meta[name="description"]').content = post.excerpt);

  // Article structured data
    document.getElementById('ld-article').textContent = JSON.stringify({
    "@context": "https://schema.org",
    "@type": "Article",
    "headline": post.title,
    "description": post.excerpt,
    "datePublished": post.date,
    "dateModified": post.date,
    "author": { "@type": "Organization", "name": "The Verdict AI", "url": "https://theverdict.site" },
    "publisher": { "@type": "Organization", "name": "The Verdict", "url": "https://theverdict.site", "logo": { "@type": "ImageObject", "url": "https://theverdict.site/og-image.png" } },
    "mainEntityOfPage": { "@type": "WebPage", "@id": url },
    "keywords": post.keywords?.join(', ') ?? post.category,
    "articleSection": post.category,
    "url": url
  });
}

function renderPost(post) {
  setMeta(post);

  const conf    = Math.min(100, Math.max(10, parseInt(post.confidence) || 75));
  const verdict = post.verdict ?? '';
  const shareText = encodeURIComponent(\`The AI verdict on "\${post.title}" is: \${verdict} — read the full analysis\`);
  const shareUrl  = encodeURIComponent(\`https://theverdict.site/blog/\${post.slug}/\`);

  const cmpRows = (post.comparison ?? []).map(r => {
    const isW = (r.option ?? '').toLowerCase() === verdict.toLowerCase();
    return \`<tr class="\${isW ? 'winner' : ''}"><td>\${esc(r.option)}\${isW ? ' ✦' : ''}</td><td>\${esc(r.assessment)}</td></tr>\`;
  }).join('');

  const prosHtml = (post.pros ?? []).map(p => \`<li class="pro">+ \${esc(p)}</li>\`).join('');
  const consHtml = (post.cons ?? []).map(c => \`<li class="con">− \${esc(c)}</li>\`).join('');

  document.getElementById('article-root').innerHTML = \`
    <article itemscope itemtype="https://schema.org/Article">
      <header class="article-header">
        <div class="article-meta">
          <span class="cat-badge">\${esc(post.category)}</span>
          <span class="article-date">\${new Date(post.date).toLocaleDateString('en-GB',{day:'numeric',month:'long',year:'numeric'})}</span>
          <span class="read-time">5 min read</span>
        </div>
        <h1 class="article-title" itemprop="headline">\${esc(post.title)}</h1>
        <p class="article-excerpt" itemprop="description">\${esc(post.excerpt)}</p>
      </header>

      <!-- Ad: top -->
      <div class="ad-unit">
        <p class="ad-label">Advertisement</p>
        <ins class="adsbygoogle" style="display:block" data-ad-client="ca-pub-XXXXXXXXXXXXXXXX" data-ad-slot="6666666666" data-ad-format="auto" data-full-width-responsive="true"></ins>
        <script>(adsbygoogle = window.adsbygoogle || []).push({});<\\/script>
      </div>

      <!-- Verdict hero -->
      <div class="verdict-hero">
        <p class="verdict-hero-label">The AI Verdict</p>
        <div class="verdict-hero-choice">\${esc(verdict)}</div>
        <div class="verdict-confidence">
          <span>\${conf}% confidence</span>
          <div class="conf-bar"><div class="conf-fill" style="width:\${conf}%"></div></div>
        </div>
      </div>

      <!-- Article body -->
      <div class="article-body" itemprop="articleBody">
        \${post.article_html ?? \`<p>\${esc(post.body ?? '')}</p>\`}
      </div>

      <!-- Full AI analysis -->
      <div class="analysis-box">
        <div class="analysis-section">
          <div class="analysis-head">💡 Why This Verdict</div>
          <div class="analysis-body"><p>\${esc(post.reasoning)}</p></div>
        </div>
        <div class="analysis-section">
          <div class="analysis-head">📊 Options Compared</div>
          <div class="analysis-body">
            <table class="cmp-table">
              <thead><tr><th>Option</th><th>Assessment</th></tr></thead>
              <tbody>\${cmpRows}</tbody>
            </table>
          </div>
        </div>
        <div class="analysis-section">
          <div class="analysis-head">⚖️ Strengths & Watch-outs</div>
          <div class="analysis-body">
            <ul>\${prosHtml}\${consHtml}</ul>
          </div>
        </div>
        <div class="analysis-section">
          <div class="analysis-head">🚀 Next Step</div>
          <div class="next-step">\${esc(post.next_step)}</div>
        </div>
      </div>

      <!-- Ad: mid -->
      <div class="ad-unit">
        <p class="ad-label">Advertisement</p>
        <ins class="adsbygoogle" style="display:block" data-ad-client="ca-pub-XXXXXXXXXXXXXXXX" data-ad-slot="7777777777" data-ad-format="rectangle" data-full-width-responsive="true"></ins>
        <script>(adsbygoogle = window.adsbygoogle || []).push({});<\\/script>
      </div>

      <!-- Share -->
      <div class="share-row">
        <span class="share-label">Share this verdict</span>
        <a class="share-btn" href="https://twitter.com/intent/tweet?text=\${shareText}&url=\${shareUrl}" target="_blank" rel="noopener">𝕏 Twitter</a>
        <a class="share-btn" href="https://www.linkedin.com/sharing/share-offsite/?url=\${shareUrl}" target="_blank" rel="noopener">LinkedIn</a>
        <a class="share-btn" href="https://wa.me/?text=\${shareText}%20\${shareUrl}" target="_blank" rel="noopener">WhatsApp</a>
        <button class="share-btn" onclick="navigator.clipboard.writeText(location.href);this.textContent='✓ Copied'">Copy link</button>
      </div>

      <!-- CTA -->
      <div class="cta-box">
        <h3>Make your own verdict</h3>
        <p>Have a decision to make? Enter your question, options, and factors — the AI will reason through it and give you a justified answer.</p>
        <a href="/" class="cta-btn">Get the verdict →</a>
      </div>
    </article>\`;
}

// Load post
(async () => {
  const s = slug();
  if (!s) { location.href = '/blog/'; return; }
  try {
    const res = await fetch(\`/api/blog/post/\${s}\`);
    if (!res.ok) throw new Error('not found');
    const post = await res.json();
    renderPost(post);
  } catch {
    document.getElementById('article-root').innerHTML =
      '<div class="loading"><p>Verdict not found.</p><p style="margin-top:12px"><a href="/blog/" style="color:var(--accent)">← Back to blog</a></p></div>';
  }
})();
</script>
</body>
</html>
`;


// ── Daily topic seeds ──────────────────────────────────────────
// AI picks one each day based on the date
const TOPIC_SEEDS = [
  { category: 'career',        question: 'Should I stay in my current job or look for a new one?',           options: ['Stay and grow internally', 'Start actively job hunting', 'Go freelance or consult'],        factors: 'Current market uncertainty, skill development opportunities, compensation growth, work-life balance, career trajectory' },
  { category: 'money',         question: 'Should I invest my savings in index funds or pay off my debt first?', options: ['Invest in index funds (S&P 500)', 'Pay off high-interest debt first', 'Split 50/50 between both'], factors: 'Compound interest, interest rates, psychological peace of mind, emergency fund, long-term wealth building' },
  { category: 'tech',          question: 'Which JavaScript framework should a startup choose in 2026?',        options: ['Next.js', 'Remix', 'SvelteKit', 'Nuxt 3'],                                                  factors: 'Ecosystem maturity, hiring pool, performance, developer experience, community support, enterprise adoption' },
  { category: 'lifestyle',     question: 'Should I move to a new city or stay where I am?',                   options: ['Move to a new city', 'Stay and invest locally', 'Try a 3-month test move first'],           factors: 'Career opportunities, cost of living, social connections, personal growth, family ties, housing market' },
  { category: 'travel',        question: 'Where should a solo traveller go for 2 weeks in Asia?',             options: ['Japan', 'Vietnam', 'Thailand', 'Indonesia (Bali)'],                                         factors: 'Budget, solo safety, cultural richness, food scene, nature, Instagram-worthiness, English accessibility' },
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
      model:      'claude-sonnet-4-5',
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
      .replace(/-$/, '') + '-' + Date.now().toString(36);

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
    if (env.BLOG_KV && question) {
      env.BLOG_KV && saveVerdictAsBlogPost(question, options, factors, parsed, env);
    }

    // Return slug so frontend can optionally link to the blog post
    const slug = (question || parsed.verdict || '')
      .toLowerCase().replace(/[^a-z0-9\s-]/g,'').replace(/\s+/g,'-').slice(0,60);
    return json({ ...parsed, blog_slug: slug }, 200);

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

    // CORS preflight
    if (request.method === 'OPTIONS') return new Response(null, { status: 200, headers: CORS });

    // /api/verdict — main verdict tool
    if (path === '/api/verdict') return handleVerdict(request, env);

    // /api/blog/posts — list all posts
    if (path === '/api/blog/posts') {
      const raw   = await env.BLOG_KV.get('index');
      const index = raw ? JSON.parse(raw) : [];
      return json(index);
    }

    // /api/blog/post/:slug — single post
    if (path.startsWith('/api/blog/post/')) {
      const slug  = path.replace('/api/blog/post/', '');
      const keys  = await env.BLOG_KV.list({ prefix: `post:` });
      let postRaw = null;
      for (const k of keys.keys) {
        if (k.name.endsWith(`:${slug}`)) { postRaw = await env.BLOG_KV.get(k.name); break; }
      }
      if (!postRaw) return json({ error: 'Not found' }, 404);
      return json(JSON.parse(postRaw));
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
      const rss = await env.BLOG_KV.get('rss');
      if (rss) return xml(rss);
      // generate on first hit
      const raw   = await env.BLOG_KV.get('index');
      const index = raw ? JSON.parse(raw) : [];
      const fresh = await buildSitemap(index); // reuse builder shape
      await generateRSS(index, env);
      const rss2 = await env.BLOG_KV.get('rss');
      return xml(rss2 ?? '<?xml version="1.0"?><rss version="2.0"><channel></channel></rss>');
    }

    // /sitemap.xml — dynamic
    if (path === '/sitemap.xml') {
      const raw   = await env.BLOG_KV.get('index');
      const index = raw ? JSON.parse(raw) : [];
      return xml(await buildSitemap(index));
    }

    // /blog/ listing page
    if (path === '/blog') {
      return html(BLOG_INDEX_HTML);
    }

    // /blog/:slug — serve inlined post.html (no env.ASSETS needed)
    if (path.startsWith('/blog/')) {
      return html(BLOG_POST_HTML);
    }

    // All other routes — try ASSETS, fall back to index.html
    if (env.ASSETS) return env.ASSETS.fetch(request);
    return html(BLOG_INDEX_HTML);
  },

  // Cron trigger — runs daily at 08:00 UTC
  // Add to wrangler.toml:
  //   [[triggers.crons]]
  //   cron = "0 8 * * *"
  async scheduled(event, env, ctx) {
    ctx.waitUntil(handleCron(env));
  },
};

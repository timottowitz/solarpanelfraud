#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const matter = require('gray-matter');
const { marked } = require('marked');

const ROOT = path.resolve(__dirname, '..');
const DIST = path.join(ROOT, 'dist');
const CONTENT = path.join(ROOT, 'src', 'content', 'blog');

function ensureDir(d) { if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true }); }

function walk(dir) {
  if (!fs.existsSync(dir)) return [];
  const out = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...walk(p));
    else if (e.isFile() && e.name.endsWith('.md')) out.push(p);
  }
  return out;
}

function htmlEscape(s) {
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function baseHtml(template, headMeta, bodyHtml) {
  // Inject head tags and static body content into dist/index.html
  let html = template;
  // naive head injection right before </head>
  html = html.replace(/<title>.*?<\/title>/s, `<title>${htmlEscape(headMeta.title)}</title>`);
  const headInsert = [
    `<meta name="description" content="${htmlEscape(headMeta.description || '')}">`,
    `<link rel="canonical" href="${htmlEscape(headMeta.canonical)}">`,
    `<meta property="og:title" content="${htmlEscape(headMeta.title)}">`,
    `<meta property="og:description" content="${htmlEscape(headMeta.description || '')}">`,
    `<meta property="og:type" content="article">`,
    `<meta property="og:url" content="${htmlEscape(headMeta.canonical)}">`,
    `<meta property="og:image" content="${htmlEscape(headMeta.ogImage || '')}">`,
  ].join('\n');
  html = html.replace(/<\/head>/, headInsert + '\n</head>');
  // Replace root content
  html = html.replace('<div id="root"></div>', `<div id="root">${bodyHtml}</div>`);
  return html;
}

function renderPost({ slug, title, description, category, date, content }) {
  const md = content
    .replace(/<hub-list[^>]*\/>/g, '')
    .replace(/<see-also[^>]*\/>/g, '')
    .replace(/<audio-story[^>]*\/>/g, '');
  const article = `
    <article class="container mx-auto px-4 py-8">
      <header>
        <div class="text-sm text-muted-foreground mb-4">${htmlEscape(category || '')} • ${htmlEscape(date || '')}</div>
        <h1 class="text-4xl font-bold mb-4">${htmlEscape(title)}</h1>
        <p class="text-xl text-muted-foreground mb-8">${htmlEscape(description || '')}</p>
      </header>
      <div class="prose max-w-none">${marked.parse(md)}</div>
    </article>
  `;
  return article;
}

function buildIndex(posts) {
  const items = posts.map(p => `
    <a href="/blog/${p.slug}" class="block group border rounded-lg p-4 hover:border-primary/50">
      <div class="text-xs text-muted-foreground mb-2">${htmlEscape(p.category)}</div>
      <h2 class="font-semibold group-hover:text-primary mb-1">${htmlEscape(p.title)}</h2>
      <p class="text-sm text-muted-foreground">${htmlEscape(p.description || '')}</p>
    </a>
  `).join('\n');
  return `<div class="container mx-auto px-4 py-8"><h1 class="text-3xl font-bold mb-6">Solar Fraud Legal Blog</h1><div class="grid md:grid-cols-2 gap-4">${items}</div></div>`;
}

function readPosts() {
  const files = walk(CONTENT);
  return files.map(f => {
    const raw = fs.readFileSync(f, 'utf8');
    const { data, content } = matter(raw);
    return {
      slug: (data.slug || path.basename(f).replace(/\.md$/i, '')).toLowerCase(),
      title: data.title || 'Article',
      description: data.description || '',
      category: data.category || 'Blog',
      date: data.publishDate || '',
      tags: Array.isArray(data.tags) ? data.tags : [],
      content
    };
  });
}

function writeFileForRoute(routePath, html) {
  // routePath like /blog/foo or /blog
  const targetDir = path.join(DIST, routePath.replace(/^\//, ''), routePath.endsWith('/') ? '' : '/');
  ensureDir(targetDir);
  fs.writeFileSync(path.join(targetDir, 'index.html'), html, 'utf8');
}

function main() {
  if (!fs.existsSync(DIST)) {
    console.error('dist/ not found. Run build first.');
    process.exit(1);
  }
  const template = fs.readFileSync(path.join(DIST, 'index.html'), 'utf8');
  const origin = process.env.SITE_ORIGIN || 'https://solarpanelfraud.org';
  const posts = readPosts().sort((a,b) => new Date(b.date) - new Date(a.date));

  // Blog index
  const blogHead = {
    title: 'Solar Fraud Legal Blog | Expert Insights & Consumer Protection',
    description: 'Expert legal insights on solar panel fraud, consumer protection, and your rights.',
    canonical: `${origin}/blog`,
    ogImage: `${origin}/og/${posts[0]?.slug || 'og'}.png`
  };
  const blogHtml = baseHtml(template, blogHead, buildIndex(posts.slice(0, 40)));
  writeFileForRoute('/blog', blogHtml);

  // Posts
  for (const p of posts) {
    const head = {
      title: `${p.title} | SolarPanelFraud.org`,
      description: p.description,
      canonical: `${origin}/blog/${p.slug}`,
      ogImage: `${origin}/og/${p.slug}.png`
    };
    const body = renderPost(p);
    const html = baseHtml(template, head, body);
    writeFileForRoute(`/blog/${p.slug}`, html);
  }

  // Simple category pages
  const categories = Array.from(new Set(posts.map(p => p.category)));
  for (const c of categories) {
    const list = posts.filter(p => p.category === c).slice(0, 40);
    const head = {
      title: `Blog Category: ${c} | SolarPanelFraud.org`,
      description: `Articles filed under ${c}`,
      canonical: `${origin}/blog/category/${encodeURIComponent(c)}`,
      ogImage: `${origin}/og/${list[0]?.slug || 'og'}.png`
    };
    const body = buildIndex(list);
    const html = baseHtml(template, head, body);
    writeFileForRoute(`/blog/category/${c}`, html);
  }

  // Simple tag pages
  const tagSet = new Set();
  posts.forEach(p => (p.tags||[]).forEach(t => tagSet.add(t)));
  for (const t of Array.from(tagSet)) {
    const list = posts.filter(p => (p.tags||[]).includes(t)).slice(0, 40);
    const head = {
      title: `Tag: ${t} | SolarPanelFraud.org`,
      description: `Articles tagged with ${t}`,
      canonical: `${origin}/blog/tag/${encodeURIComponent(t)}`,
      ogImage: `${origin}/og/${list[0]?.slug || 'og'}.png`
    };
    const body = buildIndex(list);
    const html = baseHtml(template, head, body);
    writeFileForRoute(`/blog/tag/${t}`, html);
  }
  console.log('Static prerender complete.');
}

main();


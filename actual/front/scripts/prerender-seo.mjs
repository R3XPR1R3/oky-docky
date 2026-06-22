import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const templatesDir = path.resolve(process.env.SEO_TEMPLATES_DIR || '../back/data/templates');
const distDir = path.resolve('dist');
const siteUrl = (process.env.SEO_SITE_URL || 'https://barckhat.com/oky-docky').replace(/\/$/, '');

const escapeHtml = (value = '') => String(value)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

function replaceMeta(html, selector, content, property = false) {
  const attr = property ? 'property' : 'name';
  const pattern = new RegExp(`<meta\\s+${attr}="${selector}"[^>]*>`, 'i');
  const tag = `<meta ${attr}="${selector}" content="${escapeHtml(content)}" />`;
  return pattern.test(html) ? html.replace(pattern, tag) : html.replace('</head>', `    ${tag}\n  </head>`);
}

const shell = await readFile(path.join(distDir, 'index.html'), 'utf8');
const directories = await readdir(templatesDir, { withFileTypes: true });
let generated = 0;
const publishedTemplates = [];

for (const directory of directories) {
  if (!directory.isDirectory()) continue;
  let meta;
  try {
    meta = JSON.parse(await readFile(path.join(templatesDir, directory.name, 'template.json'), 'utf8'));
  } catch { continue; }
  if (meta.published === false) continue;
  publishedTemplates.push(meta);

  const id = meta.id || directory.name;
  const title = meta.seo_title || `${meta.title || id} - Free Online Form | Oky-Docky`;
  const description = meta.seo_description || `Fill out ${meta.title || id} online with guided questions and download the completed PDF.`;
  const heading = meta.seo_heading || `Fill out ${meta.title || id} online`;
  const intro = meta.seo_intro || meta.description || description;
  const keywords = (meta.seo_keywords || meta.tags || []).join(', ');
  const canonical = `${siteUrl}/${id}`;
  const faq = (meta.seo_faq || []).filter((item) => item.question && item.answer);
  const structuredData = JSON.stringify({
    '@context': 'https://schema.org', '@graph': [{
      '@type': 'WebApplication', name: meta.title || id, description, url: canonical,
      applicationCategory: 'BusinessApplication', operatingSystem: 'Web', isAccessibleForFree: true,
      isBasedOn: meta.source_url || undefined, publisher: { '@type': 'Organization', name: 'Oky-Docky' },
      offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
    }, ...(faq.length ? [{ '@type': 'FAQPage', mainEntity: faq.map((item) => ({
      '@type': 'Question', name: item.question, acceptedAnswer: { '@type': 'Answer', text: item.answer },
    })) }] : [])],
  }).replace(/</g, '\\u003c');
  const sectionsHtml = (meta.seo_sections || []).filter((section) => section.heading && section.body)
    .map((section) => `<section><h2>${escapeHtml(section.heading)}</h2><p>${escapeHtml(section.body)}</p></section>`).join('');
  const faqHtml = faq.length ? `<section><h2>Frequently asked questions</h2>${faq.map((item) => `<details><summary>${escapeHtml(item.question)}</summary><p>${escapeHtml(item.answer)}</p></details>`).join('')}</section>` : '';

  let html = shell
    .replace(/<script\s+type="application\/ld\+json">[\s\S]*?<\/script>/gi, '')
    .replace(/<title>[\s\S]*?<\/title>/i, `<title>${escapeHtml(title)}</title>`);
  html = replaceMeta(html, 'description', description);
  html = replaceMeta(html, 'keywords', keywords);
  html = replaceMeta(html, 'og:title', title, true);
  html = replaceMeta(html, 'og:description', description, true);
  html = replaceMeta(html, 'og:url', canonical, true);
  if (meta.og_image) html = replaceMeta(html, 'og:image', meta.og_image, true);
  html = replaceMeta(html, 'twitter:title', title);
  html = replaceMeta(html, 'twitter:description', description);
  html = html.replace(/<link\s+rel="canonical"[^>]*>/i, `<link rel="canonical" href="${escapeHtml(canonical)}" />`);
  html = html.replace('</head>', `    <script type="application/ld+json">${structuredData}</script>\n  </head>`);
  html = html.replace('<div id="root"></div>', `<div id="root"><main style="max-width:900px;margin:60px auto;padding:24px;font-family:system-ui,sans-serif"><nav><a href="${siteUrl}/templates">All forms</a></nav><h1>${escapeHtml(heading)}</h1><p>${escapeHtml(intro)}</p>${sectionsHtml}${faqHtml}<p><a href="${canonical}/start">Start guided ${escapeHtml(meta.title || 'form')}</a></p></main></div>`);
  await writeFile(path.join(distDir, `${id}.html`), html, 'utf8');
  let startHtml = shell.replace(/<title>[\s\S]*?<\/title>/i, `<title>${escapeHtml(meta.title || id)} assistant | Oky-Docky</title>`);
  startHtml = replaceMeta(startHtml, 'robots', 'noindex,follow');
  startHtml = replaceMeta(startHtml, 'googlebot', 'noindex,follow');
  startHtml = replaceMeta(startHtml, 'bingbot', 'noindex,follow');
  startHtml = startHtml.replace(/<link\s+rel="canonical"[^>]*>/i, `<link rel="canonical" href="${escapeHtml(canonical)}" />`);
  await mkdir(path.join(distDir, id), { recursive: true });
  await writeFile(path.join(distDir, id, 'start.html'), startHtml, 'utf8');
  generated += 1;
}

let listing = shell
  .replace(/<title>[\s\S]*?<\/title>/i, '<title>Free Online Tax and Legal Forms | Oky-Docky</title>')
  .replace('<div id="root"></div>', `<div id="root"><main style="max-width:900px;margin:60px auto;padding:24px;font-family:system-ui,sans-serif"><h1>Free online document forms</h1><p>Choose a guided form, answer the questions, and download the completed PDF.</p><ul>${publishedTemplates.map((meta) => `<li style="margin:18px 0"><a href="${siteUrl}/${escapeHtml(meta.id)}"><strong>${escapeHtml(meta.title)}</strong></a><br>${escapeHtml(meta.seo_description || meta.description || '')}</li>`).join('')}</ul></main></div>`);
listing = replaceMeta(listing, 'description', 'Browse free guided tax, employment, identity, and legal document forms with completed PDF download.');
listing = listing.replace(/<link\s+rel="canonical"[^>]*>/i, `<link rel="canonical" href="${siteUrl}/templates" />`);
await writeFile(path.join(distDir, 'templates.html'), listing, 'utf8');

console.log(`Generated ${generated} indexable template pages.`);

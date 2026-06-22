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
  const defaultFaq = [
    { question: `Can I complete ${meta.title || id} online?`, answer: 'You can prepare the document with guided questions and download a PDF. Complete any filing, delivery, signature, witness, or notarization steps required by the official instructions.' },
    { question: 'Does Oky-Docky file the document for me?', answer: 'No. Oky-Docky prepares a PDF from your answers. Review the official instructions to determine where and how it must be submitted.' },
  ];
  const faq = (meta.seo_faq?.length ? meta.seo_faq : defaultFaq).filter((item) => item.question && item.answer);
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
  const defaultSections = [
    { heading: `What is ${meta.title || id}?`, body: meta.description || `${meta.title || id} is a document you can prepare with the guided Oky-Docky workflow.` },
    { heading: 'What information will you need?', body: 'Have the names, dates, addresses, identification details, and supporting records requested by the document available before you begin.' },
    { heading: 'How the guided form works', body: 'Answer the questions, review the generated values, then download the prepared PDF. Check the official instructions before filing or signing it.' },
  ];
  const sections = meta.seo_sections?.length ? meta.seo_sections : defaultSections;
  const sectionsHtml = sections.filter((section) => section.heading && section.body)
    .map((section) => `<section><h2>${escapeHtml(section.heading)}</h2><p>${escapeHtml(section.body)}</p></section>`).join('');
  const faqHtml = faq.length ? `<section><h2>Frequently asked questions</h2>${faq.map((item) => `<details><summary>${escapeHtml(item.question)}</summary><p>${escapeHtml(item.answer)}</p></details>`).join('')}</section>` : '';
  const partnerResources = (meta.partner_resources || []).filter((item) =>
    (item.placement === 'landing' || item.placement === 'both') && /^https?:\/\//i.test(item.url || '')
  );
  const partnerHtml = partnerResources.length ? `<section><h2>Optional professional services</h2>${partnerResources.map((item) => `<article><h3>${escapeHtml(item.title)}</h3><p>${escapeHtml(item.description)}</p><a href="${escapeHtml(item.url)}" rel="sponsored noreferrer">${escapeHtml(item.button_label || 'View resource')}</a><p><small>${escapeHtml(item.disclosure || 'Optional third-party service. Oky-Docky may receive compensation for referrals.')}</small></p></article>`).join('')}</section>` : '';
  const guides = (meta.seo_guides || []).filter((guide) =>
    guide.published !== false && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(guide.slug || '') &&
    guide.title && guide.description && guide.heading && guide.intro &&
    (guide.sections || []).some((section) => section.heading && section.body)
  );
  const guidesHtml = guides.length ? `<section><h2>Helpful ${escapeHtml(meta.title || 'form')} guides</h2><ul>${guides.map((guide) => `<li><a href="${canonical}/${escapeHtml(guide.slug)}">${escapeHtml(guide.heading)}</a> - ${escapeHtml(guide.description)}</li>`).join('')}</ul></section>` : '';

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
  html = html.replace('<div id="root"></div>', `<div id="root"><main style="max-width:900px;margin:60px auto;padding:24px;font-family:system-ui,sans-serif"><nav><a href="${siteUrl}/templates">All forms</a></nav><h1>${escapeHtml(heading)}</h1><p>${escapeHtml(intro)}</p>${sectionsHtml}${faqHtml}${guidesHtml}${partnerHtml}<p><a href="${canonical}/start">Start guided ${escapeHtml(meta.title || 'form')}</a></p></main></div>`);
  await writeFile(path.join(distDir, `${id}.html`), html, 'utf8');

  for (const guide of guides) {
    const guideCanonical = `${canonical}/${guide.slug}`;
    const guideFaq = (guide.faq || []).filter((item) => item.question && item.answer);
    const guideSectionsHtml = guide.sections.filter((section) => section.heading && section.body)
      .map((section) => `<section><h2>${escapeHtml(section.heading)}</h2><p>${escapeHtml(section.body)}</p></section>`).join('');
    const guideFaqHtml = guideFaq.length ? `<section><h2>Frequently asked questions</h2>${guideFaq.map((item) => `<details><summary>${escapeHtml(item.question)}</summary><p>${escapeHtml(item.answer)}</p></details>`).join('')}</section>` : '';
    const guideStructuredData = JSON.stringify({
      '@context': 'https://schema.org', '@graph': [{
        '@type': 'Article', headline: guide.heading, description: guide.description,
        mainEntityOfPage: guideCanonical, about: meta.title || id,
        publisher: { '@type': 'Organization', name: 'Oky-Docky' },
      }, ...(guideFaq.length ? [{ '@type': 'FAQPage', mainEntity: guideFaq.map((item) => ({
        '@type': 'Question', name: item.question,
        acceptedAnswer: { '@type': 'Answer', text: item.answer },
      })) }] : [])],
    }).replace(/</g, '\\u003c');
    let guideHtml = shell
      .replace(/<script\s+type="application\/ld\+json">[\s\S]*?<\/script>/gi, '')
      .replace(/<title>[\s\S]*?<\/title>/i, `<title>${escapeHtml(guide.title)}</title>`);
    guideHtml = replaceMeta(guideHtml, 'description', guide.description);
    guideHtml = replaceMeta(guideHtml, 'keywords', (guide.keywords || []).join(', '));
    guideHtml = replaceMeta(guideHtml, 'robots', 'index,follow,max-snippet:-1,max-image-preview:large');
    guideHtml = replaceMeta(guideHtml, 'og:title', guide.title, true);
    guideHtml = replaceMeta(guideHtml, 'og:description', guide.description, true);
    guideHtml = replaceMeta(guideHtml, 'og:url', guideCanonical, true);
    guideHtml = guideHtml.replace(/<link\s+rel="canonical"[^>]*>/i, `<link rel="canonical" href="${escapeHtml(guideCanonical)}" />`);
    guideHtml = guideHtml.replace('</head>', `    <script type="application/ld+json">${guideStructuredData}</script>\n  </head>`);
    guideHtml = guideHtml.replace('<div id="root"></div>', `<div id="root"><main style="max-width:900px;margin:60px auto;padding:24px;font-family:system-ui,sans-serif"><nav><a href="${canonical}">${escapeHtml(meta.title || id)}</a></nav><article><h1>${escapeHtml(guide.heading)}</h1><p>${escapeHtml(guide.intro)}</p>${guideSectionsHtml}${guideFaqHtml}<p><a href="${canonical}/start">Fill out ${escapeHtml(meta.title || 'the form')} online</a></p></article></main></div>`);
    await mkdir(path.join(distDir, id), { recursive: true });
    await writeFile(path.join(distDir, id, `${guide.slug}.html`), guideHtml, 'utf8');
  }

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

let privacy = shell
  .replace(/<title>[\s\S]*?<\/title>/i, '<title>Privacy Policy | Oky-Docky</title>')
  .replace('<div id="root"></div>', `<div id="root"><main style="max-width:800px;margin:60px auto;padding:24px;font-family:system-ui,sans-serif"><h1>Privacy Policy</h1><p>Last updated: June 22, 2026</p><p>This policy explains how Oky-Docky and Barckhat LLC handle information when visitors browse the site, complete a guided questionnaire, and generate a document.</p><h2>Document information</h2><p>Answers are sent to the server when a visitor requests a PDF. The server uses them to create the requested document, delivers the PDF to the browser, and deletes the temporary generated file after delivery. Form answers, signatures, tax identifiers, and PDF contents are not added to analytics.</p><h2>Analytics and service providers</h2><p>Oky-Docky records first-party usage and attribution events using a random session identifier. Cloudflare, hosting infrastructure, advertising providers, and optional external partners may process limited technical information under their own terms.</p><h2>Contact</h2><p>Privacy questions: legal@barckhat.com.</p></main></div>`);
privacy = replaceMeta(privacy, 'description', 'How Oky-Docky handles form answers, generated documents, analytics, advertising, and service-provider data.');
privacy = privacy.replace(/<link\s+rel="canonical"[^>]*>/i, `<link rel="canonical" href="${siteUrl}/privacy" />`);
await writeFile(path.join(distDir, 'privacy.html'), privacy, 'utf8');

console.log(`Generated ${generated} indexable template pages.`);

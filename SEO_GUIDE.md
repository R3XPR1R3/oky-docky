# Oky-Docky SEO checklist

## For every template

1. Open **Admin -> Builder -> Load Template -> Search & SEO**.
2. New templates already contain a generated mini-page. Keep the template as a draft until the PDF, Q&A, and generated text have been reviewed.
3. Write a unique search title (roughly 50-60 characters).
4. Write a useful description (roughly 120-160 characters).
5. Add a clear page heading and an original introduction explaining:
   - who needs the document;
   - what information the user needs;
   - what the generated PDF contains;
   - the form year/revision and official source.
6. Add several useful H2 sections and real frequently asked questions. Empty or duplicate sections are not useful.
7. Configure the social title, description, and a 1200 x 630 share image when available.
8. Add target phrases as editorial guidance. Do not repeat phrases unnaturally.
9. Enable **Publish and allow indexing**, save, sync, and redeploy the frontend.

The frontend build creates an HTML snapshot for every published template. Drafts are excluded from public APIs, snapshots, and `sitemap.xml`.

Public landing pages use `/oky-docky/{template-id}` and are indexable. Interactive questionnaires use `/oky-docky/{template-id}/start`, declare `noindex,follow`, and canonicalize back to the landing page.

## Search-intent guides

- Use **Search-intent guide pages** only for a distinct visitor problem, not keyword variations of the same article.
- A guide is published at `/oky-docky/{template-id}/{guide-slug}` and automatically receives its own title, description, H1, canonical URL, Article/FAQ structured data, prerendered HTML, and sitemap entry.
- Write a direct introduction and original sections that fully answer the narrow question, then link visitors to the guided form.
- Keep incomplete guides as drafts. Published guides are rejected by Builder validation unless the slug, metadata, introduction, and at least one section are complete.
- Start with a small set based on real search demand. Merge or remove pages that become near-duplicates.

## Google

1. Add the `barckhat.com` domain property in Google Search Console and complete DNS verification.
2. Submit `https://barckhat.com/oky-docky/sitemap.xml` in **Sitemaps**.
3. Use **URL inspection** for the templates page and important document pages, run **Test live URL**, then request indexing.
4. Check **Page indexing**, **Core Web Vitals**, and manual/security actions after Google recrawls the site.

## Bing and Yahoo

1. Add the site in Bing Webmaster Tools (it can import a verified Search Console property).
2. Submit the same sitemap URL.
3. Inspect important URLs and request crawling. Yahoo search results are largely supplied by Bing, so Bing Webmaster Tools is the relevant submission path.

## Important limitations

- No setting guarantees a high position. Ranking depends on usefulness, competition, reputation, links, performance, and crawl/index status.
- Google does not use the `meta keywords` tag for ranking. Target phrases are stored for internal search and content planning.
- Do not create near-duplicate pages or copy long passages from IRS/USCIS documents. Add original guidance and link to the official source.

## Partner resources

- Add optional professional services in **Partner and professional resources**.
- Choose whether a resource appears on the landing page, before download, or in both locations.
- Use an HTTPS destination and a clear affiliate/referral disclosure.
- Partner links are rendered with `rel="sponsored"` and never block access to the generated PDF.
- Only recommend a notary or filing provider when the document or jurisdiction may actually require that service. Do not present a referral partner as an official agency.

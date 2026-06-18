import { useEffect } from 'react';

interface DocumentMeta {
  title?: string;
  description?: string;
  canonical?: string;
  ogTitle?: string;
  ogDescription?: string;
  ogUrl?: string;
  keywords?: string;
  robots?: string;
}

const DEFAULT_TITLE = 'Oky-Docky — Smart Document Form Assistant';
const DEFAULT_DESC = 'Complete tax forms and legal documents faster with guided Q&A workflows and instant PDF generation.';
const DEFAULT_ROBOTS = 'index,follow,max-snippet:-1,max-image-preview:large,max-video-preview:-1';
const configuredSiteUrl = import.meta.env.VITE_SITE_URL?.trim().replace(/\/$/, '');

function getBaseUrl() {
  if (configuredSiteUrl) return configuredSiteUrl;
  if (typeof window !== 'undefined' && window.location.origin) return window.location.origin;
  return 'https://oky-docky.com';
}

function buildCanonicalUrl(path?: string) {
  const baseUrl = getBaseUrl();
  if (!path) return baseUrl;
  if (/^https?:\/\//i.test(path)) return path;
  return `${baseUrl}${path.startsWith('/') ? path : `/${path}`}`;
}

function setMetaTag(property: string, content: string, isOg = false) {
  const attr = isOg ? 'property' : 'name';
  let el = document.querySelector(`meta[${attr}="${property}"]`) as HTMLMetaElement | null;
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute(attr, property);
    document.head.appendChild(el);
  }
  el.content = content;
}

function setCanonical(href: string) {
  let el = document.querySelector('link[rel="canonical"]') as HTMLLinkElement | null;
  if (!el) {
    el = document.createElement('link');
    el.rel = 'canonical';
    document.head.appendChild(el);
  }
  el.href = href;
}

export function useDocumentMeta(meta: DocumentMeta) {
  useEffect(() => {
    const title = meta.title || DEFAULT_TITLE;
    const desc = meta.description || DEFAULT_DESC;
    const url = buildCanonicalUrl(meta.canonical);

    document.title = title;
    setMetaTag('description', desc);
    setMetaTag('robots', meta.robots || DEFAULT_ROBOTS);
    setMetaTag('googlebot', meta.robots || DEFAULT_ROBOTS);
    setMetaTag('bingbot', meta.robots || DEFAULT_ROBOTS);
    if (meta.keywords) setMetaTag('keywords', meta.keywords);
    setMetaTag('og:title', meta.ogTitle || title, true);
    setMetaTag('og:description', meta.ogDescription || desc, true);
    setMetaTag('og:type', 'website', true);
    setMetaTag('og:url', meta.ogUrl ? buildCanonicalUrl(meta.ogUrl) : url, true);
    setMetaTag('twitter:title', meta.ogTitle || title);
    setMetaTag('twitter:description', meta.ogDescription || desc);
    setCanonical(url);

    return () => {
      document.title = DEFAULT_TITLE;
    };
  }, [meta.title, meta.description, meta.canonical, meta.ogTitle, meta.ogDescription, meta.ogUrl, meta.keywords, meta.robots]);
}

import { useEffect } from 'react';

interface DocumentMeta {
  title?: string;
  description?: string;
  canonical?: string;
  ogTitle?: string;
  ogDescription?: string;
  ogUrl?: string;
}

const DEFAULT_TITLE = 'Oky-Docky — Smart Document Form Assistant';
const DEFAULT_DESC = 'Complete tax forms and legal documents faster with guided Q&A workflows and instant PDF generation.';
const BASE_URL = 'https://oky-docky.com';

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
    const url = meta.canonical ? `${BASE_URL}${meta.canonical}` : BASE_URL;

    document.title = title;
    setMetaTag('description', desc);
    setMetaTag('og:title', meta.ogTitle || title, true);
    setMetaTag('og:description', meta.ogDescription || desc, true);
    setMetaTag('og:url', meta.ogUrl || url, true);
    setMetaTag('twitter:title', meta.ogTitle || title);
    setMetaTag('twitter:description', meta.ogDescription || desc);
    setCanonical(url);

    return () => {
      document.title = DEFAULT_TITLE;
    };
  }, [meta.title, meta.description, meta.canonical, meta.ogTitle, meta.ogDescription, meta.ogUrl]);
}

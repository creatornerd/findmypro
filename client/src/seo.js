import { useEffect } from 'react';

export const SITE_URL = 'https://findmyspecialist.vercel.app';
export const OG_IMAGE = `${SITE_URL}/og-image.png`;

function upsertMeta(selector, attr, name, content) {
  let el = document.head.querySelector(selector);
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute(attr, name);
    document.head.appendChild(el);
  }
  el.setAttribute('content', content);
}

function setNamed(name, content) {
  upsertMeta(`meta[name="${name}"]`, 'name', name, content);
}

function setProperty(property, content) {
  upsertMeta(`meta[property="${property}"]`, 'property', property, content);
}

/**
 * Applies per-route <head> data. React Router swaps components without a
 * document reload, so title / description / canonical have to be rewritten
 * here or every route would inherit the landing page's tags.
 */
export function useSeo({ title, description, path = '/', image = OG_IMAGE, jsonLd, noindex = false }) {
  const canonical = `${SITE_URL}${path === '/' ? '/' : path}`;
  const ld = jsonLd ? JSON.stringify(jsonLd) : null;

  useEffect(() => {
    document.title = title;
    setNamed('description', description);
    setNamed('robots', noindex ? 'noindex, follow' : 'index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1');

    setProperty('og:type', 'website');
    setProperty('og:title', title);
    setProperty('og:description', description);
    setProperty('og:url', canonical);
    setProperty('og:image', image);
    setProperty('og:site_name', 'FindMyPro');

    setNamed('twitter:card', 'summary_large_image');
    setNamed('twitter:title', title);
    setNamed('twitter:description', description);
    setNamed('twitter:image', image);

    let link = document.head.querySelector('link[rel="canonical"]');
    if (!link) {
      link = document.createElement('link');
      link.setAttribute('rel', 'canonical');
      document.head.appendChild(link);
    }
    link.setAttribute('href', canonical);
  }, [title, description, canonical, image, noindex]);

  // Structured data is appended and removed per route so stale schema from a
  // previous route never lingers in the DOM for a crawler to pick up.
  useEffect(() => {
    if (!ld) return undefined;
    const script = document.createElement('script');
    script.type = 'application/ld+json';
    script.dataset.routeSchema = 'true';
    script.textContent = ld;
    document.head.appendChild(script);
    return () => { script.remove(); };
  }, [ld]);
}

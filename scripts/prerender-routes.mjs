#!/usr/bin/env node
/**
 * Generates a distinct static index.html per route from the single Vite build
 * output, so crawlers and link-unfurlers that don't execute JavaScript see
 * correct per-page <title>/meta/canonical/JSON-LD and real crawlable copy —
 * not just the root page's tags served for every URL.
 *
 * This is NOT server-side rendering: real visitors still get the same SPA
 * bundle, which replaces the static markup the instant it mounts (React's
 * client render, not hydration — content is identical so there's no visible
 * flash). Keep each route's copy below in sync with the matching React
 * component by hand; there is no shared source of truth between them.
 *
 * Runs after `vite build` (see client/package.json's build script).
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const distDir = path.resolve(__dirname, '../client/dist');
const SITE_URL = 'https://findmyspecialist.vercel.app';

const template = readFileSync(path.join(distDir, 'index.html'), 'utf8');

function withHead(html, { title, description, path: routePath, ogDescription, jsonLd }) {
  const canonical = `${SITE_URL}${routePath}`;
  let out = html;

  out = out.replace(/<title>.*?<\/title>/s, `<title>${title}</title>`);
  out = out.replace(
    /<meta name="description" content=".*?" \/>/s,
    `<meta name="description" content="${description}" />`
  );
  out = out.replace(
    /<link rel="canonical" href=".*?" \/>/s,
    `<link rel="canonical" href="${canonical}" />`
  );
  out = out.replace(/<meta property="og:url" content=".*?" \/>/s, `<meta property="og:url" content="${canonical}" />`);
  out = out.replace(/<meta property="og:title" content=".*?" \/>/s, `<meta property="og:title" content="${title}" />`);
  out = out.replace(
    /<meta property="og:description" content=".*?" \/>/s,
    `<meta property="og:description" content="${ogDescription || description}" />`
  );
  out = out.replace(/<meta name="twitter:title" content=".*?" \/>/s, `<meta name="twitter:title" content="${title}" />`);
  out = out.replace(
    /<meta name="twitter:description" content=".*?" \/>/s,
    `<meta name="twitter:description" content="${ogDescription || description}" />`
  );

  if (jsonLd) {
    const script = `\n    <script type="application/ld+json">${JSON.stringify(jsonLd)}</script>`;
    out = out.replace('</head>', `${script}\n  </head>`);
  }

  return out;
}

function withBody(html, bodyHtml) {
  return html.replace('<div id="root"></div>', `<div id="root">${bodyHtml}</div>`);
}

const routes = [
  {
    path: '/',
    dir: '.',
    title: 'FindMyPro — Find the Right Lawyer, Doctor or Financial Advisor Near You',
    description:
      "Describe your situation in plain English. FindMyPro works out whether you need a lawyer, doctor or financial advisor, then shows the highest-rated verified professionals near you — ranked by real Google reviews, with no paid placements.",
    ogDescription:
      "Tell FindMyPro what's going on in plain words. It works out which specialist you need and surfaces top-rated professionals near you — ranked by real Google reviews.",
    body: `
      <header>
        <h1>Find the right professional without guessing.</h1>
      </header>
      <main>
        <p>Most people lose days working out which kind of professional they even need.
        Describe what is happening in your own words and FindMyPro figures that out for you —
        then puts the highest-rated lawyers, doctors and financial advisors near you in front
        of you, ranked by real Google reviews.</p>
        <h2>How it works</h2>
        <p>Describe your situation in plain words. FindMyPro identifies whether you need a
        lawyer, doctor or financial advisor, then shows verified, highly rated practitioners
        near you.</p>
        <h2>Who you'll find</h2>
        <p>Lawyers for personal injury, landlord disputes, family and custody matters,
        employment issues, estate planning and immigration. Doctors across primary care and
        specialties. Financial advisors for retirement planning, taxes and investments.</p>
        <nav>
          <a href="/chat">Open FindMyPro</a>
          <a href="/about">About</a>
        </nav>
      </main>`,
  },
  {
    path: '/chat',
    dir: 'chat',
    title: 'Find a Lawyer, Doctor or Financial Advisor | FindMyPro',
    description:
      "Describe your situation and FindMyPro will identify the type of lawyer, doctor or financial advisor you may need and find highly rated professionals near you, using real Google ratings and credential verification sources.",
    body: `
      <header>
        <a href="/">FindMyPro</a>
      </header>
      <main>
        <h1>Find a lawyer, doctor or financial advisor.</h1>
        <p>Describe your situation in plain words — no jargon, no forms. FindMyPro
        identifies the type of professional you may need and finds highly rated
        specialists near you, using real Google ratings and credential verification
        sources.</p>
      </main>`,
  },
  {
    path: '/about',
    dir: 'about',
    title: 'About FindMyPro — Who Built It and How It Works',
    description:
      'How FindMyPro matches you with the right lawyer, doctor or financial advisor, what it is built on, and who made it.',
    body: `
      <header>
        <a href="/">FindMyPro</a>
      </header>
      <main>
        <h1>The right professional, found in seconds.</h1>
        <p>FindMyPro uses AI to do what most people struggle with: figuring out exactly which
        type of specialist they need — and then finding the highest-rated one near them.
        No directories to browse, no forms to fill out.</p>
        <h2>How it works</h2>
        <p>You describe your situation in plain English. The AI triages your case to decide
        which type of professional fits. FindMyPro searches for top-rated practitioners in
        your city, returning names, phone numbers, addresses and live Google review scores,
        plus a direct link to verify credentials before you call.</p>
      </main>`,
  },
];

for (const route of routes) {
  const outDir = path.join(distDir, route.dir);
  mkdirSync(outDir, { recursive: true });

  let html = withHead(template, route);
  html = withBody(html, route.body);

  writeFileSync(path.join(outDir, 'index.html'), html);
  console.log(`prerendered ${route.path} -> client/dist/${route.dir === '.' ? '' : route.dir + '/'}index.html`);
}

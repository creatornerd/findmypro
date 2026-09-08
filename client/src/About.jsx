import { Link } from 'react-router-dom';
import { CompassIcon, SunIcon, MoonIcon } from './icons.jsx';
import { useTheme } from './theme.js';
import { useSeo, SITE_URL } from './seo.js';

const STACK = [
  { name: 'Gemini',       by: 'Conversational AI',   href: 'https://deepmind.google/technologies/gemini/' },
  { name: 'Serper',       by: 'Google Places data',  href: 'https://serper.dev' },
  { name: 'Supabase',     by: 'Accounts & sign-in',  href: 'https://supabase.com' },
  { name: 'Upstash',      by: 'Usage limits',        href: 'https://upstash.com' },
  { name: 'Vercel',       by: 'Hosting',             href: 'https://vercel.com' },
  { name: 'React + Vite', by: 'Frontend',            href: 'https://vite.dev' },
];

const HOW_IT_WORKS = [
  {
    num: '01',
    title: 'You describe your situation',
    desc: 'No forms, no checkboxes. Just tell FindMyPro what\'s going on in plain English — a car accident, a confusing medical symptom, an IRS letter.',
  },
  {
    num: '02',
    title: 'The AI triages your case',
    desc: 'Gemini reads your message and decides which type of professional fits — and asks a follow-up if the situation is too vague to call.',
  },
  {
    num: '03',
    title: 'Real results, real ratings',
    desc: 'FindMyPro searches Google Places for top-rated practitioners in your city, returning names, phone numbers, addresses, and live Google review scores.',
  },
  {
    num: '04',
    title: 'Verify before you call',
    desc: 'Every result includes a direct link to verify credentials — State Bar lookup for lawyers, FINRA BrokerCheck for advisors, Healthgrades for doctors.',
  },
];

export default function About() {
  const [darkMode, setDarkMode] = useTheme();

  useSeo({
    path: '/about',
    title: 'About FindMyPro — Who Built It and How It Works',
    description:
      'How FindMyPro matches you with the right lawyer, doctor or financial advisor, what it is built on, and who made it.',
    jsonLd: {
      '@context': 'https://schema.org',
      '@type': 'AboutPage',
      name: 'About FindMyPro',
      url: `${SITE_URL}/about`,
      breadcrumb: {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Home',  item: `${SITE_URL}/` },
          { '@type': 'ListItem', position: 2, name: 'About', item: `${SITE_URL}/about` },
        ],
      },
    },
  });

  return (
    <div className="about-page">
      <a href="#about-main" className="skip-link">Skip to main content</a>

      <header className="about-header">
        <Link to="/" className="about-back">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M19 12H5M12 5l-7 7 7 7"/>
          </svg>
          Back to FindMyPro
        </Link>
        <div className="about-header-right">
          <button
            className="theme-btn"
            onClick={() => setDarkMode(d => !d)}
            aria-label={darkMode ? 'Switch to light mode' : 'Switch to dark mode'}
          >
            {darkMode ? <SunIcon /> : <MoonIcon />}
          </button>
          <Link to="/" className="about-logo">
            <CompassIcon size={32} />
            <span>Find<em>My</em>Pro</span>
          </Link>
        </div>
      </header>

      <main className="about-main" id="about-main">

        {/* Hero */}
        <section className="about-hero">
          <div className="about-eyebrow">About this project</div>
          <h1 className="about-h1">The right professional,<br/><em>found in seconds.</em></h1>
          <p className="about-lede">
            FindMyPro uses AI to do what most people struggle with: figuring out exactly which
            type of specialist they need — and then finding the highest-rated one near them.
            No directories to browse, no forms to fill out.
          </p>
        </section>

        {/* How it works */}
        <section className="about-section">
          <h2 className="about-h2">How it works</h2>
          <div className="about-steps">
            {HOW_IT_WORKS.map(s => (
              <div key={s.num} className="about-step">
                <span className="about-step-num">{s.num}</span>
                <div>
                  <div className="about-step-title">{s.title}</div>
                  <div className="about-step-desc">{s.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Tech stack */}
        <section className="about-section">
          <h2 className="about-h2">Built with</h2>
          <p className="about-section-note">The services doing the heavy lifting behind the scenes.</p>
          <div className="about-stack">
            {STACK.map(s => (
              <a key={s.name} href={s.href} target="_blank" rel="noopener noreferrer" className="about-stack-card">
                <div className="about-stack-name">{s.name}</div>
                <div className="about-stack-by">{s.by}</div>
              </a>
            ))}
          </div>
        </section>

        {/* About the developer */}
        <section className="about-section about-creator">
          <h2 className="about-h2">The developer</h2>
          <div className="about-bio-card">
            <div className="about-bio-avatar">AH</div>
            <div>
              <div className="about-bio-name">Ahaan Hossain</div>
              <p className="about-bio-text">
                Ahaan is a 13-year-old student developer in Washington State. He builds tools
                that solve problems he has run into himself, and he is always after feedback to
                make them better. Away from the keyboard he plays piano and does robotics and
                competition maths.
              </p>
              <p className="about-bio-text">
                The source is on GitHub, and the fastest way to reach him about a bug, an idea,
                or anything that looks wrong is email.
              </p>
              <div className="about-bio-links">
                <a href="https://github.com/creatornerd/findmypro" target="_blank" rel="noopener noreferrer">
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                    <path d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0 1 12 6.844a9.59 9.59 0 0 1 2.504.337c1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.02 10.02 0 0 0 22 12.017C22 6.484 17.522 2 12 2z"/>
                  </svg>
                  View source on GitHub
                </a>
                <a href="mailto:ahaan.hossain@yahoo.com">
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
                    <polyline points="22,6 12,13 2,6"/>
                  </svg>
                  ahaan.hossain@yahoo.com
                </a>
              </div>
            </div>
          </div>
        </section>

        {/* Try it */}
        <section className="about-section about-try">
          <h2 className="about-h2">Try it</h2>
          <p className="about-try-text">
            Your first search is free — no account, no card. Describe what is going on and
            see who is well rated near you.
          </p>
          <Link to="/chat" className="cta-btn about-try-cta">Start a free search &rarr;</Link>
        </section>

        {/* Disclaimer */}
        <section className="about-section about-disclaimer">
          <p>
            FindMyPro helps you <strong>find</strong> professionals — it does not provide legal,
            medical, or financial advice. Always verify credentials independently and consult
            a licensed professional before making any decisions.
          </p>
        </section>

      </main>

      <footer className="about-footer">
        © {new Date().getFullYear()} Ahaan Hossain. All rights reserved. ·{' '}
        <Link to="/">Home</Link> · <Link to="/chat">Open FindMyPro</Link>
      </footer>
    </div>
  );
}

import { Link } from 'react-router-dom';

function CompassIcon({ size = 36 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" fill="none" aria-hidden="true">
      <circle cx="20" cy="20" r="19" fill="var(--paper)" stroke="var(--ink)" strokeWidth="1.25"/>
      <circle cx="20" cy="20" r="15.5" stroke="var(--ink-4)" strokeWidth="0.6" strokeDasharray="1 3"/>
      <g stroke="var(--ink-3)" strokeWidth="0.8" strokeLinecap="round">
        <line x1="20" y1="3"  x2="20" y2="6"/>
        <line x1="20" y1="34" x2="20" y2="37"/>
        <line x1="3"  y1="20" x2="6"  y2="20"/>
        <line x1="34" y1="20" x2="37" y2="20"/>
      </g>
      <polygon points="20,7 22.6,20 20,16.5" fill="var(--accent-deep)"/>
      <polygon points="20,7 17.4,20 20,16.5" fill="var(--accent)"/>
      <polygon points="20,33 22.6,20 20,23.5" fill="var(--ink-2)"/>
      <polygon points="20,33 17.4,20 20,23.5" fill="var(--ink)"/>
      <circle cx="20" cy="20" r="2.6" fill="var(--paper)" stroke="var(--ink)" strokeWidth="0.8"/>
      <circle cx="20" cy="20" r="1"   fill="var(--accent-deep)"/>
    </svg>
  );
}

const STACK = [
  {
    name: 'Gemini AI',
    by: 'Google',
    desc: 'Powers the conversational triage — understands your situation and identifies which specialist you need.',
    href: 'https://deepmind.google/technologies/gemini/',
  },
  {
    name: 'Serper',
    by: 'Google Search API',
    desc: 'Pulls real Google Places results — ratings, phone numbers, and addresses for practitioners near you.',
    href: 'https://serper.dev',
  },
  {
    name: 'Supabase',
    by: 'Auth & database',
    desc: 'Handles user accounts and authentication, including Google sign-in.',
    href: 'https://supabase.com',
  },
  {
    name: 'Upstash Redis',
    by: 'Rate limiting',
    desc: 'Tracks free search usage per IP to enforce the weekly guest limit without a database hit.',
    href: 'https://upstash.com',
  },
  {
    name: 'Vercel',
    by: 'Hosting & edge',
    desc: 'Deploys the frontend and serverless API, globally distributed for fast load times.',
    href: 'https://vercel.com',
  },
  {
    name: 'React + Vite',
    by: 'Frontend',
    desc: 'Single-page app with instant hot-module reload during development and a lean production bundle.',
    href: 'https://vite.dev',
  },
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
  return (
    <div className="about-page">
      <header className="about-header">
        <Link to="/" className="about-back">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M19 12H5M12 5l-7 7 7 7"/>
          </svg>
          Back to FindMyPro
        </Link>
        <div className="about-logo">
          <CompassIcon size={32} />
          <span>Find<em>My</em>Pro</span>
        </div>
      </header>

      <main className="about-main">

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
          <div className="about-stack">
            {STACK.map(s => (
              <a key={s.name} href={s.href} target="_blank" rel="noopener noreferrer" className="about-stack-card">
                <div className="about-stack-name">{s.name}</div>
                <div className="about-stack-by">{s.by}</div>
                <div className="about-stack-desc">{s.desc}</div>
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
                Ahaan is a 13-year-old student developer in the Redmond, Washington area,
                currently in middle school. He built FindMyPro to make it easier for people
                to find the right professional without having to navigate confusing directories
                or know exactly what kind of help they need upfront.
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
        © 2026 Ahaan Hossain. All rights reserved. ·{' '}
        <Link to="/">Back to FindMyPro</Link>
      </footer>
    </div>
  );
}

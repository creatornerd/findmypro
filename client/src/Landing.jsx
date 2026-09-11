import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { CompassIcon, SunIcon, MoonIcon } from './icons.jsx';
import { useTheme } from './theme.js';
import { useSeo, SITE_URL, OG_IMAGE } from './seo.js';

const YEAR = new Date().getFullYear();

const STEPS = [
  {
    num: '01',
    title: 'Describe it in plain words',
    desc: 'No forms, no dropdowns, no legal or medical jargon. Write it the way you would tell a friend — "I got rear-ended in Chicago and my back hurts."',
  },
  {
    num: '02',
    title: 'The AI works out who you need',
    desc: 'FindMyPro reads your situation and decides whether it calls for a lawyer, a doctor, a financial advisor — or more than one. If it is too vague to call, it asks you one follow-up.',
  },
  {
    num: '03',
    title: 'You get real, rated matches',
    desc: 'Top-rated practitioners in your city with live Google review scores, phone numbers and addresses — plus a direct link to verify every licence yourself.',
  },
];

const FIELDS = [
  {
    kind: 'Legal',
    heading: 'Lawyers',
    blurb: 'Personal injury, landlord and tenant disputes, family and custody matters, employment issues, estate planning, immigration.',
    examples: ['Car accident injury', 'Security deposit dispute', 'Divorce and custody', 'Wrongful termination'],
    verify: { label: 'State Bar directory', href: 'https://www.americanbar.org/groups/legal_services/flh-home/' },
  },
  {
    kind: 'Medical',
    heading: 'Doctors',
    blurb: 'Primary care and specialists — cardiology, neurology, orthopaedics, dermatology, mental health and more, matched to the symptoms you describe.',
    examples: ['Recurring migraines', 'Chest pain and breathlessness', 'Chronic back pain', 'Persistent skin condition'],
    verify: { label: 'State Medical Board', href: 'https://www.fsmb.org/physician-data-center/' },
  },
  {
    kind: 'Financial',
    heading: 'Advisors',
    blurb: 'Fiduciary financial planners, tax specialists, retirement and estate advisors, and help when the IRS comes knocking.',
    examples: ['IRS audit notice', 'Retirement planning', 'Inheritance and estate tax', 'Managing an investment portfolio'],
    verify: { label: 'FINRA BrokerCheck', href: 'https://brokercheck.finra.org' },
  },
];

const REASONS = [
  {
    title: 'No paid placements, ever',
    desc: 'Nobody can buy their way to the top of your results. Ranking comes from Google review data alone — the same data you would find yourself, just sorted for you.',
  },
  {
    title: 'You do not need the right words',
    desc: 'Directories make you pick a practice area before you can search. If you knew the practice area, you would not need the directory. Describe the problem instead.',
  },
  {
    title: 'Every result is verifiable',
    desc: 'Each match ships with a link to the official register — State Bar, Medical Board, or FINRA BrokerCheck — so you can confirm a licence before you pick up the phone.',
  },
  {
    title: 'Your conversation stays yours',
    desc: 'Searches are not sold to lead-generation firms and your details are never passed to a professional without you making that call. There is no "we will have someone contact you".',
  },
];

const EXAMPLES = [
  { kind: 'Legal',     text: 'I got into a car accident in Chicago and my back hurts' },
  { kind: 'Legal',     text: "My landlord in Brooklyn won't return my security deposit" },
  { kind: 'Medical',   text: "I've been having chest pains and shortness of breath in Boston" },
  { kind: 'Medical',   text: 'I keep getting bad migraines and nothing helps' },
  { kind: 'Financial', text: 'The IRS is auditing me and I live in Denver' },
  { kind: 'Financial', text: 'I need help managing $500k in investments in San Francisco' },
];

const FAQ = [
  {
    q: 'Is FindMyPro free to use?',
    a: 'Yes. Every visitor gets one free search straight away, with no card and no account. Creating a free account raises that to fifteen searches a week and saves your conversation history across devices.',
  },
  {
    q: 'How are the professionals ranked?',
    a: 'Purely by their Google rating and review volume, pulled live from Google Places. There are no sponsored slots and no paid placements — no professional can pay to appear or to rank higher.',
  },
  {
    q: 'Does FindMyPro give legal, medical or financial advice?',
    a: 'No. FindMyPro helps you find the right kind of professional and shows you who is well rated nearby. It does not advise you on your situation, and it is not a substitute for a licensed professional.',
  },
  {
    q: 'Do you contact the professionals on my behalf?',
    a: 'Never. You get names, ratings, addresses and phone numbers, and you decide who to contact. Your details are not passed on to anyone and your search is not sold as a lead.',
  },
  {
    q: 'Which countries does it cover?',
    a: 'Coverage is strongest in the United States, where credential verification links are built in. You can search for professionals elsewhere — just say which country you are in when you describe your situation.',
  },
  {
    q: 'How do I check that a professional is properly licensed?',
    a: 'Every result includes a direct verification link: your State Bar for lawyers, the State Medical Board for doctors, and FINRA BrokerCheck for financial advisors. Always confirm a licence before engaging anyone.',
  },
];

function buildJsonLd() {
  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'WebSite',
        '@id': `${SITE_URL}/#website`,
        url: `${SITE_URL}/`,
        name: 'FindMyPro',
        description:
          'AI that reads your situation in plain English and finds the right lawyer, doctor or financial advisor near you, ranked by real Google reviews.',
        inLanguage: 'en-US',
        publisher: { '@id': `${SITE_URL}/#person` },
      },
      {
        '@type': 'Person',
        '@id': `${SITE_URL}/#person`,
        name: 'Ahaan Hossain',
        url: `${SITE_URL}/about`,
        sameAs: ['https://github.com/creatornerd'],
      },
      {
        '@type': 'WebApplication',
        '@id': `${SITE_URL}/#app`,
        name: 'FindMyPro',
        url: `${SITE_URL}/chat`,
        applicationCategory: 'BusinessApplication',
        operatingSystem: 'Any modern web browser',
        browserRequirements: 'Requires JavaScript',
        description:
          'Describe your situation in plain English and FindMyPro identifies whether you need a lawyer, doctor or financial advisor, then surfaces the highest-rated verified practitioners near you.',
        offers: {
          '@type': 'Offer',
          price: '0',
          priceCurrency: 'USD',
          description: 'One free search for guests; fifteen searches a week with a free account.',
        },
        featureList: [
          'Plain-English situation triage',
          'Lawyer, doctor and financial advisor matching',
          'Ranking by live Google review data',
          'Credential verification links for every result',
        ],
      },
      {
        '@type': 'FAQPage',
        '@id': `${SITE_URL}/#faq`,
        mainEntity: FAQ.map(item => ({
          '@type': 'Question',
          name: item.q,
          acceptedAnswer: { '@type': 'Answer', text: item.a },
        })),
      },
    ],
  };
}

function CheckIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--accent-deep)" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M20 6L9 17l-5-5"/>
    </svg>
  );
}

function LandingNav({ darkMode, setDarkMode }) {
  const [open, setOpen] = useState(false);
  return (
    <header className="lp-nav">
      <div className="lp-nav-inner">
        <Link to="/" className="brand lp-brand" aria-label="FindMyPro home">
          <CompassIcon size={34} />
          <span className="brand-text">Find<em>My</em>Pro</span>
        </Link>

        <nav className={`lp-nav-links ${open ? 'open' : ''}`} aria-label="Primary">
          <a href="#how-it-works" onClick={() => setOpen(false)}>How it works</a>
          <a href="#who" onClick={() => setOpen(false)}>Who you&rsquo;ll find</a>
          <a href="#faq" onClick={() => setOpen(false)}>FAQ</a>
          <Link to="/about" onClick={() => setOpen(false)}>About</Link>
        </nav>

        <div className="lp-nav-actions">
          <button
            className="theme-btn"
            onClick={() => setDarkMode(d => !d)}
            aria-label={darkMode ? 'Switch to light mode' : 'Switch to dark mode'}
          >
            {darkMode ? <SunIcon /> : <MoonIcon />}
          </button>
          <Link to="/chat" className="cta-btn lp-nav-cta">Open FindMyPro</Link>
          <button
            className="lp-menu-btn"
            onClick={() => setOpen(o => !o)}
            aria-label="Toggle navigation menu"
            aria-expanded={open}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" aria-hidden="true">
              {open ? <path d="M18 6L6 18M6 6l12 12"/> : <path d="M3 6h18M3 12h18M3 18h18"/>}
            </svg>
          </button>
        </div>
      </div>
    </header>
  );
}

export default function Landing() {
  const [darkMode, setDarkMode] = useTheme();
  const [query, setQuery] = useState('');
  const navigate = useNavigate();

  useSeo({
    path: '/',
    title: 'FindMyPro — Find the Right Lawyer, Doctor or Financial Advisor Near You',
    description:
      'Describe your situation in plain English. FindMyPro works out whether you need a lawyer, doctor or financial advisor, then shows the highest-rated verified professionals near you — ranked by real Google reviews, with no paid placements.',
    image: OG_IMAGE,
    jsonLd: buildJsonLd(),
  });

  const startSearch = (text) => {
    const q = (text ?? query).trim();
    navigate(q ? `/chat?q=${encodeURIComponent(q)}` : '/chat');
  };

  return (
    <div className="lp">
      <a href="#main" className="skip-link">Skip to main content</a>

      <LandingNav darkMode={darkMode} setDarkMode={setDarkMode} />

      <main id="main" className="lp-main">

        {/* ── Hero ───────────────────────────────────── */}
        <section className="lp-hero" aria-labelledby="lp-h1">
          <p className="eyebrow"><span className="dot" />One free search &middot; No card &middot; No account needed</p>

          <h1 id="lp-h1" className="lp-h1">
            Find the right professional<br /><em>without guessing.</em>
          </h1>

          <p className="lp-lede">
            Most people lose days working out <em>which kind</em> of professional they even need.
            Describe what is happening in your own words and FindMyPro figures that out for you —
            then puts the highest-rated lawyers, doctors and financial advisors near you in front
            of you, ranked by real Google reviews.
          </p>

          <form
            className="lp-search"
            onSubmit={(e) => { e.preventDefault(); startSearch(); }}
            role="search"
          >
            <label className="sr-only" htmlFor="lp-query">Describe your situation</label>
            <input
              id="lp-query"
              type="text"
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="What's going on? e.g. I was rear-ended in Chicago…"
              autoComplete="off"
            />
            <button type="submit" className="cta-btn lp-search-btn">
              FindMyPro <span aria-hidden="true">&rarr;</span>
            </button>
          </form>

          <ul className="lp-hero-proof">
            <li><CheckIcon /> Ranked by live Google reviews</li>
            <li><CheckIcon /> No sponsored or paid listings</li>
            <li><CheckIcon /> Licence check link on every result</li>
          </ul>
        </section>

        {/* ── How it works ───────────────────────────── */}
        <section className="lp-section" id="how-it-works" aria-labelledby="lp-how">
          <p className="lp-kicker">How it works</p>
          <h2 id="lp-how" className="lp-h2">Three steps, about a minute.</h2>
          <ol className="lp-steps">
            {STEPS.map(s => (
              <li key={s.num} className="lp-step">
                <span className="lp-step-num" aria-hidden="true">{s.num}</span>
                <h3 className="lp-step-title">{s.title}</h3>
                <p className="lp-step-desc">{s.desc}</p>
              </li>
            ))}
          </ol>
        </section>

        {/* ── Who you'll find ────────────────────────── */}
        <section className="lp-section" id="who" aria-labelledby="lp-who">
          <p className="lp-kicker">Who you&rsquo;ll find</p>
          <h2 id="lp-who" className="lp-h2">Three professions, one conversation.</h2>
          <p className="lp-section-lede">
            You do not have to know which one you need. If your situation spans two — an injury
            claim that is both medical and legal, say — FindMyPro returns both.
          </p>
          <div className="lp-fields">
            {FIELDS.map(f => (
              <article key={f.kind} className="lp-field">
                <p className="lp-field-kind">{f.kind}</p>
                <h3 className="lp-field-heading">{f.heading}</h3>
                <p className="lp-field-blurb">{f.blurb}</p>
                <ul className="lp-field-list">
                  {f.examples.map(e => <li key={e}>{e}</li>)}
                </ul>
                <a
                  className="lp-field-verify"
                  href={f.verify.href}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Verify licences via {f.verify.label} <span aria-hidden="true">&#8599;</span>
                </a>
              </article>
            ))}
          </div>
        </section>

        {/* ── Why ────────────────────────────────────── */}
        <section className="lp-section" id="why" aria-labelledby="lp-why">
          <p className="lp-kicker">Why FindMyPro</p>
          <h2 id="lp-why" className="lp-h2">Built to be useful, not to sell your details.</h2>
          <div className="lp-reasons">
            {REASONS.map(r => (
              <div key={r.title} className="lp-reason">
                <h3 className="lp-reason-title">{r.title}</h3>
                <p className="lp-reason-desc">{r.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ── Examples ───────────────────────────────── */}
        <section className="lp-section" id="examples" aria-labelledby="lp-examples">
          <p className="lp-kicker">Try one</p>
          <h2 id="lp-examples" className="lp-h2">Real things people arrive with.</h2>
          <p className="lp-section-lede">Pick one to see exactly how it works — your free search is waiting.</p>
          <div className="lp-examples">
            {EXAMPLES.map(e => (
              <button key={e.text} className="lp-example" onClick={() => startSearch(e.text)}>
                <span className="lp-example-kind">{e.kind}</span>
                <span className="lp-example-text">&ldquo;{e.text}&rdquo;</span>
                <span className="lp-example-arrow" aria-hidden="true">&rarr;</span>
              </button>
            ))}
          </div>
        </section>

        {/* ── FAQ ────────────────────────────────────── */}
        <section className="lp-section" id="faq" aria-labelledby="lp-faq">
          <p className="lp-kicker">Questions</p>
          <h2 id="lp-faq" className="lp-h2">Frequently asked.</h2>
          <div className="lp-faq">
            {FAQ.map(item => (
              <details key={item.q} className="lp-faq-item">
                <summary>
                  <span>{item.q}</span>
                  <span className="lp-faq-mark" aria-hidden="true" />
                </summary>
                <p>{item.a}</p>
              </details>
            ))}
          </div>
        </section>

        {/* ── Closing CTA ────────────────────────────── */}
        <section className="lp-final" aria-labelledby="lp-final-h">
          <CompassIcon size={44} />
          <h2 id="lp-final-h" className="lp-final-h">Stop scrolling directories.</h2>
          <p className="lp-final-text">
            Tell FindMyPro what is going on and see who is actually good near you.
            Your first search is free and takes about a minute.
          </p>
          <Link to="/chat" className="cta-btn lp-final-cta">
            Start my free search <span aria-hidden="true">&rarr;</span>
          </Link>
          <p className="lp-final-note">One free search as a guest &middot; Free account unlocks 15 a week</p>
        </section>
      </main>

      <footer className="lp-footer">
        <div className="lp-footer-inner">
          <div className="lp-footer-brand">
            <CompassIcon size={28} />
            <span className="brand-text">Find<em>My</em>Pro</span>
          </div>

          <nav className="lp-footer-links" aria-label="Footer">
            <Link to="/chat">Open FindMyPro</Link>
            <Link to="/about">About</Link>
            <a href="#how-it-works">How it works</a>
            <a href="#faq">FAQ</a>
          </nav>

          <p className="lp-footer-disclaimer">
            FindMyPro helps you <strong>find</strong> professionals — it does not provide legal,
            medical or financial advice, and it is not a substitute for a licensed professional.
            Ratings come from Google review data; listings are never sponsored. Always verify
            credentials independently before engaging anyone.
          </p>

          <p className="lp-footer-legal">© {YEAR} Ahaan Hossain. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}

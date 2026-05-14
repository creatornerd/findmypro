import { useState, useRef, useEffect, useCallback } from 'react';
import { Analytics } from '@vercel/analytics/react';

const API_URL = import.meta.env.DEV ? 'http://localhost:3001/api' : '/api';

const STORAGE_KEY = 'findmypro_session';

const SUGGESTIONS = [
  { kind: 'Legal',     text: "I got into a car accident in Chicago and my back hurts" },
  { kind: 'Legal',     text: "My landlord in Brooklyn won't return my security deposit" },
  { kind: 'Legal',     text: "I'm going through a divorce in Austin and need custody help" },
  { kind: 'Medical',   text: "I've been having chest pains and shortness of breath in Boston" },
  { kind: 'Medical',   text: "I keep getting bad migraines and nothing helps" },
  { kind: 'Financial', text: "I need help managing $500k in investments in San Francisco" },
  { kind: 'Financial', text: "The IRS is auditing me and I live in Denver" },
];

const REFINEMENTS = [
  "Show me someone closer to downtown",
  "I'd prefer a female specialist",
  "Who has the best reviews?",
  "What questions should I ask them?",
];

/* ─── Icons ────────────────────────────────────────── */

function CompassIcon({ size = 40 }) {
  return (
    <svg className="compass" width={size} height={size} viewBox="0 0 40 40" fill="none" aria-hidden="true">
      <circle cx="20" cy="20" r="19" fill="var(--paper)" stroke="var(--ink)" strokeWidth="1.25"/>
      <circle cx="20" cy="20" r="15.5" stroke="var(--ink-4)" strokeWidth="0.6" strokeDasharray="1 3"/>
      <g stroke="var(--ink-3)" strokeWidth="0.8" strokeLinecap="round">
        <line x1="20" y1="3" x2="20" y2="6"/>
        <line x1="20" y1="34" x2="20" y2="37"/>
        <line x1="3" y1="20" x2="6" y2="20"/>
        <line x1="34" y1="20" x2="37" y2="20"/>
      </g>
      <polygon points="20,7 22.6,20 20,16.5" fill="var(--accent-deep)"/>
      <polygon points="20,7 17.4,20 20,16.5" fill="var(--accent)"/>
      <polygon points="20,33 22.6,20 20,23.5" fill="var(--ink-2)"/>
      <polygon points="20,33 17.4,20 20,23.5" fill="var(--ink)"/>
      <circle cx="20" cy="20" r="2.6" fill="var(--paper)" stroke="var(--ink)" strokeWidth="0.8"/>
      <circle cx="20" cy="20" r="1" fill="var(--accent-deep)"/>
    </svg>
  );
}

function Mark() {
  return (
    <span className="brand">
      <CompassIcon />
      <span className="brand-text">Find<em>My</em>Pro</span>
    </span>
  );
}

function MiniCompass() {
  return (
    <svg width="18" height="18" viewBox="0 0 40 40" fill="none" aria-hidden="true">
      <polygon points="20,7 22.6,20 20,16.5" fill="var(--accent-deep)"/>
      <polygon points="20,7 17.4,20 20,16.5" fill="var(--accent)"/>
      <polygon points="20,33 22.6,20 20,23.5" fill="var(--ink-2)"/>
      <polygon points="20,33 17.4,20 20,23.5" fill="var(--ink)"/>
      <circle cx="20" cy="20" r="2.6" fill="var(--paper)"/>
    </svg>
  );
}

function SendIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 12h14M13 6l6 6-6 6" />
    </svg>
  );
}

function ShareIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/>
      <polyline points="16 6 12 2 8 6"/>
      <line x1="12" y1="2" x2="12" y2="15"/>
    </svg>
  );
}

/* ─── Sub-components ───────────────────────────────── */

function Stars({ rating }) {
  const full = Math.round(rating);
  return (
    <span className="stars" aria-label={`${rating} stars`}>
      {Array.from({ length: 5 }).map((_, i) => (
        <span key={i}>{i < full ? '★' : '☆'}</span>
      ))}
    </span>
  );
}

function Progress({ stage }) {
  const steps = [
    { id: 'listening', label: 'Listening' },
    { id: 'asking',    label: 'Clarifying' },
    { id: 'searching', label: 'Searching' },
    { id: 'found',     label: 'Matched' },
  ];
  const order = steps.map(s => s.id);
  const idx = order.indexOf(stage);
  return (
    <div className="progress" role="status" aria-live="polite">
      {steps.map((s, i) => (
        <span key={s.id} className={`step ${i === idx ? 'active' : i < idx ? 'done' : ''}`}>
          {String(i + 1).padStart(2, '0')} · {s.label}
        </span>
      ))}
    </div>
  );
}

function ResultCard({ r, n }) {
  return (
    <article className="card">
      <div className="num">{String(n).padStart(2, '0')}</div>
      <div className="body">
        <h4 className="name">{r.name}</h4>
        {r.why && <p className="why">{r.why}</p>}
        <div className="row">
          {r.address && (
            <span>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
                <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/>
                <circle cx="12" cy="10" r="3"/>
              </svg>
              {r.address}
            </span>
          )}
          {r.phone && (
            <span>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
                <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.91.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92z"/>
              </svg>
              {r.phone}
            </span>
          )}
          {r.website && (
            <span>
              <a href={r.website} target="_blank" rel="noopener noreferrer">Visit website →</a>
            </span>
          )}
        </div>
      </div>
      <div className="rating">
        {r.rating != null && (
          <>
            <span className="num-big">{Number(r.rating).toFixed(1)}</span>
            <Stars rating={r.rating} />
            {r.reviews != null && <span className="reviews">{r.reviews} reviews</span>}
          </>
        )}
      </div>
    </article>
  );
}

function HowItWorks() {
  const steps = [
    { num: '01', title: 'Describe your situation', desc: 'Tell us what happened in plain words — no jargon, no forms.' },
    { num: '02', title: 'AI identifies the specialist', desc: 'We figure out if you need a lawyer, doctor, advisor, or all three.' },
    { num: '03', title: 'See top-rated matches', desc: 'Real ratings and reviews from Google, ranked for your city.' },
  ];
  return (
    <div className="how-it-works">
      {steps.map(s => (
        <div key={s.num} className="hiw-step">
          <span className="hiw-num">{s.num}</span>
          <div>
            <div className="hiw-title">{s.title}</div>
            <div className="hiw-desc">{s.desc}</div>
          </div>
        </div>
      ))}
    </div>
  );
}

function Welcome({ onPick }) {
  const groups = ['Legal', 'Medical', 'Financial'].map(k => ({
    kind: k,
    items: SUGGESTIONS.filter(s => s.kind === k),
  }));

  return (
    <section className="welcome">
      <div className="eyebrow"><span className="dot"></span>AI-powered · Lawyers, Doctors & Advisors · Real Google ratings</div>
      <h1 className="headline">Find the right professional<br/><em>without guessing.</em></h1>
      <p className="lede">
        Describe what's going on in plain words. FindMyPro uses AI to identify
        the type of specialist you need — then surfaces the highest-rated,
        verified practitioners near you. No directories. No forms.
      </p>

      <HowItWorks />

      <div className="trust-bar">
        <div className="trust-item">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--accent-deep)" strokeWidth="1.6"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
          <span>We help you find — we don't replace professional advice</span>
        </div>
        <div className="trust-item">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--accent-deep)" strokeWidth="1.6"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
          <span>Ratings sourced from real Google reviews</span>
        </div>
        <div className="trust-item">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--accent-deep)" strokeWidth="1.6"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
          <span>Always verify credentials before engaging any professional</span>
        </div>
      </div>

      <div className="starters">
        <div className="starters-heading">Try an example, or type your own below</div>
        {groups.map(g => (
          <div key={g.kind} className="starter-group">
            <div className="starter-label">{g.kind}</div>
            {g.items.map((s, i) => (
              <button key={i} className="starter" onClick={() => onPick(s.text)}>
                <span className="text">"{s.text}"</span>
                <span className="arr">→</span>
              </button>
            ))}
          </div>
        ))}
      </div>
    </section>
  );
}

/* ─── Main App ─────────────────────────────────────── */

function App() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [searching, setSearching] = useState(false);
  const [results, setResults] = useState(null);
  const [stage, setStage] = useState('listening');
  const [toast, setToast] = useState(null);
  const [restored, setRestored] = useState(false);
  const taRef = useRef(null);
  const mainRef = useRef(null);
  const resultsRef = useRef(null);
  const prevResultsRef = useRef(null);

  // Restore session from localStorage on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const session = JSON.parse(saved);
        if (session.messages?.length) {
          setMessages(session.messages);
          setResults(session.results || null);
          setStage(session.results ? 'found' : 'asking');
          setRestored(true);
          setTimeout(() => setRestored(false), 3000);
        }
      }
    } catch { /* ignore corrupt data */ }
  }, []);

  // Save session to localStorage on change
  useEffect(() => {
    if (messages.length > 0) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ messages, results }));
    }
  }, [messages, results]);

  // Scroll to bottom for new messages/loading, scroll to top of results when results first appear
  useEffect(() => {
    if (!mainRef.current) return;
    const resultsJustArrived = results && !prevResultsRef.current;
    prevResultsRef.current = results;

    if (resultsJustArrived && resultsRef.current) {
      // Scroll results section into view from the top
      resultsRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } else if (messages.length > 0 && !results) {
      // Scroll to bottom to show latest message / typing indicator
      mainRef.current.scrollTop = mainRef.current.scrollHeight;
    }
  }, [messages, results, loading, searching]);

  const showToast = useCallback((text) => {
    setToast(text);
    setTimeout(() => setToast(null), 2200);
  }, []);

  const adjustTA = () => {
    const ta = taRef.current;
    if (!ta) return;
    ta.style.height = 'auto';
    ta.style.height = Math.min(ta.scrollHeight, 160) + 'px';
  };

  const send = async (textArg) => {
    const text = (textArg ?? input).trim();
    if (!text || loading) return;

    const next = [...messages, { role: 'user', content: text }];
    setMessages(next);
    setInput('');
    setLoading(true);
    setStage('asking');
    if (taRef.current) taRef.current.style.height = 'auto';

    try {
      const chatRes = await fetch(`${API_URL}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: next }),
      });

      if (!chatRes.ok) throw new Error('API request failed');

      const data = await chatRes.json();
      if (!data.message) throw new Error('No response from AI');

      setMessages(m => [...m, { role: 'assistant', content: data.message }]);
      setLoading(false);

      if (data.readyToSearch && data.searches?.length > 0) {
        setStage('searching');
        setSearching(true);

        const searchRes = await fetch(`${API_URL}/search`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ queries: data.searches }),
        });

        if (!searchRes.ok) throw new Error('Search failed');

        const searchData = await searchRes.json();
        const searchResults = searchData.results;

        // Handle empty results
        if (!searchResults?.length || searchResults.every(c => !c.results?.length)) {
          setMessages(m => [...m, {
            role: 'assistant',
            content: "I wasn't able to find specific matches for that search. Could you try a different city or be more specific about the type of professional you need?"
          }]);
          setSearching(false);
          setStage('asking');
        } else {
          setResults(searchResults);
          setSearching(false);
          setStage('found');
        }
      } else {
        setStage('asking');
      }
    } catch {
      setMessages(m => [
        ...m,
        { role: 'assistant', content: "Sorry, I'm having trouble connecting right now. Please try again in a moment." },
      ]);
      setLoading(false);
      setSearching(false);
      setStage('asking');
    }
  };

  const reset = () => {
    setMessages([]);
    setResults(null);
    setStage('listening');
    setInput('');
    setSearching(false);
    localStorage.removeItem(STORAGE_KEY);
  };

  const copyResults = () => {
    if (!results) return;
    const lines = results.flatMap(cat => [
      `── ${cat.label} ──`,
      ...cat.results.map((r, i) =>
        `${i + 1}. ${r.name}${r.rating ? ` (${r.rating}★)` : ''}${r.address ? ` — ${r.address}` : ''}${r.phone ? ` — ${r.phone}` : ''}`
      ),
      '',
    ]);
    navigator.clipboard.writeText(lines.join('\n')).then(
      () => showToast('Results copied to clipboard'),
      () => showToast('Could not copy — try manually')
    );
  };

  const onKey = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  };

  const empty = messages.length === 0 && !results;

  const placeholderText = empty
    ? "Describe what you need help with…"
    : stage === 'found'
    ? "Refine your search — e.g. 'show me someone closer' or 'I need a female doctor'…"
    : "Add more detail, or share your city…";

  return (
    <div className="stage">
      <header className="topbar">
        <Mark />
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <span className="tagline">Lawyers · Doctors · Advisors</span>
          {!empty && (
            <button className="ghost-btn" onClick={reset}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" style={{ marginRight: 4 }}>
                <polyline points="1 4 1 10 7 10"/>
                <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/>
              </svg>
              New search
            </button>
          )}
        </div>
      </header>

      <main ref={mainRef}>
        {empty ? (
          <Welcome onPick={send} />
        ) : (
          <>
            {restored && (
              <div className="restored-banner">
                Restored your previous session.
                <button onClick={reset}>Start fresh instead →</button>
              </div>
            )}

            <div className="thread">
              <Progress stage={stage} />
              {messages.map((m, i) => (
                <div key={i} className={`turn ${m.role}`}>
                  <div className="avatar" aria-hidden="true">
                    {m.role === 'user'
                      ? <span className="av-you">You</span>
                      : <MiniCompass />
                    }
                  </div>
                  <div className="bubble">{m.content}</div>
                </div>
              ))}
              {loading && (
                <div className="turn assistant">
                  <div className="avatar" aria-hidden="true"><MiniCompass /></div>
                  <div className="bubble">
                    <div className="dots"><span></span><span></span><span></span></div>
                  </div>
                </div>
              )}
            </div>

            {(searching || results) && (
              <section className="results" ref={resultsRef}>
                {searching && !results && (
                  <div className="searching-note">
                    Reviewing reputations, ratings, and proximity…
                  </div>
                )}
                {results && results.map((cat, i) => (
                  <div key={i}>
                    <div className="results-head">
                      <h3>{cat.label}</h3>
                      <span className="meta">{cat.results.length} matches · ranked by rating</span>
                    </div>
                    <div className="cards">
                      {cat.results.map((r, j) => (
                        <ResultCard key={j} r={r} n={j + 1} />
                      ))}
                    </div>
                  </div>
                ))}

                {results && (
                  <div className="results-actions">
                    <button className="action-btn" onClick={copyResults}>
                      <ShareIcon /> Copy results
                    </button>
                  </div>
                )}

                {results && (
                  <div className="refine-section">
                    <div className="refine-label">Refine your search</div>
                    <div className="refine-chips">
                      {REFINEMENTS.map((r, i) => (
                        <button key={i} className="refine-chip" onClick={() => send(r)}>
                          {r}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {results && (
                  <p className="fineprint">
                    Rankings synthesize public reviews, ratings, and disclosure data.
                    FindMyPro helps narrow your options — it is not legal, medical, or financial advice.
                    Always verify credentials and consult directly before engaging any professional.
                  </p>
                )}
              </section>
            )}
          </>
        )}
      </main>

      <footer className="composer">
        <div className="composer-inner">
          <textarea
            ref={taRef}
            value={input}
            onChange={e => { setInput(e.target.value); adjustTA(); }}
            onKeyDown={onKey}
            placeholder={placeholderText}
            rows={1}
          />
          <button className="send" onClick={() => send()} disabled={!input.trim() || loading}>
            <SendIcon />
          </button>
        </div>
        <div className="composer-foot">
          <span>Press <kbd>↵</kbd> to send · <kbd>⇧↵</kbd> for newline</span>
          <span>Plain English. No forms.</span>
        </div>
      </footer>

      {toast && <div className="toast">{toast}</div>}

      <div className="site-credit">
        Created by <span>Ahaan Hossain</span>
      </div>
      <Analytics />
    </div>
  );
}

export default App;

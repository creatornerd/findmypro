import { useState, useRef, useEffect, useCallback } from 'react';
import { SignInButton, SignUpButton, UserButton, useUser, useAuth } from '@clerk/react';

const API_URL = import.meta.env.DEV ? 'http://localhost:3001/api' : '/api';
const STORAGE_KEY   = 'findmypro_session';
const SESSIONS_KEY  = 'findmypro_sessions';
const USAGE_KEY     = 'findmypro_usage';
const WEEKLY_LIMIT  = 5;

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

/* ─── Usage helpers ─────────────────────────────────── */

function getUsage() {
  try {
    const raw = localStorage.getItem(USAGE_KEY);
    if (!raw) return { count: 0, weekStart: Date.now() };
    const u = JSON.parse(raw);
    if (Date.now() - u.weekStart > 7 * 24 * 60 * 60 * 1000) {
      return { count: 0, weekStart: Date.now() };
    }
    return u;
  } catch {
    return { count: 0, weekStart: Date.now() };
  }
}

function incrementUsage() {
  const u = getUsage();
  const next = { ...u, count: u.count + 1 };
  localStorage.setItem(USAGE_KEY, JSON.stringify(next));
  return next.count;
}

/* ─── Session helpers ───────────────────────────────── */

function sessionTitle(messages) {
  const first = messages.find(m => m.role === 'user');
  if (!first) return 'New conversation';
  const t = first.content.trim();
  return t.length > 46 ? t.slice(0, 46) + '…' : t;
}

function loadSessions() {
  try { return JSON.parse(localStorage.getItem(SESSIONS_KEY) || '[]'); }
  catch { return []; }
}

function persistSessions(list) {
  localStorage.setItem(SESSIONS_KEY, JSON.stringify(list.slice(0, 30)));
}

function relativeTime(ts) {
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60000);
  if (mins < 2)  return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24)  return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days === 1) return 'Yesterday';
  if (days < 7)  return `${days}d ago`;
  return new Date(ts).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

/* ─── Icons ─────────────────────────────────────────── */

function CompassIcon({ size = 40 }) {
  return (
    <svg className="compass" width={size} height={size} viewBox="0 0 40 40" fill="none" aria-hidden="true">
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

function HistoryIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="1 4 1 10 7 10"/>
      <path d="M3.51 15a9 9 0 1 0 .49-4.88"/>
      <line x1="12" y1="7" x2="12" y2="12"/>
      <line x1="12" y1="12" x2="15" y2="14"/>
    </svg>
  );
}

/* ─── Credential verification ───────────────────────── */

const STATE_BAR_URLS = {
  CA: (n) => `https://apps.calbar.ca.gov/attorney/LicenseeSearch/QuickSearch?freeText=${encodeURIComponent(n)}`,
  FL: (n) => `https://www.floridabar.org/directories/find-mbr/?lName=${encodeURIComponent(n.split(' ').slice(-1)[0])}&fName=${encodeURIComponent(n.split(' ')[0])}`,
  TX: (n) => `https://www.texasbar.com/AM/Template.cfm?Section=Find_A_Lawyer&Filter=1&lastName=${encodeURIComponent(n.split(' ').slice(-1)[0])}&firstName=${encodeURIComponent(n.split(' ')[0])}`,
  NY: (n) => `https://iapps.courts.state.ny.us/attorneyservices/search?lastName=${encodeURIComponent(n.split(' ').slice(-1)[0])}&firstName=${encodeURIComponent(n.split(' ')[0])}&1=1`,
  IL: (n) => `https://www.iardc.org/rladvsearch.asp?type=name&lastname=${encodeURIComponent(n.split(' ').slice(-1)[0])}&firstname=${encodeURIComponent(n.split(' ')[0])}`,
  GA: (n) => `https://www.gabar.org/membersearch/?Keywords=${encodeURIComponent(n)}`,
  PA: (n) => `https://www.padisciplinaryboard.org/for-the-public/find-attorney?p=Attorney/Public/Search&type=name&value=${encodeURIComponent(n)}`,
  OH: (n) => `https://www.supremecourt.ohio.gov/AttorneySearch/#/search/${encodeURIComponent(n)}`,
  AZ: (n) => `https://www.azbar.org/for-the-public/attorney-referral-service/?s=${encodeURIComponent(n)}`,
  CO: (n) => `https://coloradosupremecourt.com/Search/AttorneySearch.asp?1=1&Name=${encodeURIComponent(n)}`,
};

function extractStateCode(address) {
  if (!address) return null;
  const m = address.match(/\b([A-Z]{2})\b(?:\s+\d{5})?/);
  return m ? m[1] : null;
}

function getVerifyLink(label, name, address) {
  if (!label) return null;
  const l = label.toLowerCase();
  const enc = encodeURIComponent(name || '');
  if (l.includes('lawyer') || l.includes('attorney') || l.includes('law')) {
    const state = extractStateCode(address);
    const barFn = state && STATE_BAR_URLS[state];
    if (barFn && name) return { url: barFn(name), text: `Verify with ${state} State Bar →` };
    return { url: `https://www.avvo.com/find-a-lawyer?q=${enc}`, text: 'Look up on Avvo →' };
  }
  if (l.includes('advisor') || l.includes('financial') || l.includes('cpa') || l.includes('broker') || l.includes('planner') || l.includes('wealth') || l.includes('tax')) {
    return { url: `https://brokercheck.finra.org/search/genericsearch/${enc}`, text: 'Check on FINRA BrokerCheck →' };
  }
  return { url: `https://www.healthgrades.com/find-a-doctor?q=${enc}`, text: 'Look up on Healthgrades →' };
}

/* ─── Sub-components ────────────────────────────────── */

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

function ResultCard({ r, n, label }) {
  const verifyLink = getVerifyLink(label, r.name, r.address);
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
          {verifyLink && (
            <span>
              <a href={verifyLink.url} target="_blank" rel="noopener noreferrer" className="verify-link">{verifyLink.text}</a>
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
            <span className="google-attr">via Google</span>
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
    { num: '03', title: 'See verified matches', desc: 'Real ratings from Google, ranked for your city — with direct links to verify credentials via State Bar, FINRA BrokerCheck, or Healthgrades.' },
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

function Welcome({ onPick, onFocusInput }) {
  const groups = ['Legal', 'Medical', 'Financial'].map(k => ({
    kind: k,
    items: SUGGESTIONS.filter(s => s.kind === k),
  }));

  return (
    <section className="welcome">
      <div className="eyebrow"><span className="dot"></span>AI-powered · Lawyers, Doctors &amp; Advisors · Real Google ratings</div>
      <h1 className="headline">Find the right professional<br/><em>without guessing.</em></h1>
      <p className="lede">
        Describe what's going on in plain words. FindMyPro uses AI to identify
        the type of specialist you need — then surfaces the highest-rated,
        verified practitioners near you. No directories. No forms.
      </p>

      <button className="cta-btn" onClick={onFocusInput}>
        Describe your situation →
      </button>

      <HowItWorks />

      <div className="trust-bar">
        <div className="trust-item">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--accent-deep)" strokeWidth="1.6"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
          <span>We help you find — we don't replace professional advice</span>
        </div>
        <div className="trust-item">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--accent-deep)" strokeWidth="1.6"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
          <span>Ratings sourced from real Google reviews · No paid placements</span>
        </div>
        <div className="trust-item">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--accent-deep)" strokeWidth="1.6"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
          <span>Your conversation is never stored or sold</span>
        </div>
        <div className="trust-item">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--accent-deep)" strokeWidth="1.6"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
          <span>Always verify credentials before engaging any professional</span>
        </div>
        <div className="trust-item">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--accent-deep)" strokeWidth="1.6"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>
          <span>Every result includes a direct credential verification link</span>
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

/* ─── Sidebar ────────────────────────────────────────── */

function Sidebar({ sessions, activeId, onSelect, onNew, open, onClose }) {
  return (
    <>
      {open && <div className="sidebar-overlay" onClick={onClose} />}
      <aside className={`sidebar ${open ? 'open' : ''}`} aria-label="Conversation history">
        <div className="sidebar-head">
          <span className="sidebar-title">History</span>
          <button className="sidebar-close" onClick={onClose} aria-label="Close history">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
              <path d="M18 6L6 18M6 6l12 12"/>
            </svg>
          </button>
        </div>

        <button className="new-chat-btn" onClick={() => { onNew(); onClose(); }}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
            <path d="M12 5v14M5 12h14"/>
          </svg>
          New conversation
        </button>

        <div className="session-list">
          {sessions.length === 0 ? (
            <p className="no-sessions">No past conversations yet.<br/>Start one below.</p>
          ) : (
            sessions.map(s => (
              <button
                key={s.id}
                className={`session-item ${s.id === activeId ? 'active' : ''}`}
                onClick={() => { onSelect(s); onClose(); }}
              >
                <span className="session-ttl">{s.title}</span>
                <span className="session-time">{relativeTime(s.timestamp)}</span>
              </button>
            ))
          )}
        </div>
      </aside>
    </>
  );
}

/* ─── Gate modal ─────────────────────────────────────── */

function GateModal({ onClose }) {
  return (
    <div className="gate-overlay" onClick={onClose}>
      <div className="gate-modal" onClick={e => e.stopPropagation()}>
        <CompassIcon size={34} />
        <h2 className="gate-title">You've used your {WEEKLY_LIMIT} free searches this week</h2>
        <p className="gate-text">
          Create a free account for unlimited searches and to save your conversation history across devices.
        </p>
        <div className="gate-actions">
          <SignUpButton mode="modal">
            <button className="cta-btn" onClick={onClose}>Create free account →</button>
          </SignUpButton>
          <SignInButton mode="modal">
            <button className="ghost-btn" onClick={onClose}>Sign in to existing account</button>
          </SignInButton>
        </div>
        <p className="gate-reset">Guest limit resets every 7 days.</p>
      </div>
    </div>
  );
}

/* ─── Auth Controls ──────────────────────────────────── */

function AuthControls() {
  const { isSignedIn, user } = useUser();
  if (isSignedIn) {
    const name = user?.firstName
      || user?.emailAddresses?.[0]?.emailAddress?.split('@')[0]
      || '';
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        {name && <span className="hi-name">Hi, {name}!</span>}
        <UserButton afterSignOutUrl="/" />
      </div>
    );
  }
  return (
    <>
      <SignInButton mode="modal">
        <button className="ghost-btn">Sign in</button>
      </SignInButton>
      <SignUpButton mode="modal">
        <button className="ghost-btn" style={{ fontWeight: 600 }}>Sign up</button>
      </SignUpButton>
    </>
  );
}

/* ─── Main App ───────────────────────────────────────── */

function App() {
  const { getToken, isSignedIn: clerkSignedIn } = useAuth();

  const sessionIdRef  = useRef(crypto.randomUUID());
  const sessionsRef   = useRef(loadSessions());

  const [sessions, setSessions]       = useState(() => loadSessions());
  const [activeId, setActiveId]       = useState(null);
  const [messages, setMessages]       = useState([]);
  const [input, setInput]             = useState('');
  const [loading, setLoading]         = useState(false);
  const [searching, setSearching]     = useState(false);
  const [results, setResults]         = useState(null);
  const [stage, setStage]             = useState('listening');
  const [toast, setToast]             = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [gateOpen, setGateOpen]       = useState(false);

  const taRef          = useRef(null);
  const mainRef        = useRef(null);
  const resultsRef     = useRef(null);
  const prevResultsRef = useRef(null);

  // Keep sessionsRef in sync
  useEffect(() => { sessionsRef.current = sessions; }, [sessions]);

  // Restore last active session from localStorage on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const session = JSON.parse(saved);
        if (session.messages?.length) {
          setMessages(session.messages);
          setResults(session.results || null);
          setStage(session.results ? 'found' : 'asking');
        }
      }
    } catch { /* ignore corrupt data */ }
  }, []);

  // Auto-save current session whenever messages change
  useEffect(() => {
    if (messages.length === 0) return;
    const id = sessionIdRef.current;
    const session = {
      id,
      title:     sessionTitle(messages),
      messages,
      results,
      stage,
      timestamp: Date.now(),
    };
    const existing = sessionsRef.current.findIndex(s => s.id === id);
    let next;
    if (existing >= 0) {
      next = [...sessionsRef.current];
      next[existing] = session;
    } else {
      next = [session, ...sessionsRef.current];
    }
    setSessions(next);
    persistSessions(next);
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ messages, results }));
  }, [messages, results, stage]);

  // Scroll behavior
  useEffect(() => {
    if (!mainRef.current) return;
    const resultsJustArrived = results && !prevResultsRef.current;
    prevResultsRef.current = results;
    if (resultsJustArrived && resultsRef.current) {
      resultsRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } else if (messages.length > 0 && !results) {
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

  const reset = useCallback(() => {
    sessionIdRef.current = crypto.randomUUID();
    setActiveId(null);
    setMessages([]);
    setResults(null);
    setStage('listening');
    setInput('');
    setSearching(false);
    localStorage.removeItem(STORAGE_KEY);
    if (taRef.current) taRef.current.style.height = 'auto';
  }, []);

  const restoreSession = useCallback((session) => {
    sessionIdRef.current = session.id;
    setActiveId(session.id);
    setMessages(session.messages);
    setResults(session.results || null);
    setStage(session.results ? 'found' : 'asking');
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ messages: session.messages, results: session.results }));
  }, []);

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
        // Check weekly limit for guests
        if (!clerkSignedIn) {
          const usage = getUsage();
          if (usage.count >= WEEKLY_LIMIT) {
            setGateOpen(true);
            setStage('asking');
            return;
          }
        }

        setStage('searching');
        setSearching(true);

        // Pass Clerk token for signed-in users (bypasses server rate limit)
        const token = clerkSignedIn ? await getToken() : null;
        const searchHeaders = { 'Content-Type': 'application/json' };
        if (token) searchHeaders['Authorization'] = `Bearer ${token}`;

        const searchRes = await fetch(`${API_URL}/search`, {
          method: 'POST',
          headers: searchHeaders,
          body: JSON.stringify({ queries: data.searches }),
        });

        if (searchRes.status === 429) {
          setGateOpen(true);
          setSearching(false);
          setStage('asking');
          return;
        }

        if (!searchRes.ok) throw new Error('Search failed');

        const searchData = await searchRes.json();
        const searchResults = searchData.results;

        // Increment guest usage on success
        if (!clerkSignedIn) incrementUsage();

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

  // Only show the history button when there are sessions from PREVIOUS conversations,
  // not the current one — prevents topbar layout shift mid-conversation.
  const hasPastSessions = sessions.some(s => s.id !== sessionIdRef.current);

  return (
    <>
      <Sidebar
        sessions={sessions}
        activeId={activeId}
        onSelect={restoreSession}
        onNew={reset}
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />

      <div className="stage">
        <header className="topbar">
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            {hasPastSessions && (
              <button
                className="ghost-btn sidebar-btn"
                onClick={() => setSidebarOpen(o => !o)}
                aria-label="Toggle conversation history"
              >
                <HistoryIcon />
              </button>
            )}
            <Mark />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <span className="tagline">Lawyers · Doctors · Advisors</span>
            {!empty && (
              <button className="ghost-btn" onClick={reset} aria-label="Start a new search">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" style={{ marginRight: 4 }}>
                  <polyline points="1 4 1 10 7 10"/>
                  <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/>
                </svg>
                New search
              </button>
            )}
            <AuthControls />
          </div>
        </header>

        <main ref={mainRef}>
          {empty ? (
            <Welcome
              onPick={send}
              onFocusInput={() => {
                taRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                taRef.current?.focus();
              }}
            />
          ) : (
            <>
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
                        <span className="meta">{cat.results.length} matches · Ranked by Google rating · No paid placements</span>
                      </div>
                      <div className="cards">
                        {cat.results.map((r, j) => (
                          <ResultCard key={j} r={r} n={j + 1} label={cat.label} />
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
                      Results ranked by Google rating. Data sourced from Google Places via Serper — no sponsored listings, no paid placements.
                      FindMyPro helps narrow your options — it is not legal, medical, or financial advice.
                      Always verify credentials directly: lawyers via your <a href="https://www.americanbar.org/groups/legal_services/flh-home/" target="_blank" rel="noopener noreferrer">State Bar</a>, doctors via the <a href="https://www.fsmb.org/physician-data-center/" target="_blank" rel="noopener noreferrer">Medical Board</a>, financial advisors via <a href="https://brokercheck.finra.org" target="_blank" rel="noopener noreferrer">FINRA BrokerCheck</a>.
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
              aria-label="Describe your situation"
              rows={1}
            />
            <button className="send" onClick={() => send()} disabled={!input.trim() || loading} aria-label="Send message">
              <SendIcon />
            </button>
          </div>
          <div className="composer-foot">
            <span>Press <kbd>↵</kbd> to send · <kbd>⇧↵</kbd> for newline</span>
            {!clerkSignedIn && (
              <span className="usage-counter">
                {Math.max(0, WEEKLY_LIMIT - getUsage().count)} free {getUsage().count >= WEEKLY_LIMIT - 1 ? 'search' : 'searches'} left this week
              </span>
            )}
          </div>
        </footer>

        <div className="site-credit">
          © {new Date().getFullYear()} Ahaan Hossain. All rights reserved.
        </div>
      </div>

      {gateOpen && <GateModal onClose={() => setGateOpen(false)} />}
      {toast && <div className="toast">{toast}</div>}
    </>
  );
}

export default App;

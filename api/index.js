const express = require('express');
const cors = require('cors');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const { createClient } = require('@supabase/supabase-js');

const app = express();
app.use(cors());
app.use(express.json({ limit: '100kb' }));

// Guests get a single free search, then the sign-up wall.
const GUEST_WEEKLY_LIMIT = 1;
const AUTH_WEEKLY_LIMIT = 15;
const REFERRAL_BONUS = 10;
// A referrer stops earning after this many rewarded referrals (caps bonus at +50/week).
const MAX_REWARDED_REFERRALS = 5;

// Guards on paid/free-tier upstream APIs (Serper credits, Gemini quota).
const MAX_QUERIES_PER_SEARCH = 3;
const MAX_QUERY_LENGTH = 200;
const CHAT_HOURLY_LIMIT = 40;
const MAX_CHAT_MESSAGES = 30;
const MAX_MESSAGE_LENGTH = 2000;

// `supabase` is only used to verify user JWTs. All table reads/writes go through
// `supabaseAdmin` (service role) so RLS can deny every write from the browser.
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);
const supabaseAdmin = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

function clientIp(req) {
  return (req.headers['x-forwarded-for'] || '').split(',')[0].trim()
      || req.socket?.remoteAddress
      || 'unknown';
}

async function upstash(path, method = 'POST') {
  const res = await fetch(`${process.env.UPSTASH_REDIS_REST_URL}${path}`, {
    method,
    headers: { Authorization: `Bearer ${process.env.UPSTASH_REDIS_REST_TOKEN}` },
  });
  return res.json();
}

async function checkRateLimit(ip) {
  try {
    const key = `fmp:rl:v2:${ip}`;
    const { result: count } = await upstash(`/incr/${key}`);
    if (count === 1) await upstash(`/expire/${key}/604800`);
    return count <= GUEST_WEEKLY_LIMIT;
  } catch (err) {
    console.warn('Upstash rate-limit check failed, allowing request:', err.message);
    return true;
  }
}

async function checkAuthRateLimit(userId, bonusSearches = 0) {
  try {
    const key = `fmp:rl:user:${userId}`;
    const { result: count } = await upstash(`/incr/${key}`);
    if (count === 1) await upstash(`/expire/${key}/604800`);
    return count <= AUTH_WEEKLY_LIMIT + bonusSearches;
  } catch (err) {
    console.warn('Upstash auth rate-limit check failed, allowing request:', err.message);
    return true;
  }
}

async function checkChatRateLimit(ip) {
  try {
    const key = `fmp:rl:chat:${ip}`;
    const { result: count } = await upstash(`/incr/${key}`);
    if (count === 1) await upstash(`/expire/${key}/3600`);
    return count <= CHAT_HOURLY_LIMIT;
  } catch (err) {
    console.warn('Upstash chat rate-limit check failed, allowing request:', err.message);
    return true;
  }
}

// Read the current usage count for a key WITHOUT incrementing it.
async function getUsageCount(key) {
  const { result } = await upstash(`/get/${key}`);
  return parseInt(result, 10) || 0;
}

// Seconds until the weekly window resets (-2 = no key yet, -1 = no expiry).
async function getUsageTtl(key) {
  const { result } = await upstash(`/ttl/${key}`);
  return typeof result === 'number' ? result : -2;
}

async function getAuthenticatedUser(authHeader) {
  if (!authHeader?.startsWith('Bearer ')) return null;
  try {
    const { data: { user }, error } = await supabase.auth.getUser(authHeader.slice(7));
    if (error || !user) return null;
    return user;
  } catch {
    return null;
  }
}

const REFERRAL_CODE_RE = /^[a-f0-9]{8,32}$/;

// Returns the user's referral code, creating it on first use. The default code is
// the first 8 hex chars of their uuid (matches links shared before codes were stored);
// on the rare collision we fall back to a longer slice.
async function getOrCreateReferralCode(userId) {
  const { data: existing } = await supabaseAdmin
    .from('referral_codes')
    .select('code')
    .eq('user_id', userId)
    .maybeSingle();
  if (existing) return existing.code;

  const hex = userId.replace(/-/g, '');
  for (const len of [8, 12, 32]) {
    const code = hex.slice(0, len);
    const { error } = await supabaseAdmin.from('referral_codes').insert({ user_id: userId, code });
    if (!error) return code;
    if (error.code !== '23505') throw error;
    // 23505 = unique violation: either this user raced us (re-read) or the code is taken (try longer).
    const { data: raced } = await supabaseAdmin
      .from('referral_codes').select('code').eq('user_id', userId).maybeSingle();
    if (raced) return raced.code;
  }
  throw new Error('Could not allocate referral code');
}

async function findReferrerByCode(code) {
  if (typeof code !== 'string' || !REFERRAL_CODE_RE.test(code)) return null;
  const { data } = await supabaseAdmin
    .from('referral_codes')
    .select('user_id')
    .eq('code', code)
    .maybeSingle();
  return data?.user_id || null;
}

async function getBonusSearches(userId) {
  const { data } = await supabaseAdmin
    .from('bonus_searches')
    .select('bonus_count')
    .eq('user_id', userId)
    .maybeSingle();
  return data?.bonus_count || 0;
}

// Credits the referrer (if any) once the referred user has actually run a search.
async function rewardPendingReferral(userId) {
  try {
    const { error } = await supabaseAdmin.rpc('reward_referral', {
      p_referred: userId,
      p_bonus: REFERRAL_BONUS,
      p_max_rewarded: MAX_REWARDED_REFERRALS,
    });
    if (error) throw error;
  } catch (err) {
    console.warn('Referral reward failed:', err.message);
  }
}

const gemini = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
// Gemini 2.0 models are shut down and 2.5 is limited to existing users.
// Lite first (cheaper, higher free-tier limits), full Flash as fallback.
const GEMINI_MODELS = ['gemini-3.5-flash-lite', 'gemini-3.8-flash'];

async function geminiWithRetry(fn, retries = 3) {
  for (let i = 0; i < retries; i++) {
    try {
      return await fn();
    } catch (err) {
      const isRetryable = err.status === 429 || err.status === 503
        || err.message?.includes('429') || err.message?.includes('503')
        || err.message?.includes('quota') || err.message?.includes('high demand')
        || err.message?.includes('overloaded');
      if (!isRetryable || i === retries - 1) throw err;
      console.warn(`Gemini transient error (attempt ${i + 1}/${retries}): ${err.status} ${err.message?.slice(0, 80)}`);
      await new Promise(r => setTimeout(r, (2 ** i) * 1000));
    }
  }
}

const SYSTEM_PROMPT = `You are FindMyPro's AI assistant — a calm, helpful guide that connects people with the right professional. You are NOT a lawyer, doctor, or financial advisor. You help people FIND the right one.

YOUR GOAL:
Understand the user's situation well enough to match them with the right type of professional. Do not rush — ask a clarifying question if the situation is vague or could have many causes.

PROFESSIONAL CATEGORIES:
LAW: Personal Injury, Medical Malpractice, Criminal Defense (DUI/assault/theft), Family Law (divorce/custody), Employment Law (wrongful termination/harassment), Workers Compensation, Bankruptcy, Tenant/Landlord, Business/Corporate Law, Immigration, Probate/Estate

MEDICAL: Cardiologist, Oncologist, Neurologist, Orthopedic Surgeon, Dermatologist, Ophthalmologist, Endocrinologist, Gastroenterologist, Rheumatologist, Pulmonologist, Nephrologist, ENT, Psychiatrist, Plastic Surgeon, Pediatric Specialists, Urologist

FINANCE: Private Wealth Manager, Financial Advisor/RIA, Business Banker, Retirement Planner, CPA/Tax Attorney, Estate Planning, Mortgage Broker, Debt/Credit Counselor

TRIAGE RULES — follow these before recommending any specialist:

1. COMMON/VAGUE SYMPTOMS — ask ONE follow-up question before recommending:
   - Symptoms like neck pain, back pain, headache, dizziness, fatigue, blurry vision, nausea on their own are very common and have many causes.
   - Ask about duration and severity: "How long has this been going on, and would you say it's mild, moderate, or severe?"
   - Only recommend a specialist once you understand the context (e.g., chronic vs sudden onset, mild vs debilitating).

2. CLEAR SPECIALIST TRIGGERS — go straight to recommending if the user describes:
   - A specific incident (car accident, fall, workplace injury → Personal Injury / Orthopedic)
   - A legal situation (divorce, eviction, arrest, wrongful termination)
   - A financial situation (IRS audit, retirement planning, debt)
   - A known diagnosis they want specialist care for
   - Symptoms that are clearly cardiac: chest pain + shortness of breath, palpitations, pain radiating to arm/jaw
   - Symptoms that are clearly neurological: sudden numbness, sudden loss of vision, sudden severe headache, slurred speech (NOTE: for these, also tell them to seek emergency care immediately, not just find a specialist)

3. MULTIPLE POSSIBLE SPECIALISTS — if the situation could involve 2 types, mention both and ask which fits better, or recommend both if clearly applicable (e.g., car accident = personal injury lawyer + orthopedic surgeon).
   CRITICAL: when recommending two distinct professional types (e.g. "tax attorney or CPA", "cardiologist or pulmonologist"), ALWAYS create a SEPARATE search entry for each type — never merge them into one label. One label must match one type of professional. Merging leads to mismatched results that confuse users.

4. TONE RULES — critical:
   - Never say "I am very concerned" or use alarming language for vague symptoms.
   - Be calm, warm, and matter-of-fact. You are a knowledgeable friend, not an ER doctor.
   - Only express urgency if symptoms are genuinely acute (sudden onset, severe, classic emergency signs).
   - For common symptoms, be casual: "That could be a few different things — how long has it been bothering you?"

5. LOCATION: Once you know the professional type AND the situation is clear, ask for their city if they haven't given it. Don't ask for city until the situation is understood.

RESPONSE FORMAT — always respond with valid JSON:
{
  "message": "Your response here — plain text only, no markdown, 1-3 sentences",
  "needsLocation": true/false,
  "readyToSearch": true/false,
  "searches": [
    {
      "query": "best personal injury lawyer in Chicago",
      "label": "Personal Injury Lawyer",
      "reason": "One sentence explaining why this specialist fits the user's specific situation."
    }
  ]
}

FIELD RULES:
- "readyToSearch": true ONLY when you have (a) a clear professional type AND (b) the user's city
- "searches": 1-3 items, only when readyToSearch is true. Query format: "best [specialist] in [city]". Be specific: use "personal injury law firm" not just "lawyer", "licensed CPA" not just "accountant", "tax attorney law firm" not "tax help" — this prevents unrelated businesses (e.g. tax relief firms) from appearing under a professional label.
- "needsLocation": true when professional type is known but city is missing
- "searches": empty array [] when readyToSearch is false
- "reason": one sentence explaining why this specialist fits the user's described situation (e.g. "Your car accident puts this in personal injury territory, where a lawyer can pursue compensation for medical bills and lost wages.")

EXAMPLES OF CORRECT BEHAVIOR:

User: "I have neck pain"
Wrong: Immediately recommend an orthopedic surgeon or neurologist.
Correct: { "message": "Neck pain is pretty common and can have a lot of different causes. How long has it been bothering you, and is it more of a dull ache or sharp pain?", "needsLocation": false, "readyToSearch": false, "searches": [] }

User: "I've been getting dizzy and things look blurry"
Wrong: Immediately recommend a neurologist or ophthalmologist.
Correct: { "message": "Those symptoms can come from quite a few different things. How long has this been happening, and does it come and go or is it constant?", "needsLocation": false, "readyToSearch": false, "searches": [] }

User: "I've had neck pain for 3 months and it radiates down my arm, it's getting worse"
Correct: now it's clear — recommend a neurologist or orthopedic surgeon and ask for city.

User: "I got into a car accident and my back hurts"
Correct: clear incident — go straight to personal injury lawyer + orthopedic surgeon, ask for city.

User: "I have chest pain and my left arm is numb — it came on suddenly"
Correct: genuine emergency signs — tell them to call 911 or go to the ER immediately first, then offer to find a cardiologist for follow-up.`;

// Vague symptom keywords that need follow-up before recommending a specialist
const VAGUE_SYMPTOMS = [
  'dizzy','dizziness','blurry','blurred','vision','neck pain','neck hurts','back pain','back hurts',
  'headache','head hurts','tired','fatigue','nausea','nauseous','ache','aching','sore','pain',
  'feeling off','not feeling well','not feeling great','feel weird','feel sick',
];

// Context words that indicate the situation IS already clear (no need to triage)
const CLEAR_CONTEXT = [
  'accident','crash','fell','injured','diagnosed','for months','for weeks','for years',
  'getting worse','radiates','spreading','severe','unbearable','can\'t',
  'arrested','fired','eviction','divorce','irs','audit','lawsuit',
  'chest pain','heart','arm is numb','slurred','can\'t breathe',
];

function needsTriage(messages) {
  // Only triage on the very first user message
  const userMessages = messages.filter(m => m.role === 'user');
  if (userMessages.length !== 1) return false;

  const text = userMessages[0].content.toLowerCase();
  const hasVague = VAGUE_SYMPTOMS.some(k => text.includes(k));
  const hasClear = CLEAR_CONTEXT.some(k => text.includes(k));
  return hasVague && !hasClear;
}

app.post('/api/chat', async (req, res) => {
  try {
    const { messages } = req.body || {};
    const valid = Array.isArray(messages)
      && messages.length > 0
      && messages.length <= MAX_CHAT_MESSAGES
      && messages.every(m => m && (m.role === 'user' || m.role === 'assistant')
        && typeof m.content === 'string' && m.content.length <= MAX_MESSAGE_LENGTH)
      && messages[messages.length - 1].role === 'user';
    if (!valid) return res.status(400).json({ error: 'Invalid messages' });

    if (!(await checkChatRateLimit(clientIp(req)))) {
      return res.status(429).json({ error: 'chat_rate_limited', message: "You're sending messages too quickly. Please wait a bit and try again." });
    }

    // Gemini uses 'model' role instead of 'assistant'
    const history = messages.slice(0, -1).map(m => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }],
    }));

    // If the first message has only vague symptoms, bypass the model entirely
    // and return a triage follow-up question directly — the model ignores prompt-level rules.
    if (needsTriage(messages)) {
      return res.json({
        message: "That could be a few different things — how long has this been going on, and would you say it's mild, moderate, or pretty severe?",
        needsLocation: false,
        readyToSearch: false,
        searches: [],
      });
    }

    const lastMessage = messages[messages.length - 1].content;
    let text;

    // Try each model in order — if one is overloaded/down, fall back to the next
    for (let m = 0; m < GEMINI_MODELS.length; m++) {
      try {
        const model = gemini.getGenerativeModel({
          model: GEMINI_MODELS[m],
          systemInstruction: SYSTEM_PROMPT,
        });
        const chat = model.startChat({ history });
        const result = await geminiWithRetry(() => chat.sendMessage(lastMessage));
        text = result.response.text().trim();
        break;
      } catch (err) {
        console.warn(`Model ${GEMINI_MODELS[m]} failed: ${err.status} ${err.message?.slice(0, 100)}`);
        if (m === GEMINI_MODELS.length - 1) throw err;
      }
    }

    let parsed;
    try {
      const cleaned = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
      parsed = JSON.parse(cleaned);
    } catch {
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        parsed = JSON.parse(jsonMatch[0]);
      } else {
        parsed = { message: text, needsLocation: false, readyToSearch: false, searches: [] };
      }
    }

    res.json(parsed);
  } catch (error) {
    console.error('Chat error:', error.status, error.message);
    res.status(500).json({ error: 'Something went wrong. Please try again.' });
  }
});

async function serperFetch(url, body) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'X-API-KEY': process.env.SERPER_API_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Serper ${url} returned ${res.status}: ${text.slice(0, 200)}`);
  }
  return res.json();
}

// Directory/aggregator/"best of" sites — these list many providers rather than being
// one, so they must never be surfaced as if they were an individual result.
const DIRECTORY_DOMAINS = new Set([
  'avvo.com', 'findlaw.com', 'justia.com', 'superlawyers.com', 'martindale.com',
  'lawyers.com', 'nolo.com', 'expertise.com', 'bestlawyers.com', 'lawinfo.com',
  'upcounsel.com', 'lawyer.com', 'attorneys.com', 'attorney.com',
  'healthgrades.com', 'vitals.com', 'zocdoc.com', 'webmd.com', 'ratemds.com',
  'wellness.com', 'sharecare.com', 'caredash.com', 'usnews.com',
  'yelp.com', 'angi.com', 'thumbtack.com', 'bbb.org', 'manta.com', 'yellowpages.com',
  'smartasset.com', 'nerdwallet.com', 'bankrate.com', 'forbes.com',
  'investopedia.com', 'wallethub.com', 'consumeraffairs.com', 'reddit.com',
]);

// Catches "Top 10 ...", "Best ... Lawyers", "... Law Firms & Lawyers" style listicle/roundup titles.
const LISTICLE_TITLE_RE = /^(top\s*\d*|best)\b|\btop\s*\d+\b|\b(firms?|lawyers?|attorneys?)\s*&\s*(firms?|lawyers?|attorneys?)\b/i;

function hostnameOf(url) {
  try { return new URL(url).hostname.replace(/^www\./, ''); } catch { return ''; }
}

function isDirectoryResult({ name, website }) {
  const host = hostnameOf(website);
  if (host && DIRECTORY_DOMAINS.has(host)) return true;
  if (name && LISTICLE_TITLE_RE.test(name.trim())) return true;
  return false;
}

// Ranks by Google rating weighted by review volume (a Bayesian average), so a 5.0 from
// 3 reviews doesn't outrank a 4.8 from 900. Unrated results keep Google's order, last.
const PRIOR_RATING = 4.0;
const PRIOR_WEIGHT = 20;

function ratingScore({ rating, reviews }) {
  if (rating == null) return -1;
  const n = Number(reviews) || 0;
  return (n * Number(rating) + PRIOR_WEIGHT * PRIOR_RATING) / (n + PRIOR_WEIGHT);
}

function rankByRating(items) {
  return items
    .map((item, i) => ({ item, i, score: ratingScore(item) }))
    .sort((a, b) => b.score - a.score || a.i - b.i)
    .map(x => x.item);
}

function buildWhy(reason, item) {
  if (!reason) return null;
  if (item.rating && item.reviews) {
    return `${reason} Rated ${Number(item.rating).toFixed(1)}/5 across ${item.reviews} Google reviews.`;
  }
  return reason;
}

async function searchWithSerper(query) {
  try {
    const placesData = await serperFetch('https://google.serper.dev/places', { q: query, gl: 'us' });
    const places = placesData.places || [];

    if (places.length > 0) {
      return rankByRating(places.map(p => ({
        name: p.title || p.name || '',
        rating: p.rating || null,
        reviews: p.ratingCount || p.reviews || null,
        address: p.address || '',
        phone: p.phoneNumber || p.phone || '',
        website: p.website || '',
      }))).slice(0, 5);
    }
  } catch (err) {
    console.warn(`Serper /places failed for "${query}":`, err.message);
  }

  try {
    // Ask for more than we need since directory/listicle results get filtered out below.
    const searchData = await serperFetch('https://google.serper.dev/search', { q: query, num: 10 });
    return (searchData.organic || [])
      .filter(item => !isDirectoryResult({ name: item.title, website: item.link }))
      .slice(0, 5)
      .map(item => ({
        name: item.title,
        rating: null,
        reviews: null,
        address: item.snippet || '',
        phone: '',
        website: item.link || '',
      }));
  } catch (err) {
    console.warn(`Serper /search fallback failed for "${query}":`, err.message);
    return [];
  }
}

app.post('/api/search', async (req, res) => {
  try {
    // Validate before touching the rate limiter so malformed requests don't burn a search,
    // and cap the query count so one request can't drain Serper credits.
    const rawQueries = req.body?.queries;
    const validQueries = Array.isArray(rawQueries)
      && rawQueries.length > 0
      && rawQueries.length <= MAX_QUERIES_PER_SEARCH
      && rawQueries.every(q => q && typeof q.query === 'string'
        && q.query.trim().length > 0 && q.query.length <= MAX_QUERY_LENGTH);
    if (!validQueries) {
      return res.status(400).json({ error: `Send 1-${MAX_QUERIES_PER_SEARCH} search queries.` });
    }
    const queries = rawQueries.map(q => ({
      query: q.query.trim(),
      label: typeof q.label === 'string' ? q.label.slice(0, 100) : '',
      reason: typeof q.reason === 'string' ? q.reason.slice(0, 400) : '',
    }));

    const user = await getAuthenticatedUser(req.headers.authorization);
    if (!user) {
      const allowed = await checkRateLimit(clientIp(req));
      if (!allowed) {
        return res.status(429).json({ error: 'weekly_limit_reached', limit: GUEST_WEEKLY_LIMIT });
      }
    } else {
      const bonus = await getBonusSearches(user.id);
      const allowed = await checkAuthRateLimit(user.id, bonus);
      if (!allowed) {
        return res.status(429).json({ error: 'weekly_limit_reached', limit: AUTH_WEEKLY_LIMIT + bonus });
      }
    }

    const settled = await Promise.allSettled(
      queries.map(async ({ query, label, reason }) => {
        const items = await searchWithSerper(query);
        return { label, results: items.map(item => ({ ...item, why: buildWhy(reason, item) })) };
      })
    );

    const results = settled.map((r, i) => {
      if (r.status === 'fulfilled') return r.value;
      console.warn(`Search query "${queries[i].query}" failed:`, r.reason?.message);
      return { label: queries[i].label, results: [] };
    });

    if (user) await rewardPendingReferral(user.id);

    res.json({ results });
  } catch (error) {
    console.error('Search error:', error);
    res.status(500).json({ error: 'Search failed. Please try again.' });
  }
});

/* ─── Usage endpoint ───────────────────────────────────── */

// Returns the caller's current weekly search usage without consuming one.
// Works for both guests (IP-keyed) and authenticated users (user-keyed),
// mirroring the exact keys the rate limiter uses so the numbers line up.
app.get('/api/usage', async (req, res) => {
  try {
    const user = await getAuthenticatedUser(req.headers.authorization);

    if (!user) {
      const key = `fmp:rl:v2:${clientIp(req)}`;
      let used = 0, ttl = -2;
      try { used = await getUsageCount(key); ttl = await getUsageTtl(key); }
      catch (err) { console.warn('Usage lookup failed:', err.message); }
      const limit = GUEST_WEEKLY_LIMIT;
      return res.json({
        authenticated: false,
        used,
        limit,
        base: GUEST_WEEKLY_LIMIT,
        bonus: 0,
        remaining: Math.max(0, limit - used),
        resetInSeconds: ttl > 0 ? ttl : null,
      });
    }

    let bonus = 0;
    try { bonus = await getBonusSearches(user.id); }
    catch (err) { console.warn('Bonus lookup failed:', err.message); }

    const key = `fmp:rl:user:${user.id}`;
    let used = 0, ttl = -2;
    try { used = await getUsageCount(key); ttl = await getUsageTtl(key); }
    catch (err) { console.warn('Usage lookup failed:', err.message); }

    const limit = AUTH_WEEKLY_LIMIT + bonus;
    res.json({
      authenticated: true,
      used,
      limit,
      base: AUTH_WEEKLY_LIMIT,
      bonus,
      remaining: Math.max(0, limit - used),
      resetInSeconds: ttl > 0 ? ttl : null,
    });
  } catch (error) {
    console.error('Usage error:', error);
    res.status(500).json({ error: 'Failed to fetch usage' });
  }
});


/* ─── Referral endpoints ───────────────────────────────── */

app.get('/api/referral/info', async (req, res) => {
  try {
    const user = await getAuthenticatedUser(req.headers.authorization);
    if (!user) return res.status(401).json({ error: 'Unauthorized' });

    const referralCode = await getOrCreateReferralCode(user.id);

    const { data: referrals } = await supabaseAdmin
      .from('referrals')
      .select('id, rewarded, created_at')
      .eq('referrer_id', user.id);

    const successfulReferrals = (referrals || []).filter(r => r.rewarded).length;
    const bonusSearches = Math.min(successfulReferrals, MAX_REWARDED_REFERRALS) * REFERRAL_BONUS;

    res.json({
      referralCode,
      referralLink: `https://findmyspecialist.vercel.app?ref=${referralCode}`,
      totalReferrals: (referrals || []).length,
      successfulReferrals,
      bonusSearches,
      maxBonusSearches: MAX_REWARDED_REFERRALS * REFERRAL_BONUS,
    });
  } catch (error) {
    console.error('Referral info error:', error);
    res.status(500).json({ error: 'Failed to fetch referral info' });
  }
});

// Records who referred this user. The referrer is NOT credited here — that happens
// in /api/search after the new user's first search (see rewardPendingReferral).
app.post('/api/referral/claim', async (req, res) => {
  try {
    const user = await getAuthenticatedUser(req.headers.authorization);
    if (!user) return res.status(401).json({ error: 'Unauthorized' });

    const { referralCode } = req.body || {};
    if (!referralCode) return res.status(400).json({ error: 'No referral code provided' });

    const referrerId = await findReferrerByCode(referralCode);
    if (!referrerId) return res.status(400).json({ error: 'Invalid referral code' });
    if (referrerId === user.id) return res.status(400).json({ error: 'Cannot refer yourself' });

    const { error: insertErr } = await supabaseAdmin
      .from('referrals')
      .insert({ referrer_id: referrerId, referred_user_id: user.id, rewarded: false });

    if (insertErr?.code === '23505') return res.status(400).json({ error: 'Already referred' });
    if (insertErr) throw insertErr;

    res.json({ success: true });
  } catch (error) {
    console.error('Referral claim error:', error);
    res.status(500).json({ error: 'Failed to process referral' });
  }
});

app.get('/api/referral/validate/:code', async (req, res) => {
  try {
    res.json({ valid: !!(await findReferrerByCode(req.params.code)) });
  } catch {
    res.json({ valid: false });
  }
});

module.exports = app;

const express = require('express');
const cors = require('cors');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const { createClient } = require('@supabase/supabase-js');

const app = express();
app.use(cors());
app.use(express.json());

const GUEST_WEEKLY_LIMIT = 5;
const AUTH_WEEKLY_LIMIT = 15;
const REFERRAL_BONUS = 10;

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);
const supabaseAdmin = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function upstash(path, method = 'POST') {
  const res = await fetch(`${process.env.UPSTASH_REDIS_REST_URL}${path}`, {
    method,
    headers: { Authorization: `Bearer ${process.env.UPSTASH_REDIS_REST_TOKEN}` },
  });
  return res.json();
}

async function checkRateLimit(ip) {
  try {
    const key = `fmp:rl:${ip}`;
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

function generateReferralCode(userId) {
  return userId.replace(/-/g, '').slice(0, 8);
}

async function getBonusSearches(userId) {
  const { data } = await supabase
    .from('bonus_searches')
    .select('bonus_count')
    .eq('user_id', userId)
    .single();
  return data?.bonus_count || 0;
}

const gemini = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const GEMINI_MODELS = ['gemini-2.0-flash', 'gemini-2.0-flash-lite', 'gemini-2.5-flash'];

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
      "label": "Personal Injury Lawyer"
    }
  ]
}

FIELD RULES:
- "readyToSearch": true ONLY when you have (a) a clear professional type AND (b) the user's city
- "searches": 1-3 items, only when readyToSearch is true. Query format: "best [specialist] in [city]"
- "needsLocation": true when professional type is known but city is missing
- "searches": empty array [] when readyToSearch is false

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
    const { messages } = req.body;

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

async function searchWithSerper(query) {
  try {
    const placesData = await serperFetch('https://google.serper.dev/places', { q: query, gl: 'us' });
    const places = (placesData.places || []).slice(0, 5);

    if (places.length > 0) {
      return places.map(p => ({
        name: p.title || p.name || '',
        rating: p.rating || null,
        reviews: p.ratingCount || p.reviews || null,
        address: p.address || '',
        phone: p.phoneNumber || p.phone || '',
        website: p.website || '',
      }));
    }
  } catch (err) {
    console.warn(`Serper /places failed for "${query}":`, err.message);
  }

  try {
    const searchData = await serperFetch('https://google.serper.dev/search', { q: query, num: 5 });
    return (searchData.organic || []).slice(0, 5).map(item => ({
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
    const user = await getAuthenticatedUser(req.headers.authorization);
    if (!user) {
      const ip = (req.headers['x-forwarded-for'] || '').split(',')[0].trim()
              || req.socket?.remoteAddress
              || 'unknown';
      const allowed = await checkRateLimit(ip);
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

    const { queries } = req.body;

    const settled = await Promise.allSettled(
      queries.map(async ({ query, label }) => {
        const items = await searchWithSerper(query);
        return { label, results: items };
      })
    );

    const results = settled.map((r, i) => {
      if (r.status === 'fulfilled') return r.value;
      console.warn(`Search query "${queries[i].query}" failed:`, r.reason?.message);
      return { label: queries[i].label, results: [] };
    });

    res.json({ results });
  } catch (error) {
    console.error('Search error:', error);
    res.status(500).json({ error: 'Search failed. Please try again.' });
  }
});

/* ─── Referral endpoints ───────────────────────────────── */

app.get('/api/referral/info', async (req, res) => {
  try {
    const user = await getAuthenticatedUser(req.headers.authorization);
    if (!user) return res.status(401).json({ error: 'Unauthorized' });

    const referralCode = generateReferralCode(user.id);

    const { data: referrals } = await supabase
      .from('referrals')
      .select('id, rewarded, created_at')
      .eq('referrer_id', user.id);

    const successfulReferrals = (referrals || []).filter(r => r.rewarded).length;
    const bonusSearches = successfulReferrals * REFERRAL_BONUS;

    res.json({
      referralCode,
      referralLink: `https://findmyspecialist.vercel.app?ref=${referralCode}`,
      totalReferrals: (referrals || []).length,
      successfulReferrals,
      bonusSearches,
    });
  } catch (error) {
    console.error('Referral info error:', error);
    res.status(500).json({ error: 'Failed to fetch referral info' });
  }
});

app.post('/api/referral/claim', async (req, res) => {
  try {
    const user = await getAuthenticatedUser(req.headers.authorization);
    if (!user) return res.status(401).json({ error: 'Unauthorized' });

    const { referralCode } = req.body;
    if (!referralCode) return res.status(400).json({ error: 'No referral code provided' });

    const { data: allUsers } = await supabaseAdmin.auth.admin.listUsers();
    const referrer = (allUsers?.users || []).find(
      u => generateReferralCode(u.id) === referralCode
    );

    if (!referrer) return res.status(400).json({ error: 'Invalid referral code' });
    if (referrer.id === user.id) return res.status(400).json({ error: 'Cannot refer yourself' });

    const { data: existing } = await supabase
      .from('referrals')
      .select('id')
      .eq('referred_user_id', user.id)
      .single();

    if (existing) return res.status(400).json({ error: 'Already referred' });

    const { error: insertErr } = await supabase
      .from('referrals')
      .insert({ referrer_id: referrer.id, referred_user_id: user.id, rewarded: true });

    if (insertErr) throw insertErr;

    const currentBonus = await getBonusSearches(referrer.id);
    await supabase
      .from('bonus_searches')
      .upsert({ user_id: referrer.id, bonus_count: currentBonus + REFERRAL_BONUS, updated_at: new Date().toISOString() });

    res.json({ success: true });
  } catch (error) {
    console.error('Referral claim error:', error);
    res.status(500).json({ error: 'Failed to process referral' });
  }
});

app.get('/api/referral/validate/:code', async (req, res) => {
  try {
    const { code } = req.params;
    const { data: allUsers } = await supabaseAdmin.auth.admin.listUsers();
    const referrer = (allUsers?.users || []).find(
      u => generateReferralCode(u.id) === code
    );
    res.json({ valid: !!referrer });
  } catch {
    res.json({ valid: false });
  }
});

module.exports = app;

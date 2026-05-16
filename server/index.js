const path = require('path');
const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const { GoogleGenerativeAI } = require('@google/generative-ai');

dotenv.config({ path: path.join(__dirname, '.env') });

const app = express();
app.use(cors());
app.use(express.json());

const gemini = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

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
      "label": "Personal Injury Lawyer",
      "reason": "One sentence explaining why this specialist fits the user's specific situation."
    }
  ]
}

FIELD RULES:
- "readyToSearch": true ONLY when you have (a) a clear professional type AND (b) the user's city
- "searches": 1-3 items, only when readyToSearch is true. Query format: "best [specialist] in [city]"
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
    const { messages } = req.body;

    const model = gemini.getGenerativeModel({
      model: 'gemini-flash-latest',
      systemInstruction: SYSTEM_PROMPT,
    });

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

    const chat = model.startChat({ history });
    const lastMessage = messages[messages.length - 1].content;
    const result = await chat.sendMessage(lastMessage);
    const text = result.response.text().trim();

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
    console.error('Chat error:', error);
    res.status(500).json({ error: 'Something went wrong. Please try again.' });
  }
});

function buildWhy(reason, item) {
  if (!reason) return null;
  if (item.rating && item.reviews) {
    return `${reason} Rated ${Number(item.rating).toFixed(1)}/5 across ${item.reviews} Google reviews.`;
  }
  return reason;
}

async function searchWithSerper(query) {
  // Use /places endpoint for rich structured data (ratings, phone, address)
  const placesRes = await fetch('https://google.serper.dev/places', {
    method: 'POST',
    headers: { 'X-API-KEY': process.env.SERPER_API_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ q: query, gl: 'us' }),
  });
  const placesData = await placesRes.json();
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

  // Fall back to organic results if no places found
  const searchRes = await fetch('https://google.serper.dev/search', {
    method: 'POST',
    headers: { 'X-API-KEY': process.env.SERPER_API_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ q: query, num: 5 }),
  });
  const searchData = await searchRes.json();
  return (searchData.organic || []).slice(0, 5).map(item => ({
    name: item.title,
    rating: null,
    reviews: null,
    address: item.snippet || '',
    phone: '',
    website: item.link || '',
  }));
}

// Gemini search with Google grounding — requires billing enabled on GCP project
async function searchWithGemini(query) {
  const model = gemini.getGenerativeModel({
    model: 'gemini-flash-latest',
    tools: [{ googleSearch: {} }],
  });

  const prompt = `Find the top 5 "${query}" results. Return ONLY a JSON array where each object has: name, rating (number or null), reviews (number or null), address, phone, website. No markdown, no code fences.`;
  const result = await model.generateContent(prompt);
  const text = result.response.text().trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  const match = text.match(/\[[\s\S]*\]/);
  if (!match) return [];
  return JSON.parse(match[0]).slice(0, 5).map(item => ({
    name: item.name || '',
    rating: typeof item.rating === 'number' ? item.rating : null,
    reviews: typeof item.reviews === 'number' ? item.reviews : null,
    address: item.address || '',
    phone: item.phone || '',
    website: item.website || '',
  }));
}

app.post('/api/search', async (req, res) => {
  try {
    const { queries } = req.body;

    const results = await Promise.all(
      queries.map(async ({ query, label, reason }) => {
        // Use Gemini if USE_GEMINI=true in .env (requires GCP billing enabled)
        // otherwise uses Serper (default)
        let items = [];
        if (process.env.USE_GEMINI === 'true') {
          try {
            items = await searchWithGemini(query);
          } catch (err) {
            console.warn('Gemini search failed, falling back to Serper:', err.message);
            items = await searchWithSerper(query);
          }
        } else {
          items = await searchWithSerper(query);
        }
        items = items.map(item => ({ ...item, why: buildWhy(reason, item) }));
        return { label, results: items };
      })
    );

    res.json({ results });
  } catch (error) {
    console.error('Search error:', error);
    res.status(500).json({ error: 'Search failed. Please try again.' });
  }
});


const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`FindMyPro server running on port ${PORT}`);
});

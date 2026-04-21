// Cloudflare Worker: receives {question, passages} from the site's chatbot,
// calls Workers AI (Llama 3.1) to synthesize a grounded answer, returns JSON.

const MODEL = '@cf/meta/llama-3.1-8b-instruct';
const MAX_QUESTION_LEN = 400;
const MAX_PASSAGES = 5;
const MAX_PASSAGE_LEN = 800;

const SYSTEM_PROMPT = `You are a helpful assistant for the "AI in Plain English" blog.
You ONLY answer questions about AI tools, AI models, and how to use AI (ChatGPT, Claude, Gemini, and related topics).

Rules:
- If the user asks about anything NOT related to AI (cooking, weather, sports, jokes, general trivia, personal advice, etc.), respond with EXACTLY this and nothing else: "I only answer questions about AI. Try asking me about ChatGPT, Claude, Gemini, or how to use them."
- If the question IS about AI, answer using ONLY the provided site passages. If the passages don't contain the answer, say so plainly — do not invent facts.
- Keep AI answers short and friendly (2-4 sentences max).
- Do not mention "the passages" or "the context" — just answer naturally.
- Use plain English. No jargon unless it's already in the passages.`;

function corsHeaders(origin, allowed) {
  const allow = (allowed === '*' || origin === allowed) ? (origin || '*') : allowed;
  return {
    'Access-Control-Allow-Origin': allow,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
  };
}

function json(data, status, headers) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...headers },
  });
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin') || '';
    const cors = corsHeaders(origin, env.ALLOWED_ORIGIN || '*');

    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
    if (request.method !== 'POST')    return json({ error: 'POST only' }, 405, cors);

    let body;
    try { body = await request.json(); }
    catch { return json({ error: 'Invalid JSON' }, 400, cors); }

    const question = String(body.question || '').trim().slice(0, MAX_QUESTION_LEN);
    if (!question) return json({ error: 'Missing question' }, 400, cors);

    const passages = Array.isArray(body.passages) ? body.passages.slice(0, MAX_PASSAGES) : [];
    const context = passages
      .map((p, i) => `[Passage ${i + 1}${p.title ? ` — ${p.title}` : ''}]\n${String(p.text || '').slice(0, MAX_PASSAGE_LEN)}`)
      .join('\n\n');

    const userPrompt = context
      ? `Question: ${question}\n\nSite passages:\n${context}`
      : `Question: ${question}\n\n(No relevant passages were found on the site.)`;

    try {
      const result = await env.AI.run(MODEL, {
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user',   content: userPrompt },
        ],
        max_tokens: 300,
        temperature: 0.3,
      });

      const answer = (result && (result.response || result.result)) || '';
      return json({ answer: String(answer).trim() }, 200, cors);
    } catch (err) {
      return json({ error: 'AI request failed', detail: String(err).slice(0, 200) }, 502, cors);
    }
  },
};

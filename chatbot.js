(() => {
  const SOURCES = [
    { url: 'index.html',                  title: 'Home' },
    { url: 'blog.html',                   title: 'Blog' },
    { url: 'chatgpt.html',                title: 'ChatGPT' },
    { url: 'claude.html',                 title: 'Claude' },
    { url: 'gemini.html',                 title: 'Gemini' },
    { url: 'post-opus-4-7.html',          title: 'Meet Claude Opus 4.7' },
    { url: 'post-claude-design.html',     title: 'How Claude Is Designed' },
    { url: 'post-claude-personality.html',title: "Claude's Personality" },
  ];

  const STOP = new Set(('a an and are as at be but by for from has have he her his how i if in is it its '
    + 'me my of on or our she so that the their them there they this to was we were what when where which '
    + 'who why will with you your do does did can could would should about into than then these those just')
    .split(' '));

  const tokenize = (s) => (s.toLowerCase().match(/[a-z0-9]+/g) || []).filter(w => w.length > 1 && !STOP.has(w));

  let index = null;
  let indexing = null;

  async function buildIndex() {
    const docs = [];
    await Promise.all(SOURCES.map(async (src) => {
      try {
        const html = await fetch(src.url).then(r => r.ok ? r.text() : '');
        if (!html) return;
        const doc = new DOMParser().parseFromString(html, 'text/html');
        doc.querySelectorAll('script,style,nav,footer,.navbar,.footer').forEach(n => n.remove());
        const root = doc.querySelector('.post, main, body');
        const blocks = root.querySelectorAll('p, li, h1, h2, h3, blockquote');
        blocks.forEach(el => {
          const text = el.textContent.replace(/\s+/g, ' ').trim();
          if (text.length < 40) return;
          docs.push({ text, url: src.url, title: src.title, tokens: tokenize(text) });
        });
      } catch {}
    }));
    // build doc frequency for tf-idf-ish scoring
    const df = new Map();
    docs.forEach(d => new Set(d.tokens).forEach(t => df.set(t, (df.get(t) || 0) + 1)));
    return { docs, df, N: docs.length };
  }

  function ensureIndex() {
    if (index) return Promise.resolve(index);
    if (!indexing) indexing = buildIndex().then(i => index = i);
    return indexing;
  }

  function answer(query, idx) {
    const qTokens = tokenize(query);
    if (!qTokens.length) return { hits: [], message: "Ask me something about ChatGPT, Claude, Gemini, or any of the posts on this site." };
    const scored = idx.docs.map(d => {
      let score = 0;
      const tf = new Map();
      d.tokens.forEach(t => tf.set(t, (tf.get(t) || 0) + 1));
      qTokens.forEach(t => {
        const f = tf.get(t);
        if (!f) return;
        const idfv = Math.log(1 + idx.N / (1 + (idx.df.get(t) || 0)));
        score += f * idfv;
      });
      return { d, score };
    }).filter(x => x.score > 0)
      .sort((a, b) => b.score - a.score);

    const seenTitles = new Set();
    const hits = [];
    for (const s of scored) {
      const key = s.d.title + '|' + s.d.text.slice(0, 40);
      if (seenTitles.has(key)) continue;
      seenTitles.add(key);
      hits.push(s.d);
      if (hits.length >= 3) break;
    }
    if (!hits.length) return { hits: [], message: "I couldn't find anything about that on the site. Try rephrasing, or ask about ChatGPT, Claude, Gemini, or signup guides." };
    return { hits };
  }

  function injectStyles() {
    const css = `
    .cb-toggle { position: fixed; bottom: 22px; right: 22px; width: 56px; height: 56px; border-radius: 50%;
      background: var(--accent, #e8633a); color: #fff; border: none; cursor: pointer; z-index: 9998;
      box-shadow: 0 8px 24px rgba(232, 99, 58, 0.4); font-size: 1.4rem; display: flex; align-items: center;
      justify-content: center; transition: transform 0.25s cubic-bezier(0.2,0.8,0.2,1), box-shadow 0.25s; }
    .cb-toggle:hover { transform: translateY(-3px) scale(1.05); box-shadow: 0 12px 30px rgba(232, 99, 58, 0.55); }
    .cb-panel { position: fixed; bottom: 92px; right: 22px; width: 360px; max-width: calc(100vw - 32px);
      height: 520px; max-height: calc(100vh - 120px); background: #fff; border-radius: 16px;
      box-shadow: 0 20px 60px rgba(0,0,0,0.22); display: flex; flex-direction: column; overflow: hidden;
      z-index: 9998; opacity: 0; transform: translateY(16px) scale(0.98); pointer-events: none;
      transition: opacity 0.25s ease, transform 0.25s cubic-bezier(0.2,0.8,0.2,1);
      font-family: var(--font-body, 'Inter', sans-serif); }
    .cb-panel.open { opacity: 1; transform: translateY(0) scale(1); pointer-events: auto; }
    .cb-header { padding: 1rem 1.1rem; background: var(--ink, #1a1a2e); color: #fff; font-weight: 700;
      display: flex; align-items: center; justify-content: space-between; }
    .cb-header .cb-title { font-size: 0.98rem; }
    .cb-header .cb-sub { font-size: 0.72rem; opacity: 0.65; font-weight: 500; margin-top: 2px; }
    .cb-close { background: transparent; border: none; color: #fff; cursor: pointer; font-size: 1.3rem; line-height: 1; opacity: 0.7; }
    .cb-close:hover { opacity: 1; }
    .cb-body { flex: 1; overflow-y: auto; padding: 1rem; background: #faf8f4; display: flex; flex-direction: column; gap: 0.75rem; }
    .cb-msg { padding: 0.7rem 0.9rem; border-radius: 12px; font-size: 0.9rem; line-height: 1.55; max-width: 85%;
      animation: cbFade 0.3s ease-out both; }
    .cb-msg.user { align-self: flex-end; background: var(--accent, #e8633a); color: #fff; border-bottom-right-radius: 4px; }
    .cb-msg.bot  { align-self: flex-start; background: #fff; color: var(--ink, #1a1a2e);
      border: 1px solid rgba(0,0,0,0.06); border-bottom-left-radius: 4px; }
    .cb-msg.bot .cb-src { display: block; margin-top: 0.55rem; font-size: 0.75rem; color: var(--accent, #e8633a); font-weight: 600; }
    .cb-msg.bot .cb-src a { color: inherit; text-decoration: none; }
    .cb-msg.bot .cb-src a:hover { text-decoration: underline; }
    .cb-form { display: flex; gap: 0.5rem; padding: 0.75rem; border-top: 1px solid rgba(0,0,0,0.06); background: #fff; }
    .cb-input { flex: 1; border: 1px solid rgba(0,0,0,0.12); border-radius: 10px; padding: 0.6rem 0.8rem;
      font-size: 0.9rem; font-family: inherit; outline: none; transition: border-color 0.2s; }
    .cb-input:focus { border-color: var(--accent, #e8633a); }
    .cb-send { background: var(--accent, #e8633a); color: #fff; border: none; border-radius: 10px;
      padding: 0 1rem; font-weight: 600; cursor: pointer; font-size: 0.9rem;
      transition: background-color 0.2s, transform 0.15s; }
    .cb-send:hover { background: var(--accent-hover, #d15530); }
    .cb-send:active { transform: scale(0.96); }
    .cb-send:disabled { opacity: 0.5; cursor: not-allowed; }
    .cb-typing { display: inline-flex; gap: 4px; align-items: center; }
    .cb-typing span { width: 6px; height: 6px; border-radius: 50%; background: var(--muted, #6b6b7b);
      animation: cbBounce 1.2s ease-in-out infinite; }
    .cb-typing span:nth-child(2) { animation-delay: 0.15s; }
    .cb-typing span:nth-child(3) { animation-delay: 0.3s; }
    @keyframes cbBounce { 0%, 60%, 100% { transform: translateY(0); opacity: 0.5; } 30% { transform: translateY(-5px); opacity: 1; } }
    @keyframes cbFade { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: translateY(0); } }
    @media (max-width: 600px) {
      .cb-panel { right: 12px; left: 12px; width: auto; bottom: 82px; height: 70vh; }
      .cb-toggle { right: 14px; bottom: 14px; }
    }
    @media (prefers-reduced-motion: reduce) {
      .cb-toggle, .cb-panel, .cb-msg, .cb-typing span { transition: none !important; animation: none !important; }
    }`;
    const style = document.createElement('style');
    style.textContent = css;
    document.head.appendChild(style);
  }

  function build() {
    injectStyles();
    const toggle = document.createElement('button');
    toggle.className = 'cb-toggle';
    toggle.setAttribute('aria-label', 'Open chatbot');
    toggle.innerHTML = '💬';

    const panel = document.createElement('div');
    panel.className = 'cb-panel';
    panel.setAttribute('role', 'dialog');
    panel.setAttribute('aria-label', 'Site assistant');
    panel.innerHTML = `
      <div class="cb-header">
        <div>
          <div class="cb-title">Ask about the site</div>
          <div class="cb-sub">Answers pulled from posts</div>
        </div>
        <button class="cb-close" aria-label="Close">×</button>
      </div>
      <div class="cb-body"></div>
      <form class="cb-form">
        <input class="cb-input" type="text" placeholder="Ask a question…" autocomplete="off" />
        <button class="cb-send" type="submit">Send</button>
      </form>
    `;

    document.body.appendChild(toggle);
    document.body.appendChild(panel);

    const body = panel.querySelector('.cb-body');
    const form = panel.querySelector('.cb-form');
    const input = panel.querySelector('.cb-input');
    const sendBtn = panel.querySelector('.cb-send');

    const addMsg = (role, html) => {
      const m = document.createElement('div');
      m.className = 'cb-msg ' + role;
      m.innerHTML = html;
      body.appendChild(m);
      body.scrollTop = body.scrollHeight;
      return m;
    };

    const showTyping = () => addMsg('bot', '<span class="cb-typing"><span></span><span></span><span></span></span>');

    addMsg('bot', "Hi! I can answer questions using the posts on this site. Try asking about ChatGPT, Claude, Gemini, or how to sign up.");

    const open = () => {
      panel.classList.add('open');
      input.focus();
      ensureIndex();
    };
    const close = () => panel.classList.remove('open');

    toggle.addEventListener('click', () => panel.classList.contains('open') ? close() : open());
    panel.querySelector('.cb-close').addEventListener('click', close);

    const escapeHtml = (s) => s.replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const q = input.value.trim();
      if (!q) return;
      addMsg('user', escapeHtml(q));
      input.value = '';
      sendBtn.disabled = true;
      const typing = showTyping();
      try {
        const idx = await ensureIndex();
        const { hits, message } = answer(q, idx);
        typing.remove();
        if (message) {
          addMsg('bot', escapeHtml(message));
        } else {
          const top = hits[0];
          const related = hits.slice(1);
          let html = escapeHtml(top.text);
          html += `<span class="cb-src">— <a href="${top.url}">${escapeHtml(top.title)}</a></span>`;
          if (related.length) {
            html += `<span class="cb-src" style="margin-top:0.35rem;color:var(--muted,#6b6b7b);font-weight:500;">Related: `
              + related.map(r => `<a href="${r.url}" style="color:var(--accent,#e8633a);">${escapeHtml(r.title)}</a>`).join(', ')
              + '</span>';
          }
          addMsg('bot', html);
        }
      } catch (err) {
        typing.remove();
        addMsg('bot', "Something went wrong searching the posts. Try again?");
      } finally {
        sendBtn.disabled = false;
        input.focus();
      }
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', build);
  } else {
    build();
  }
})();

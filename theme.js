(() => {
  const KEY = 'aipe-theme';
  const root = document.documentElement;

  // Apply theme as early as possible to avoid flash. (This script should be in <head>, not deferred.)
  try {
    const saved = localStorage.getItem(KEY);
    if (saved === 'dark' || saved === 'light') {
      root.setAttribute('data-theme', saved);
    } else if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
      root.setAttribute('data-theme', 'dark');
    }
  } catch {}

  function injectControls() {
    const navbar = document.querySelector('.navbar');
    const nav = navbar && navbar.querySelector('nav');
    if (!navbar || !nav) return;

    // --- Theme toggle (inside nav so it sits in the mobile dropdown too) ---
    if (!nav.querySelector('.theme-toggle')) {
      const btn = document.createElement('button');
      btn.className = 'theme-toggle';
      btn.type = 'button';
      btn.setAttribute('aria-label', 'Toggle dark mode');
      btn.innerHTML = `
        <svg class="icon-moon" viewBox="0 0 24 24"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>
        <svg class="icon-sun" viewBox="0 0 24 24">
          <circle cx="12" cy="12" r="4"/>
          <line x1="12" y1="2"  x2="12" y2="4"/>
          <line x1="12" y1="20" x2="12" y2="22"/>
          <line x1="2"  y1="12" x2="4"  y2="12"/>
          <line x1="20" y1="12" x2="22" y2="12"/>
          <line x1="4.93"  y1="4.93"  x2="6.34"  y2="6.34"/>
          <line x1="17.66" y1="17.66" x2="19.07" y2="19.07"/>
          <line x1="4.93"  y1="19.07" x2="6.34"  y2="17.66"/>
          <line x1="17.66" y1="6.34"  x2="19.07" y2="4.93"/>
        </svg>
      `;
      btn.addEventListener('click', () => {
        const current = root.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
        const next = current === 'dark' ? 'light' : 'dark';
        root.setAttribute('data-theme', next);
        try { localStorage.setItem(KEY, next); } catch {}
      });
      nav.appendChild(btn);
    }

    // --- Hamburger (outside nav, visible only on mobile via CSS) ---
    if (!navbar.querySelector('.menu-toggle')) {
      const ham = document.createElement('button');
      ham.className = 'menu-toggle';
      ham.type = 'button';
      ham.setAttribute('aria-label', 'Open menu');
      ham.setAttribute('aria-expanded', 'false');
      ham.innerHTML = `
        <svg viewBox="0 0 24 24">
          <line x1="4" y1="7"  x2="20" y2="7"/>
          <line x1="4" y1="12" x2="20" y2="12"/>
          <line x1="4" y1="17" x2="20" y2="17"/>
        </svg>
      `;
      ham.addEventListener('click', () => {
        const open = navbar.classList.toggle('open');
        ham.setAttribute('aria-expanded', open ? 'true' : 'false');
      });
      // Close the dropdown when a link inside it is tapped
      nav.addEventListener('click', (e) => {
        if (e.target.tagName === 'A') {
          navbar.classList.remove('open');
          ham.setAttribute('aria-expanded', 'false');
        }
      });
      navbar.appendChild(ham);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', injectControls);
  } else {
    injectControls();
  }
})();

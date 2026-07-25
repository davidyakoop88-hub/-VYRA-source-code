/* ============================================================
   VYRA — Empty States Logic
   ============================================================
   Smart tomma tillstånd som vet när de ska visas, vilken
   text som passar, och hur man hjälper användaren vidare.
   ============================================================ */

(function () {
  'use strict';

  // === Konfiguration ===
  const CONFIG = {
    storageKey: 'vyra-state',
    examples: [
      { emoji: '🎁', name: 'Gift Alert', hint: 'pop-up för gåvor' },
      { emoji: '💬', name: 'Chat Highlight', hint: 'puffar för chat' },
      { emoji: '🏆', name: 'Top Like', hint: 'topplista' },
      { emoji: '⏰', name: 'Profile Frame', hint: 'ram för profil' },
      { emoji: '🎵', name: 'Sound Alert', hint: 'ljud vid händelse' },
      { emoji: '🔥', name: 'Live Counter', hint: 'antal tittare' },
    ],
    templates: [
      { name: 'Party Mode', meta: '6 widgets · 2 colors', gradient: true },
      { name: 'Soft Stream', meta: '4 widgets · minimal', gradient: false },
      { name: 'Pro Streamer', meta: '8 widgets · corporate', gradient: true },
      { name: 'Cozy Chat', meta: '3 widgets · warm', gradient: false },
    ],
    tips: [
      { icon: '⚡', text: 'Prova "Lägg till widget" — bara dra och släpp' },
      { icon: '📱', text: 'Synka mellan desktop och OBS-overlay automatiskt' },
      { icon: '🎨', text: 'Byt tema med ett klick — matcha din stream' },
    ],
  };

  // === Hjälpfunktioner ===
  function getState() {
    try {
      return JSON.parse(localStorage.getItem(CONFIG.storageKey) || '{}');
    } catch (e) {
      return {};
    }
  }

  function hasWidgets() {
    const state = getState();
    return state && state.widgets && Object.keys(state.widgets).length > 0;
  }

  function hasSavedLayouts() {
    const state = getState();
    return state && state.savedLayouts && state.savedLayouts.length > 0;
  }

  function getDaysSinceLastVisit() {
    const lastVisit = localStorage.getItem('vyra-last-visit');
    if (!lastVisit) return null;
    const days = Math.floor((Date.now() - parseInt(lastVisit, 10)) / 86400000);
    localStorage.setItem('vyra-last-visit', Date.now().toString());
    return days;
  }

  // === HTML-generatorer för olika states ===

  // State 1: Första gången (Hero)
  function renderFirstTime() {
    return `
      <div class="empty-state empty-state--hero">
        <div class="empty-state__icon">🎉</div>
        <h2 class="empty-state__title">Välkommen till VYRA!</h2>
        <p class="empty-state__description">
          Skapa episka live-overlay för din TikTok-stream. Widget för varje tillfälle —
          gåvor, chat, top likes, och mer.
        </p>
        <div class="empty-state__actions">
          <button class="empty-state__action empty-state__action--primary" data-action="add-first-widget">
            <span>✨</span> Lägg till din första widget
          </button>
          <button class="empty-state__action empty-state__action--secondary" data-action="browse-templates">
            <span>📋</span> Bläddra mallar
          </button>
          <a href="#tutorial" class="empty-state__action empty-state__action--ghost" data-action="watch-tutorial">
            Se 2-minuters guide →
          </a>
        </div>
        <div class="empty-state__examples">
          ${CONFIG.examples
            .map(
              (e) => `
            <div class="empty-state__example" data-action="add-${e.name.toLowerCase().replace(/\s+/g, '-')}">
              <div class="empty-state__example-emoji">${e.emoji}</div>
              <div class="empty-state__example-name">${e.name}</div>
              <div class="empty-state__example-hint">${e.hint}</div>
            </div>
          `
            )
            .join('')}
        </div>
        <div class="empty-state__banner">
          <span class="empty-state__banner-icon">💡</span>
          <span>Tips: Håll <kbd>Ctrl</kbd>+<kbd>Z</kbd> för att ångra — spelar du med ingenting att förlora!</span>
        </div>
      </div>
    `;
  }

  // State 2: Inga widgets men användaren har använt VYRA förut
  function renderNoWidgets() {
    return `
      <div class="empty-state">
        <div class="empty-state__icon">📦</div>
        <h2 class="empty-state__title">Din canvas är tom</h2>
        <p class="empty-state__description">
          Du har inga widgets just nu. Lägg till en för att starta din overlay.
        </p>
        <div class="empty-state__actions">
          <button class="empty-state__action empty-state__action--primary" data-action="add-widget">
            <span>➕</span> Lägg till widget
          </button>
          ${
            hasSavedLayouts()
              ? `<button class="empty-state__action empty-state__action--secondary" data-action="restore-layout">
                  <span>↩️</span> Återställ layout
                </button>`
              : ''
          }
        </div>
      </div>
    `;
  }

  // State 3: Inga sökresultat
  function renderNoSearchResults(query) {
    return `
      <div class="empty-state empty-state--compact">
        <div class="empty-state__icon">🔍</div>
        <h3 class="empty-state__title">Inga träffar på "${escapeHtml(query)}"</h3>
        <p class="empty-state__description">
          Prova andra sökord eller <a href="#" data-action="show-all">visa alla widgets</a>.
        </p>
      </div>
    `;
  }

  // State 4: Inga mallar
  function renderNoTemplates() {
    return `
      <div class="empty-state">
        <div class="empty-state__icon">📋</div>
        <h2 class="empty-state__title">Inga mallar ännu</h2>
        <p class="empty-state__description">
          Mallar låter dig snabbt komma igång. Skapa din första genom att spara
          din nuvarande layout som en mall.
        </p>
        <div class="empty-state__actions">
          <button class="empty-state__action empty-state__action--primary" data-action="save-current-as-template">
            <span>💾</span> Spara nuvarande som mall
          </button>
          <a href="#community" class="empty-state__action empty-state__action--secondary">
            Bläddra community-mallar →
          </a>
        </div>
        <div class="empty-state__tips">
          ${CONFIG.tips
            .map(
              (t) => `
            <div class="empty-state__tip">
              <span class="empty-state__tip-icon">${t.icon}</span>
              <span>${t.text}</span>
            </div>
          `
            )
            .join('')}
        </div>
      </div>
    `;
  }

  // State 5: Laddar / ansluter
  function renderLoading(message = 'Ansluter till TikTok LIVE...') {
    return `
      <div class="empty-state empty-state--loading">
        <div class="empty-state__loader"></div>
        <p class="empty-state__description">${escapeHtml(message)}</p>
      </div>
    `;
  }

  // State 6: Välkommen tillbaka
  function renderWelcomeBack(days) {
    return `
      <div class="empty-state empty-state--welcome">
        <div class="empty-state__icon">👋</div>
        <h2 class="empty-state__title">Välkommen tillbaka!</h2>
        <p class="empty-state__description">
          Det var ${days} ${days === 1 ? 'dag' : 'dagar'} sedan du var här sist.
          Vad vill du göra idag?
        </p>
        <div class="empty-state__actions">
          <button class="empty-state__action empty-state__action--primary" data-action="resume">
            <span>▶️</span> Fortsätt senaste
          </button>
          <button class="empty-state__action empty-state__action--secondary" data-action="new-layout">
            <span>🆕</span> Ny layout
          </button>
        </div>
      </div>
    `;
  }

  // State 7: Inga notiser än
  function renderNoNotifications() {
    return `
      <div class="empty-state empty-state--inline">
        <div class="empty-state__icon">🔔</div>
        <div class="empty-state__body">
          <h3 class="empty-state__title">Allt lugnt</h3>
          <p class="empty-state__description">Inga notiser — du är ikapp!</p>
        </div>
      </div>
    `;
  }

  // State 8: Suggestions (när användaren bara har 1 widget)
  function renderAddMore(animate = true) {
    return `
      <div class="empty-state empty-state--compact" style="${animate ? 'animation: fade-in 0.4s ease;' : ''}">
        <div class="empty-state__icon">💡</div>
        <h3 class="empty-state__title">Bra start!</h3>
        <p class="empty-state__description">
          Lägg till en till för att skapa variation i din overlay.
        </p>
        <div class="empty-state__actions">
          <button class="empty-state__action empty-state__action--primary" data-action="add-widget">
            Lägg till widget
          </button>
        </div>
      </div>
    `;
  }

  // === Smart rendering ===
  // Bestämmer automatiskt vilket state som passar
  function renderSmart(context = {}) {
    const days = getDaysSinceLastVisit();

    // Första besök
    if (days === null) {
      localStorage.setItem('vyra-last-visit', Date.now().toString());
      return renderFirstTime();
    }

    // Välkommen tillbaka efter >7 dagar
    if (days > 7) {
      return renderWelcomeBack(days);
    }

    // Sökning utan resultat
    if (context.searchQuery) {
      return renderNoSearchResults(context.searchQuery);
    }

    // Inga widgets
    if (!hasWidgets()) {
      // Första gången utan widgets → hjälpsammare version
      return hasSavedLayouts() ? renderNoWidgets() : renderNoWidgets();
    }

    // Användaren har en widget → tipsa om fler
    const state = getState();
    const widgetCount = Object.keys(state.widgets || {}).length;
    if (widgetCount === 1 && context.showSuggestions) {
      return renderAddMore();
    }

    // Default: inget att visa
    return null;
  }

  // === Event delegation ===
  function attachEventListeners(rootEl) {
    rootEl.addEventListener('click', (e) => {
      const target = e.target.closest('[data-action]');
      if (!target) return;

      const action = target.getAttribute('data-action');
      // Bubbla upp till en global handler
      const event = new CustomEvent('vyra:empty-state-action', {
        detail: { action, target },
        bubbles: true,
      });
      rootEl.dispatchEvent(event);

      // För demo: animera bort knappen som klickades
      target.classList.add('is-fading-out');
      setTimeout(() => target.classList.remove('is-fading-out'), 800);
    });
  }

  // === Escape HTML för säkerhet ===
  function escapeHtml(s) {
    const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
    return String(s).replace(/[&<>"']/g, (m) => map[m]);
  }

  // === Public API ===
  window.VYRA = window.VYRA || {};
  window.VYRA.EmptyStates = {
    render: function (selector, context = {}) {
      const root = document.querySelector(selector);
      if (!root) return;

      const html = renderSmart(context);
      if (html) {
        root.innerHTML = html;
        attachEventListeners(root);
      } else {
        root.innerHTML = '';
      }
      return html;
    },

    // Manuella states (för specifika situationer)
    states: {
      firstTime: renderFirstTime,
      noWidgets: renderNoWidgets,
      noSearchResults: renderNoSearchResults,
      noTemplates: renderNoTemplates,
      loading: renderLoading,
      welcomeBack: renderWelcomeBack,
      noNotifications: renderNoNotifications,
      addMore: renderAddMore,
    },

    // Hjälpfunktioner
    helpers: {
      hasWidgets,
      hasSavedLayouts,
      getState,
    },
  };

  // === Auto-init: lyssna efter applikationens actions ===
  document.addEventListener('vyra:empty-state-action', (e) => {
    const action = e.detail.action;
    console.log('[VYRA EmptyStates]', 'Action:', action);
    // Applikationen kan koppla in sin egen handler via:
    // document.addEventListener('vyra:empty-state-action', handler)
  });
})();


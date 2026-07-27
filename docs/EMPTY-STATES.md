# VYRA Empty States

Smart tomma tillstånd för VYRA. Varje state är designat för att inte skrämmas, utan ge användaren en väg framåt.

## 🎯 Filosofi

1. **Inte skrämma** — Tomt ska inte se ut som ett fel.
2. **Actionable** — Varje state har minst en CTA-knapp.
3. **Ge värde** — Tips, exempel, eller tutorials.
4. **Tonmässigt rätt** — Matcha VYRA:s energi (live, gemenskap, kreativ).

## 📦 Filer

- `empty-states.css` — Alla stilar (12+ state-varianter)
- `empty-states.js` — Smart rendering + actions
- `empty-states-demo.html` — Interaktiv demo

## 🚀 Användning

### Auto: Smart rendering
```js
// Anropar VYRA.EmptyStates.render() och väljer state baserat på data
VYRA.EmptyStates.render('#empty-state-container');
```

### Manuellt: Specifik state
```js
// Första gången (hjälpsam, med exempel)
VYRA.EmptyStates.render('#container', { auto: true });
// eller
VYRA.EmptyStates.render('#container');  // smart

// Sökresultat
VYRA.EmptyStates.render('#search-results', {
  searchQuery: 'zzz-no-results'
});

// Direkt med state-funktion
document.getElementById('notifications').innerHTML =
  VYRA.EmptyStates.states.noNotifications();
```

## 🧩 Alla States

| # | State | När den visas | Huvudbudskap |
|---|---|---|---|
| 1 | **Första gången** | Användaren öppnar VYRA för första gången | "Välkommen! Lägg till din första widget" |
| 2 | **Inga widgets** | Canvas är tom, användaren har varit här förut | "Din canvas är tom — lägg till widget" |
| 3 | **Lägg till fler** | Användaren har bara 1 widget | "Bra start! Lägg till en till" |
| 4 | **Inga sökresultat** | Sökning ger 0 träffar | "Inga träffar på 'xyz' — prova annat" |
| 5 | **Inga mallar** | Inga templates sparade | "Spara din layout som mall" |
| 6 | **Laddar** | Ansluter till TikTok LIVE | "Ansluter till TikTok LIVE..." |
| 7 | **Välkommen tillbaka** | Frånvaro > 7 dagar | "Välkommen tillbaka — fortsätt senaste" |
| 8 | **Inga notiser** | Notis-panel är tom | "Allt lugnt — du är ikapp" |

## ✏️ Copy (redigerbar)

Alla strängar finns i `CONFIG` överst i `empty-states.js`:

```js
const CONFIG = {
  examples: [
    { emoji: '🎁', name: 'Gift Alert', hint: 'pop-up för gåvor' },
    // Lägg till fler eller ändra
  ],
  templates: [
    { name: 'Party Mode', meta: '6 widgets · 2 colors' },
    // Lägg till fler teman
  ],
  tips: [
    'Prova "Lägg till widget" — bara dra och släpp',
    // ...
  ],
};
```

## 🎨 Anpassning

### Ändra färger

I `empty-states.css`, ändra `:root`-variablerna:

```css
:root {
  --es-accent: #7c5cff;      /* Primär */
  --es-accent-2: #5b8cff;    /* Sekundär */
  --es-bg: #0a0914;          /* Bakgrund */
  /* ... */
}
```

### Ändra beteende

I `empty-states.js`, ändra `renderSmart()`:

```js
function renderSmart(context = {}) {
  // Lägg till custom logic här
  if (context.user.isPro === false) {
    return renderFirstTime(); // Visa alltid första-gången-versionen
  }
  // Standard
  if (!hasWidgets()) return renderNoWidgets();
  // ...
}
```

## 🧪 Testa

Öppna `empty-states-demo.html` i webbläsaren:

```bash
# Lokalt
python3 -m http.server 4173
open http://127.0.0.1:4173/empty-states-demo.html

# Eller deployat
open https://vyralive.app/empty-states-demo.html
```

## 🔌 Actions / Events

Varje gång en användare klickar på en CTA-knapp i en empty state skickas ett custom event:

```js
document.addEventListener('vyra:empty-state-action', (e) => {
  console.log('Action:', e.detail.action);
  // Hantera i din app:
  switch (e.detail.action) {
    case 'add-first-widget':
      openWidgetPicker();
      break;
    case 'browse-templates':
      showTemplateGallery();
      break;
    case 'restore-layout':
      restoreLastLayout();
      break;
    // ...
  }
});
```

Tillgängliga actions:

- `add-first-widget`, `add-widget`, `add-<type>`
- `browse-templates`, `watch-tutorial`
- `save-current-as-template`
- `restore-layout`, `resume`, `new-layout`
- `show-all` (för sökresultat)

## 📱 Responsiv

Empty states fungerar på desktop och mobil:

- `.empty-state--hero` → textbundning bryts automatiskt
- `.empty-state__examples` → grid med `auto-fit` (1-3 kolumner)
- `.empty-state--inline` → flex på små skärmar

## ♿ Tillgänglighet

- ✅ `prefers-reduced-motion` respekteras
- ✅ Tangentbord-navigering fungerar (knappar är `<button>`)
- ✅ Färgkontrast > 4.5:1 (WCAG AA)
- ✅ `aria-live` rekommenderas för dynamiska state-byten (lägg till i din wrapper)


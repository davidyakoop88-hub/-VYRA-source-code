# VYRA Project State

Last updated: 2026-07-22 (Phase 4 — Premium Widget Design System).

**2026-07-22 re-prioritization**: the user redirected the roadmap's Phase 4 onward away from
TikTok/overlay-runtime/SaaS work toward the premium live overlay widget system (see
`VYRA_MASTER_ROADMAP.md`'s reprioritization note and "Deferred" section). Phases 0-3 below are
unaffected. The commit `e670003` (Phase 3) is the last commit under the old ordering; every
commit after it follows the new Phase 4-12 sequence.

## Current branch

`feature/vyra-vfx-engine`

## Latest verified commit

Phase 4 (Premium Widget Design System) commit — see git log for exact SHA after push.
Prior verified commits: `e670003` (Phase 3, `feat(recognition): add generic live event
adapter contract`), `f022cf0` (Phase 2, `fix(recognition): harden runtime lifecycle and
failure handling`), `21cffb8` (Phase 0 docs), `540eaac` (Phase 1,
`feat(recognition): add standalone recognition runtime`). Local HEAD confirmed equal to
`origin/feature/vyra-vfx-engine` after each push.

Working tree at audit time: clean except pre-existing unrelated untracked items
(`.claude/agents/`, `.claude/data/`, `assets/gifts/`, `assets/images/test/` — not created by
this roadmap, left untouched).

## Completed systems

- **Widget/theme catalog** (12 widget families, multiple themes/skins each) — shipped prior
  to this roadmap, verified end-to-end in browser this session's predecessor work.
- **Design system migration** (`design-tokens.css`, `design-system.css`, semantic classes
  across all studio.js pages) — shipped prior to this roadmap.
- **VFX Engine M1 + M2 + M2 hardening + M2 visual QA** — particle/fountain system built on
  vendored PixiJS + GSAP, one owning ticker, hardened lifecycle, visually QA'd across
  resolutions/quality levels/reduced-motion. Loaded only behind `?vfxdemo=1`/`?vfxdemo=2`,
  not yet wired to real semantic events (that's Phase 8 of this roadmap).
- **Recognition Engine, Steg 1-8** (Types, Rules, Normalizer, Merge, Queue, Controller, Card
  Mapper, Card UI) — commits `a6d451c`, `c5f5af0`, `0e213f1`, `4ee4f4c`, `17f659b`, `6ec8327`.
- **Recognition Engine, Steg 9 = this roadmap's Phase 1 (Standalone Recognition Runtime)** —
  commit `540eaac`. `recognition-runtime.js` composes Merge → Queue → Controller → Card
  Mapper → Card behind `window.VyraRecognitionRuntime = {mount, start, stop, pause, resume,
  push, tick, flush, clear, destroy, getState, getStats, subscribe}`. Dev demo
  `recognition-runtime-demo.html` covers every required button (Join/Like/Like burst/Share/
  Follow/Small-Medium-Large Gift/Mixed/Stress, plus lifecycle + time-advance controls).
  **Verified this session**: 242/242 automated cases pass (Node + browser), plus a full
  manual demo pass — join→tick, tick-to-presentation-end, 50-event stress (no crash/no
  console errors), Like-burst-10 aggregation (`mergedCount:10` confirmed), Mixed-10 priority
  ordering (large gift sorts to the front of the queue), pause blocks new presentations while
  ticking, resume restores progression, stop/clear/destroy all behave and destroy is
  idempotent with safe rejected results after.

## Partially completed / not yet started (per this roadmap)

- **Phase 0 — Repository audit**: done this pass (see Baseline findings below).
- **Phase 2 — Runtime hardening**: done. Full checklist reviewed (see
  `docs/recognition-runtime-report.md`); 4 new stress/lifecycle test cases added
  (`Hardening 1-4`: 500 mixed events, repeated start/stop cycles, repeated mount/clear
  cycles, duplicate-subscription check) — 246/246 passing in Node and browser, zero console
  errors. No Runtime defects found; `?recognitiondebug=1` diagnostics mode already existed
  from earlier steps and was confirmed inert-by-default and correctly wired into every
  caught-error path.
- **Phase 3 — Generic adapter contract**: done. `recognition-adapter-types.js` +
  `recognition-adapter.js` implement a provider-agnostic, FACTORY-style contract (unlike
  every other Recognition Engine file, `create()` returns a fresh, independent instance each
  call — no shared singleton). Public API: `window.VyraRecognitionAdapter = {create,
  registerProvider, getProviders}`; each instance exposes `{connect, disconnect, isConnected,
  getState, getStats, subscribe, destroy}`. Zero TikTok-specific logic anywhere in either
  file — confirmed by construction (payload is always treated as opaque). Bounded, cancellable
  reconnect backoff is opt-in per instance (`options.reconnect = {enabled, baseDelayMs,
  maxDelayMs, maxAttempts}`, disabled by default), implemented with a single stored
  `setTimeout` handle cleared on `disconnect()`/`destroy()` — the one legitimate timer in this
  module, unlike the Runtime pipeline which has none at all.
  `recognition-adapter-demo.html` registers ONE generic "demo-fake-provider" (zero
  platform-specific logic — the only provider-specific code lives in the demo page's own
  script, not in `recognition-adapter.js`) and demonstrates the intended Phase 4 integration
  pattern: raw provider event → adapter envelope → demo-only translation into a
  NormalizedEvent → `window.VyraRecognitionRuntime.push(...)`. **Verified this session**:
  16 new automated cases (`Adapter 1-16`) — connection lifecycle, duplicate connect/
  disconnect, malformed provider events, subscriber error isolation, bounded reconnect with
  successful re-connection, cancellable reconnect, async provider connect failure, synchronous
  provider connect() that throws, destroy idempotency/permanence, and a structural boundary
  check proving a raw adapter envelope is never itself acceptable as a NormalizedEvent (a
  caller must always normalize it first). 262/262 total cases pass (Node + browser), zero
  console errors. Manual demo pass confirmed: connect → emit join → normalize → Runtime push
  (`queued`) → tick → presentation starts → Card renders ("David Yakoop joined the live") →
  tick-to-end → clean completion; malformed event rejected without crash; unexpected
  disconnect handled cleanly with no auto-reconnect (demo's reconnect policy left disabled).
- **Phase 4 — Premium Widget Design System (re-prioritized, this pass)**: done. Built
  `premium-widget-core.js` (lifecycle: mount/show/hide/update/preview/setPerformanceMode/
  destroy/getState/subscribe), `premium-widget-tokens.css` (shared tokens + all 4
  family/tier CSS blocks), `premium-widget-assets.js` (image sanitization, initials,
  hand-authored inline SVG glyphs), `premium-widget-demo.html`, and
  `docs/PREMIUM_WIDGET_SPEC.md` (written before the implementation, per the user's
  instruction — every constant in the CSS/JS traces back to a value named in the spec). Four
  visually distinct families built: Crystal Halo, Royal Crown, Legendary Portal, Elite
  Minimal — verified genuinely different silhouettes (not recolored rectangles) by direct
  bounding-box measurement, not just class names. Separate, additive system from
  `recognition-card.js`/`recognition-card.css` — zero dependency either direction, different
  root z-index band (999998 vs. Recognition Card's 999999). See `VYRA_ARCHITECTURE.md` §10
  for the full architectural writeup.
  **Verified this session** (see "Manual visual verification" below for the full breakdown):
  mount/show/hide/replay lifecycle across all 4 families and all 3 tiers; missing-avatar and
  missing-gift-image fallback (initials / SVG glyph, never a broken `<img>`); long name
  ellipsis truncation; emoji and non-Latin (Japanese/Arabic) name rendering; 4 families shown
  simultaneously side-by-side (flex-wrap layout, no extra code needed); low-performance mode
  (particles/glow hidden); forced reduced-motion (all transitions collapse to 1ms); a 100x
  rapid-replay stress test leaving zero leaked DOM nodes/instances afterward; zero console
  errors throughout. Geometry-verified at exactly 1080×1920 (portrait), 1920×1080 (landscape),
  and 1080×1080 (square) via `getBoundingClientRect()`: every family stayed within the
  viewport and within the documented safe zone at every resolution, every avatar frame
  computed `border-radius: 50%` (circular), and bounding-box dimensions differed meaningfully
  per family (e.g. at 1080×1920 legendary tier: Crystal Halo 313×105, Royal Crown 359×132,
  Legendary Portal 313×233 — the tallest, ~12% of viewport height as the spec predicted —
  Elite Minimal 276×63 — the slimmest), confirming distinct silhouettes, not just distinct
  colors.
  **Verification gap, disclosed**: automated pixel screenshots
  (`computer{action:"screenshot"}`/`zoom`) timed out consistently in this session's
  environment regardless of viewport size — a known recurring tool issue in this session, not
  specific to this feature. Geometry/computed-style inspection substituted for pixel review
  (see above); a genuine pixel-level visual pass is still recommended once screenshot tooling
  is available, flagged in `VYRA_ARCHITECTURE.md` §10.
- **Phase 5 — Premium Gift Widget**: not started.
- **Phase 6 — Top Gifter Widget**: not started.
- **Phase 7 — MVP Reveal Widget**: not started.
- **Phase 8 — Natural Like Fountain**: not started.
- **Phase 9 — Match Widgets (X2/X3/Glove/Booster)**: not started.
- **Phase 10 — Premium Widget Overlay Integration**: not started.
- **Phase 11 — TikTok LIVE Adapter** (formerly Phase 4 before re-prioritization): not
  started. The **transport** already exists and works (`tiktok-bridge/bridge.js` →
  `tiktok-live-connector` → `server.ps1` → `live-client.js`); the Phase 3 generic adapter
  contract is ready for a `tiktok-live-adapter.js` provider registration to build on whenever
  this phase starts.
- **Phase 12 — OBS and TikTok LIVE Studio Validation**: not started.
- Billing/analytics/campaigns/AI/account/workspace/general-SaaS-expansion phases: explicitly
  **deferred** per the user's 2026-07-22 instruction, not started, not currently in scope —
  see `VYRA_MASTER_ROADMAP.md`'s "Deferred" section for their preserved acceptance criteria.

## Failing tests

None. `recognition-verify.js` (Recognition Engine only — the Premium Widget system has no
automated test harness yet, see "Known gaps" below) still reports 262/262 in both Node and
browser, unchanged by this pass since no `recognition-*.js` file was touched. One
test-authoring bug was found and fixed during Phase 3 (not an adapter defect, see prior
entries in git history) — not relevant to this pass.

## Known gaps for the Premium Widget system

- **No automated test harness yet** (unlike the Recognition Engine's 262-case
  `recognition-verify.js`). Everything verified this pass was manual (DOM/console/geometry
  inspection in the browser). Adding a Node+browser test harness for
  `premium-widget-core.js` (mirroring the Recognition Engine's `runCase`/thunk pattern) is a
  reasonable candidate for early in Phase 5, once there's real event-driven usage to test
  against, rather than adding tests against the foundation in isolation.
- **No pixel-level screenshot verification** — see the disclosed gap above.

## Baseline audit findings (Phase 0 — recorded, not fixed, per audit rule "record first")

Found via targeted `grep` across the repository (not an exhaustive line-by-line read of every
file — flagged as a methodology limit):

| Finding | Where | Note |
|---|---|---|
| `setInterval` usage | `media.js`, `app.js`, `action-options.js`, `state-backup.js`, `live-leaderboard.js`, `action-event-advanced.js`, `action-scenes.js` | Legacy widget/UI polling timers — pre-existing, out of scope for the Recognition/VFX rules (those explicitly forbid *their own* hidden timers, not the whole app). Not yet individually audited for cleanup-on-teardown. |
| `requestAnimationFrame` usage | `media.js`, `vfx-ticker.js`, `vfx-fountain-demo.js`, `action-options.js`, `chatbot-overlay.js`, `action-runtime.js`, vendored `gsap.min.js`/`pixi.min.js` | `vfx-ticker.js` is the one confirmed, intentional single owner for the VFX system (hardened in M2 pass). The others are legacy UI code, not yet individually audited. |
| `recognition-*.js` mentions of `setInterval`/`requestAnimationFrame` | `recognition-runtime.js`, `recognition-controller.js`, `recognition-queue.js` | **False positives** — confirmed by direct read: these are code *comments* documenting the "no hidden timers" rule, not actual timer calls. Recognition pipeline is clean. |
| Raw `.innerHTML =` assignment | 22 files, incl. `media.js`, `extras.js`, `action-event.js`, `studio.js`, most widget/feature files | Established, repo-wide rendering convention (template-literal HTML strings). Several of these interpolate user-influenced strings (usernames, gift names, chat text) without escaping — a real latent XSS surface in the **legacy widget layer**. Contrast: `recognition-card.js` (the new pipeline) uses `textContent` exclusively for untrusted text and a dedicated `sanitizeImageUrl()` for all external images — already meets the roadmap's security bar. Full remediation of the legacy layer is out of scope for Phase 0 and should be scheduled explicitly (candidate: Phase 19 security review, or sooner if a specific widget is touched). |
| `TODO`/`FIXME`/`XXX` comments | `wishlist.js`, `gifts-manifest.js` | Only 2 files, low volume — not investigated further this pass; low priority. |
| `addEventListener`/`removeEventListener` balance | 38 `addEventListener` occurrences across 18 files vs. only 5 `removeEventListener` occurrences across 3 files (2 of which are vendored `pixi.min.js`/`gsap.min.js`) | Imbalance is expected for one-time, page-lifetime listeners (e.g. top-level nav bindings that live as long as the SPA does) but is a real risk for anything bound/unbound per-widget-instance or per-modal-open. Not yet audited per-file for actual leaks — flagged for the Phase 18 performance audit (DOM node accumulation / event subscription cleanup checks) rather than guessed at here. |
| No root `package.json` | repository root | Confirmed: this is a build-free static app. `electron-app/` and `tiktok-bridge/` are the only two real Node projects, each self-contained with their own `package.json`. Any future lint/test tooling (Phase 22's "run lint" step) needs a real decision on where that config lives — none exists today. |
| No auth on any `/api/*` endpoint in `server.ps1` | `server.ps1` | By design for a local single-user dev server; a real gap relative to the SaaS/multi-tenant vision in later roadmap phases — see the architecture conflict note in `VYRA_ARCHITECTURE.md` §9. |
| `overlay.html` is a bare redirect | `overlay.html` | `location.replace('studio.html?overlay=1')` — no overlay ID, no access token, no signed public token exists yet. Phase 7 (browser-source delivery) starts from zero here, not from a partial implementation. |
| TikTok connection method already exists | `tiktok-bridge/bridge.js` + `server.ps1` + `live-client.js` | Uses the unofficial `tiktok-live-connector` npm package in a separate local Node process, forwarding into the same `/api/events` endpoint the in-app demo button uses. Phase 4 must build on this transport, not invent a new one (per working rule #2/#18) — recorded here so it is not rediscovered/reinvented later. |

No blocking correctness bugs were found in the Recognition Engine or VFX Engine during this
audit pass — both were already hardened/verified in prior session work referenced above.

## Current blockers

None for Phases 4-12 (all buildable within the current local-first architecture, and none
require the deferred billing/analytics/account/SaaS work). The local-first-vs-SaaS product
decision (see `VYRA_ARCHITECTURE.md` §9) remains open but is now irrelevant to the near-term
roadmap entirely (Account/Workspace is in the explicitly deferred section).

## Exact next action

Begin **Phase 5 — Premium Gift Widget**: build the first real event-driven widget on top of
the Phase 4 foundation. Use `window.VyraPremiumWidget.show(model)` with a real gift-tier →
family/tier mapping (small/medium/large gift coin thresholds — reuse
`recognition-rules.js`'s `priority.giftThresholds` convention for consistency, or define an
equivalent local constant if reuse isn't clean) — all 4 families should be usable across gift
tiers per `docs/PREMIUM_WIDGET_SPEC.md`, this phase decides the actual default
family-per-tier mapping and wires it to real gift image/amount/coins data. Does not touch
`recognition-card.js`/`recognition-card.css` or any existing widget in `media.js`. Add tests
(if a harness is started, see "Known gaps" above) and/or a manual verification pass, then
commit as `feat(widgets): add premium gift widget`.

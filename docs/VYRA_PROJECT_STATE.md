# VYRA Project State

Last updated: 2026-07-22 (Phase 0 audit + Phase 1 confirmation).

## Current branch

`feature/vyra-vfx-engine`

## Latest verified commit

`540eaac4788e04c286d716b3bc914ac5982edcf8` —
`feat(recognition): add standalone recognition runtime`
(pushed; local HEAD confirmed equal to `origin/feature/vyra-vfx-engine`)

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
- **Phase 2 — Runtime hardening**: not started. Recognition Runtime is already reasonably
  hardened by construction (deterministic, no hidden timers, error-contained subscriber
  dispatch) but the roadmap's specific stress scenarios (500 mixed events, repeated
  start/stop and mount/clear cycles, `?recognitiondebug=1` diagnostics mode,
  `docs/recognition-runtime-report.md`) have not been run/written yet.
- **Phase 3 — Generic adapter contract**: not started. No `recognition-adapter.js` exists.
- **Phase 4 — TikTok LIVE adapter**: not started as a Recognition-Runtime-facing adapter.
  The **transport** already exists and works (`tiktok-bridge/bridge.js` →
  `tiktok-live-connector` → `server.ps1` → `live-client.js`), but nothing bridges
  `live-client.js`'s raw events into `window.VyraRecognitionRuntime.push(...)` yet.
- **Phases 5-22**: not started. See `VYRA_MASTER_ROADMAP.md` for full breakdown, dependencies,
  and the flagged architecture conflict (local-first app vs. multi-tenant SaaS model implied
  by Phase 14+).

## Failing tests

None. `recognition-verify.js` reports 242/242 in both Node and browser as of this audit.
No other automated test suite exists in the repository (confirmed — no `package.json` test
script at root, no Jest/Mocha/Vitest config anywhere).

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

None for Phases 0-13 (all buildable within the current local-first architecture). One
**documented, unresolved product decision** blocks serious work on Phase 14 onward: whether
VYRA's "workspace/account" model becomes a real multi-tenant hosted backend or stays a
local-per-creator concept (see `VYRA_ARCHITECTURE.md` §9). This should be raised with the
user before Phase 14 begins — not before.

## Exact next action

Begin **Phase 2 — Runtime Hardening**: run the roadmap's specific stress scenarios against
`recognition-runtime.js` (500 mixed events, repeated start/stop cycles, repeated mount/clear
cycles, memory/subscription cleanup checks), add the `?recognitiondebug=1` dev-only
diagnostics mode, write `docs/recognition-runtime-report.md`, and commit as
`fix(recognition): harden runtime lifecycle and failure handling`.

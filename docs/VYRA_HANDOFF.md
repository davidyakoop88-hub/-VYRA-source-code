# VYRA Handoff

This file is always kept ready so another engineer or AI session can pick up the VYRA
build-out with zero prior context. Read this first, then `VYRA_PROJECT_STATE.md` (current
snapshot), then `VYRA_MASTER_ROADMAP.md` (full phase list), then `VYRA_ARCHITECTURE.md`
(how the system fits together) as needed.

## What VYRA is

A local-first (today), build-free, static HTML/JS/CSS application for TikTok LIVE creators —
an overlay/widget studio plus (in progress) a deterministic Recognition Engine and VFX Engine,
packaged as a Windows desktop app via Electron and also runnable via a tiny PowerShell dev
server (`server.ps1`, port 4173). See `VYRA_ARCHITECTURE.md` for full detail, including a
documented, unresolved conflict between this local-first architecture and the roadmap's later
multi-tenant SaaS phases.

## Repository

`davidyakoop88-hub/-VYRA-source-code`, branch `feature/vyra-vfx-engine`.
Working directory in this environment:
`C:\Users\A\Desktop\vyra\VYRA-source-code-2026-07-14`

## How to run it locally

```
# Option A: PowerShell dev server (fastest for iteration)
powershell -File server.ps1
# then open http://127.0.0.1:4173/studio.html

# Option B: Electron packaged app
cd electron-app
npm install
npm start

# Optional: real TikTok LIVE bridge (separate process)
cd tiktok-bridge
npm install
node bridge.js <tiktok_username_without_@>
```

## How to run the only existing automated tests

```
node -e "require('./recognition-types.js');require('./recognition-rules.js');require('./recognition-normalizer.js');require('./recognition-merge.js');require('./recognition-queue.js');require('./recognition-controller.js');require('./recognition-card-mapper.js');require('./recognition-card.js');require('./recognition-runtime.js');require('./recognition-adapter-types.js');require('./recognition-adapter.js');require('./recognition-verify.js').run().then(r=>console.log(r.filter(x=>x.pass).length+'/'+r.length))"
```
Expected: `262/262` as of the latest commit on this branch. Or open
`recognition-verify.html` via the dev server and read `#summary`.

## What's done

See `VYRA_PROJECT_STATE.md` → "Completed systems". In short: the full widget/theme catalog,
the design-system migration, the VFX Engine (M1/M2/hardening/visual QA), and the full
Recognition Engine including the standalone Recognition Runtime (Roadmap Phase 1, commit
`540eaac`), Runtime Hardening (Phase 2, commit `f022cf0`), and the Generic Live Event Adapter
Contract (Phase 3, `recognition-adapter.js`/`recognition-adapter-types.js`/
`recognition-adapter-demo.html`).

## What's next

`VYRA_PROJECT_STATE.md` → "Exact next action": **Phase 4 — TikTok LIVE Adapter**. Inspect the
existing transport (`tiktok-bridge/bridge.js` + `server.ps1` + `live-client.js`) before
writing code; build `tiktok-live-adapter.js` (registers a `'tiktok'` provider against the
Phase 3 adapter contract) and `tiktok-live-normalizer.js` (TikTok payload → NormalizedEvent),
with a simulation mode for development without a live session.

## Rules this project follows (do not violate these when continuing)

1. Inspect before assuming any file/API/function/dependency exists.
2. Preserve working functionality; don't rewrite stable systems without a concrete reason
   (e.g. `studio.js` is intentionally minified/untouched — sibling files monkey-patch
   `render`/`bind`/`props`/`wh` instead of editing it directly).
3. Small, separately-committed, separately-tested milestones. One phase per commit, using
   the exact conventional-commit message specified for that phase in the original roadmap
   prompt (see `VYRA_MASTER_ROADMAP.md` for the phase list).
4. No TikTok-specific code inside generic Recognition/VFX modules — TikTok logic is isolated
   to `tiktok-bridge/`, and (once built) `tiktok-live-adapter.js`.
5. Deterministic state machines, not hidden timers — the Recognition pipeline in particular
   has zero internal `setInterval`/`setTimeout`/`requestAnimationFrame` except
   `recognition-card.js`'s own animation-phase timers.
6. Sanitize all untrusted text (`textContent`, never `innerHTML`, for user-controlled
   strings) and all external URLs (`sanitizeImageUrl()` pattern in `recognition-card.js`) —
   this bar is met in the new Recognition pipeline; the legacy widget layer (`media.js` and
   friends) is not yet audited/remediated to this bar (flagged in `VYRA_PROJECT_STATE.md`).
7. Overlay output must keep working as an OBS/TikTok Studio browser source — never let
   editor-only interactivity leak into `?overlay=1` mode.
8. Never claim something works without actually testing it (Node + browser + manual demo
   where relevant).

## Known open decisions (raise with the user, don't decide unilaterally)

1. Local-first vs. hosted multi-tenant SaaS backend — blocks Phase 14 onward. See
   `VYRA_ARCHITECTURE.md` §9.
2. Where lint/test tooling should live, given no root `package.json` exists today — affects
   how literally Phase 22's "run lint" step can be executed.
3. Whether to extend the existing `action-event.js`/`sound-alerts.js` systems (Phases 12/13)
   or replace them — audit first, per working rule #4.

## Continuation prompt

If starting a fresh session to continue this work, paste:

> Continue the VYRA roadmap from `docs/VYRA_PROJECT_STATE.md` → "Exact next action". Read
> `docs/VYRA_MASTER_ROADMAP.md`, `docs/VYRA_ARCHITECTURE.md`, and `docs/VYRA_HANDOFF.md`
> first. Do not assume any file/API exists — verify against the actual repository at
> `C:\Users\A\Desktop\vyra\VYRA-source-code-2026-07-14` on branch `feature/vyra-vfx-engine`.
> Follow the working rules listed in `VYRA_HANDOFF.md`. Complete Phase 4 (TikTok LIVE
> Adapter), run tests, commit with message `feat(tiktok): connect live events to recognition
> runtime`, update the four project-management docs, then continue to Phase 5.

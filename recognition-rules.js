// recognition-rules.js — Recognition Engine, pure configuration (Steg 4).
// No logic, no DOM, no timers, no side effects beyond registering window.VyraRecognitionRules.
// Consumed by recognition-merge.js (and later Filter/Controller) — never mutated at runtime;
// the whole tree is frozen below.
(function (root) {
  'use strict';

  // join has no time-based dedupe window: a duplicate join is only possible again once the
  // Recognition session itself is reset via VyraRecognitionMerge.clear() (see that file's
  // joinSeenActors Set). dedupeWindowMs's contract everywhere else is "a numeric millisecond
  // width the merge engine compares an elapsed time against" — rather than inventing a second,
  // undocumented mechanism just for join (e.g. a separate boolean/string flag the merge engine
  // would need special-case branching for), Infinity keeps join inside that exact same
  // "elapsed < window" comparison and simply never resolves true until clear() empties the
  // seen-set out from under it. This is the "clear implementation for join sessions" this file
  // is responsible for choosing and documenting.
  var JOIN_DEDUPE_IS_SESSION_SCOPED = Infinity;

  var canonical = {
    mergeWindowMs: Object.freeze({
      like: 1500,
      gift: 1500
    }),
    dedupeWindowMs: Object.freeze({
      join: JOIN_DEDUPE_IS_SESSION_SCOPED,
      follow: 5000,
      share: 5000
    })
  };

  var existing = root.VyraRecognitionRules;
  var next = (existing && typeof existing === 'object')
    ? Object.assign({}, existing, canonical)
    : canonical;

  root.VyraRecognitionRules = Object.freeze(next);
})(typeof window !== 'undefined' ? window : globalThis);

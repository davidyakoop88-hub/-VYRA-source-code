// recognition-verify.js — Recognition Engine, isolated verification (Steg 3 + Steg 4).
// DEV-ONLY. Never loaded by media.js or any production page — see recognition-verify.html,
// which is itself a standalone dev page. Not part of the pipeline itself. This project has no
// test framework anywhere (no jest/playwright/eslint/tsconfig — confirmed by inspection), so
// this intentionally does not introduce one. It runs two ways, matching conventions this
// project already uses:
//   - in a browser via recognition-verify.html (plain <script> tags, same as every VFX demo)
//   - headless via Node (`node -e "require(...)"`), same as tiktok-bridge/bridge.js is run
// Depends on window.VyraRecognitionNormalizer (Steg 3) and window.VyraRecognitionMerge
// (Steg 4), both of which must already be loaded before run() is called.
(function (root) {
  'use strict';

  function getNormalizer() {
    var ns = root.VyraRecognitionNormalizer;
    if (!ns || typeof ns.normalize !== 'function') {
      throw new Error('window.VyraRecognitionNormalizer.normalize is not available — load recognition-types.js and recognition-normalizer.js first');
    }
    return ns.normalize;
  }

  function getMerge() {
    var ns = root.VyraRecognitionMerge;
    if (!ns || typeof ns.push !== 'function') {
      throw new Error('window.VyraRecognitionMerge is not available — load recognition-types.js, recognition-rules.js and recognition-merge.js first');
    }
    return ns;
  }

  function getQueue() {
    var ns = root.VyraRecognitionQueue;
    if (!ns || typeof ns.enqueue !== 'function') {
      throw new Error('window.VyraRecognitionQueue is not available — load recognition-types.js, recognition-rules.js and recognition-queue.js first');
    }
    return ns;
  }

  function getController() {
    var ns = root.VyraRecognitionController;
    if (!ns || typeof ns.tick !== 'function') {
      throw new Error('window.VyraRecognitionController is not available — load recognition-types.js, recognition-rules.js, recognition-queue.js and recognition-controller.js first');
    }
    return ns;
  }

  function getMapper() {
    var ns = root.VyraRecognitionCardMapper;
    if (!ns || typeof ns.map !== 'function') {
      throw new Error('window.VyraRecognitionCardMapper is not available — load recognition-types.js, recognition-rules.js and recognition-card-mapper.js first');
    }
    return ns;
  }

  function getCard() {
    var ns = root.VyraRecognitionCard;
    if (!ns || typeof ns.mount !== 'function') {
      throw new Error('window.VyraRecognitionCard is not available — load recognition-types.js, recognition-rules.js, recognition-card-mapper.js and recognition-card.js first');
    }
    return ns;
  }

  function hasDom() {
    return typeof document !== 'undefined';
  }

  function wait(ms) {
    return new Promise(function (resolve) { setTimeout(resolve, ms); });
  }

  function makeResult(name, pass, details) {
    return { name: name, pass: !!pass, details: details || '' };
  }

  // Steg 8 (Recognition Card) needs to observe state AFTER real setTimeout-driven animation
  // phases finish (enter-complete, exit-complete, stale-timer safety) — something a purely
  // synchronous result can never express. A case function may return a plain {pass, details}
  // object (every case before Steg 8 does, and still works completely unchanged) OR a Promise
  // of one (Steg 8's timing-sensitive cases).
  //
  // runCase() returns a THUNK (a zero-arg function), not an already-started Promise. This
  // matters because every stage shares one singleton (Merge/Queue/Controller/Mapper/Card) the
  // same way `state`/`selected` are shared globals in studio.js — if every case's fn() started
  // executing immediately (e.g. via Promise.all), a later synchronous case's card.destroy()
  // would race ahead of an earlier case still mid-`wait()`, corrupting its assertions. run()
  // below invokes these thunks one at a time, awaiting each one's full completion (including
  // any real wait) before starting the next — the same strict serial order the plain
  // synchronous version had before Steg 8 introduced genuine async cases.
  function runCase(name, fn) {
    return function runDeferredCase() {
      return Promise.resolve()
        .then(function () { return fn(); })
        .then(function (outcome) { return makeResult(name, outcome.pass, outcome.details); })
        .catch(function (err) { return makeResult(name, false, 'threw: ' + (err && err.message ? err.message : String(err))); });
    };
  }

  // ---- Steg 3: Event Normalizer cases --------------------------------------------

  function runNormalizerCases(results) {
    var normalize = getNormalizer();

    results.push(runCase('1. Komplett join-event', function () {
      var result = normalize({ id: 'evt1', type: 'join', username: 'alice', name: 'Alice', profileImage: 'https://x/a.png', timestamp: 1700000000000, userId: 'u-1' });
      var ok = !!result && result.kind === 'join' && result.id === 'evt1'
        && result.actor.id === 'u-1' && result.actor.username === 'alice'
        && result.actor.displayName === 'Alice' && result.actor.avatarUrl === 'https://x/a.png'
        && result.gift === null && result.count === 1 && result.coins === 0
        && result.timestamp === 1700000000000 && result.mergeKey === 'join:u-1';
      return { pass: ok, details: JSON.stringify(result) };
    }));

    results.push(runCase('2. Join-event med saknat namn', function () {
      var result = normalize({ type: 'join', username: 'bob', userId: 'u-2' });
      var ok = !!result && result.actor.displayName === 'bob' && result.actor.username === 'bob';
      return { pass: ok, details: JSON.stringify(result) };
    }));

    results.push(runCase('2b. Bade namn och username saknas -> Guest (extra kontroll)', function () {
      var result = normalize({ type: 'join', userId: 'u-2b' });
      var ok = !!result && result.actor.displayName === 'Guest' && result.actor.username === '';
      return { pass: ok, details: JSON.stringify(result) };
    }));

    results.push(runCase('3. Like-event med count som strang', function () {
      var result = normalize({ type: 'like', username: 'carol', userId: 'u-3', count: '7' });
      var ok = !!result && result.kind === 'like' && result.count === 7 && result.mergeKey === 'like:u-3';
      return { pass: ok, details: JSON.stringify(result) };
    }));

    results.push(runCase('4. Gift-event med full giftdata', function () {
      var result = normalize({ type: 'gift', username: 'dave', userId: 'u-4', giftId: 'g-100', giftName: 'Rose', giftImage: 'https://x/rose.png', coins: 50, count: 2 });
      var ok = !!result && result.kind === 'gift' && !!result.gift
        && result.gift.id === 'g-100' && result.gift.name === 'Rose' && result.gift.imageUrl === 'https://x/rose.png'
        && result.coins === 50 && result.count === 2 && result.mergeKey === 'gift:u-4:g-100';
      return { pass: ok, details: JSON.stringify(result) };
    }));

    results.push(runCase('5. Gift-event utan giftId men med giftName (stabilt fallback-id)', function () {
      var r1 = normalize({ type: 'gift', username: 'erin', userId: 'u-5', giftName: 'Galaxy', coins: 1000 });
      var r2 = normalize({ type: 'gift', username: 'erin', userId: 'u-5', giftName: 'Galaxy', coins: 1000 });
      var ok = !!r1 && !!r1.gift && typeof r1.gift.id === 'string' && r1.gift.id.length > 0
        && r1.gift.id === r2.gift.id && r1.mergeKey === r2.mergeKey;
      return { pass: ok, details: JSON.stringify({ r1: r1, r2: r2 }) };
    }));

    results.push(runCase('6. Okand eventtyp', function () {
      var result = normalize({ type: 'subscribe_unknown_thing', username: 'frank' });
      return { pass: result === null, details: 'result=' + JSON.stringify(result) };
    }));

    results.push(runCase('7. null och icke-objekt som input', function () {
      var inputs = [null, undefined, 'a string', 42, true, function () {}];
      var allNullNoThrow = true;
      var details = [];
      inputs.forEach(function (input) {
        try {
          var result = normalize(input);
          details.push(String(input) + ' -> ' + JSON.stringify(result));
          if (result !== null) allNullNoThrow = false;
        } catch (err) {
          allNullNoThrow = false;
          details.push(String(input) + ' -> THREW ' + err.message);
        }
      });
      return { pass: allNullNoThrow, details: details.join(' | ') };
    }));

    results.push(runCase('8. Negativ coins', function () {
      var result = normalize({ type: 'gift', username: 'gina', userId: 'u-8', giftName: 'Rose', coins: -25 });
      var ok = !!result && result.coins === 0;
      return { pass: ok, details: JSON.stringify(result) };
    }));

    results.push(runCase('9. count som 0 eller negativt', function () {
      var r0 = normalize({ type: 'like', username: 'hank', userId: 'u-9', count: 0 });
      var rNeg = normalize({ type: 'like', username: 'hank', userId: 'u-9', count: -5 });
      var ok = !!r0 && r0.count === 1 && !!rNeg && rNeg.count === 1;
      return { pass: ok, details: JSON.stringify({ r0: r0, rNeg: rNeg }) };
    }));

    results.push(runCase('10. Raobjektet ar oforandrat efter normalize()', function () {
      var raw = { type: 'gift', username: 'iris', userId: 'u-10', giftName: 'Rose', coins: 12, count: 3, timestamp: 123 };
      var before = JSON.stringify(raw);
      normalize(raw);
      var after = JSON.stringify(raw);
      return { pass: before === after, details: 'before=' + before + ' after=' + after };
    }));

    results.push(runCase('11. Tva events utan id far olika genererade id:n', function () {
      var r1 = normalize({ type: 'join', username: 'ivan' });
      var r2 = normalize({ type: 'join', username: 'ivan' });
      var ok = !!r1 && !!r2 && typeof r1.id === 'string' && typeof r2.id === 'string' && r1.id !== r2.id;
      return { pass: ok, details: 'id1=' + (r1 && r1.id) + ' id2=' + (r2 && r2.id) };
    }));

    results.push(runCase('12. Samma typ och anvandare far samma deterministiska mergeKey', function () {
      var r1 = normalize({ type: 'follow', username: 'judy', userId: 'u-12' });
      var r2 = normalize({ type: 'follow', username: 'judy', userId: 'u-12', timestamp: Date.now() + 999 });
      var ok = !!r1 && !!r2 && r1.mergeKey === r2.mergeKey && r1.mergeKey === 'follow:u-12';
      return { pass: ok, details: 'mergeKey1=' + (r1 && r1.mergeKey) + ' mergeKey2=' + (r2 && r2.mergeKey) };
    }));
  }

  // ---- Steg 4: Merge Engine cases --------------------------------------------

  function buildMergeKey(kind, actorId, gift) {
    if (kind === 'gift') return 'gift:' + actorId + ':' + ((gift && gift.id) || 'unknown');
    return kind + ':' + actorId;
  }

  function makeEvent(overrides) {
    overrides = overrides || {};
    var kind = overrides.kind || 'like';
    var actor = Object.assign({ id: 'actor-1', username: 'user1', displayName: 'User One', avatarUrl: null }, overrides.actor || {});
    var gift = overrides.gift === undefined ? null : overrides.gift;
    return {
      id: overrides.id || ('evt-' + Math.random().toString(36).slice(2, 10)),
      kind: kind,
      actor: actor,
      gift: gift,
      count: overrides.count !== undefined ? overrides.count : 1,
      coins: overrides.coins !== undefined ? overrides.coins : 0,
      timestamp: overrides.timestamp !== undefined ? overrides.timestamp : 1000,
      mergeKey: overrides.mergeKey || buildMergeKey(kind, actor.id, gift)
    };
  }

  function runMergeCases(results) {
    var merge = getMerge();

    results.push(runCase('Merge 1. Tva likes fran samma anvandare inom 1500 ms slas ihop', function () {
      merge.clear();
      var r1 = merge.push(makeEvent({ kind: 'like', timestamp: 1000, id: 'e1' }));
      var r2 = merge.push(makeEvent({ kind: 'like', timestamp: 1200, id: 'e2' }));
      var ok = r1.status === 'pending' && r2.status === 'merged' && r2.event.mergedCount === 2
        && merge.getPending().length === 1 && merge.getPending()[0].count === 2;
      return { pass: ok, details: JSON.stringify({ r1: r1, r2: r2, pending: merge.getPending() }) };
    }));

    results.push(runCase('Merge 2. Likes fran olika anvandare halls separata', function () {
      merge.clear();
      merge.push(makeEvent({ kind: 'like', actor: { id: 'actor-A' }, timestamp: 1000, id: 'eA' }));
      merge.push(makeEvent({ kind: 'like', actor: { id: 'actor-B' }, timestamp: 1000, id: 'eB' }));
      var pending = merge.getPending();
      var ok = pending.length === 2 && pending[0].mergeKey !== pending[1].mergeKey;
      return { pass: ok, details: JSON.stringify(pending) };
    }));

    results.push(runCase('Merge 3. Likes fran samma anvandare efter fonstret skapar tva aggregat', function () {
      merge.clear();
      var emittedLog = [];
      var unsub = merge.subscribe(function (e) { emittedLog.push(e); });
      var r1 = merge.push(makeEvent({ kind: 'like', timestamp: 1000, id: 'e1' }));
      var r2 = merge.push(makeEvent({ kind: 'like', timestamp: 1000 + 1500 + 1, id: 'e2' }));
      unsub();
      var pending = merge.getPending();
      var ok = r1.status === 'pending' && r2.status === 'pending'
        && emittedLog.length === 1 && emittedLog[0].mergedCount === 1
        && pending.length === 1 && pending[0].id !== emittedLog[0].id;
      return { pass: ok, details: JSON.stringify({ r1: r1, r2: r2, emittedLog: emittedLog, pending: pending }) };
    }));

    results.push(runCase('Merge 4. Tre likes summerar count korrekt', function () {
      merge.clear();
      merge.push(makeEvent({ kind: 'like', timestamp: 1000, count: 2, id: 'e1' }));
      merge.push(makeEvent({ kind: 'like', timestamp: 1100, count: 3, id: 'e2' }));
      merge.push(makeEvent({ kind: 'like', timestamp: 1200, count: 1, id: 'e3' }));
      var pending = merge.getPending();
      var ok = pending.length === 1 && pending[0].count === 6;
      return { pass: ok, details: JSON.stringify(pending) };
    }));

    results.push(runCase('Merge 5. mergedCount raknar source events, inte like-count', function () {
      merge.clear();
      merge.push(makeEvent({ kind: 'like', timestamp: 1000, count: 2, id: 'e1' }));
      merge.push(makeEvent({ kind: 'like', timestamp: 1100, count: 3, id: 'e2' }));
      merge.push(makeEvent({ kind: 'like', timestamp: 1200, count: 1, id: 'e3' }));
      var pending = merge.getPending();
      var ok = pending.length === 1 && pending[0].mergedCount === 3 && pending[0].count === 6;
      return { pass: ok, details: JSON.stringify(pending) };
    }));

    results.push(runCase('Merge 6. Tva identiska gifts fran samma anvandare slas ihop', function () {
      merge.clear();
      var gift = { id: 'g1', name: 'Rose', imageUrl: null };
      var r1 = merge.push(makeEvent({ kind: 'gift', gift: gift, timestamp: 1000, count: 1, coins: 10, id: 'g-e1' }));
      var r2 = merge.push(makeEvent({ kind: 'gift', gift: gift, timestamp: 1200, count: 1, coins: 10, id: 'g-e2' }));
      var pending = merge.getPending();
      var ok = r1.status === 'pending' && r2.status === 'merged'
        && pending.length === 1 && pending[0].count === 2 && pending[0].coins === 20;
      return { pass: ok, details: JSON.stringify({ r1: r1, r2: r2, pending: pending }) };
    }));

    results.push(runCase('Merge 7. Olika gifts fran samma anvandare halls separata', function () {
      merge.clear();
      merge.push(makeEvent({ kind: 'gift', gift: { id: 'g1', name: 'Rose', imageUrl: null }, timestamp: 1000, id: 'e1' }));
      merge.push(makeEvent({ kind: 'gift', gift: { id: 'g2', name: 'Galaxy', imageUrl: null }, timestamp: 1000, id: 'e2' }));
      var ok = merge.getPending().length === 2;
      return { pass: ok, details: JSON.stringify(merge.getPending()) };
    }));

    results.push(runCase('Merge 8. Samma gift fran olika anvandare halls separata', function () {
      merge.clear();
      merge.push(makeEvent({ kind: 'gift', actor: { id: 'actorA' }, gift: { id: 'g1', name: 'Rose', imageUrl: null }, timestamp: 1000, id: 'e1' }));
      merge.push(makeEvent({ kind: 'gift', actor: { id: 'actorB' }, gift: { id: 'g1', name: 'Rose', imageUrl: null }, timestamp: 1000, id: 'e2' }));
      var ok = merge.getPending().length === 2;
      return { pass: ok, details: JSON.stringify(merge.getPending()) };
    }));

    results.push(runCase('Merge 9. Dubbelt source event-id raknas inte tva ganger', function () {
      merge.clear();
      var gift = { id: 'g1', name: 'Rose', imageUrl: null };
      merge.push(makeEvent({ kind: 'gift', gift: gift, timestamp: 1000, count: 1, coins: 10, id: 'dup-1' }));
      var r2 = merge.push(makeEvent({ kind: 'gift', gift: gift, timestamp: 1100, count: 1, coins: 10, id: 'dup-1' }));
      var pending = merge.getPending();
      var ok = r2.status === 'duplicate' && pending.length === 1 && pending[0].count === 1 && pending[0].mergedCount === 1;
      return { pass: ok, details: JSON.stringify({ r2: r2, pending: pending }) };
    }));

    results.push(runCase('Merge 10. Samma join tva ganger under sessionen blir duplicate', function () {
      merge.clear();
      var r1 = merge.push(makeEvent({ kind: 'join', timestamp: 1000, id: 'j1' }));
      var r2 = merge.push(makeEvent({ kind: 'join', timestamp: 1100, id: 'j2' }));
      var ok = r1.status === 'emitted' && r2.status === 'duplicate';
      return { pass: ok, details: JSON.stringify({ r1: r1, r2: r2 }) };
    }));

    results.push(runCase('Merge 11. Join fran olika anvandare accepteras', function () {
      merge.clear();
      var r1 = merge.push(makeEvent({ kind: 'join', actor: { id: 'actorA' }, timestamp: 1000, id: 'j1' }));
      var r2 = merge.push(makeEvent({ kind: 'join', actor: { id: 'actorB' }, timestamp: 1000, id: 'j2' }));
      var ok = r1.status === 'emitted' && r2.status === 'emitted';
      return { pass: ok, details: JSON.stringify({ r1: r1, r2: r2 }) };
    }));

    results.push(runCase('Merge 12. Dubbla follows inom 5000 ms filtreras', function () {
      merge.clear();
      var r1 = merge.push(makeEvent({ kind: 'follow', timestamp: 1000, id: 'f1' }));
      var r2 = merge.push(makeEvent({ kind: 'follow', timestamp: 1000 + 4999, id: 'f2' }));
      var ok = r1.status === 'emitted' && r2.status === 'duplicate';
      return { pass: ok, details: JSON.stringify({ r1: r1, r2: r2 }) };
    }));

    results.push(runCase('Merge 13. Follow efter dedupe-fonstret accepteras', function () {
      merge.clear();
      var r1 = merge.push(makeEvent({ kind: 'follow', timestamp: 1000, id: 'f1' }));
      var r2 = merge.push(makeEvent({ kind: 'follow', timestamp: 1000 + 5000, id: 'f2' }));
      var ok = r1.status === 'emitted' && r2.status === 'emitted';
      return { pass: ok, details: JSON.stringify({ r1: r1, r2: r2 }) };
    }));

    results.push(runCase('Merge 14. Dubbla shares inom 5000 ms filtreras', function () {
      merge.clear();
      var r1 = merge.push(makeEvent({ kind: 'share', timestamp: 1000, id: 's1' }));
      var r2 = merge.push(makeEvent({ kind: 'share', timestamp: 1000 + 4999, id: 's2' }));
      var ok = r1.status === 'emitted' && r2.status === 'duplicate';
      return { pass: ok, details: JSON.stringify({ r1: r1, r2: r2 }) };
    }));

    results.push(runCase('Merge 15. flushExpired emitterar ratt pending event', function () {
      merge.clear();
      var emittedLog = [];
      var unsub = merge.subscribe(function (e) { emittedLog.push(e); });
      merge.push(makeEvent({ kind: 'like', timestamp: 1000, count: 5, id: 'e1' }));
      var flushed = merge.flushExpired(1000 + 1500);
      unsub();
      var ok = flushed.length === 1 && flushed[0].count === 5
        && emittedLog.length === 1 && emittedLog[0].count === 5
        && merge.getPending().length === 0;
      return { pass: ok, details: JSON.stringify({ flushed: flushed, emittedLog: emittedLog }) };
    }));

    results.push(runCase('Merge 16. flushExpired for tidigt emitterar inget', function () {
      merge.clear();
      merge.push(makeEvent({ kind: 'like', timestamp: 1000, id: 'e1' }));
      var flushed = merge.flushExpired(1000 + 1499);
      var ok = flushed.length === 0 && merge.getPending().length === 1;
      return { pass: ok, details: JSON.stringify({ flushed: flushed, pending: merge.getPending() }) };
    }));

    results.push(runCase('Merge 17. clear tommer state och stats', function () {
      merge.clear();
      merge.push(makeEvent({ kind: 'like', timestamp: 1000, id: 'e1' }));
      merge.push(makeEvent({ kind: 'join', timestamp: 1000, id: 'j1' }));
      merge.clear();
      var statsAfter = merge.getStats();
      var expected = { received: 0, pending: 0, merged: 0, emitted: 0, duplicates: 0, rejected: 0 };
      var statsOk = JSON.stringify(statsAfter) === JSON.stringify(expected);
      var pendingOk = merge.getPending().length === 0;
      var rJoinAgain = merge.push(makeEvent({ kind: 'join', timestamp: 9999, id: 'j-new' }));
      var ok = statsOk && pendingOk && rJoinAgain.status === 'emitted';
      return { pass: ok, details: JSON.stringify({ statsAfter: statsAfter, rJoinAgain: rJoinAgain }) };
    }));

    results.push(runCase('Merge 18. Input-eventet ar oforandrat efter push()', function () {
      merge.clear();
      var raw = makeEvent({ kind: 'like', timestamp: 1000, id: 'immutable-1' });
      var before = JSON.stringify(raw);
      merge.push(raw);
      var after = JSON.stringify(raw);
      return { pass: before === after, details: 'before=' + before + ' after=' + after };
    }));

    results.push(runCase('Merge 19. En subscriber som kastar fel stoppar inte nasta subscriber', function () {
      merge.clear();
      var secondCalled = false;
      var unsub1 = merge.subscribe(function () { throw new Error('boom'); });
      var unsub2 = merge.subscribe(function () { secondCalled = true; });
      merge.push(makeEvent({ kind: 'join', timestamp: 1000, id: 'sub-test' }));
      unsub1();
      unsub2();
      return { pass: secondCalled === true, details: 'secondCalled=' + secondCalled };
    }));

    results.push(runCase('Merge 20. Ogiltig input returnerar rejected utan exception', function () {
      merge.clear();
      var inputs = [
        null, undefined, 'x', 42, {},
        { id: 'z', kind: 'not-a-kind', actor: { id: 'a', username: '', displayName: 'd', avatarUrl: null }, gift: null, count: 1, coins: 0, timestamp: 1, mergeKey: 'x' }
      ];
      var allRejectedNoThrow = true;
      var details = [];
      inputs.forEach(function (input) {
        try {
          var r = merge.push(input);
          details.push(JSON.stringify(input) + ' -> ' + r.status);
          if (r.status !== 'rejected') allRejectedNoThrow = false;
        } catch (err) {
          allRejectedNoThrow = false;
          details.push(JSON.stringify(input) + ' -> THREW ' + err.message);
        }
      });
      return { pass: allRejectedNoThrow, details: details.join(' | ') };
    }));

    results.push(runCase('Merge 21. sourceEventIds ar unika', function () {
      merge.clear();
      merge.push(makeEvent({ kind: 'like', timestamp: 1000, id: 'u1' }));
      merge.push(makeEvent({ kind: 'like', timestamp: 1100, id: 'u2' }));
      merge.push(makeEvent({ kind: 'like', timestamp: 1100, id: 'u2' })); // duplicate id, must not double-add
      var pending = merge.getPending();
      var ids = pending[0].sourceEventIds;
      var uniqueIds = Array.prototype.filter.call(ids, function (id, i) { return ids.indexOf(id) === i; });
      var ok = pending.length === 1 && ids.length === 2 && uniqueIds.length === ids.length;
      return { pass: ok, details: JSON.stringify(pending) };
    }));

    results.push(runCase('Merge 22. getPending returnerar kopior, inte muterbart internt state', function () {
      merge.clear();
      merge.push(makeEvent({ kind: 'like', timestamp: 1000, id: 'copy-1' }));
      var snapshot = merge.getPending();
      snapshot[0].count = 99999;
      snapshot[0].actor.displayName = 'HACKED';
      var again = merge.getPending();
      var ok = again[0].count !== 99999 && again[0].actor.displayName !== 'HACKED';
      return { pass: ok, details: JSON.stringify({ mutatedSnapshot: snapshot, freshRead: again }) };
    }));

    // ---- pending stat accuracy (fix: getStats().pending must always equal the actual number
    // of entries in pendingByMergeKey, never a separately-drifting counter) --------------------

    results.push(runCase('PendingStats 1. Nytt like-event ger pending = 1', function () {
      merge.clear();
      merge.push(makeEvent({ kind: 'like', timestamp: 1000, id: 'ps1-e1' }));
      var ok = merge.getStats().pending === 1 && merge.getPending().length === 1;
      return { pass: ok, details: JSON.stringify(merge.getStats()) };
    }));

    results.push(runCase('PendingStats 2. Merge av samma eventgrupp behaller pending = 1', function () {
      merge.clear();
      merge.push(makeEvent({ kind: 'like', timestamp: 1000, id: 'ps2-e1' }));
      merge.push(makeEvent({ kind: 'like', timestamp: 1200, id: 'ps2-e2' }));
      merge.push(makeEvent({ kind: 'like', timestamp: 1300, id: 'ps2-e3' }));
      var ok = merge.getStats().pending === 1 && merge.getPending().length === 1;
      return { pass: ok, details: JSON.stringify(merge.getStats()) };
    }));

    results.push(runCase('PendingStats 3. flushExpired() andrar pending till 0', function () {
      merge.clear();
      merge.push(makeEvent({ kind: 'like', timestamp: 1000, id: 'ps3-e1' }));
      var beforeFlush = merge.getStats().pending;
      merge.flushExpired(1000 + 1500);
      var afterFlush = merge.getStats().pending;
      var ok = beforeFlush === 1 && afterFlush === 0 && merge.getPending().length === 0;
      return { pass: ok, details: JSON.stringify({ beforeFlush: beforeFlush, afterFlush: afterFlush }) };
    }));

    results.push(runCase('PendingStats 4. Tva olika pending mergeKeys ger pending = 2', function () {
      merge.clear();
      merge.push(makeEvent({ kind: 'like', actor: { id: 'ps4-A' }, timestamp: 1000, id: 'ps4-e1' }));
      merge.push(makeEvent({ kind: 'gift', actor: { id: 'ps4-A' }, gift: { id: 'g1', name: 'Rose', imageUrl: null }, timestamp: 1000, id: 'ps4-e2' }));
      var ok = merge.getStats().pending === 2 && merge.getPending().length === 2;
      return { pass: ok, details: JSON.stringify(merge.getStats()) };
    }));

    results.push(runCase('PendingStats 5. Utganget aggregat ersatt av nytt for samma mergeKey forblir pending = 1', function () {
      merge.clear();
      merge.push(makeEvent({ kind: 'like', timestamp: 1000, id: 'ps5-e1' }));
      var afterFirst = merge.getStats().pending;
      merge.push(makeEvent({ kind: 'like', timestamp: 1000 + 1500 + 1, id: 'ps5-e2' })); // window elapsed -> old emitted, new created
      var afterReplace = merge.getStats().pending;
      var ok = afterFirst === 1 && afterReplace === 1 && merge.getPending().length === 1;
      return { pass: ok, details: JSON.stringify({ afterFirst: afterFirst, afterReplace: afterReplace, pending: merge.getPending() }) };
    }));

    results.push(runCase('PendingStats 6. clear() ger pending = 0', function () {
      merge.clear();
      merge.push(makeEvent({ kind: 'like', actor: { id: 'ps6-A' }, timestamp: 1000, id: 'ps6-e1' }));
      merge.push(makeEvent({ kind: 'gift', actor: { id: 'ps6-B' }, gift: { id: 'g1', name: 'Rose', imageUrl: null }, timestamp: 1000, id: 'ps6-e2' }));
      var beforeClear = merge.getStats().pending;
      merge.clear();
      var afterClear = merge.getStats().pending;
      var ok = beforeClear === 2 && afterClear === 0 && merge.getPending().length === 0;
      return { pass: ok, details: JSON.stringify({ beforeClear: beforeClear, afterClear: afterClear }) };
    }));

    merge.clear(); // leave the shared singleton in a clean state for anything run after this
  }

  // ---- Steg 5: Priority Queue cases --------------------------------------------

  function makeMergedEvent(overrides) {
    overrides = overrides || {};
    var kind = overrides.kind || 'like';
    var actor = Object.assign({ id: 'actor-1', username: 'user1', displayName: 'User One', avatarUrl: null }, overrides.actor || {});
    var gift = overrides.gift === undefined ? null : overrides.gift;
    var timestamp = overrides.timestamp !== undefined ? overrides.timestamp : 1000;
    var id = overrides.id || ('mrg-evt-' + Math.random().toString(36).slice(2, 10));
    return {
      id: id,
      kind: kind,
      actor: actor,
      gift: gift,
      count: overrides.count !== undefined ? overrides.count : 1,
      coins: overrides.coins !== undefined ? overrides.coins : 0,
      timestamp: timestamp,
      mergeKey: overrides.mergeKey || (kind + ':' + actor.id + (gift ? ':' + gift.id : '')),
      mergedCount: overrides.mergedCount !== undefined ? overrides.mergedCount : 1,
      firstSeen: overrides.firstSeen !== undefined ? overrides.firstSeen : timestamp,
      lastSeen: overrides.lastSeen !== undefined ? overrides.lastSeen : timestamp,
      sourceEventIds: overrides.sourceEventIds || [id]
    };
  }

  function runQueueCases(results) {
    var queue = getQueue();

    results.push(runCase('Queue 1. Join enqueue/dequeue', function () {
      queue.clear();
      var enq = queue.enqueue(makeMergedEvent({ kind: 'join', id: 'j1', timestamp: Date.now() }));
      var out = queue.dequeueNext();
      var ok = enq.status === 'enqueued' && !!out && out.kind === 'join' && out.id === 'j1' && queue.size() === 0;
      return { pass: ok, details: JSON.stringify({ enq: enq, out: out }) };
    }));

    results.push(runCase('Queue 2. Gift gar fore join', function () {
      queue.clear();
      queue.enqueue(makeMergedEvent({ kind: 'join', id: 'j1', timestamp: Date.now() }));
      queue.enqueue(makeMergedEvent({ kind: 'gift', id: 'g1', gift: { id: 'gg1', name: 'Rose', imageUrl: null }, coins: 10, timestamp: Date.now() }));
      var first = queue.dequeueNext();
      var ok = !!first && first.kind === 'gift';
      return { pass: ok, details: JSON.stringify(first) };
    }));

    results.push(runCase('Queue 3. Follow gar fore share', function () {
      queue.clear();
      queue.enqueue(makeMergedEvent({ kind: 'share', id: 's1', timestamp: Date.now() }));
      queue.enqueue(makeMergedEvent({ kind: 'follow', id: 'f1', timestamp: Date.now() }));
      var first = queue.dequeueNext();
      var ok = !!first && first.kind === 'follow';
      return { pass: ok, details: JSON.stringify(first) };
    }));

    results.push(runCase('Queue 4. Large gift gar fore medium och small gift', function () {
      queue.clear();
      queue.enqueue(makeMergedEvent({ kind: 'gift', id: 'gs', gift: { id: 'g-s', name: 'Rose', imageUrl: null }, coins: 5, timestamp: Date.now() }));
      queue.enqueue(makeMergedEvent({ kind: 'gift', id: 'gm', gift: { id: 'g-m', name: 'Galaxy', imageUrl: null }, coins: 500, timestamp: Date.now() }));
      queue.enqueue(makeMergedEvent({ kind: 'gift', id: 'gl', gift: { id: 'g-l', name: 'Universe', imageUrl: null }, coins: 5000, timestamp: Date.now() }));
      var order = [queue.dequeueNext().id, queue.dequeueNext().id, queue.dequeueNext().id];
      var ok = order[0] === 'gl' && order[1] === 'gm' && order[2] === 'gs';
      return { pass: ok, details: JSON.stringify(order) };
    }));

    results.push(runCase('Queue 5. Samma prioritet foljer FIFO', function () {
      queue.clear();
      queue.enqueue(makeMergedEvent({ kind: 'like', id: 'l1', timestamp: Date.now() }));
      queue.enqueue(makeMergedEvent({ kind: 'like', id: 'l2', timestamp: Date.now() }));
      queue.enqueue(makeMergedEvent({ kind: 'like', id: 'l3', timestamp: Date.now() }));
      var order = [queue.dequeueNext().id, queue.dequeueNext().id, queue.dequeueNext().id];
      var ok = order[0] === 'l1' && order[1] === 'l2' && order[2] === 'l3';
      return { pass: ok, details: JSON.stringify(order) };
    }));

    results.push(runCase('Queue 6. peek tar inte bort event', function () {
      queue.clear();
      queue.enqueue(makeMergedEvent({ kind: 'like', id: 'l1', timestamp: Date.now() }));
      var p = queue.peek();
      var ok = !!p && p.id === 'l1' && queue.size() === 1;
      return { pass: ok, details: JSON.stringify({ p: p, size: queue.size() }) };
    }));

    results.push(runCase('Queue 7. dequeue tar bort event', function () {
      queue.clear();
      queue.enqueue(makeMergedEvent({ kind: 'like', id: 'l1', timestamp: Date.now() }));
      var d = queue.dequeueNext();
      var ok = !!d && d.id === 'l1' && queue.size() === 0;
      return { pass: ok, details: JSON.stringify({ d: d, size: queue.size() }) };
    }));

    results.push(runCase('Queue 8. Pause blockerar dequeue', function () {
      queue.clear();
      queue.enqueue(makeMergedEvent({ kind: 'like', id: 'l1', timestamp: Date.now() }));
      queue.pause();
      var d = queue.dequeueNext();
      var ok = d === null && queue.size() === 1 && queue.isPaused() === true;
      queue.resume();
      return { pass: ok, details: JSON.stringify({ d: d, size: queue.size() }) };
    }));

    results.push(runCase('Queue 9. Enqueue fungerar under pause', function () {
      queue.clear();
      queue.pause();
      var r = queue.enqueue(makeMergedEvent({ kind: 'like', id: 'l1', timestamp: Date.now() }));
      var ok = r.status === 'enqueued' && queue.size() === 1;
      queue.resume();
      return { pass: ok, details: JSON.stringify(r) };
    }));

    results.push(runCase('Queue 10. Resume aterstaller dequeue', function () {
      queue.clear();
      queue.enqueue(makeMergedEvent({ kind: 'like', id: 'l1', timestamp: Date.now() }));
      queue.pause();
      queue.dequeueNext();
      queue.resume();
      var d = queue.dequeueNext();
      var ok = !!d && d.id === 'l1';
      return { pass: ok, details: JSON.stringify(d) };
    }));

    results.push(runCase('Queue 11. Expired join tas bort', function () {
      queue.clear();
      queue.enqueue(makeMergedEvent({ kind: 'join', id: 'j1', timestamp: 1000 }));
      var d = queue.dequeueNext(1000 + 10000);
      var ok = d === null && queue.size() === 0;
      return { pass: ok, details: JSON.stringify({ d: d, size: queue.size() }) };
    }));

    results.push(runCase('Queue 12. Icke-expired join finns kvar', function () {
      queue.clear();
      queue.enqueue(makeMergedEvent({ kind: 'join', id: 'j1', timestamp: 1000 }));
      var p = queue.peek(1000 + 9999);
      var ok = !!p && p.id === 'j1' && queue.size() === 1;
      return { pass: ok, details: JSON.stringify({ p: p, size: queue.size() }) };
    }));

    results.push(runCase('Queue 13. Full ko droppar lagprioriterat nytt event', function () {
      queue.clear();
      for (var i = 0; i < 30; i++) queue.enqueue(makeMergedEvent({ kind: 'like', id: 'fill' + i, timestamp: Date.now() }));
      var r = queue.enqueue(makeMergedEvent({ kind: 'join', id: 'low-new', timestamp: Date.now() }));
      var ok = r.status === 'dropped' && queue.size() === 30;
      return { pass: ok, details: JSON.stringify(r) };
    }));

    results.push(runCase('Queue 14. Full ko ersatter lagst prioriterade event med hogre prioritet', function () {
      queue.clear();
      for (var i = 0; i < 30; i++) queue.enqueue(makeMergedEvent({ kind: 'like', id: 'fill' + i, timestamp: Date.now() }));
      var r = queue.enqueue(makeMergedEvent({ kind: 'follow', id: 'high-new', timestamp: Date.now() }));
      var ok = r.status === 'replaced' && !!r.replacedEvent && r.replacedEvent.kind === 'like' && r.replacedEvent.id === 'fill0' && queue.size() === 30;
      return { pass: ok, details: JSON.stringify(r) };
    }));

    results.push(runCase('Queue 15. Join kan inte ersatta gift', function () {
      queue.clear();
      for (var i = 0; i < 30; i++) queue.enqueue(makeMergedEvent({ kind: 'gift', id: 'giftfill' + i, gift: { id: 'gid' + i, name: 'Rose', imageUrl: null }, coins: 5, timestamp: Date.now() }));
      var r = queue.enqueue(makeMergedEvent({ kind: 'join', id: 'join-cant', timestamp: Date.now() }));
      var ok = r.status === 'dropped';
      return { pass: ok, details: JSON.stringify(r) };
    }));

    results.push(runCase('Queue 16. Gift kan ersatta join', function () {
      queue.clear();
      for (var i = 0; i < 29; i++) queue.enqueue(makeMergedEvent({ kind: 'gift', id: 'giftfill' + i, gift: { id: 'gid' + i, name: 'Rose', imageUrl: null }, coins: 5, timestamp: Date.now() }));
      queue.enqueue(makeMergedEvent({ kind: 'join', id: 'the-join', timestamp: Date.now() }));
      var r = queue.enqueue(makeMergedEvent({ kind: 'gift', id: 'gift-new', gift: { id: 'gnew', name: 'Universe', imageUrl: null }, coins: 5000, timestamp: Date.now() }));
      var ok = r.status === 'replaced' && !!r.replacedEvent && r.replacedEvent.kind === 'join' && r.replacedEvent.id === 'the-join';
      return { pass: ok, details: JSON.stringify(r) };
    }));

    results.push(runCase('Queue 17. Maxlangd overskrids aldrig', function () {
      queue.clear();
      for (var i = 0; i < 40; i++) queue.enqueue(makeMergedEvent({ kind: 'like', id: 'overfill' + i, timestamp: Date.now() }));
      var ok = queue.size() === 30 && queue.getStats().length === 30;
      return { pass: ok, details: 'size=' + queue.size() };
    }));

    results.push(runCase('Queue 18. clear tommer kon', function () {
      queue.clear();
      queue.enqueue(makeMergedEvent({ kind: 'join', id: 'j1', timestamp: Date.now() }));
      queue.enqueue(makeMergedEvent({ kind: 'like', id: 'l1', timestamp: Date.now() }));
      queue.clear();
      var ok = queue.size() === 0 && queue.getItems().length === 0;
      return { pass: ok, details: 'size=' + queue.size() };
    }));

    results.push(runCase('Queue 19. Stats ar korrekta', function () {
      queue.clear();
      queue.enqueue(makeMergedEvent({ kind: 'like', id: 'sa1', timestamp: Date.now() })); // enqueued
      queue.enqueue(makeMergedEvent({ kind: 'join', id: 'sa2', timestamp: Date.now() })); // enqueued
      queue.dequeueNext(); // dequeues sa1 (higher priority) -> dequeued=1, only sa2 (join) remains
      // 29 more likes brings the queue to exactly 30 (1 existing + 29) without ever hitting the
      // full-queue branch during the loop itself.
      for (var i = 0; i < 29; i++) queue.enqueue(makeMergedEvent({ kind: 'like', id: 'safill' + i, timestamp: Date.now() }));
      queue.enqueue(makeMergedEvent({ kind: 'join', id: 'sa-dropped', timestamp: Date.now() })); // full, priority 20 == sa2's 20 -> dropped
      var beforeReplace = queue.getStats();
      queue.enqueue(makeMergedEvent({ kind: 'gift', id: 'sa-replace', gift: { id: 'sag', name: 'Rose', imageUrl: null }, coins: 5000, timestamp: Date.now() })); // full, priority 95 > sa2's 20 -> replaces sa2
      var stats = queue.getStats();
      var ok = stats.dequeued === 1 && beforeReplace.dropped === 1 && stats.replaced === 1
        && stats.enqueued === (2 + 29 + 1) // sa1+sa2, 29 fills, the successful replace also counts as an enqueue
        && stats.length === queue.size() && stats.length === 30 && stats.paused === false;
      return { pass: ok, details: JSON.stringify({ beforeReplace: beforeReplace, stats: stats }) };
    }));

    results.push(runCase('Queue 20. Ogiltig input ger rejected', function () {
      queue.clear();
      var inputs = [
        null, undefined, 'x', 42, {},
        { id: 'z', kind: 'not-a-kind', actor: { id: 'a', username: '', displayName: 'd', avatarUrl: null }, gift: null, count: 1, coins: 0, timestamp: 1, mergeKey: 'x', mergedCount: 1, firstSeen: 1, lastSeen: 1, sourceEventIds: [] },
        makeMergedEvent({ kind: 'gift', id: 'no-gift-data', gift: null, timestamp: Date.now() })
      ];
      var allRejectedNoThrow = true;
      var details = [];
      inputs.forEach(function (input) {
        try {
          var r = queue.enqueue(input);
          details.push(JSON.stringify(input) + ' -> ' + r.status);
          if (r.status !== 'rejected') allRejectedNoThrow = false;
        } catch (err) {
          allRejectedNoThrow = false;
          details.push(JSON.stringify(input) + ' -> THREW ' + err.message);
        }
      });
      return { pass: allRejectedNoThrow, details: details.join(' | ') };
    }));

    results.push(runCase('Queue 21. Input-event muteras inte', function () {
      queue.clear();
      var raw = makeMergedEvent({ kind: 'like', id: 'immutable-1', timestamp: 1000 });
      var before = JSON.stringify(raw);
      queue.enqueue(raw);
      var after = JSON.stringify(raw);
      return { pass: before === after, details: 'before=' + before + ' after=' + after };
    }));

    results.push(runCase('Queue 22. getItems returnerar djupa kopior', function () {
      queue.clear();
      queue.enqueue(makeMergedEvent({ kind: 'like', id: 'copy-1', timestamp: Date.now() }));
      var snapshot = queue.getItems();
      snapshot[0].priority = 99999;
      snapshot[0].event.count = 12345;
      var again = queue.getItems();
      var ok = again[0].priority !== 99999 && again[0].event.count !== 12345;
      return { pass: ok, details: JSON.stringify({ mutatedSnapshot: snapshot, freshRead: again }) };
    }));

    results.push(runCase('Queue 23. Subscriber-fel stoppar inte nasta subscriber', function () {
      queue.clear();
      var secondCalled = false;
      var unsub1 = queue.subscribe(function () { throw new Error('boom'); });
      var unsub2 = queue.subscribe(function () { secondCalled = true; });
      queue.enqueue(makeMergedEvent({ kind: 'join', id: 'sub-test', timestamp: Date.now() }));
      unsub1();
      unsub2();
      return { pass: secondCalled === true, details: 'secondCalled=' + secondCalled };
    }));

    results.push(runCase('Queue 24. Sorteringen ar deterministisk', function () {
      queue.clear();
      queue.enqueue(makeMergedEvent({ kind: 'like', id: 'd1', timestamp: Date.now() }));
      queue.enqueue(makeMergedEvent({ kind: 'gift', id: 'd2', gift: { id: 'dg', name: 'Rose', imageUrl: null }, coins: 10, timestamp: Date.now() }));
      queue.enqueue(makeMergedEvent({ kind: 'follow', id: 'd3', timestamp: Date.now() }));
      queue.enqueue(makeMergedEvent({ kind: 'join', id: 'd4', timestamp: Date.now() }));
      var first = JSON.stringify(queue.getItems());
      var second = JSON.stringify(queue.getItems());
      var ids = queue.getItems().map(function (item) { return item.event.id; });
      var ok = first === second && ids.join(',') === ['d2', 'd3', 'd1', 'd4'].join(',');
      return { pass: ok, details: 'ids=' + ids.join(',') };
    }));

    results.push(runCase('Queue 25. dequeue fran tom ko returnerar null', function () {
      queue.clear();
      var d = queue.dequeueNext();
      return { pass: d === null, details: 'd=' + JSON.stringify(d) };
    }));

    queue.clear(); // leave the shared singleton in a clean state for anything run after this
  }

  // ---- Steg 6: Recognition Controller cases --------------------------------------------

  function runControllerCases(results) {
    var queue = getQueue();
    var controller = getController();

    function resetAll() {
      queue.clear();
      controller.stop();
      controller.clear();
    }

    results.push(runCase('Controller 1. Initial state ar stopped', function () {
      resetAll();
      var state = controller.getState();
      var ok = state.status === 'stopped' && state.running === false;
      return { pass: ok, details: JSON.stringify(state) };
    }));

    results.push(runCase('Controller 2. start ger idle', function () {
      resetAll();
      controller.start();
      var state = controller.getState();
      var ok = state.status === 'idle' && state.running === true && state.current === null;
      return { pass: ok, details: JSON.stringify(state) };
    }));

    results.push(runCase('Controller 3. Forsta tick hamtar ett event', function () {
      resetAll();
      controller.start();
      queue.enqueue(makeMergedEvent({ kind: 'like', id: 'c3', timestamp: 1000 }));
      controller.tick(1000);
      var current = controller.getCurrent();
      var ok = !!current && current.event.id === 'c3' && current.status === 'presenting';
      return { pass: ok, details: JSON.stringify(current) };
    }));

    results.push(runCase('Controller 4. Endast ett event ar current', function () {
      resetAll();
      controller.start();
      queue.enqueue(makeMergedEvent({ kind: 'like', id: 'c4a', timestamp: 1000 }));
      queue.enqueue(makeMergedEvent({ kind: 'join', id: 'c4b', timestamp: 1000 }));
      controller.tick(1000);
      var current = controller.getCurrent();
      var ok = !!current && current.event.id === 'c4a' && queue.size() === 1;
      return { pass: ok, details: JSON.stringify({ current: current, queueSize: queue.size() }) };
    }));

    results.push(runCase('Controller 5. Ett andra event startar inte medan current ar aktivt', function () {
      resetAll();
      controller.start();
      queue.enqueue(makeMergedEvent({ kind: 'like', id: 'c5a', timestamp: 1000 }));
      controller.tick(2000); // starts c5a, endsAt = 2000 + 3000 = 5000
      queue.enqueue(makeMergedEvent({ kind: 'gift', id: 'c5b', gift: { id: 'g5', name: 'Rose', imageUrl: null }, coins: 10, timestamp: 2000 }));
      controller.tick(2100); // not yet expired
      var current = controller.getCurrent();
      var ok = !!current && current.event.id === 'c5a' && queue.size() === 1;
      return { pass: ok, details: JSON.stringify({ current: current, queueSize: queue.size() }) };
    }));

    results.push(runCase('Controller 6. Event slutfors nar now nar endsAt', function () {
      resetAll();
      controller.start();
      var completes = [];
      var unsub = controller.subscribe(function (e) { if (e.type === 'presentation-complete') completes.push(e); });
      queue.enqueue(makeMergedEvent({ kind: 'join', id: 'c6', timestamp: 1000 }));
      controller.tick(1000); // endsAt = 1000 + 2500 = 3500
      controller.tick(3500);
      unsub();
      var ok = controller.getCurrent() === null && completes.length === 1 && completes[0].presentation.event.id === 'c6';
      return { pass: ok, details: JSON.stringify(completes) };
    }));

    results.push(runCase('Controller 7. Nasta event startar forst pa efterfoljande tick', function () {
      resetAll();
      controller.start();
      queue.enqueue(makeMergedEvent({ kind: 'join', id: 'c7a', timestamp: 1000 }));
      queue.enqueue(makeMergedEvent({ kind: 'join', id: 'c7b', timestamp: 1000 }));
      controller.tick(1000); // starts c7a, endsAt=3500
      controller.tick(3500); // completes c7a, does NOT start c7b this same call
      var afterCompleteTick = controller.getCurrent();
      controller.tick(3600); // separate tick -> now starts c7b
      var afterNextTick = controller.getCurrent();
      var ok = afterCompleteTick === null && !!afterNextTick && afterNextTick.event.id === 'c7b';
      return { pass: ok, details: JSON.stringify({ afterCompleteTick: afterCompleteTick, afterNextTick: afterNextTick }) };
    }));

    results.push(runCase('Controller 8. completeCurrent avslutar direkt', function () {
      resetAll();
      controller.start();
      queue.enqueue(makeMergedEvent({ kind: 'like', id: 'c8', timestamp: 1000 }));
      controller.tick(1000);
      var result = controller.completeCurrent('manual-done');
      var ok = !!result && result.event.id === 'c8' && result.status === 'completed' && controller.getCurrent() === null;
      return { pass: ok, details: JSON.stringify(result) };
    }));

    results.push(runCase('Controller 9. skipCurrent avslutar direkt', function () {
      resetAll();
      controller.start();
      queue.enqueue(makeMergedEvent({ kind: 'like', id: 'c9', timestamp: 1000 }));
      controller.tick(1000);
      var result = controller.skipCurrent('user-skip');
      var ok = !!result && result.event.id === 'c9' && result.status === 'skipped' && controller.getCurrent() === null;
      return { pass: ok, details: JSON.stringify(result) };
    }));

    results.push(runCase('Controller 10. completeCurrent pa tom Controller ger null', function () {
      resetAll();
      controller.start();
      var result = controller.completeCurrent();
      return { pass: result === null, details: 'result=' + JSON.stringify(result) };
    }));

    results.push(runCase('Controller 11. skipCurrent pa tom Controller ger null', function () {
      resetAll();
      controller.start();
      var result = controller.skipCurrent();
      return { pass: result === null, details: 'result=' + JSON.stringify(result) };
    }));

    results.push(runCase('Controller 12. pause behaller current', function () {
      resetAll();
      controller.start();
      queue.enqueue(makeMergedEvent({ kind: 'like', id: 'c12', timestamp: 1000 }));
      controller.tick(1000);
      controller.pause();
      var current = controller.getCurrent();
      var ok = !!current && current.event.id === 'c12' && controller.isPaused() === true;
      controller.resume();
      return { pass: ok, details: JSON.stringify(current) };
    }));

    results.push(runCase('Controller 13. tick under paus andrar inget', function () {
      resetAll();
      controller.start();
      queue.enqueue(makeMergedEvent({ kind: 'join', id: 'c13', timestamp: 1000 }));
      controller.tick(1000); // endsAt = 3500
      controller.pause();
      controller.tick(9999999); // far past endsAt, but paused -> tick() must no-op entirely
      var current = controller.getCurrent();
      var ok = !!current && current.event.id === 'c13';
      controller.resume();
      return { pass: ok, details: JSON.stringify(current) };
    }));

    results.push(runCase('Controller 14. resume forlanger endsAt med pausens langd', function () {
      resetAll();
      controller.start();
      queue.enqueue(makeMergedEvent({ kind: 'join', id: 'c14', timestamp: Date.now() }));
      controller.tick(Date.now());
      var beforePause = controller.getCurrent().endsAt;
      controller.pause();
      var waitStart = Date.now();
      while (Date.now() - waitStart < 20) { /* deterministic-enough busy wait for a real, measurable pause duration — pause()/resume() take no `now` override per the spec's own exposed signatures, so this is the only honest way to prove real elapsed time gets added back */ }
      controller.resume();
      var afterResume = controller.getCurrent().endsAt;
      var delta = afterResume - beforePause;
      var ok = afterResume > beforePause && delta >= 15 && delta < 2000;
      return { pass: ok, details: JSON.stringify({ beforePause: beforePause, afterResume: afterResume, delta: delta }) };
    }));

    results.push(runCase('Controller 15. stop behaller current', function () {
      resetAll();
      controller.start();
      queue.enqueue(makeMergedEvent({ kind: 'like', id: 'c15', timestamp: 1000 }));
      controller.tick(1000);
      controller.stop();
      var current = controller.getCurrent();
      var ok = !!current && current.event.id === 'c15' && controller.getState().status === 'stopped';
      return { pass: ok, details: JSON.stringify(current) };
    }));

    results.push(runCase('Controller 16. tick under stop andrar inget', function () {
      resetAll();
      controller.start();
      queue.enqueue(makeMergedEvent({ kind: 'join', id: 'c16', timestamp: 1000 }));
      controller.tick(1000); // endsAt = 3500
      controller.stop();
      controller.tick(9999999);
      var current = controller.getCurrent();
      var ok = !!current && current.event.id === 'c16';
      return { pass: ok, details: JSON.stringify(current) };
    }));

    results.push(runCase('Controller 17. start efter stop fungerar', function () {
      resetAll();
      controller.start();
      queue.enqueue(makeMergedEvent({ kind: 'like', id: 'c17a', timestamp: 1000 }));
      controller.tick(1000);
      controller.completeCurrent(); // clear current before stopping, so restart starts from a clean idle
      controller.stop();
      controller.start();
      var stateAfterRestart = controller.getState();
      queue.enqueue(makeMergedEvent({ kind: 'join', id: 'c17b', timestamp: 2000 }));
      controller.tick(2000);
      var current = controller.getCurrent();
      var ok = stateAfterRestart.status === 'idle' && stateAfterRestart.running === true
        && !!current && current.event.id === 'c17b';
      return { pass: ok, details: JSON.stringify({ stateAfterRestart: stateAfterRestart, current: current }) };
    }));

    results.push(runCase('Controller 18. clear tommer endast current, inte Queue', function () {
      resetAll();
      controller.start();
      queue.enqueue(makeMergedEvent({ kind: 'like', id: 'c18a', timestamp: 1000 }));
      queue.enqueue(makeMergedEvent({ kind: 'join', id: 'c18b', timestamp: 1000 }));
      controller.tick(1000); // current = c18a, c18b still pending in queue
      var queueSizeBefore = queue.size();
      controller.clear();
      var current = controller.getCurrent();
      var queueSizeAfter = queue.size();
      var ok = current === null && queueSizeBefore === 1 && queueSizeAfter === 1;
      return { pass: ok, details: JSON.stringify({ queueSizeBefore: queueSizeBefore, queueSizeAfter: queueSizeAfter }) };
    }));

    // 19-25: presentation durations per kind, including the three gift tiers.
    (function () {
      var cases = [
        [19, 'Join far ratt duration', 'join', null, 2500],
        [20, 'Like far ratt duration', 'like', null, 3000],
        [21, 'Follow far ratt duration', 'follow', null, 4000],
        [22, 'Share far ratt duration', 'share', null, 3500],
        [23, 'Small gift far ratt duration', 'gift', { gift: { id: 'gs', name: 'Rose', imageUrl: null }, coins: 5 }, 4500],
        [24, 'Medium gift far ratt duration', 'gift', { gift: { id: 'gm', name: 'Galaxy', imageUrl: null }, coins: 500 }, 5500],
        [25, 'Large gift far ratt duration', 'gift', { gift: { id: 'gl', name: 'Universe', imageUrl: null }, coins: 5000 }, 7000]
      ];
      cases.forEach(function (c) {
        var caseNumber = c[0], label = c[1], kind = c[2], giftOverrides = c[3], expectedDuration = c[4];
        results.push(runCase('Controller ' + caseNumber + '. ' + label, function () {
          resetAll();
          controller.start();
          var overrides = Object.assign({ kind: kind, id: 'dur-' + kind + '-' + caseNumber, timestamp: 1000 }, giftOverrides || {});
          queue.enqueue(makeMergedEvent(overrides));
          controller.tick(1000);
          var current = controller.getCurrent();
          var ok = !!current && current.durationMs === expectedDuration && current.endsAt === 1000 + expectedDuration;
          return { pass: ok, details: JSON.stringify(current) };
        }));
      });
    })();

    results.push(runCase('Controller 26. Samma Queue-event muteras inte', function () {
      resetAll();
      controller.start();
      var original = makeMergedEvent({ kind: 'gift', id: 'c26', gift: { id: 'g26', name: 'Rose', imageUrl: null }, coins: 50, timestamp: 1000 });
      var before = JSON.stringify(original);
      queue.enqueue(original);
      controller.tick(1000);
      var after = JSON.stringify(original);
      return { pass: before === after, details: 'before=' + before + ' after=' + after };
    }));

    results.push(runCase('Controller 27. getCurrent returnerar djup kopia', function () {
      resetAll();
      controller.start();
      queue.enqueue(makeMergedEvent({ kind: 'like', id: 'c27', timestamp: 1000 }));
      controller.tick(1000);
      var snapshot = controller.getCurrent();
      snapshot.durationMs = 999999;
      snapshot.event.count = 42424242;
      var again = controller.getCurrent();
      var ok = again.durationMs !== 999999 && again.event.count !== 42424242;
      return { pass: ok, details: JSON.stringify({ mutatedSnapshot: snapshot, freshRead: again }) };
    }));

    results.push(runCase('Controller 28. getState returnerar djup kopia', function () {
      resetAll();
      controller.start();
      queue.enqueue(makeMergedEvent({ kind: 'like', id: 'c28', timestamp: 1000 }));
      controller.tick(1000);
      var snapshot = controller.getState();
      snapshot.current.durationMs = 111;
      snapshot.status = 'tampered';
      var again = controller.getState();
      var ok = again.current.durationMs !== 111 && again.status !== 'tampered';
      return { pass: ok, details: JSON.stringify({ mutatedSnapshot: snapshot, freshRead: again }) };
    }));

    results.push(runCase('Controller 29. Subscriber far presentation-start', function () {
      resetAll();
      controller.start();
      var events = [];
      var unsub = controller.subscribe(function (e) { events.push(e); });
      queue.enqueue(makeMergedEvent({ kind: 'like', id: 'c29', timestamp: 1000 }));
      controller.tick(1000);
      unsub();
      var ok = events.some(function (e) { return e.type === 'presentation-start' && e.presentation.event.id === 'c29'; });
      return { pass: ok, details: JSON.stringify(events) };
    }));

    results.push(runCase('Controller 30. Subscriber far presentation-complete', function () {
      resetAll();
      controller.start();
      var events = [];
      var unsub = controller.subscribe(function (e) { events.push(e); });
      queue.enqueue(makeMergedEvent({ kind: 'join', id: 'c30', timestamp: 1000 }));
      controller.tick(1000); // endsAt = 3500
      controller.tick(3500);
      unsub();
      var ok = events.some(function (e) { return e.type === 'presentation-complete' && e.presentation.event.id === 'c30'; });
      return { pass: ok, details: JSON.stringify(events) };
    }));

    results.push(runCase('Controller 31. Subscriber far presentation-skip', function () {
      resetAll();
      controller.start();
      var events = [];
      var unsub = controller.subscribe(function (e) { events.push(e); });
      queue.enqueue(makeMergedEvent({ kind: 'like', id: 'c31', timestamp: 1000 }));
      controller.tick(1000);
      controller.skipCurrent('c31-reason');
      unsub();
      var ok = events.some(function (e) { return e.type === 'presentation-skip' && e.presentation.event.id === 'c31' && e.reason === 'c31-reason'; });
      return { pass: ok, details: JSON.stringify(events) };
    }));

    results.push(runCase('Controller 32. Subscriber-fel stoppar inte nasta subscriber', function () {
      resetAll();
      controller.start();
      var secondCalled = false;
      var unsub1 = controller.subscribe(function () { throw new Error('boom'); });
      var unsub2 = controller.subscribe(function () { secondCalled = true; });
      queue.enqueue(makeMergedEvent({ kind: 'join', id: 'c32', timestamp: 1000 }));
      controller.tick(1000);
      unsub1();
      unsub2();
      return { pass: secondCalled === true, details: 'secondCalled=' + secondCalled };
    }));

    results.push(runCase('Controller 33. unsubscribe fungerar', function () {
      resetAll();
      var calls = 0;
      var unsub = controller.subscribe(function () { calls++; });
      controller.start(); // -> calls=1
      unsub();
      controller.stop(); // unsubscribed -> must NOT increment
      var ok = calls === 1;
      return { pass: ok, details: 'calls=' + calls };
    }));

    results.push(runCase('Controller 34. Stats raknas korrekt', function () {
      resetAll();
      controller.start();
      queue.enqueue(makeMergedEvent({ kind: 'like', id: 'c34a', timestamp: 1000 }));
      controller.tick(1000); // started=1, ticks=1 (starts c34a, endsAt=4000)
      controller.tick(1000); // ticks=2, nothing else changes (not expired yet)
      queue.enqueue(makeMergedEvent({ kind: 'join', id: 'c34b', timestamp: 1000 }));
      controller.tick(4000); // ticks=3, completes c34a (completed=1), does not start c34b this call
      controller.tick(4000); // ticks=4, starts c34b (started=2)
      controller.skipCurrent('c34-skip'); // skipped=1
      var stats = controller.getStats();
      var ok = stats.started === 2 && stats.completed === 1 && stats.skipped === 1 && stats.ticks === 4
        && stats.errors === 0 && stats.running === true && stats.paused === false && stats.hasCurrent === false;
      return { pass: ok, details: JSON.stringify(stats) };
    }));

    results.push(runCase('Controller 35. Ogiltigt/tomt Queue-event kraschar inte Controller', function () {
      resetAll();
      controller.start();
      var threw = false;
      try { controller.tick(Date.now()); } catch (err) { threw = true; }
      var current = controller.getCurrent();
      var ok = threw === false && current === null;
      return { pass: ok, details: JSON.stringify({ threw: threw, current: current }) };
    }));

    results.push(runCase('Controller 36. tick ar deterministisk med explicit now', function () {
      resetAll();
      controller.start();
      queue.enqueue(makeMergedEvent({ kind: 'like', id: 'c36', timestamp: 5000 }));
      controller.tick(5000);
      var current1 = controller.getCurrent();
      controller.tick(5000); // same explicit now again — current already active, not expired -> unchanged
      var current2 = controller.getCurrent();
      var ok = current1.startedAt === 5000 && current1.endsAt === 8000 && JSON.stringify(current1) === JSON.stringify(current2);
      return { pass: ok, details: JSON.stringify({ current1: current1, current2: current2 }) };
    }));

    results.push(runCase('Controller 37. Controller anvander inga timers', function () {
      resetAll();
      var originalSetTimeout = root.setTimeout;
      var originalSetInterval = root.setInterval;
      var originalRAF = root.requestAnimationFrame;
      var calls = { setTimeout: 0, setInterval: 0, requestAnimationFrame: 0 };
      if (typeof originalSetTimeout === 'function') root.setTimeout = function () { calls.setTimeout++; return originalSetTimeout.apply(this, arguments); };
      if (typeof originalSetInterval === 'function') root.setInterval = function () { calls.setInterval++; return originalSetInterval.apply(this, arguments); };
      if (typeof originalRAF === 'function') root.requestAnimationFrame = function () { calls.requestAnimationFrame++; return originalRAF.apply(this, arguments); };

      try {
        controller.start();
        queue.enqueue(makeMergedEvent({ kind: 'like', id: 'timer-check', timestamp: Date.now() }));
        controller.tick(Date.now());
        controller.pause();
        controller.tick(Date.now());
        controller.resume();
        controller.completeCurrent();
        controller.skipCurrent();
        controller.stop();
        controller.clear();
      } finally {
        if (typeof originalSetTimeout === 'function') root.setTimeout = originalSetTimeout;
        if (typeof originalSetInterval === 'function') root.setInterval = originalSetInterval;
        if (typeof originalRAF === 'function') root.requestAnimationFrame = originalRAF;
      }

      var ok = calls.setTimeout === 0 && calls.setInterval === 0 && calls.requestAnimationFrame === 0;
      return { pass: ok, details: JSON.stringify(calls) };
    }));

    resetAll(); // leave both shared singletons in a clean state for anything run after this
  }

  // ---- Steg 7: Recognition Card Mapper cases --------------------------------------------

  function makePresentation(event, overrides) {
    overrides = overrides || {};
    return {
      id: overrides.id || ('pres-' + Math.random().toString(36).slice(2, 10)),
      event: event,
      startedAt: overrides.startedAt !== undefined ? overrides.startedAt : 1000,
      durationMs: overrides.durationMs !== undefined ? overrides.durationMs : 3000,
      endsAt: overrides.endsAt !== undefined ? overrides.endsAt : 4000,
      status: overrides.status || 'presenting'
    };
  }

  function runMapperCases(results) {
    var mapper = getMapper();
    mapper.clearStats();

    results.push(runCase('Mapper 1. Join mappas korrekt', function () {
      var event = makeMergedEvent({ kind: 'join', id: 'm1', actor: { id: 'a1', username: 'david', displayName: 'David' }, timestamp: 1000 });
      var r = mapper.map(event);
      var ok = r.status === 'mapped' && r.model.kind === 'join' && r.model.variant === 'join-soft'
        && r.model.content.eyebrow === 'WELCOME' && r.model.content.title === 'David'
        && r.model.content.subtitle === 'joined the live' && r.model.content.countLabel === null && r.model.content.coinLabel === null;
      return { pass: ok, details: JSON.stringify(r) };
    }));

    results.push(runCase('Mapper 2. Like count 1 saknar countLabel', function () {
      var event = makeMergedEvent({ kind: 'like', id: 'm2', count: 1, timestamp: 1000 });
      var r = mapper.map(event);
      var ok = r.status === 'mapped' && r.model.content.countLabel === null && r.model.content.subtitle === 'sent a like';
      return { pass: ok, details: JSON.stringify(r) };
    }));

    results.push(runCase('Mapper 3. Like count over 1 far countLabel', function () {
      var event = makeMergedEvent({ kind: 'like', id: 'm3', count: 5, timestamp: 1000 });
      var r = mapper.map(event);
      var ok = r.status === 'mapped' && r.model.content.countLabel === '×5' && r.model.content.subtitle === 'sent likes';
      return { pass: ok, details: JSON.stringify(r) };
    }));

    results.push(runCase('Mapper 4. Like-pulse variant', function () {
      var event = makeMergedEvent({ kind: 'like', id: 'm4', count: 50, timestamp: 1000 });
      var r = mapper.map(event);
      return { pass: r.status === 'mapped' && r.model.variant === 'like-pulse', details: JSON.stringify(r) };
    }));

    results.push(runCase('Mapper 5. Like-wave variant', function () {
      var event = makeMergedEvent({ kind: 'like', id: 'm5', count: 500, timestamp: 1000 });
      var r = mapper.map(event);
      return { pass: r.status === 'mapped' && r.model.variant === 'like-wave', details: JSON.stringify(r) };
    }));

    results.push(runCase('Mapper 6. Like-storm variant', function () {
      var event = makeMergedEvent({ kind: 'like', id: 'm6', count: 5000, timestamp: 1000 });
      var r = mapper.map(event);
      return { pass: r.status === 'mapped' && r.model.variant === 'like-storm', details: JSON.stringify(r) };
    }));

    results.push(runCase('Mapper 7. Share mappas korrekt', function () {
      var event = makeMergedEvent({ kind: 'share', id: 'm7', actor: { id: 'a7', username: 'sara', displayName: 'Sara' }, timestamp: 1000 });
      var r = mapper.map(event);
      var ok = r.status === 'mapped' && r.model.variant === 'share-signal' && r.model.content.eyebrow === 'SHARE'
        && r.model.content.subtitle === 'shared the live' && r.model.content.title === 'Sara';
      return { pass: ok, details: JSON.stringify(r) };
    }));

    results.push(runCase('Mapper 8. Follow mappas korrekt', function () {
      var event = makeMergedEvent({ kind: 'follow', id: 'm8', actor: { id: 'a8', username: 'leo', displayName: 'Leo' }, timestamp: 1000 });
      var r = mapper.map(event);
      var ok = r.status === 'mapped' && r.model.variant === 'follow-spotlight' && r.model.content.eyebrow === 'NEW FOLLOWER'
        && r.model.content.subtitle === 'started following';
      return { pass: ok, details: JSON.stringify(r) };
    }));

    results.push(runCase('Mapper 9. Small gift mappas korrekt', function () {
      var event = makeMergedEvent({ kind: 'gift', id: 'm9', gift: { id: 'g9', name: 'Rose', imageUrl: null }, coins: 10, timestamp: 1000 });
      var r = mapper.map(event);
      var ok = r.status === 'mapped' && r.model.gift.tier === 'small' && r.model.variant === 'gift-crystal' && r.model.content.eyebrow === 'GIFT';
      return { pass: ok, details: JSON.stringify(r) };
    }));

    results.push(runCase('Mapper 10. Medium gift mappas korrekt', function () {
      var event = makeMergedEvent({ kind: 'gift', id: 'm10', gift: { id: 'g10', name: 'Galaxy', imageUrl: null }, coins: 500, timestamp: 1000 });
      var r = mapper.map(event);
      var ok = r.status === 'mapped' && r.model.gift.tier === 'medium' && r.model.variant === 'gift-crown' && r.model.content.eyebrow === 'BIG GIFT';
      return { pass: ok, details: JSON.stringify(r) };
    }));

    results.push(runCase('Mapper 11. Large gift mappas korrekt', function () {
      var event = makeMergedEvent({ kind: 'gift', id: 'm11', gift: { id: 'g11', name: 'Universe', imageUrl: null }, coins: 5000, timestamp: 1000 });
      var r = mapper.map(event);
      var ok = r.status === 'mapped' && r.model.gift.tier === 'large' && r.model.variant === 'gift-legendary' && r.model.content.eyebrow === 'LEGENDARY GIFT';
      return { pass: ok, details: JSON.stringify(r) };
    }));

    results.push(runCase('Mapper 12. Gift countLabel fungerar', function () {
      var event = makeMergedEvent({ kind: 'gift', id: 'm12', gift: { id: 'g12', name: 'Rose', imageUrl: null }, coins: 10, count: 3, timestamp: 1000 });
      var r = mapper.map(event);
      return { pass: r.status === 'mapped' && r.model.content.countLabel === '×3', details: JSON.stringify(r) };
    }));

    results.push(runCase('Mapper 13. Gift coinLabel fungerar', function () {
      var event = makeMergedEvent({ kind: 'gift', id: 'm13', gift: { id: 'g13', name: 'Rose', imageUrl: null }, coins: 300, timestamp: 1000 });
      var r = mapper.map(event);
      return { pass: r.status === 'mapped' && r.model.content.coinLabel === '300 coins', details: JSON.stringify(r) };
    }));

    results.push(runCase('Mapper 14. Gift utan coins far null coinLabel', function () {
      var event = makeMergedEvent({ kind: 'gift', id: 'm14', gift: { id: 'g14', name: 'Rose', imageUrl: null }, coins: 0, timestamp: 1000 });
      var r = mapper.map(event);
      return { pass: r.status === 'mapped' && r.model.content.coinLabel === null, details: JSON.stringify(r) };
    }));

    results.push(runCase('Mapper 15. CurrentPresentation ger presentationId', function () {
      var event = makeMergedEvent({ kind: 'like', id: 'm15', timestamp: 1000 });
      var presentation = makePresentation(event, { id: 'pres-m15' });
      var r = mapper.map(presentation);
      return { pass: r.status === 'mapped' && r.model.metadata.presentationId === 'pres-m15', details: JSON.stringify(r) };
    }));

    results.push(runCase('Mapper 16. CurrentPresentation ger durationMs', function () {
      var event = makeMergedEvent({ kind: 'like', id: 'm16', timestamp: 1000 });
      var presentation = makePresentation(event, { id: 'pres-m16', durationMs: 3000 });
      var r = mapper.map(presentation);
      return { pass: r.status === 'mapped' && r.model.metadata.durationMs === 3000, details: JSON.stringify(r) };
    }));

    results.push(runCase('Mapper 17. Direkt MergedEvent ger null presentationId', function () {
      var event = makeMergedEvent({ kind: 'like', id: 'm17', timestamp: 1000 });
      var r = mapper.map(event);
      return { pass: r.status === 'mapped' && r.model.metadata.presentationId === null, details: JSON.stringify(r) };
    }));

    results.push(runCase('Mapper 18. Direkt MergedEvent ger null durationMs', function () {
      var event = makeMergedEvent({ kind: 'like', id: 'm18', timestamp: 1000 });
      var r = mapper.map(event);
      return { pass: r.status === 'mapped' && r.model.metadata.durationMs === null, details: JSON.stringify(r) };
    }));

    results.push(runCase('Mapper 19. DisplayName anvands fore username', function () {
      var event = makeMergedEvent({ kind: 'join', id: 'm19', actor: { id: 'a19', username: 'dyakoop', displayName: 'David Yakoop' }, timestamp: 1000 });
      var r = mapper.map(event);
      return { pass: r.status === 'mapped' && r.model.actor.displayName === 'David Yakoop' && r.model.content.title === 'David Yakoop', details: JSON.stringify(r) };
    }));

    results.push(runCase('Mapper 20. Username anvands som fallback', function () {
      var event = makeMergedEvent({ kind: 'join', id: 'm20', actor: { id: 'a20', username: 'sarauser', displayName: '' }, timestamp: 1000 });
      var r = mapper.map(event);
      return { pass: r.status === 'mapped' && r.model.actor.displayName === 'sarauser', details: JSON.stringify(r) };
    }));

    results.push(runCase('Mapper 21. Guest anvands nar bada saknas', function () {
      var event = makeMergedEvent({ kind: 'join', id: 'm21', actor: { id: 'a21', username: '', displayName: '' }, timestamp: 1000 });
      var r = mapper.map(event);
      return { pass: r.status === 'mapped' && r.model.actor.displayName === 'Guest', details: JSON.stringify(r) };
    }));

    results.push(runCase('Mapper 22. Initialer fran tva ord', function () {
      var event = makeMergedEvent({ kind: 'join', id: 'm22', actor: { id: 'a22', username: 'dy', displayName: 'David Yakoop' }, timestamp: 1000 });
      var r = mapper.map(event);
      return { pass: r.status === 'mapped' && r.model.actor.initials === 'DY', details: JSON.stringify(r) };
    }));

    results.push(runCase('Mapper 23. Initial fran ett ord', function () {
      var event = makeMergedEvent({ kind: 'join', id: 'm23', actor: { id: 'a23', username: 'david', displayName: 'David' }, timestamp: 1000 });
      var r = mapper.map(event);
      return { pass: r.status === 'mapped' && r.model.actor.initials === 'D', details: JSON.stringify(r) };
    }));

    results.push(runCase('Mapper 24. Tomt namn ger fragetecken', function () {
      var event = makeMergedEvent({ kind: 'join', id: 'm24', actor: { id: 'a24', username: '', displayName: '' }, timestamp: 1000 });
      var r = mapper.map(event);
      return { pass: r.status === 'mapped' && r.model.actor.initials === '?', details: JSON.stringify(r) };
    }));

    results.push(runCase('Mapper 25. Avatar saknas ger null', function () {
      var event = makeMergedEvent({ kind: 'join', id: 'm25', actor: { id: 'a25', username: 'x', displayName: 'X', avatarUrl: null }, timestamp: 1000 });
      var r = mapper.map(event);
      return { pass: r.status === 'mapped' && r.model.actor.avatarUrl === null, details: JSON.stringify(r) };
    }));

    results.push(runCase('Mapper 26. Giftbild saknas ger null', function () {
      var event = makeMergedEvent({ kind: 'gift', id: 'm26', gift: { id: 'g26', name: 'Rose', imageUrl: null }, coins: 10, timestamp: 1000 });
      var r = mapper.map(event);
      return { pass: r.status === 'mapped' && r.model.gift.imageUrl === null, details: JSON.stringify(r) };
    }));

    results.push(runCase('Mapper 27. Input muteras inte', function () {
      var event = makeMergedEvent({ kind: 'gift', id: 'm27', gift: { id: 'g27', name: 'Rose', imageUrl: null }, coins: 50, timestamp: 1000 });
      var before = JSON.stringify(event);
      mapper.map(event);
      var after = JSON.stringify(event);
      return { pass: before === after, details: 'before=' + before + ' after=' + after };
    }));

    results.push(runCase('Mapper 28. Output ar en djup kopia', function () {
      var event = makeMergedEvent({ kind: 'like', id: 'm28', timestamp: 1000 });
      var rA = mapper.map(event);
      var rB = mapper.map(event);
      rA.model.actor.displayName = 'MUTATED';
      rA.model.content.title = 'MUTATED';
      var ok = rB.model.actor.displayName !== 'MUTATED' && rB.model.content.title !== 'MUTATED';
      return { pass: ok, details: JSON.stringify({ rA: rA, rB: rB }) };
    }));

    results.push(runCase('Mapper 29. Okand kind rejected', function () {
      var event = makeMergedEvent({ kind: 'unknown-thing', id: 'm29', timestamp: 1000 });
      var r = mapper.map(event);
      return { pass: r.status === 'rejected', details: JSON.stringify(r) };
    }));

    results.push(runCase('Mapper 30. Saknat event-id rejected', function () {
      // makeMergedEvent's own `overrides.id || (...)` treats '' as falsy and would silently
      // substitute a generated id, so the empty id is set directly on the built event instead.
      var event = makeMergedEvent({ kind: 'like', timestamp: 1000 });
      event.id = '';
      var r = mapper.map(event);
      return { pass: r.status === 'rejected', details: JSON.stringify(r) };
    }));

    results.push(runCase('Mapper 31. Saknat actor-id rejected', function () {
      var event = makeMergedEvent({ kind: 'like', id: 'm31', actor: { id: '', username: 'x', displayName: 'X' }, timestamp: 1000 });
      var r = mapper.map(event);
      return { pass: r.status === 'rejected', details: JSON.stringify(r) };
    }));

    results.push(runCase('Mapper 32. Ogiltig timestamp rejected', function () {
      var event = makeMergedEvent({ kind: 'like', id: 'm32', timestamp: NaN });
      var r = mapper.map(event);
      return { pass: r.status === 'rejected', details: JSON.stringify(r) };
    }));

    results.push(runCase('Mapper 33. Negativ count rejected', function () {
      var event = makeMergedEvent({ kind: 'like', id: 'm33', count: -5, timestamp: 1000 });
      var r = mapper.map(event);
      return { pass: r.status === 'rejected', details: JSON.stringify(r) };
    }));

    results.push(runCase('Mapper 34. Negativa coins rejected', function () {
      var event = makeMergedEvent({ kind: 'gift', id: 'm34', gift: { id: 'g34', name: 'Rose', imageUrl: null }, coins: -10, timestamp: 1000 });
      var r = mapper.map(event);
      return { pass: r.status === 'rejected', details: JSON.stringify(r) };
    }));

    results.push(runCase('Mapper 35. Gift utan giftdata rejected', function () {
      var event = makeMergedEvent({ kind: 'gift', id: 'm35', gift: null, timestamp: 1000 });
      var r = mapper.map(event);
      return { pass: r.status === 'rejected', details: JSON.stringify(r) };
    }));

    results.push(runCase('Mapper 36. Formatter ger 999', function () {
      var event = makeMergedEvent({ kind: 'like', id: 'm36', count: 999, timestamp: 1000 });
      var r = mapper.map(event);
      return { pass: r.status === 'mapped' && r.model.content.countLabel === '×999', details: JSON.stringify(r) };
    }));

    results.push(runCase('Mapper 37. Formatter ger 1K', function () {
      var event = makeMergedEvent({ kind: 'like', id: 'm37', count: 1000, timestamp: 1000 });
      var r = mapper.map(event);
      return { pass: r.status === 'mapped' && r.model.content.countLabel === '×1K', details: JSON.stringify(r) };
    }));

    results.push(runCase('Mapper 38. Formatter ger 1.2K', function () {
      var event = makeMergedEvent({ kind: 'like', id: 'm38', count: 1200, timestamp: 1000 });
      var r = mapper.map(event);
      return { pass: r.status === 'mapped' && r.model.content.countLabel === '×1.2K', details: JSON.stringify(r) };
    }));

    results.push(runCase('Mapper 39. Formatter ger 1M', function () {
      var event = makeMergedEvent({ kind: 'like', id: 'm39', count: 1000000, timestamp: 1000 });
      var r = mapper.map(event);
      return { pass: r.status === 'mapped' && r.model.content.countLabel === '×1M', details: JSON.stringify(r) };
    }));

    results.push(runCase('Mapper 40. Formatter ger 1.2M', function () {
      var event = makeMergedEvent({ kind: 'like', id: 'm40', count: 1250000, timestamp: 1000 });
      var r = mapper.map(event);
      return { pass: r.status === 'mapped' && r.model.content.countLabel === '×1.2M', details: JSON.stringify(r) };
    }));

    results.push(runCase('Mapper 41. Aria-label for join ar korrekt', function () {
      var event = makeMergedEvent({ kind: 'join', id: 'm41', actor: { id: 'a41', username: 'david', displayName: 'David' }, timestamp: 1000 });
      var r = mapper.map(event);
      return { pass: r.status === 'mapped' && r.model.accessibility.ariaLabel === 'David joined the live', details: JSON.stringify(r) };
    }));

    results.push(runCase('Mapper 42. Aria-label for like anvander fullt tal', function () {
      var event = makeMergedEvent({ kind: 'like', id: 'm42', actor: { id: 'a42', username: 'david', displayName: 'David' }, count: 1200, timestamp: 1000 });
      var r = mapper.map(event);
      return { pass: r.status === 'mapped' && r.model.accessibility.ariaLabel === 'David sent 1,200 likes', details: JSON.stringify(r) };
    }));

    results.push(runCase('Mapper 43. Aria-label for gift innehaller antal, namn och coins', function () {
      var event = makeMergedEvent({ kind: 'gift', id: 'm43', actor: { id: 'a43', username: 'david', displayName: 'David' }, gift: { id: 'g43', name: 'Rose', imageUrl: null }, count: 3, coins: 300, timestamp: 1000 });
      var r = mapper.map(event);
      return { pass: r.status === 'mapped' && r.model.accessibility.ariaLabel === 'David sent 3 Rose gifts worth 300 coins', details: JSON.stringify(r) };
    }));

    results.push(runCase('Mapper 44. validateCardModel accepterar korrekt modell', function () {
      var event = makeMergedEvent({ kind: 'like', id: 'm44', timestamp: 1000 });
      var r = mapper.map(event);
      var validation = mapper.validateCardModel(r.model);
      return { pass: validation.valid === true && validation.errors.length === 0, details: JSON.stringify(validation) };
    }));

    results.push(runCase('Mapper 45. validateCardModel avvisar felaktig modell', function () {
      var validation = mapper.validateCardModel({ id: '', kind: 'not-a-kind' });
      return { pass: validation.valid === false && validation.errors.length > 0, details: JSON.stringify(validation) };
    }));

    results.push(runCase('Mapper 46. Stats raknas korrekt', function () {
      mapper.clearStats();
      mapper.map(makeMergedEvent({ kind: 'join', id: 'st1', timestamp: 1000 }));
      mapper.map(makeMergedEvent({ kind: 'like', id: 'st2', timestamp: 1000 }));
      mapper.map(makeMergedEvent({ kind: 'gift', id: 'st3', gift: { id: 'gst', name: 'Rose', imageUrl: null }, coins: 5000, timestamp: 1000 })); // large
      mapper.map(makeMergedEvent({ kind: 'unknown-thing', id: 'st4', timestamp: 1000 })); // rejected
      var stats = mapper.getStats();
      var ok = stats.mapped === 3 && stats.rejected === 1 && stats.join === 1 && stats.like === 1
        && stats.gift === 1 && stats.largeGift === 1 && stats.smallGift === 0 && stats.mediumGift === 0
        && stats.share === 0 && stats.follow === 0;
      return { pass: ok, details: JSON.stringify(stats) };
    }));

    results.push(runCase('Mapper 47. clearStats fungerar', function () {
      mapper.map(makeMergedEvent({ kind: 'join', id: 'cs1', timestamp: 1000 }));
      mapper.clearStats();
      var stats = mapper.getStats();
      var expected = { mapped: 0, rejected: 0, join: 0, like: 0, share: 0, follow: 0, gift: 0, smallGift: 0, mediumGift: 0, largeGift: 0 };
      return { pass: JSON.stringify(stats) === JSON.stringify(expected), details: JSON.stringify(stats) };
    }));

    results.push(runCase('Mapper 48. Mapper innehaller ingen DOM-kod', function () {
      var hasDocument = typeof document !== 'undefined';
      var calls = { createElement: 0, querySelector: 0, getElementById: 0 };
      var originals = {};
      if (hasDocument) {
        originals.createElement = document.createElement;
        originals.querySelector = document.querySelector;
        originals.getElementById = document.getElementById;
        document.createElement = function () { calls.createElement++; return originals.createElement.apply(document, arguments); };
        document.querySelector = function () { calls.querySelector++; return originals.querySelector.apply(document, arguments); };
        document.getElementById = function () { calls.getElementById++; return originals.getElementById.apply(document, arguments); };
      }
      try {
        mapper.map(makeMergedEvent({ kind: 'gift', id: 'dom-check', gift: { id: 'gd', name: 'Rose', imageUrl: null }, coins: 500, timestamp: Date.now() }));
        mapper.mapEvent(makeMergedEvent({ kind: 'like', id: 'dom-check-2', timestamp: Date.now() }));
        mapper.getVariant(makeMergedEvent({ kind: 'follow', id: 'dom-check-3', timestamp: Date.now() }));
        mapper.getGiftTier(makeMergedEvent({ kind: 'gift', id: 'dom-check-4', gift: { id: 'gd2', name: 'Rose', imageUrl: null }, coins: 10, timestamp: Date.now() }));
        mapper.validateCardModel({});
        mapper.getStats();
        mapper.clearStats();
      } finally {
        if (hasDocument) {
          document.createElement = originals.createElement;
          document.querySelector = originals.querySelector;
          document.getElementById = originals.getElementById;
        }
      }
      var ok = calls.createElement === 0 && calls.querySelector === 0 && calls.getElementById === 0;
      return { pass: ok, details: JSON.stringify(calls) };
    }));

    results.push(runCase('Mapper 49. Mapper anvander inga timers', function () {
      var originalSetTimeout = root.setTimeout;
      var originalSetInterval = root.setInterval;
      var originalRAF = root.requestAnimationFrame;
      var calls = { setTimeout: 0, setInterval: 0, requestAnimationFrame: 0 };
      if (typeof originalSetTimeout === 'function') root.setTimeout = function () { calls.setTimeout++; return originalSetTimeout.apply(this, arguments); };
      if (typeof originalSetInterval === 'function') root.setInterval = function () { calls.setInterval++; return originalSetInterval.apply(this, arguments); };
      if (typeof originalRAF === 'function') root.requestAnimationFrame = function () { calls.requestAnimationFrame++; return originalRAF.apply(this, arguments); };
      try {
        mapper.map(makeMergedEvent({ kind: 'like', id: 'timer-check', timestamp: Date.now() }));
        mapper.getStats();
        mapper.clearStats();
      } finally {
        if (typeof originalSetTimeout === 'function') root.setTimeout = originalSetTimeout;
        if (typeof originalSetInterval === 'function') root.setInterval = originalSetInterval;
        if (typeof originalRAF === 'function') root.requestAnimationFrame = originalRAF;
      }
      var ok = calls.setTimeout === 0 && calls.setInterval === 0 && calls.requestAnimationFrame === 0;
      return { pass: ok, details: JSON.stringify(calls) };
    }));

    mapper.clearStats(); // leave the shared singleton clean for anything run after this
  }

  // ---- Steg 8: Recognition Card UI cases --------------------------------------------
  //
  // Card is the one Recognition Engine file that needs a real DOM — there is no meaningful
  // DOM-free logic to verify headlessly (unlike every earlier stage). Every case below checks
  // hasDom() first and reports a clear "skipped: no DOM" soft-pass under Node, then runs its
  // real assertions in the browser. Two required checks (#40/#41: media.js/studio.html
  // untouched) are repo-level, not JS-testable, and are confirmed separately via `git status`
  // in the final report. Two more (#42/#43: demo works standalone / no console errors on every
  // demo button) are verified directly against recognition-card-demo.html in the browser, not
  // through this shared harness, since that demo is a separate page this file never loads.

  function runCardCases(results) {
    var card = getCard();
    var mapper = getMapper();

    function mapModel(overrides) {
      var event = makeMergedEvent(overrides);
      var result = mapper.map(event);
      if (result.status !== 'mapped') throw new Error('test setup: mapModel() could not map ' + JSON.stringify(overrides) + ' -> ' + result.reason);
      return result.model;
    }

    function freshMount() {
      card.destroy();
      var container = document.createElement('div');
      container.id = 'vyra-recognition-test-stage';
      document.body.appendChild(container);
      card.mount(container);
      return container;
    }

    function teardown(container) {
      card.destroy();
      if (container && container.parentNode) container.parentNode.removeChild(container);
    }

    function skip(reason) {
      return { pass: true, details: 'skipped: ' + (reason || 'no DOM in this environment') };
    }

    results.push(runCase('Card 1. mount med HTMLElement', function () {
      if (!hasDom()) return skip();
      card.destroy();
      var container = document.createElement('div');
      document.body.appendChild(container);
      var r = card.mount(container);
      var ok = r.status === 'mounted' && !!card.getElement() && card.getElement().parentNode === container;
      teardown(container);
      return { pass: ok, details: JSON.stringify(r) };
    }));

    results.push(runCase('Card 2. mount med selector', function () {
      if (!hasDom()) return skip();
      card.destroy();
      var container = document.createElement('div');
      container.id = 'vyra-recognition-selector-target';
      document.body.appendChild(container);
      var r = card.mount('#vyra-recognition-selector-target');
      var ok = r.status === 'mounted' && card.getElement().parentNode === container;
      teardown(container);
      return { pass: ok, details: JSON.stringify(r) };
    }));

    results.push(runCase('Card 3. Ogiltig target rejected', function () {
      if (!hasDom()) return skip();
      card.destroy();
      var r1 = card.mount('#this-selector-matches-nothing');
      var r2 = card.mount(42);
      var r3 = card.mount(null);
      var ok = r1.status === 'rejected' && r2.status === 'rejected' && r3.status === 'rejected';
      return { pass: ok, details: JSON.stringify({ r1: r1, r2: r2, r3: r3 }) };
    }));

    results.push(runCase('Card 4. show join', function () {
      if (!hasDom()) return skip();
      var container = freshMount();
      var r = card.show(mapModel({ kind: 'join' }));
      var ok = r.status === 'shown' && card.getState().phase === 'entering' && card.getState().currentModel.kind === 'join';
      teardown(container);
      return { pass: ok, details: JSON.stringify(r) };
    }));

    results.push(runCase('Card 5. show like', function () {
      if (!hasDom()) return skip();
      var container = freshMount();
      var r = card.show(mapModel({ kind: 'like', count: 5 }));
      var ok = r.status === 'shown' && card.getState().currentModel.kind === 'like';
      teardown(container);
      return { pass: ok, details: JSON.stringify(r) };
    }));

    results.push(runCase('Card 6. show share', function () {
      if (!hasDom()) return skip();
      var container = freshMount();
      var r = card.show(mapModel({ kind: 'share' }));
      var ok = r.status === 'shown' && card.getState().currentModel.kind === 'share';
      teardown(container);
      return { pass: ok, details: JSON.stringify(r) };
    }));

    results.push(runCase('Card 7. show follow', function () {
      if (!hasDom()) return skip();
      var container = freshMount();
      var r = card.show(mapModel({ kind: 'follow' }));
      var ok = r.status === 'shown' && card.getState().currentModel.kind === 'follow';
      teardown(container);
      return { pass: ok, details: JSON.stringify(r) };
    }));

    results.push(runCase('Card 8. show small gift', function () {
      if (!hasDom()) return skip();
      var container = freshMount();
      var r = card.show(mapModel({ kind: 'gift', gift: { id: 'g8', name: 'Rose', imageUrl: null }, coins: 10 }));
      var ok = r.status === 'shown' && card.getState().currentModel.gift.tier === 'small';
      teardown(container);
      return { pass: ok, details: JSON.stringify(r) };
    }));

    results.push(runCase('Card 9. show medium gift', function () {
      if (!hasDom()) return skip();
      var container = freshMount();
      var r = card.show(mapModel({ kind: 'gift', gift: { id: 'g9', name: 'Galaxy', imageUrl: null }, coins: 500 }));
      var ok = r.status === 'shown' && card.getState().currentModel.gift.tier === 'medium';
      teardown(container);
      return { pass: ok, details: JSON.stringify(r) };
    }));

    results.push(runCase('Card 10. show large gift', function () {
      if (!hasDom()) return skip();
      var container = freshMount();
      var r = card.show(mapModel({ kind: 'gift', gift: { id: 'g10', name: 'Universe', imageUrl: null }, coins: 5000 }));
      var ok = r.status === 'shown' && card.getState().currentModel.gift.tier === 'large';
      teardown(container);
      return { pass: ok, details: JSON.stringify(r) };
    }));

    results.push(runCase('Card 11. Ratt variantklass anvands', function () {
      if (!hasDom()) return skip();
      var container = freshMount();
      card.show(mapModel({ kind: 'gift', gift: { id: 'g11', name: 'Universe', imageUrl: null }, coins: 5000 }));
      var el = card.getElement().querySelector('.vyra-recognition-card');
      var ok = !!el && el.classList.contains('vyra-recognition-variant-gift-legendary');
      teardown(container);
      return { pass: ok, details: 'className=' + (el && el.className) };
    }));

    results.push(runCase('Card 12. Avatar ar cirkular', function () {
      if (!hasDom()) return skip();
      var container = freshMount();
      card.show(mapModel({ kind: 'join' }));
      var frame = card.getElement().querySelector('.vyra-recognition-avatar-frame');
      var radius = frame ? getComputedStyle(frame).borderRadius : '';
      var ok = !!frame && (radius.indexOf('50%') !== -1 || parseFloat(radius) > 0);
      teardown(container);
      return { pass: ok, details: 'borderRadius=' + radius };
    }));

    results.push(runCase('Card 13. Giftbild renderas separat', function () {
      if (!hasDom()) return skip();
      var container = freshMount();
      card.show(mapModel({ kind: 'gift', gift: { id: 'g13', name: 'Rose', imageUrl: null }, coins: 10 }));
      var avatarFrame = card.getElement().querySelector('.vyra-recognition-avatar-frame');
      var giftFrame = card.getElement().querySelector('.vyra-recognition-gift-frame');
      var ok = !!avatarFrame && !!giftFrame && avatarFrame !== giftFrame;
      teardown(container);
      return { pass: ok, details: 'avatarFrame=' + !!avatarFrame + ' giftFrame=' + !!giftFrame };
    }));

    results.push(runCase('Card 14. Avatarfallback fungerar', function () {
      if (!hasDom()) return skip();
      var container = freshMount();
      card.show(mapModel({ kind: 'join', actor: { avatarUrl: null } }));
      var frame = card.getElement().querySelector('.vyra-recognition-avatar-frame');
      var ok = !!frame && frame.classList.contains('vyra-recognition-avatar-fallback') && !frame.querySelector('img');
      teardown(container);
      return { pass: ok, details: 'className=' + (frame && frame.className) };
    }));

    results.push(runCase('Card 15. Giftfallback fungerar', function () {
      if (!hasDom()) return skip();
      var container = freshMount();
      card.show(mapModel({ kind: 'gift', gift: { id: 'g15', name: 'Rose', imageUrl: null }, coins: 10 }));
      var frame = card.getElement().querySelector('.vyra-recognition-gift-frame');
      var ok = !!frame && frame.classList.contains('vyra-recognition-gift-fallback') && !frame.querySelector('img');
      teardown(container);
      return { pass: ok, details: 'className=' + (frame && frame.className) };
    }));

    results.push(runCase('Card 16. Ogiltig avatar-URL ignoreras', function () {
      if (!hasDom()) return skip();
      var container = freshMount();
      card.show(mapModel({ kind: 'join', actor: { avatarUrl: 'javascript:alert(1)' } }));
      var frame = card.getElement().querySelector('.vyra-recognition-avatar-frame');
      var ok = !!frame && !frame.querySelector('img') && frame.classList.contains('vyra-recognition-avatar-fallback');
      teardown(container);
      return { pass: ok, details: 'className=' + (frame && frame.className) };
    }));

    results.push(runCase('Card 17. Ogiltig gift-URL ignoreras', function () {
      if (!hasDom()) return skip();
      var container = freshMount();
      card.show(mapModel({ kind: 'gift', gift: { id: 'g17', name: 'Rose', imageUrl: 'javascript:alert(1)' }, coins: 10 }));
      var frame = card.getElement().querySelector('.vyra-recognition-gift-frame');
      var ok = !!frame && !frame.querySelector('img') && frame.classList.contains('vyra-recognition-gift-fallback');
      teardown(container);
      return { pass: ok, details: 'className=' + (frame && frame.className) };
    }));

    results.push(runCase('Card 18. Text renderas med textContent', function () {
      if (!hasDom()) return skip();
      var container = freshMount();
      var dangerous = '<b>XSS</b><img src=x onerror=alert(1)>';
      card.show(mapModel({ kind: 'join', actor: { displayName: dangerous } }));
      var titleEl = card.getElement().querySelector('.vyra-recognition-title');
      var ok = !!titleEl && titleEl.textContent === dangerous && !titleEl.querySelector('b') && !titleEl.querySelector('img');
      teardown(container);
      return { pass: ok, details: 'textContent=' + (titleEl && titleEl.textContent) + ' innerHTML=' + (titleEl && titleEl.innerHTML) };
    }));

    results.push(runCase('Card 19. Aria-label anvands', function () {
      if (!hasDom()) return skip();
      var container = freshMount();
      var model = mapModel({ kind: 'join', actor: { displayName: 'David' } });
      card.show(model);
      var el = card.getElement().querySelector('.vyra-recognition-card');
      var ok = !!el && el.getAttribute('aria-label') === model.accessibility.ariaLabel;
      teardown(container);
      return { pass: ok, details: 'aria-label=' + (el && el.getAttribute('aria-label')) };
    }));

    results.push(runCase('Card 20. role=status finns', function () {
      if (!hasDom()) return skip();
      var container = freshMount();
      card.show(mapModel({ kind: 'join' }));
      var el = card.getElement().querySelector('.vyra-recognition-card');
      var ok = !!el && el.getAttribute('role') === 'status';
      teardown(container);
      return { pass: ok, details: 'role=' + (el && el.getAttribute('role')) };
    }));

    results.push(runCase('Card 21. aria-live=polite finns', function () {
      if (!hasDom()) return skip();
      var container = freshMount();
      card.show(mapModel({ kind: 'join' }));
      var el = card.getElement().querySelector('.vyra-recognition-card');
      var ok = !!el && el.getAttribute('aria-live') === 'polite';
      teardown(container);
      return { pass: ok, details: 'aria-live=' + (el && el.getAttribute('aria-live')) };
    }));

    results.push(runCase('Card 22. update andrar modellen', function () {
      if (!hasDom()) return skip();
      var container = freshMount();
      card.show(mapModel({ kind: 'like', count: 5 }));
      var r = card.update(mapModel({ kind: 'like', count: 999 }));
      var countEl = card.getElement().querySelector('.vyra-recognition-count-label');
      var ok = r.status === 'updated' && !!countEl && countEl.textContent === '×999';
      teardown(container);
      return { pass: ok, details: JSON.stringify(r) + ' countText=' + (countEl && countEl.textContent) };
    }));

    results.push(runCase('Card 23. update aterskapar inte root', function () {
      if (!hasDom()) return skip();
      var container = freshMount();
      card.show(mapModel({ kind: 'like', count: 5 }));
      var elBefore = card.getElement().querySelector('.vyra-recognition-card');
      card.update(mapModel({ kind: 'like', count: 999 }));
      var elAfter = card.getElement().querySelector('.vyra-recognition-card');
      var ok = elBefore === elAfter;
      teardown(container);
      return { pass: ok, details: 'sameElement=' + ok };
    }));

    results.push(runCase('Card 24. hide gar till exiting', function () {
      if (!hasDom()) return skip();
      var container = freshMount();
      card.show(mapModel({ kind: 'join' }));
      card.hide('test');
      var ok = card.getState().phase === 'exiting';
      teardown(container);
      return { pass: ok, details: JSON.stringify(card.getState()) };
    }));

    results.push(runCase('Card 25. exit slutar i idle', function () {
      if (!hasDom()) return Promise.resolve(skip());
      var container = freshMount();
      card.show(mapModel({ kind: 'join' }));
      card.hide('test');
      return wait(500).then(function () {
        var state = card.getState();
        var el = card.getElement().querySelector('.vyra-recognition-card');
        var ok = state.phase === 'idle' && state.currentModel === null && !el;
        teardown(container);
        return { pass: ok, details: JSON.stringify(state) + ' elRemains=' + !!el };
      });
    }));

    results.push(runCase('Card 26. show under aktivt kort ger replace', function () {
      if (!hasDom()) return skip();
      var container = freshMount();
      card.show(mapModel({ kind: 'join' }));
      var r = card.show(mapModel({ kind: 'like', count: 3 }));
      var ok = r.status === 'replaced';
      teardown(container);
      return { pass: ok, details: JSON.stringify(r) };
    }));

    results.push(runCase('Card 27. Gamla timers paverkar inte nytt kort', function () {
      if (!hasDom()) return Promise.resolve(skip());
      var container = freshMount();
      card.show(mapModel({ kind: 'join', actor: { id: 'old-actor' } }));
      // replace almost immediately, well before the first card's own enter sequence would
      // have finished — its now-stale timers must never touch state again
      card.show(mapModel({ kind: 'like', actor: { id: 'new-actor' }, count: 7 }));
      return wait(900).then(function () {
        var state = card.getState();
        var ok = state.phase === 'visible' && state.currentModel.actor.id === 'new-actor' && state.currentModel.kind === 'like';
        teardown(container);
        return { pass: ok, details: JSON.stringify(state) };
      });
    }));

    results.push(runCase('Card 28. destroy tar bort DOM', function () {
      if (!hasDom()) return skip();
      card.destroy();
      var container = document.createElement('div');
      document.body.appendChild(container);
      card.mount(container);
      card.show(mapModel({ kind: 'join' }));
      var r = card.destroy();
      var ok = r.status === 'destroyed' && container.children.length === 0;
      if (container.parentNode) container.parentNode.removeChild(container);
      return { pass: ok, details: JSON.stringify(r) + ' childCount=' + container.children.length };
    }));

    results.push(runCase('Card 29. destroy rensar timers', function () {
      if (!hasDom()) return Promise.resolve(skip());
      var container = document.createElement('div');
      document.body.appendChild(container);
      card.destroy();
      card.mount(container);
      var events = [];
      var unsub = card.subscribe(function (e) { events.push(e); });
      card.show(mapModel({ kind: 'join' })); // starts phase timers
      card.destroy(); // must clear them before they fire
      return wait(900).then(function () {
        unsub();
        var ok = !events.some(function (e) { return e.type === 'enter-complete'; });
        if (container.parentNode) container.parentNode.removeChild(container);
        return { pass: ok, details: JSON.stringify(events.map(function (e) { return e.type; })) };
      });
    }));

    results.push(runCase('Card 30. Upprepad destroy ar saker', function () {
      if (!hasDom()) return skip();
      card.destroy();
      var r1 = card.destroy();
      var r2 = card.destroy();
      var ok = r1.status === 'destroyed' && r2.status === 'destroyed';
      return { pass: ok, details: JSON.stringify({ r1: r1, r2: r2 }) };
    }));

    results.push(runCase('Card 31. Upprepad hide ar saker', function () {
      if (!hasDom()) return skip();
      var container = freshMount();
      var r1 = card.hide();
      var r2 = card.hide();
      var ok = r1.status === 'hidden' && r2.status === 'hidden';
      teardown(container);
      return { pass: ok, details: JSON.stringify({ r1: r1, r2: r2 }) };
    }));

    results.push(runCase('Card 32. getState returnerar kopia', function () {
      if (!hasDom()) return skip();
      var container = freshMount();
      card.show(mapModel({ kind: 'join' }));
      var snapshot = card.getState();
      snapshot.phase = 'tampered';
      snapshot.currentModel.kind = 'tampered';
      var again = card.getState();
      var ok = again.phase !== 'tampered' && again.currentModel.kind !== 'tampered';
      teardown(container);
      return { pass: ok, details: JSON.stringify({ mutatedSnapshot: snapshot, freshRead: again }) };
    }));

    results.push(runCase('Card 33. getElement returnerar root', function () {
      if (!hasDom()) return skip();
      var container = freshMount();
      var el = card.getElement();
      var ok = !!el && el.classList.contains('vyra-recognition-root') && el.parentNode === container;
      teardown(container);
      return { pass: ok, details: 'className=' + (el && el.className) };
    }));

    results.push(runCase('Card 34. Subscriber far show-event', function () {
      if (!hasDom()) return skip();
      var container = freshMount();
      var events = [];
      var unsub = card.subscribe(function (e) { events.push(e); });
      card.show(mapModel({ kind: 'join' }));
      unsub();
      var ok = events.some(function (e) { return e.type === 'show'; });
      teardown(container);
      return { pass: ok, details: JSON.stringify(events.map(function (e) { return e.type; })) };
    }));

    results.push(runCase('Card 35. Subscriber far hide-event', function () {
      if (!hasDom()) return skip();
      var container = freshMount();
      var events = [];
      var unsub = card.subscribe(function (e) { events.push(e); });
      card.show(mapModel({ kind: 'join' }));
      card.hide('reason-35');
      unsub();
      var ok = events.some(function (e) { return e.type === 'hide' && e.reason === 'reason-35'; });
      teardown(container);
      return { pass: ok, details: JSON.stringify(events) };
    }));

    results.push(runCase('Card 36. Subscriber-fel stoppar inte nasta subscriber', function () {
      if (!hasDom()) return skip();
      var container = freshMount();
      var secondCalled = false;
      var unsub1 = card.subscribe(function () { throw new Error('boom'); });
      var unsub2 = card.subscribe(function () { secondCalled = true; });
      card.show(mapModel({ kind: 'join' }));
      unsub1();
      unsub2();
      teardown(container);
      return { pass: secondCalled === true, details: 'secondCalled=' + secondCalled };
    }));

    results.push(runCase('Card 37. reduced-motion stods', function () {
      if (!hasDom() || !root.matchMedia) return Promise.resolve(skip(!hasDom() ? 'no DOM' : 'no matchMedia'));
      var container = freshMount();
      var originalMatchMedia = root.matchMedia;
      root.matchMedia = function (query) {
        if (String(query).indexOf('prefers-reduced-motion') !== -1) return { matches: true, media: query, addListener: function () {}, removeListener: function () {} };
        return originalMatchMedia.call(root, query);
      };
      var events = [];
      var unsub = card.subscribe(function (e) { events.push(e); });
      card.show(mapModel({ kind: 'join' }));
      return wait(150).then(function () {
        root.matchMedia = originalMatchMedia;
        unsub();
        var ok = card.getState().phase === 'visible' && events.some(function (e) { return e.type === 'enter-complete'; });
        teardown(container);
        return { pass: ok, details: 'phase=' + card.getState().phase + ' events=' + JSON.stringify(events.map(function (e) { return e.type; })) };
      });
    }));

    results.push(runCase('Card 38. Inga globala CSS-selectors paverkas', function () {
      if (!hasDom()) return skip();
      var sheet = findCardStylesheet();
      if (!sheet) return { pass: false, details: 'recognition-card.css stylesheet not found in document.styleSheets' };
      var offenders = [];
      try {
        Array.prototype.forEach.call(sheet.cssRules, function (rule) {
          if (!rule.selectorText) return;
          rule.selectorText.split(',').forEach(function (part) {
            var trimmed = part.trim().toLowerCase();
            if (['body', 'html', 'button', 'img', '*', 'a', 'input', 'div', 'span', 'p'].indexOf(trimmed) !== -1) {
              offenders.push(trimmed);
            }
          });
        });
      } catch (err) {
        return { pass: false, details: 'could not read cssRules: ' + err.message };
      }
      return { pass: offenders.length === 0, details: 'offenders=' + JSON.stringify(offenders) };
    }));

    results.push(runCase('Card 39. Inga externa fonts laddas', function () {
      if (!hasDom()) return skip();
      var sheet = findCardStylesheet();
      if (!sheet) return { pass: false, details: 'recognition-card.css stylesheet not found in document.styleSheets' };
      var fontFaceCount = 0;
      try {
        Array.prototype.forEach.call(sheet.cssRules, function (rule) {
          if (typeof CSSFontFaceRule !== 'undefined' && rule instanceof CSSFontFaceRule) fontFaceCount++;
        });
      } catch (err) {
        return { pass: false, details: 'could not read cssRules: ' + err.message };
      }
      var container = freshMount();
      card.show(mapModel({ kind: 'join' }));
      var cardEl = card.getElement().querySelector('.vyra-recognition-card');
      var fontFamily = cardEl ? getComputedStyle(cardEl).fontFamily : '';
      teardown(container);
      var ok = fontFaceCount === 0 && fontFamily.toLowerCase().indexOf('-apple-system') !== -1;
      return { pass: ok, details: 'fontFaceCount=' + fontFaceCount + ' fontFamily=' + fontFamily };
    }));

    results.push(runCase('Card 44. Lang displayName bryter inte layout', function () {
      if (!hasDom()) return skip();
      var container = freshMount();
      var longName = 'A'.repeat(80);
      card.show(mapModel({ kind: 'join', actor: { displayName: longName } }));
      var cardEl = card.getElement().querySelector('.vyra-recognition-card');
      var titleEl = card.getElement().querySelector('.vyra-recognition-title');
      var cardWidth = cardEl.getBoundingClientRect().width;
      var overflowStyle = titleEl ? getComputedStyle(titleEl).textOverflow : '';
      var ok = cardWidth <= 410 && overflowStyle === 'ellipsis';
      teardown(container);
      return { pass: ok, details: 'cardWidth=' + cardWidth + ' textOverflow=' + overflowStyle };
    }));

    results.push(runCase('Card 45. Lang giftName bryter inte layout', function () {
      if (!hasDom()) return skip();
      var container = freshMount();
      var longGiftName = 'B'.repeat(80);
      card.show(mapModel({ kind: 'gift', gift: { id: 'g45', name: longGiftName, imageUrl: null }, coins: 10 }));
      var cardEl = card.getElement().querySelector('.vyra-recognition-card');
      var subtitleEl = card.getElement().querySelector('.vyra-recognition-subtitle');
      var cardWidth = cardEl.getBoundingClientRect().width;
      var overflowStyle = subtitleEl ? getComputedStyle(subtitleEl).textOverflow : '';
      var ok = cardWidth <= 410 && overflowStyle === 'ellipsis';
      teardown(container);
      return { pass: ok, details: 'cardWidth=' + cardWidth + ' textOverflow=' + overflowStyle };
    }));

    card.destroy(); // leave the shared singleton clean for anything run after this
  }

  function findCardStylesheet() {
    for (var i = 0; i < document.styleSheets.length; i++) {
      var sheet = document.styleSheets[i];
      try {
        if (sheet.href && sheet.href.indexOf('recognition-card.css') !== -1) return sheet;
      } catch (err) { /* cross-origin sheet, skip */ }
    }
    return null;
  }

  // Returns a Promise<Array<{name, pass, details}>>. `caseThunks` collects the deferred thunks
  // runCase() produces; they are invoked one at a time via reduce, each awaited to completion
  // (including any real wait()) before the next one starts — strict serial order, required
  // because every stage's singleton is shared mutable state across all of that stage's cases.
  function run() {
    var caseThunks = [];
    runNormalizerCases(caseThunks);
    runMergeCases(caseThunks);
    runQueueCases(caseThunks);
    runControllerCases(caseThunks);
    runMapperCases(caseThunks);
    runCardCases(caseThunks);

    var output = [];
    return caseThunks.reduce(function (chain, thunk) {
      return chain.then(function () { return thunk(); }).then(function (result) { output.push(result); });
    }, Promise.resolve()).then(function () { return output; });
  }

  var api = { run: run };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.VyraRecognitionVerify = api;
})(typeof window !== 'undefined' ? window : globalThis);

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

  function makeResult(name, pass, details) {
    return { name: name, pass: !!pass, details: details || '' };
  }

  function runCase(name, fn) {
    try {
      var outcome = fn();
      return makeResult(name, outcome.pass, outcome.details);
    } catch (err) {
      return makeResult(name, false, 'threw: ' + (err && err.message ? err.message : String(err)));
    }
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

  function run() {
    var results = [];
    runNormalizerCases(results);
    runMergeCases(results);
    return results;
  }

  var api = { run: run };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.VyraRecognitionVerify = api;
})(typeof window !== 'undefined' ? window : globalThis);

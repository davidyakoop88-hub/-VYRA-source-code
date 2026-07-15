// Connects to a real TikTok LIVE room (via the unofficial tiktok-live-connector library — TikTok has
// no public API for this) and forwards events into VYRA's existing local server (server.ps1) using the
// exact same /api/connect and /api/events endpoints the "Testa gåva" demo button already uses. That
// means every existing consumer of live events — live-client.js's poll loop, Action & Event rules,
// battle-widget routing — works unchanged; this script's only job is to be a real event *source*.
//
// Usage:
//   cd tiktok-bridge
//   npm install
//   node bridge.js <tiktok_username_without_@>
//
// Optional environment variables:
//   VYRA_SERVER_URL   default http://127.0.0.1:4173 — where server.ps1 is listening
'use strict';

const { TikTokLiveConnection, WebcastEvent } = require('tiktok-live-connector');

const username = process.argv[2];
if (!username) {
  console.error('Usage: node bridge.js <tiktok_username_without_@>');
  process.exit(1);
}

const SERVER = process.env.VYRA_SERVER_URL || 'http://127.0.0.1:4173';
const RECONNECT_DELAY_MS = 10_000;

async function postJson(path, body) {
  try {
    const res = await fetch(SERVER + path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    if (!res.ok) console.error(`[bridge] ${path} -> HTTP ${res.status}`);
  } catch (err) {
    console.error(`[bridge] Kunde inte nå VYRA-servern på ${SERVER} (${path}):`, err.message);
  }
}

function sendEvent(type, fields) {
  return postJson('/api/events', { type, ...fields });
}

function profileImageOf(user) {
  return user?.profilePicture?.urls?.[0] || user?.avatarThumb?.urlListList?.[0] || '';
}

function connect() {
  const connection = new TikTokLiveConnection(username, {});

  connection.on(WebcastEvent.CHAT, data => {
    const comment = data.comment || '';
    sendEvent(comment.trim().startsWith('!') ? 'chatcommand' : 'chat', {
      username: data.user?.uniqueId || '',
      name: comment,
      profileImage: profileImageOf(data.user)
    });
  });

  connection.on(WebcastEvent.GIFT, data => {
    const coinsEach = data.giftDetails?.diamondCount ?? data.diamondCount ?? 0;
    const repeatCount = data.repeatCount || 1;
    sendEvent('gift', {
      username: data.user?.uniqueId || '',
      name: data.user?.nickname || data.user?.uniqueId || '',
      profileImage: profileImageOf(data.user),
      giftName: data.giftDetails?.giftName || data.giftName || 'Gift',
      coins: coinsEach * repeatCount,
      count: repeatCount
    });
  });

  connection.on(WebcastEvent.FOLLOW, data => {
    sendEvent('follow', {
      username: data.user?.uniqueId || '',
      name: data.user?.nickname || data.user?.uniqueId || '',
      profileImage: profileImageOf(data.user)
    });
  });

  connection.on(WebcastEvent.SHARE, data => {
    sendEvent('share', {
      username: data.user?.uniqueId || '',
      name: data.user?.nickname || data.user?.uniqueId || '',
      profileImage: profileImageOf(data.user)
    });
  });

  connection.on(WebcastEvent.MEMBER, data => {
    sendEvent('member', {
      username: data.user?.uniqueId || '',
      name: data.user?.nickname || data.user?.uniqueId || '',
      profileImage: profileImageOf(data.user)
    });
  });

  connection.on(WebcastEvent.LIKE, data => {
    sendEvent('likes', {
      username: data.user?.uniqueId || '',
      name: data.user?.nickname || data.user?.uniqueId || '',
      profileImage: profileImageOf(data.user),
      count: data.likeCount || 0,
      points: data.totalLikeCount || 0
    });
  });

  connection.on(WebcastEvent.DISCONNECTED, () => {
    console.log('[bridge] Frånkopplad från TikTok LIVE, försöker igen om 10s...');
    postJson('/api/disconnect', {});
    setTimeout(connect, RECONNECT_DELAY_MS);
  });

  connection.on(WebcastEvent.ERROR, err => {
    console.error('[bridge] Anslutningsfel:', err?.message || err);
  });

  connection.connect()
    .then(state => {
      console.log(`[bridge] Ansluten till @${username} (room ${state.roomId}). Vidarebefordrar events till ${SERVER}`);
      postJson('/api/connect', { username });
    })
    .catch(err => {
      console.error(`[bridge] Kunde inte ansluta till @${username}:`, err?.message || err);
      console.log(`[bridge] Är ${username} live just nu? Försöker igen om 10s...`);
      setTimeout(connect, RECONNECT_DELAY_MS);
    });
}

connect();

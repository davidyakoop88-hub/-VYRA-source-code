(function () {
  if (window.__vyraLiveBooted) return;
  window.__vyraLiveBooted = true;

  const API = '/api';
  const listeners = new Set();
  const POLL_ACTIVE_MS = 1500;
  const POLL_HIDDEN_MS = 6000;
  const POLL_ERROR_MS = 4000;
  const LEADER_KEY = 'vyra-live-poll-leader';
  const LEADER_TTL_MS = 5000;
  const FIRST_ACTIVITY_KEY = 'vyra-live-first-activity-users';
  const FIRST_ACTIVITY_TTL_MS = 12 * 60 * 60 * 1000;
  const FIRST_ACTIVITY_LIMIT = 500;

  let last = Number(sessionStorage.getItem('vyra-last-live-event') || 0);
  let online = false;
  let pollTimer = null;
  let pollInFlight = false;
  const tabId = sessionStorage.getItem('vyra-live-tab-id') || ('tab-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8));

  sessionStorage.setItem('vyra-live-tab-id', tabId);

  async function json(url, options) {
    const response = await fetch(API + url, {
      cache: 'no-store',
      headers: { 'Content-Type': 'application/json' },
      ...options
    });
    if (!response.ok) throw Error('Serverfel ' + response.status);
    return response.json();
  }

  function emit(name, detail) {
    dispatchEvent(new CustomEvent(name, { detail }));
    listeners.forEach(fn => fn(detail));
  }

  function readLeader() {
    try {
      return JSON.parse(localStorage.getItem(LEADER_KEY) || 'null');
    } catch {
      return null;
    }
  }

  function writeLeader() {
    localStorage.setItem(LEADER_KEY, JSON.stringify({ tabId, at: Date.now() }));
  }

  function leaderIsFresh(leader) {
    return !!leader && Date.now() - Number(leader.at || 0) < LEADER_TTL_MS;
  }

  function isPollLeader() {
    const leader = readLeader();
    return !!leader && leader.tabId === tabId && leaderIsFresh(leader);
  }

  function claimLeadership() {
    const leader = readLeader();
    if (!leaderIsFresh(leader) || leader?.tabId === tabId || document.visibilityState === 'visible') {
      writeLeader();
    }
    return isPollLeader();
  }

  function nextPollDelay(failed) {
    if (failed) return POLL_ERROR_MS;
    return document.visibilityState === 'hidden' ? POLL_HIDDEN_MS : POLL_ACTIVE_MS;
  }

  function schedulePoll(delay) {
    clearTimeout(pollTimer);
    pollTimer = setTimeout(poll, delay);
  }

  function liveUserKey(event) {
    const raw = String(event?.userId || event?.username || event?.name || '').trim().replace(/^@/, '').toLowerCase();
    return raw || '';
  }

  function readFirstActivityCache() {
    try {
      const parsed = JSON.parse(localStorage.getItem(FIRST_ACTIVITY_KEY) || '{"users":[],"updatedAt":0}');
      if (!Array.isArray(parsed.users)) return { users: [], updatedAt: 0 };
      if (Date.now() - Number(parsed.updatedAt || 0) > FIRST_ACTIVITY_TTL_MS) return { users: [], updatedAt: 0 };
      return {
        users: parsed.users
          .map(value => String(value || '').trim().toLowerCase())
          .filter(Boolean)
          .slice(-FIRST_ACTIVITY_LIMIT),
        updatedAt: Number(parsed.updatedAt || 0)
      };
    } catch {
      return { users: [], updatedAt: 0 };
    }
  }

  function writeFirstActivityCache(users) {
    try {
      localStorage.setItem(FIRST_ACTIVITY_KEY, JSON.stringify({
        users: users.slice(-FIRST_ACTIVITY_LIMIT),
        updatedAt: Date.now()
      }));
    } catch {}
  }

  function consumeFirstActivity(event, payload) {
    const userKey = liveUserKey(event);
    if (!userKey) return [];
    const cache = readFirstActivityCache();
    if (cache.users.includes(userKey)) return [];
    cache.users.push(userKey);
    writeFirstActivityCache(cache.users);
    return [['firstActivity', payload]];
  }

  async function status() {
    try {
      const data = await json('/status');
      if (!online) {
        online = true;
        emit('vyra-server-status', data);
      }
      return data;
    } catch (error) {
      if (online) {
        online = false;
        emit('vyra-server-offline', { error: error.message });
      }
      throw error;
    }
  }

  function liveEventTriggers(event) {
    const type = String(event.type || '').toLowerCase();
    const payload = {
      username: event.username,
      name: event.name || event.username,
      gift: event.giftName,
      giftname: event.giftName,
      profileImage: event.profileImage,
      coins: event.coins,
      count: event.count,
      repeatcount: event.count,
      combo: event.count,
      value: event.name || event.giftName || event.username
    };
    const firstActivity = consumeFirstActivity(event, payload);

    if (type === 'gift') {
      const triggers = [[event.count > 1 ? 'giftCombo' : 'gift', payload]];
      const coinValue = Number(event.coins ?? event.value ?? 0);
      if (coinValue > 0) triggers.unshift(['giftCoins', { ...payload, value: coinValue, coins: coinValue }]);
      return [...firstActivity, ...triggers];
    }
    if (type === 'follow') return [...firstActivity, ['follow', payload]];
    if (type === 'member' || type === 'subscribe') return [...firstActivity, ['member', payload], ['join', payload]];
    if (type === 'share') return [...firstActivity, ['share', payload]];
    if (type === 'likes' || type === 'like') return [...firstActivity, ['likes', { ...payload, value: event.count }]];
    if (type === 'chatcommand') return [...firstActivity, ['chatCommand', { ...payload, command: event.name, value: event.name }]];
    if (type === 'chat') return [...firstActivity, ['chat', { ...payload, comment: event.name, value: event.name }]];
    return [];
  }

  async function poll() {
    if (pollInFlight) return;
    if (!claimLeadership()) {
      schedulePoll(nextPollDelay(false));
      return;
    }
    pollInFlight = true;

    let failed = false;
    try {
      writeLeader();
      const data = await json('/events?after=' + last);
      for (const event of data.events || []) {
        last = Math.max(last, event.id || 0);
        sessionStorage.setItem('vyra-last-live-event', last);
        localStorage.setItem('vyra-live-event', JSON.stringify(event));
        emit('vyra-live-event', event);
        if (typeof routeLiveBattleEvent === 'function') routeLiveBattleEvent(event);
        const mapped = liveEventTriggers(event);
        if (mapped.length && window.VyraActionEvent) {
          mapped.forEach(entry => {
            const [trigger, payload] = entry;
            window.VyraActionEvent.handleEvent(trigger, payload);
          });
        }
      }
    } catch {
      failed = true;
    } finally {
      pollInFlight = false;
      schedulePoll(nextPollDelay(failed));
    }
  }

  document.addEventListener('visibilitychange', () => {
    if (!pollInFlight) {
      claimLeadership();
      schedulePoll(nextPollDelay(false));
    }
  });

  addEventListener('storage', event => {
    if (event.key === 'vyra-live-event' && event.newValue) {
      try {
        const payload = JSON.parse(event.newValue);
        last = Math.max(last, payload.id || 0);
        sessionStorage.setItem('vyra-last-live-event', last);
        emit('vyra-live-event', payload);
      } catch {}
    }
    if (event.key === LEADER_KEY && !pollInFlight) {
      schedulePoll(nextPollDelay(false));
    }
  });

  addEventListener('beforeunload', () => {
    if (isPollLeader()) localStorage.removeItem(LEADER_KEY);
  });

  window.VyraLive = {
    status,
    connect: username => json('/connect', { method: 'POST', body: JSON.stringify({ username }) }),
    disconnect: () => json('/disconnect', { method: 'POST', body: '{}' }),
    send: event => json('/events', { method: 'POST', body: JSON.stringify(event) }),
    on(fn) {
      listeners.add(fn);
      return () => listeners.delete(fn);
    }
  };

  status().catch(() => {});
  schedulePoll(0);
})();

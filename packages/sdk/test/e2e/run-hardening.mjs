// Hardening tests — security-critical + edge cases.
import { io } from 'socket.io-client';

const BASE = 'http://localhost:3001/chat';
const SOCKET_URL = 'http://localhost:3001';

const results = [];
let passCount = 0, failCount = 0;

function record(label, ok, detail = '') {
  results.push({ label, ok, detail });
  if (ok) { passCount++; console.log(`  ✓ ${label}`); }
  else { failCount++; console.log(`  ✗ ${label}  — ${detail}`); }
}

async function req(method, path, { token, body, query, headers: extra } = {}) {
  const url = new URL(BASE + path);
  if (query) for (const [k, v] of Object.entries(query)) if (v !== undefined) url.searchParams.set(k, String(v));
  const headers = { 'content-type': 'application/json', ...(extra || {}) };
  if (token) headers.authorization = `Bearer ${token}`;
  const r = await fetch(url, { method, headers, body: body ? JSON.stringify(body) : undefined });
  let parsed = null;
  const text = await r.text();
  try { parsed = text ? JSON.parse(text) : null; } catch { parsed = text; }
  return { status: r.status, body: parsed };
}

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

function collector(socket) {
  const received = new Map();
  socket.onAny((event, payload) => {
    if (!received.has(event)) received.set(event, []);
    received.get(event).push(payload);
  });
  return {
    has(event) { return received.has(event) && received.get(event).length > 0; },
    get(event) { return received.get(event) || []; },
    clear() { received.clear(); },
    async waitFor(event, timeoutMs = 2500) {
      const start = Date.now();
      while (Date.now() - start < timeoutMs) {
        if (this.has(event)) return this.get(event)[0];
        await sleep(50);
      }
      throw new Error(`timeout waiting for ${event}`);
    },
  };
}

async function login(email) {
  const r = await req('POST', '/auth/login', { body: { email, password: 'password' } });
  if (r.status >= 300) throw new Error(`login ${email} failed: ${r.status}`);
  return { email, id: r.body.user.id, token: r.body.token };
}

async function connectSocket(auth) {
  const s = io(SOCKET_URL + '/chat', { auth, transports: ['websocket'], forceNew: true });
  let err = null;
  let wasDisconnected = false;
  await new Promise((res) => {
    s.once('connect', () => res());
    s.once('connect_error', (e) => { err = e.message; res(); });
    setTimeout(() => { err = err || 'timeout'; res(); }, 2500);
  });
  // Wait a bit more to detect server-side disconnect after connect (auth rejection)
  await new Promise((res) => {
    s.once('disconnect', (reason) => { wasDisconnected = true; err = err || `disconnected: ${reason}`; res(); });
    setTimeout(res, 500);
  });
  return { socket: s, connected: s.connected && !wasDisconnected, err };
}

async function main() {
  const A = await login('alice@example.com');
  const B = await login('bob@example.com');
  const C = await login('charlie@example.com');
  console.log('Setup: A, B, C logged in\n');

  // =================================================================
  console.log('━━━ 3. SOCKET AUTH — impersonation must be blocked ━━━');
  // Attempt 1: bare userId, no token → must reject
  const asBob = await connectSocket({ userId: B.id, tenantId: 'default' });
  record('Socket rejects bare userId (no token)', !asBob.connected, asBob.connected ? '🚨 IMPERSONATION still possible' : '');
  if (asBob.connected) asBob.socket.close();

  // Attempt 2: no auth → reject
  const noAuth = await connectSocket({});
  record('Socket rejects empty auth', !noAuth.connected, noAuth.connected ? '🚨 anonymous connections accepted' : '');
  if (noAuth.connected) noAuth.socket.close();

  // Attempt 3: bogus token → reject
  const bogusToken = await connectSocket({ token: 'garbage.jwt.here' });
  record('Socket rejects garbage token', !bogusToken.connected, bogusToken.connected ? '🚨 invalid token accepted' : '');
  if (bogusToken.connected) bogusToken.socket.close();

  // Attempt 4: real token → accept + only receives own events
  const real = await connectSocket({ token: B.token });
  record('Socket accepts valid JWT token', real.connected, real.err || '');
  if (real.connected) {
    // Connect as Alice too, send private message to Bob, verify only real-Bob receives it
    const alice = await connectSocket({ token: A.token });
    const colB = collector(real.socket);
    const dc = await req('POST', '/channels/direct', { token: A.token, body: { userId: B.id } });
    const cid = dc.body.id;
    real.socket.emit('chat:join:channel', { channelId: cid });
    await sleep(200);
    colB.clear();
    await req('POST', `/channels/${cid}/messages`, { token: A.token, body: { text: 'secret to real Bob' } });
    await sleep(400);
    record('authenticated Bob socket receives own message', colB.has('chat:message:received'));
    real.socket.close();
    if (alice.connected) alice.socket.close();
    await req('DELETE', `/channels/${cid}`, { token: A.token });
  }

  // =================================================================
  console.log('\n━━━ 2. MUTE/BAN auto-expire ━━━');
  const g = await req('POST', '/channels/group', { token: A.token, body: { userIds: [B.id, C.id], name: 'expire test' } });
  const gid = g.body.id;

  // Mute B for 2 seconds
  await req('POST', `/channels/${gid}/members/${B.id}/mute`, { token: A.token, body: { seconds: 2 } });
  const blockedSend = await req('POST', `/channels/${gid}/messages`, { token: B.token, body: { text: 'try during mute' } });
  record('muted user blocked immediately', [403, 404].includes(blockedSend.status), `HTTP ${blockedSend.status}`);
  await sleep(2500);
  const afterMute = await req('POST', `/channels/${gid}/messages`, { token: B.token, body: { text: 'after mute expiry' } });
  record('mute auto-expires after seconds', [200, 201].includes(afterMute.status), `HTTP ${afterMute.status} ${JSON.stringify(afterMute.body).slice(0, 200)}`);

  // Ban C for 2 seconds
  await req('POST', `/channels/${gid}/members/${C.id}/ban`, { token: A.token, body: { seconds: 2 } });
  const blockedBan = await req('POST', `/channels/${gid}/messages`, { token: C.token, body: { text: 'try during ban' } });
  record('banned user blocked immediately', [403, 404].includes(blockedBan.status), `HTTP ${blockedBan.status}`);
  await sleep(2500);
  const afterBan = await req('POST', `/channels/${gid}/messages`, { token: C.token, body: { text: 'after ban expiry' } });
  record('ban auto-expires after seconds', [200, 201].includes(afterBan.status), `HTTP ${afterBan.status} ${JSON.stringify(afterBan.body).slice(0, 200)}`);

  // =================================================================
  console.log('\n━━━ 1. SCHEDULED message after sender leaves ━━━');
  // Alice schedules a message in 3 seconds, then leaves the channel
  const g2 = await req('POST', '/channels/group', { token: A.token, body: { userIds: [B.id], name: 'sched leave test' } });
  const g2id = g2.body.id;
  const schedAt = new Date(Date.now() + 3000).toISOString();
  const sched = await req('POST', `/channels/${g2id}/scheduled-messages`, { token: A.token, body: { text: 'ghost message', scheduledAt: schedAt } });
  record('scheduled created', [200, 201].includes(sched.status));
  // Alice deletes the channel (simulates "no longer relevant")
  // Actually let's test: Alice gets banned from the channel she created — harder. Simpler: Alice leaves.
  // But Alice is the only operator... let's make B the operator first.
  await req('POST', `/channels/${g2id}/operators`, { token: A.token, body: { userIds: [B.id] } });
  const leaveR = await req('POST', `/channels/${g2id}/leave`, { token: A.token });
  record('sender leaves channel', [200, 201, 204].includes(leaveR.status), `HTTP ${leaveR.status}`);
  // Wait for scheduled job to fire
  await sleep(4000);
  // B lists messages — does ghost appear?
  const msgs = await req('GET', `/channels/${g2id}/messages`, { token: B.token });
  const ghost = Array.isArray(msgs.body) && msgs.body.some(m => m.text === 'ghost message')
    || (msgs.body?.messages && msgs.body.messages.some(m => m.text === 'ghost message'));
  record('scheduled msg NOT delivered after sender leaves', !ghost, ghost ? '🚨 ghost message delivered despite sender left' : '');
  await req('DELETE', `/channels/${g2id}`, { token: B.token });

  // =================================================================
  console.log('\n━━━ 4. BLOCKED user receives live messages? ━━━');
  // A and B in a group with C. A blocks C. C sends a message. Does A receive it via socket?
  const g3 = await req('POST', '/channels/group', { token: A.token, body: { userIds: [B.id, C.id], name: 'block test' } });
  const g3id = g3.body.id;
  await req('POST', '/users/block', { token: A.token, body: { userId: C.id } });

  const sA = io(SOCKET_URL + '/chat', { auth: { userId: A.id }, transports: ['websocket'], forceNew: true });
  await new Promise((res) => { sA.once('connect', res); setTimeout(res, 2000); });
  const colA = collector(sA);
  sA.emit('chat:join:channel', { channelId: g3id });
  await sleep(200);
  await req('POST', `/channels/${g3id}/messages`, { token: C.token, body: { text: 'hi from blocked user' } });
  await sleep(500);
  // Check REST list too
  const list = await req('GET', `/channels/${g3id}/messages`, { token: A.token });
  const seesInRest = (Array.isArray(list.body) ? list.body : list.body?.messages || []).some(m => m.text === 'hi from blocked user');
  const seesViaSocket = colA.has('chat:message:received');
  // Behavior: could be either "filter blocked" or "let client filter". Just report observation.
  record('blocked user message filtered from REST list', !seesInRest, seesInRest ? 'not filtered (client must filter)' : '');
  record('blocked user message filtered from socket', !seesViaSocket, seesViaSocket ? 'not filtered (client must filter)' : '');
  sA.close();
  await req('POST', '/users/unblock', { token: A.token, body: { userId: C.id } });
  await req('DELETE', `/channels/${g3id}`, { token: A.token });

  // =================================================================
  console.log('\n━━━ 5. PAGINATION ━━━');
  const g4 = await req('POST', '/channels/group', { token: A.token, body: { userIds: [B.id], name: 'pagination' } });
  const g4id = g4.body.id;
  // Send 25 messages quickly
  for (let i = 0; i < 25; i++) {
    await req('POST', `/channels/${g4id}/messages`, { token: A.token, body: { text: `msg #${i}` } });
  }
  const p1 = await req('GET', `/channels/${g4id}/messages`, { token: A.token, query: { limit: 10 } });
  const p1msgs = Array.isArray(p1.body) ? p1.body : (p1.body?.messages || []);
  record('pagination limit respected', p1msgs.length === 10, `got ${p1msgs.length}`);
  // Unique IDs
  const ids = new Set(p1msgs.map(m => m.id));
  record('pagination no duplicates', ids.size === p1msgs.length);
  // Try fetching everything
  const pAll = await req('GET', `/channels/${g4id}/messages`, { token: A.token, query: { limit: 100 } });
  const pAllMsgs = Array.isArray(pAll.body) ? pAll.body : (pAll.body?.messages || []);
  record('can fetch all 25 with limit=100', pAllMsgs.length === 25, `got ${pAllMsgs.length}`);
  await req('DELETE', `/channels/${g4id}`, { token: A.token });

  // =================================================================
  console.log('\n━━━ 6. SEARCH injection / special chars ━━━');
  expectOk('search SQL-like keyword', await req('POST', '/messages/search', { token: A.token, body: { keyword: "'; DROP TABLE chat; --" } }));
  expectOk('search LIKE wildcard %', await req('POST', '/messages/search', { token: A.token, body: { keyword: '%' } }));
  expectOk('search regex metachars', await req('POST', '/messages/search', { token: A.token, body: { keyword: '.*?[]{}()' } }));
  expectOk('search very long keyword', await req('POST', '/messages/search', { token: A.token, body: { keyword: 'a'.repeat(5000) } }), [200, 201, 400, 413]);

  // =================================================================
  console.log('\n━━━ 9/10/11. MENTION / FORWARD edge cases ━━━');
  const g5 = await req('POST', '/channels/group', { token: A.token, body: { userIds: [B.id], name: 'edge' } });
  const g5id = g5.body.id;
  // Mention a non-member (C is not in g5)
  const mentionNonMember = await req('POST', `/channels/${g5id}/messages`, { token: A.token, body: { text: `hi @non`, mentionedUserIds: [C.id] } });
  record('mention non-member — either reject or silently accept', [200, 201, 400, 403].includes(mentionNonMember.status), `HTTP ${mentionNonMember.status}`);

  // Forward to channel sender is not member of
  const g5b = await req('POST', '/channels/group', { token: C.token, body: { userIds: [], name: 'sender not in' } }).catch(() => null);
  // C creates a channel where A is NOT a member
  const gC = await req('POST', '/channels/direct', { token: C.token, body: { userId: B.id } });
  const gCid = gC.body.id;
  const m = await req('POST', `/channels/${g5id}/messages`, { token: A.token, body: { text: 'to forward' } });
  const mId = m.body.id;
  const fwd = await req('POST', `/channels/${g5id}/messages/${mId}/forward`, { token: A.token, body: { targetChannelId: gCid } });
  record('forward to channel sender not in → rejected', [403, 404].includes(fwd.status), `HTTP ${fwd.status} ${JSON.stringify(fwd.body).slice(0, 150)}`);

  // Forward to frozen channel (freeze a group where A IS member)
  const g6 = await req('POST', '/channels/group', { token: A.token, body: { userIds: [B.id], name: 'frozen target' } });
  const g6id = g6.body.id;
  await req('POST', `/channels/${g6id}/freeze`, { token: A.token });
  const fwdFrozen = await req('POST', `/channels/${g5id}/messages/${mId}/forward`, { token: B.token, body: { targetChannelId: g6id } });
  record('forward to frozen channel (non-op) → rejected', [403, 404, 409].includes(fwdFrozen.status), `HTTP ${fwdFrozen.status}`);
  await req('POST', `/channels/${g6id}/unfreeze`, { token: A.token });
  await req('DELETE', `/channels/${g6id}`, { token: A.token });
  await req('DELETE', `/channels/${g5id}`, { token: A.token });
  await req('DELETE', `/channels/${gCid}`, { token: C.token });

  // =================================================================
  console.log('\n━━━ 12. REACTIONS — limits ━━━');
  const g7 = await req('POST', '/channels/group', { token: A.token, body: { userIds: [B.id], name: 'react limit' } });
  const g7id = g7.body.id;
  const rm = await req('POST', `/channels/${g7id}/messages`, { token: A.token, body: { text: 'react me' } });
  const rmId = rm.body.id;
  // 50 different reactions
  let reactFailed = null;
  for (let i = 0; i < 50; i++) {
    const rr = await req('POST', `/channels/${g7id}/messages/${rmId}/reactions`, { token: A.token, body: { key: `rx_${i}` } });
    if (rr.status >= 400) { reactFailed = { i, status: rr.status }; break; }
  }
  record('reactions unlimited or limited sanely', reactFailed === null || (reactFailed && [400, 413, 429].includes(reactFailed.status)), reactFailed ? `stopped at #${reactFailed.i} HTTP ${reactFailed.status}` : 'no limit hit at 50');
  // Duplicate reaction from same user
  const dup = await req('POST', `/channels/${g7id}/messages/${rmId}/reactions`, { token: A.token, body: { key: 'rx_0' } });
  record('duplicate reaction — either noop or error', [200, 201, 204, 400, 409].includes(dup.status), `HTTP ${dup.status}`);
  await req('DELETE', `/channels/${g7id}`, { token: A.token });

  // =================================================================
  console.log('\n━━━ 13. METADATA size ━━━');
  const g8 = await req('POST', '/channels/group', { token: A.token, body: { userIds: [B.id], name: 'metasize' } });
  const g8id = g8.body.id;
  const bigMeta = {};
  for (let i = 0; i < 200; i++) bigMeta['k' + i] = 'x'.repeat(500); // ~100KB
  const setBig = await req('PUT', `/channels/${g8id}/metadata`, { token: A.token, body: { metadata: bigMeta } });
  record('metadata accepts or rejects large payload explicitly', [200, 201, 400, 413].includes(setBig.status), `HTTP ${setBig.status}`);
  const huge = {};
  for (let i = 0; i < 20000; i++) huge['k' + i] = 'x'.repeat(500); // ~10MB
  const setHuge = await req('PUT', `/channels/${g8id}/metadata`, { token: A.token, body: { metadata: huge } });
  record('metadata >10MB rejected', [400, 413, 500].includes(setHuge.status), `HTTP ${setHuge.status}`);
  await req('DELETE', `/channels/${g8id}`, { token: A.token });

  // =================================================================
  console.log('\n━━━ 8. DIRECT channel dedup + reset-history ━━━');
  const d1 = await req('POST', '/channels/direct', { token: A.token, body: { userId: B.id } });
  const d2 = await req('POST', '/channels/direct', { token: A.token, body: { userId: B.id } });
  record('direct channel is deduplicated (same id)', d1.body?.id === d2.body?.id, `d1=${d1.body?.id} d2=${d2.body?.id}`);
  // Send a msg, reset-history, list — should be empty for A but visible for B
  const did = d1.body.id;
  await req('POST', `/channels/${did}/messages`, { token: B.token, body: { text: 'pre-reset' } });
  await req('POST', `/channels/${did}/reset-history`, { token: A.token });
  const afterReset = await req('GET', `/channels/${did}/messages`, { token: A.token });
  const aMsgs = Array.isArray(afterReset.body) ? afterReset.body : (afterReset.body?.messages || []);
  record('after reset-history A sees no old messages', !aMsgs.some(m => m.text === 'pre-reset'));
  const bView = await req('GET', `/channels/${did}/messages`, { token: B.token });
  const bMsgs = Array.isArray(bView.body) ? bView.body : (bView.body?.messages || []);
  record('after reset-history B still sees old messages', bMsgs.some(m => m.text === 'pre-reset'));

  // =================================================================
  console.log('\n━━━ 14. PII in logs ━━━');
  // We can't inspect server logs from here, but we can at least make sure the API doesn't return passwords.
  const me = await req('GET', `/users/${A.id}`, { token: A.token });
  const hasPassword = JSON.stringify(me.body).toLowerCase().includes('password');
  record('GET /users/:id does not leak password', !hasPassword, hasPassword ? 'password field in response' : '');

  // =================================================================
  console.log('\n━━━ 16. RATE LIMIT — login burst ━━━');
  const burst = await Promise.all(Array.from({ length: 30 }, () => req('POST', '/auth/login', { body: { email: 'alice@example.com', password: 'wrong' } })));
  const rateLimited = burst.some(r => r.status === 429);
  record('login burst triggers 429 (rate limit)', rateLimited, rateLimited ? '' : 'no rate limit on /auth/login (recommend adding Throttler)');

  // =================================================================
  console.log('\n━━━ 17. N+1 check on channels list (heuristic) ━━━');
  // Create 10 channels for Alice with a few messages each
  const chans = [];
  for (let i = 0; i < 10; i++) {
    const gx = await req('POST', '/channels/group', { token: A.token, body: { userIds: [B.id], name: `perf-${i}` } });
    chans.push(gx.body.id);
    await req('POST', `/channels/${gx.body.id}/messages`, { token: B.token, body: { text: 'p1' } });
    await req('POST', `/channels/${gx.body.id}/messages`, { token: B.token, body: { text: 'p2' } });
  }
  const t0 = Date.now();
  const listR = await req('GET', '/channels', { token: A.token });
  const elapsed = Date.now() - t0;
  record(`list 10 channels under 500ms (actual: ${elapsed}ms)`, elapsed < 500, elapsed < 500 ? '' : 'possibly N+1 — investigate');
  for (const cid of chans) await req('DELETE', `/channels/${cid}`, { token: A.token });

  // =================================================================
  // cleanup
  await req('DELETE', `/channels/${gid}`, { token: A.token });

  console.log(`\n━━━ SUMMARY ━━━`);
  console.log(`PASS: ${passCount}`);
  console.log(`FAIL: ${failCount}`);
  if (failCount > 0) {
    console.log('\nFailures:');
    for (const r of results) if (!r.ok) console.log(` - ${r.label}: ${r.detail}`);
  }
  process.exit(failCount > 0 ? 1 : 0);
}

function expectOk(label, res, statuses = [200, 201]) {
  const ok = statuses.includes(res.status);
  record(label, ok, ok ? '' : `HTTP ${res.status}`);
}

main().catch(e => { console.error('UNEXPECTED:', e); process.exit(2); });

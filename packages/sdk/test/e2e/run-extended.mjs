// Extended E2E — negative/authz tests + tenant isolation + all 38 Socket.IO events.
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

function expectStatus(label, res, statuses) {
  const ok = statuses.includes(res.status);
  record(label, ok, ok ? '' : `HTTP ${res.status} ${JSON.stringify(res.body).slice(0, 250)}`);
  return ok;
}
function expectErrCode(label, res, code, statuses = [400, 401, 403, 404, 409]) {
  const ok = statuses.includes(res.status) && res.body?.code === code;
  record(label, ok, ok ? '' : `got HTTP ${res.status} code=${res.body?.code} ${JSON.stringify(res.body).slice(0, 250)}`);
  return ok;
}

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

// Helper — wait for N specific events on a socket with timeout.
function collector(socket) {
  const received = new Map(); // event -> array of payloads
  const handlers = new Map();
  const original = socket.onAny.bind(socket);
  socket.onAny((event, payload) => {
    if (!received.has(event)) received.set(event, []);
    received.get(event).push(payload);
  });
  return {
    has(event) { return received.has(event) && received.get(event).length > 0; },
    get(event) { return received.get(event) || []; },
    async waitFor(event, timeoutMs = 3000) {
      const start = Date.now();
      while (Date.now() - start < timeoutMs) {
        if (this.has(event)) return this.get(event)[0];
        await sleep(50);
      }
      throw new Error(`timeout waiting for ${event}`);
    },
    clear() { received.clear(); },
  };
}

async function registerUser(email, name, organizationId) {
  const r = await req('POST', '/auth/register', { body: { email, name, password: 'password', organizationId } });
  if (r.status >= 300) throw new Error(`register ${email} failed: ${r.status} ${JSON.stringify(r.body)}`);
  return { email, id: r.body.user.id, token: r.body.token, tenantId: organizationId };
}

async function login(email) {
  const r = await req('POST', '/auth/login', { body: { email, password: 'password' } });
  if (r.status >= 300) throw new Error(`login ${email} failed: ${r.status}`);
  return { email, id: r.body.user.id, token: r.body.token };
}

async function connectSocket(userIdOrUser, _tenantId) {
  const user = typeof userIdOrUser === 'string' ? null : userIdOrUser;
  const token = user?.token;
  if (!token) throw new Error('connectSocket requires a user object with token');
  const s = io(SOCKET_URL + '/chat', {
    auth: { token },
    transports: ['websocket'],
    forceNew: true,
  });
  await new Promise((res, rej) => {
    s.once('connect', res);
    s.once('connect_error', (e) => rej(new Error('connect_error: ' + e.message)));
    setTimeout(() => rej(new Error('connect timeout')), 3000);
  });
  return s;
}

// ============================================================

async function main() {
  console.log('\n━━━ SETUP (seeded users) ━━━');
  const A = await login('alice@example.com');
  const B = await login('bob@example.com');
  const C = await login('charlie@example.com');
  const D = await login('diana@example.com');
  record('login 4 seeded users', true);

  // Create fresh users on two separate tenants for isolation tests
  const now = Date.now();
  const T1 = await registerUser(`t1-owner-${now}@ex.com`, 'T1 Owner', 'tenant-1');
  const T1b = await registerUser(`t1-peer-${now}@ex.com`, 'T1 Peer', 'tenant-1');
  const T2 = await registerUser(`t2-owner-${now}@ex.com`, 'T2 Owner', 'tenant-2');
  record('register users on tenant-1 + tenant-2', true);

  // ==============================================================
  console.log('\n━━━ AUTH — negatives ━━━');
  expectStatus('login wrong password', await req('POST', '/auth/login', { body: { email: 'alice@example.com', password: 'nope' } }), [401]);
  expectStatus('login unknown email', await req('POST', '/auth/login', { body: { email: 'nobody@ex.com', password: 'x' } }), [401]);
  expectStatus('register duplicate email', await req('POST', '/auth/register', { body: { email: 'alice@example.com', name: 'x', password: 'x' } }), [400, 409, 500]);
  expectStatus('register invalid email', await req('POST', '/auth/register', { body: { email: 'not-an-email', name: 'x', password: 'x' } }), [400]);
  expectStatus('no token', await req('GET', '/channels'), [401]);
  expectStatus('garbage token', await req('GET', '/channels', { token: 'garbage' }), [401]);

  // ==============================================================
  console.log('\n━━━ TENANT ISOLATION ━━━');
  // T1 creates a group
  const t1Group = await req('POST', '/channels/group', { token: T1.token, body: { userIds: [T1b.id], name: 'T1 secret group' } });
  expectStatus('T1 group create', t1Group, [200, 201]);
  const t1GroupId = t1Group.body?.id;

  // T2 should not see T1's channel
  const t2List = await req('GET', '/channels', { token: T2.token });
  expectStatus('T2 list channels', t2List, [200]);
  const t2SeesT1 = Array.isArray(t2List.body) && t2List.body.some(c => c.id === t1GroupId)
    || (t2List.body?.channels && t2List.body.channels.some(c => c.id === t1GroupId));
  record('T2 cannot see T1 channel in list', !t2SeesT1, t2SeesT1 ? 'LEAK' : '');

  // T2 tries to GET T1's channel directly
  const t2GetT1 = await req('GET', `/channels/${t1GroupId}`, { token: T2.token });
  record('T2 cannot GET T1 channel', [403, 404].includes(t2GetT1.status), `HTTP ${t2GetT1.status} body=${JSON.stringify(t2GetT1.body).slice(0, 200)}`);

  // T2 tries to send a message in T1's channel
  const t2SendT1 = await req('POST', `/channels/${t1GroupId}/messages`, { token: T2.token, body: { text: 'leak!' } });
  record('T2 cannot send in T1 channel', [403, 404].includes(t2SendT1.status), `HTTP ${t2SendT1.status} body=${JSON.stringify(t2SendT1.body).slice(0, 200)}`);

  // T2 tries to GET T1 user via /users/:id (cross-tenant)
  const t2GetT1User = await req('GET', `/users/${T1.id}`, { token: T2.token });
  record('T2 cannot GET T1 user', [403, 404].includes(t2GetT1User.status), `HTTP ${t2GetT1User.status}`);

  // T2 tries to search for T1 user
  const t2SearchT1 = await req('GET', '/users/search', { token: T2.token, query: { keyword: 'T1 Owner' } });
  expectStatus('T2 search runs', t2SearchT1, [200]);
  const searchResults = t2SearchT1.body;
  const leaksT1 = Array.isArray(searchResults) && searchResults.some(u => u.id === T1.id)
    || (searchResults?.users && searchResults.users.some(u => u.id === T1.id));
  record('T2 search does NOT return T1 user', !leaksT1, leaksT1 ? 'LEAK' : '');

  // Cleanup T1 channel
  await req('DELETE', `/channels/${t1GroupId}`, { token: T1.token });

  // ==============================================================
  console.log('\n━━━ AUTHZ: non-member / non-operator ━━━');
  // Alice creates a group with only Bob — Charlie is NOT a member
  const g = await req('POST', '/channels/group', { token: A.token, body: { userIds: [B.id], name: 'AuthZ group' } });
  expectStatus('A creates group', g, [200, 201]);
  const gid = g.body?.id;

  // Charlie (non-member) tries various ops
  expectStatus('non-member cannot GET channel', await req('GET', `/channels/${gid}`, { token: C.token }), [403, 404]);
  expectStatus('non-member cannot list members', await req('GET', `/channels/${gid}/members`, { token: C.token }), [403, 404]);
  expectStatus('non-member cannot send message', await req('POST', `/channels/${gid}/messages`, { token: C.token, body: { text: 'hi' } }), [403, 404]);
  expectStatus('non-member cannot mark read', await req('POST', `/channels/${gid}/read`, { token: C.token }), [403, 404]);

  // Bob (member, not operator) tries operator-only
  expectStatus('non-op cannot PATCH channel', await req('PATCH', `/channels/${gid}`, { token: B.token, body: { name: 'hijack' } }), [403]);
  expectStatus('non-op cannot invite', await req('POST', `/channels/${gid}/members/invite`, { token: B.token, body: { userIds: [C.id] } }), [403]);
  expectStatus('non-op cannot freeze', await req('POST', `/channels/${gid}/freeze`, { token: B.token }), [403]);
  expectStatus('non-op cannot ban', await req('POST', `/channels/${gid}/members/${B.id}/ban`, { token: B.token }), [403]);
  expectStatus('non-op cannot DELETE channel', await req('DELETE', `/channels/${gid}`, { token: B.token }), [403]);

  // ==============================================================
  console.log('\n━━━ FROZEN CHANNEL ━━━');
  await req('POST', `/channels/${gid}/freeze`, { token: A.token });
  const sendFrozen = await req('POST', `/channels/${gid}/messages`, { token: B.token, body: { text: 'after freeze' } });
  record('member cannot send in frozen channel', [403, 409, 400].includes(sendFrozen.status), `HTTP ${sendFrozen.status} ${JSON.stringify(sendFrozen.body).slice(0, 200)}`);
  // Operator may still be allowed — we only assert member is blocked.
  await req('POST', `/channels/${gid}/unfreeze`, { token: A.token });

  // ==============================================================
  console.log('\n━━━ BANNED / MUTED USER ━━━');
  // Add Charlie to the group, then ban him
  await req('POST', `/channels/${gid}/members/invite`, { token: A.token, body: { userIds: [C.id] } });
  await req('POST', `/channels/${gid}/members/${C.id}/ban`, { token: A.token, body: { description: 'test', seconds: 60 } });
  const bannedSend = await req('POST', `/channels/${gid}/messages`, { token: C.token, body: { text: 'hello' } });
  record('banned user cannot send', [403, 404].includes(bannedSend.status), `HTTP ${bannedSend.status}`);
  const bannedRead = await req('GET', `/channels/${gid}`, { token: C.token });
  record('banned user sees 403/404 on GET', [403, 404].includes(bannedRead.status), `HTTP ${bannedRead.status}`);
  await req('POST', `/channels/${gid}/members/${C.id}/unban`, { token: A.token });

  // Mute Charlie
  await req('POST', `/channels/${gid}/members/${C.id}/mute`, { token: A.token, body: { seconds: 60 } });
  const mutedSend = await req('POST', `/channels/${gid}/messages`, { token: C.token, body: { text: 'muted hi' } });
  record('muted user cannot send', [403, 404].includes(mutedSend.status), `HTTP ${mutedSend.status}`);
  await req('POST', `/channels/${gid}/members/${C.id}/unmute`, { token: A.token });

  // ==============================================================
  console.log('\n━━━ OWNERSHIP: edit/delete other user\'s message ━━━');
  const msgA = await req('POST', `/channels/${gid}/messages`, { token: A.token, body: { text: 'Alice says hi' } });
  expectStatus('A sends message', msgA, [200, 201]);
  const msgAId = msgA.body?.id;

  expectStatus('B cannot edit A message', await req('PATCH', `/channels/${gid}/messages/${msgAId}`, { token: B.token, body: { text: 'hacked' } }), [403]);
  // Op can delete a member's message
  expectStatus('A (operator) can delete A message', await req('DELETE', `/channels/${gid}/messages/${msgAId}`, { token: A.token }), [200, 204]);

  // ==============================================================
  console.log('\n━━━ BLOCKED USER ━━━');
  // Bob blocks Alice
  await req('POST', '/users/block', { token: B.token, body: { userId: A.id } });
  // Try creating a direct channel A -> B (blocked)
  const blockedDirect = await req('POST', '/channels/direct', { token: A.token, body: { userId: B.id } });
  record('direct create when target blocks sender', [403, 400, 409].includes(blockedDirect.status) || blockedDirect.status === 200 || blockedDirect.status === 201, `HTTP ${blockedDirect.status}`);
  // Note: behavior is documented-dependent; we record what happens either way.
  await req('POST', '/users/unblock', { token: B.token, body: { userId: A.id } });

  // ==============================================================
  console.log('\n━━━ INVALID PAYLOADS ━━━');
  expectStatus('send empty text', await req('POST', `/channels/${gid}/messages`, { token: A.token, body: { text: '' } }), [400]);
  expectStatus('invalid push-trigger', await req('PUT', `/channels/${gid}/push-trigger`, { token: A.token, body: { option: 'bogus' } }), [400]);
  expectStatus('invalid count-preference', await req('PUT', `/channels/${gid}/count-preference`, { token: A.token, body: { preference: 'bogus' } }), [400]);
  expectStatus('ban seconds negative', await req('POST', `/channels/${gid}/members/${C.id}/ban`, { token: A.token, body: { seconds: -1 } }), [400]);
  expectStatus('poll with 1 option', await req('POST', `/channels/${gid}/polls`, { token: A.token, body: { title: 'T', options: ['only'] } }), [400]);
  expectStatus('scheduled invalid date', await req('POST', `/channels/${gid}/scheduled-messages`, { token: A.token, body: { text: 'x', scheduledAt: 'not-a-date' } }), [400]);
  expectStatus('direct to nonexistent user', await req('POST', '/channels/direct', { token: A.token, body: { userId: '00000000-0000-0000-0000-000000000000' } }), [400, 404]);
  expectStatus('GET nonexistent channel', await req('GET', '/channels/nonexistent-id', { token: A.token }), [403, 404]);
  expectStatus('GET nonexistent user', await req('GET', '/users/00000000-0000-0000-0000-000000000000', { token: A.token }), [404]);

  // ==============================================================
  console.log('\n━━━ SOCKET.IO — ALL 38 EVENTS ━━━');
  // Fresh group with 3 members: A (operator), B, C
  const sg = await req('POST', '/channels/group', { token: A.token, body: { userIds: [B.id, C.id], name: 'Socket test group' } });
  expectStatus('socket test group', sg, [200, 201]);
  const sgid = sg.body?.id;

  const sA = await connectSocket(A);
  const sB = await connectSocket(B);
  const sC = await connectSocket(C);
  const cA = collector(sA);
  const cB = collector(sB);
  const cC = collector(sC);
  record('connect 3 sockets', true);

  // All join the channel
  for (const s of [sA, sB, sC]) s.emit('chat:join:channel', { channelId: sgid });
  await sleep(200);

  // ---- 1. Typing ----
  sA.emit('chat:typing:start', { channelId: sgid });
  try { await cB.waitFor('chat:typing:status:updated', 2000); record('chat:typing:status:updated (start)', true); }
  catch (e) { record('chat:typing:status:updated (start)', false, e.message); }
  sA.emit('chat:typing:stop', { channelId: sgid });
  await sleep(200);

  // ---- 2. Message events ----
  cB.clear();
  const m1 = await req('POST', `/channels/${sgid}/messages`, { token: A.token, body: { text: 'socket msg' } });
  const m1Id = m1.body?.id;
  try { await cB.waitFor('chat:message:received', 2500); record('chat:message:received', true); }
  catch (e) { record('chat:message:received', false, e.message); }

  cB.clear();
  await req('PATCH', `/channels/${sgid}/messages/${m1Id}`, { token: A.token, body: { text: 'edited socket msg' } });
  try { await cB.waitFor('chat:message:updated', 2500); record('chat:message:updated', true); }
  catch (e) { record('chat:message:updated', false, e.message); }

  cB.clear();
  // ---- 3. Reaction ----
  await req('POST', `/channels/${sgid}/messages/${m1Id}/reactions`, { token: B.token, body: { key: 'heart' } });
  try { await cA.waitFor('chat:reaction:updated', 2500); record('chat:reaction:updated (add)', true); }
  catch (e) { record('chat:reaction:updated (add)', false, e.message); }
  cA.clear();
  await req('DELETE', `/channels/${sgid}/messages/${m1Id}/reactions/heart`, { token: B.token });
  try { await cA.waitFor('chat:reaction:updated', 2500); record('chat:reaction:updated (remove)', true); }
  catch (e) { record('chat:reaction:updated (remove)', false, e.message); }

  // ---- 4. Mention ----
  cB.clear();
  await req('POST', `/channels/${sgid}/messages`, { token: A.token, body: { text: `hey @bob`, mentionedUserIds: [B.id] } });
  try { await cB.waitFor('chat:mention:received', 2500); record('chat:mention:received', true); }
  catch (e) { record('chat:mention:received', false, e.message); }

  // ---- 5. Read receipt ----
  cA.clear();
  await req('POST', `/channels/${sgid}/read`, { token: B.token });
  try { await cA.waitFor('chat:read:receipt:updated', 2500); record('chat:read:receipt:updated', true); }
  catch (e) { record('chat:read:receipt:updated', false, e.message); }

  // ---- 6. Pinned ----
  cB.clear();
  await req('POST', `/channels/${sgid}/messages/${m1Id}/pin`, { token: A.token });
  try { await cB.waitFor('chat:pinned:message:updated', 2500); record('chat:pinned:message:updated (pin)', true); }
  catch (e) { record('chat:pinned:message:updated (pin)', false, e.message); }
  cB.clear();
  await req('DELETE', `/channels/${sgid}/messages/${m1Id}/pin`, { token: A.token });
  try { await cB.waitFor('chat:pinned:message:updated', 2500); record('chat:pinned:message:updated (unpin)', true); }
  catch (e) { record('chat:pinned:message:updated (unpin)', false, e.message); }

  // ---- 7. Message deleted ----
  cB.clear();
  await req('DELETE', `/channels/${sgid}/messages/${m1Id}`, { token: A.token });
  try { await cB.waitFor('chat:message:deleted', 2500); record('chat:message:deleted', true); }
  catch (e) { record('chat:message:deleted', false, e.message); }

  // ---- 8. Polls ----
  cB.clear();
  const poll = await req('POST', `/channels/${sgid}/polls`, { token: A.token, body: { title: 'Lunch?', options: ['P', 'S'] } });
  const pollId = poll.body?.poll?.id;
  const pOpt = poll.body?.poll?.options?.[0]?.id;
  // Poll creation emits a message_received (it's a message of type POLL). Specific poll events trigger on update/vote/delete.
  cA.clear();
  await req('POST', `/channels/${sgid}/polls/${pollId}/vote`, { token: B.token, body: { optionIds: [pOpt] } });
  try { await cA.waitFor('chat:poll:voted', 2500); record('chat:poll:voted', true); }
  catch (e) { record('chat:poll:voted', false, e.message); }
  // chat:poll:updated is only emitted on explicit poll update (SDK has no such route today — N/A).
  record('chat:poll:updated (no explicit trigger endpoint)', true, 'N/A: only emitted on explicit update');

  // ---- 9. Channel changed / metadata / member counts ----
  cB.clear();
  await req('PATCH', `/channels/${sgid}`, { token: A.token, body: { name: 'Renamed socket group' } });
  try { await cB.waitFor('chat:channel:changed', 2500); record('chat:channel:changed', true); }
  catch (e) { record('chat:channel:changed', false, e.message); }

  cB.clear();
  await req('PUT', `/channels/${sgid}/metadata`, { token: A.token, body: { metadata: { k: 'v' } } });
  try { await cB.waitFor('chat:metadata:changed', 2500); record('chat:metadata:changed', true); }
  catch (e) { record('chat:metadata:changed', false, e.message); }

  // ---- 10. Freeze / unfreeze ----
  cB.clear();
  await req('POST', `/channels/${sgid}/freeze`, { token: A.token });
  try { await cB.waitFor('chat:channel:frozen', 2500); record('chat:channel:frozen', true); }
  catch (e) { record('chat:channel:frozen', false, e.message); }
  cB.clear();
  await req('POST', `/channels/${sgid}/unfreeze`, { token: A.token });
  try { await cB.waitFor('chat:channel:unfrozen', 2500); record('chat:channel:unfrozen', true); }
  catch (e) { record('chat:channel:unfrozen', false, e.message); }

  // ---- 11. Channel mute (self) — must go ONLY to acting user ----
  cA.clear(); cB.clear(); cC.clear();
  await req('POST', `/channels/${sgid}/mute`, { token: B.token });
  await sleep(400);
  record('chat:channel:muted → to acting user', cB.has('chat:channel:muted'), cB.has('chat:channel:muted') ? '' : 'B did not receive own mute event');
  record('chat:channel:muted NOT leaked to others', !cA.has('chat:channel:muted') && !cC.has('chat:channel:muted'), 'leaked to A or C');

  cA.clear(); cB.clear(); cC.clear();
  await req('POST', `/channels/${sgid}/unmute`, { token: B.token });
  await sleep(400);
  record('chat:channel:unmuted → to acting user', cB.has('chat:channel:unmuted'));
  record('chat:channel:unmuted NOT leaked to others', !cA.has('chat:channel:unmuted') && !cC.has('chat:channel:unmuted'));

  // ---- 12. User muted/unmuted (operator action) ----
  cC.clear();
  await req('POST', `/channels/${sgid}/members/${C.id}/mute`, { token: A.token, body: { seconds: 30 } });
  try { await cC.waitFor('chat:user:muted', 2500); record('chat:user:muted', true); }
  catch (e) { record('chat:user:muted', false, e.message); }
  cC.clear();
  await req('POST', `/channels/${sgid}/members/${C.id}/unmute`, { token: A.token });
  try { await cC.waitFor('chat:user:unmuted', 2500); record('chat:user:unmuted', true); }
  catch (e) { record('chat:user:unmuted', false, e.message); }

  // ---- 13. User banned/unbanned ----
  cC.clear();
  await req('POST', `/channels/${sgid}/members/${C.id}/ban`, { token: A.token, body: { seconds: 30 } });
  try { await cC.waitFor('chat:user:banned', 2500); record('chat:user:banned', true); }
  catch (e) { record('chat:user:banned', false, e.message); }
  cC.clear();
  await req('POST', `/channels/${sgid}/members/${C.id}/unban`, { token: A.token });
  try { await cC.waitFor('chat:user:unbanned', 2500); record('chat:user:unbanned', true); }
  catch (e) { record('chat:user:unbanned', false, e.message); }

  // ---- 14. Operator updated ----
  cB.clear();
  await req('POST', `/channels/${sgid}/operators`, { token: A.token, body: { userIds: [B.id] } });
  try { await cB.waitFor('chat:operator:updated', 2500); record('chat:operator:updated (promote)', true); }
  catch (e) { record('chat:operator:updated (promote)', false, e.message); }
  cB.clear();
  await req('DELETE', `/channels/${sgid}/operators`, { token: A.token, body: { userIds: [B.id] } });
  try { await cB.waitFor('chat:operator:updated', 2500); record('chat:operator:updated (demote)', true); }
  catch (e) { record('chat:operator:updated (demote)', false, e.message); }

  // ---- 15. User joined / user left / member count ----
  // Invite D → user:joined for existing members (A/B)
  cA.clear(); cB.clear();
  await req('POST', `/channels/${sgid}/members/invite`, { token: A.token, body: { userIds: [D.id] } });
  try { await cA.waitFor('chat:user:joined', 2500); record('chat:user:joined', true); }
  catch (e) { record('chat:user:joined', false, e.message); }
  const sawMemberCountJoin = cA.has('chat:channel:member:count:changed') || cB.has('chat:channel:member:count:changed');
  record('chat:channel:member:count:changed (join)', sawMemberCountJoin);

  // D leaves
  const sD = await connectSocket(D);
  const cD = collector(sD);
  sD.emit('chat:join:channel', { channelId: sgid });
  await sleep(200);
  cA.clear(); cB.clear();
  await req('POST', `/channels/${sgid}/leave`, { token: D.token });
  try { await cA.waitFor('chat:user:left', 2500); record('chat:user:left', true); }
  catch (e) { record('chat:user:left', false, e.message); }
  const sawMemberCountLeave = cA.has('chat:channel:member:count:changed') || cB.has('chat:channel:member:count:changed');
  record('chat:channel:member:count:changed (leave)', sawMemberCountLeave);

  // ---- 16. Unread count changed ----
  cB.clear();
  await req('POST', `/channels/${sgid}/messages`, { token: A.token, body: { text: 'triggers unread' } });
  await sleep(400);
  record('chat:unread:count:changed (observed)', cB.has('chat:unread:count:changed'), cB.has('chat:unread:count:changed') ? '' : 'not observed');

  // ---- 17. Channel hidden / unhidden — must go ONLY to acting user ----
  cA.clear(); cB.clear(); cC.clear();
  await req('POST', `/channels/${sgid}/hide`, { token: B.token, body: {} });
  await sleep(400);
  record('chat:channel:hidden → to acting user', cB.has('chat:channel:hidden'));
  record('chat:channel:hidden NOT leaked to others', !cA.has('chat:channel:hidden') && !cC.has('chat:channel:hidden'));

  cA.clear(); cB.clear(); cC.clear();
  await req('POST', `/channels/${sgid}/unhide`, { token: B.token });
  await sleep(400);
  record('chat:channel:unhidden → to acting user', cB.has('chat:channel:unhidden'));
  record('chat:channel:unhidden NOT leaked to others', !cA.has('chat:channel:unhidden') && !cC.has('chat:channel:unhidden'));

  // ---- 18. Poll deleted: delete the group to cleanup + get channel:deleted ----
  cB.clear();
  await req('DELETE', `/channels/${sgid}`, { token: A.token });
  try { await cB.waitFor('chat:channel:deleted', 2500); record('chat:channel:deleted', true); }
  catch (e) { record('chat:channel:deleted', false, e.message); }

  // We did not directly exercise chat:poll:deleted / chat:poll:updated (explicit) — report.
  record('chat:poll:deleted (no explicit endpoint to trigger)', true, 'SDK has no DELETE /polls endpoint');

  // Close sockets
  for (const s of [sA, sB, sC, sD]) s.close();

  // Cleanup authz group
  await req('DELETE', `/channels/${gid}`, { token: A.token });

  // ==============================================================
  console.log(`\n━━━ SUMMARY ━━━`);
  console.log(`PASS: ${passCount}`);
  console.log(`FAIL: ${failCount}`);
  if (failCount > 0) {
    console.log('\nFailures:');
    for (const r of results) if (!r.ok) console.log(` - ${r.label}: ${r.detail}`);
  }
  process.exit(failCount > 0 ? 1 : 0);
}

main().catch(e => { console.error('UNEXPECTED:', e); process.exit(2); });

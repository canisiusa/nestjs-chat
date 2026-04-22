// E2E test — hits every REST route and verifies Socket.IO events.
// Runs against http://localhost:3001/chat

import { io } from 'socket.io-client';

const BASE = 'http://localhost:3001/chat';
const SOCKET_URL = 'http://localhost:3001';

const results = [];
let passCount = 0;
let failCount = 0;

function record(label, ok, detail = '') {
  results.push({ label, ok, detail });
  if (ok) { passCount++; console.log(`  ✓ ${label}`); }
  else { failCount++; console.log(`  ✗ ${label}  — ${detail}`); }
}

async function req(method, path, { token, body, query } = {}) {
  const url = new URL(BASE + path);
  if (query) for (const [k, v] of Object.entries(query)) if (v !== undefined) url.searchParams.set(k, String(v));
  const headers = { 'content-type': 'application/json' };
  if (token) headers.authorization = `Bearer ${token}`;
  const r = await fetch(url, { method, headers, body: body ? JSON.stringify(body) : undefined });
  let parsed = null;
  const text = await r.text();
  try { parsed = text ? JSON.parse(text) : null; } catch { parsed = text; }
  return { status: r.status, body: parsed };
}

function check(label, res, expectedStatuses = [200, 201, 204]) {
  const ok = expectedStatuses.includes(res.status);
  const detail = ok ? '' : `HTTP ${res.status} ${JSON.stringify(res.body).slice(0, 200)}`;
  record(label, ok, detail);
  return ok;
}

function waitFor(emitter, event, timeoutMs = 2000) {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`timeout waiting for ${event}`)), timeoutMs);
    emitter.once(event, (payload) => { clearTimeout(t); resolve(payload); });
  });
}

async function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// --- Track which routes were hit ---
const ALL_ROUTES = [
  'POST /auth/register', 'POST /auth/login',
  'GET /users/search', 'GET /users/blocked', 'GET /users/{userId}',
  'POST /users/block', 'POST /users/unblock',
  'GET /channels', 'GET /channels/unread-count', 'GET /channels/{id}',
  'POST /channels/direct', 'POST /channels/group', 'PATCH /channels/{id}', 'DELETE /channels/{id}',
  'GET /channels/{id}/members', 'POST /channels/{id}/members/invite',
  'DELETE /channels/{id}/members/{userId}',
  'GET /channels/{id}/operators', 'POST /channels/{id}/operators', 'DELETE /channels/{id}/operators',
  'POST /channels/{id}/read',
  'PUT /channels/{id}/push-trigger', 'GET /channels/{id}/push-trigger',
  'PUT /channels/{id}/count-preference', 'GET /channels/{id}/count-preference',
  'POST /channels/{id}/freeze', 'POST /channels/{id}/unfreeze',
  'POST /channels/{id}/mute', 'POST /channels/{id}/unmute',
  'POST /channels/{id}/members/{userId}/mute', 'POST /channels/{id}/members/{userId}/unmute',
  'GET /channels/{id}/muted-users',
  'POST /channels/{id}/members/{userId}/ban', 'POST /channels/{id}/members/{userId}/unban',
  'GET /channels/{id}/banned-users',
  'POST /channels/{id}/hide', 'POST /channels/{id}/unhide', 'POST /channels/{id}/reset-history',
  'GET /channels/{id}/metadata', 'PUT /channels/{id}/metadata', 'DELETE /channels/{id}/metadata/{key}',
  'POST /channels/{id}/messages/{messageId}/pin', 'DELETE /channels/{id}/messages/{messageId}/pin',
  'GET /channels/{id}/pinned-messages',
  'GET /channels/{id}/shared-files', 'POST /channels/{id}/report',
  'POST /channels/{id}/leave',
  'GET /channels/{id}/messages', 'GET /channels/{id}/messages/{messageId}',
  'POST /channels/{id}/messages', 'PATCH /channels/{id}/messages/{messageId}',
  'DELETE /channels/{id}/messages/{messageId}',
  'GET /channels/{id}/messages/{messageId}/thread',
  'POST /channels/{id}/messages/{messageId}/forward',
  'POST /messages/search',
  'POST /channels/{id}/messages/{messageId}/reactions',
  'DELETE /channels/{id}/messages/{messageId}/reactions/{key}',
  'POST /channels/{channelId}/polls', 'GET /channels/{channelId}/polls/{pollId}',
  'POST /channels/{channelId}/polls/{pollId}/vote',
  'GET /channels/{channelId}/scheduled-messages',
  'POST /channels/{channelId}/scheduled-messages',
  'PATCH /channels/{channelId}/scheduled-messages/{scheduledId}',
  'DELETE /channels/{channelId}/scheduled-messages/{scheduledId}',
  'POST /channels/{channelId}/scheduled-messages/{scheduledId}/send-now',
];
const hit = new Set();
function mark(route) { hit.add(route); }

// ============================================================

async function main() {
  console.log('\n━━━ AUTH ━━━');
  // Login each seeded user
  const users = {};
  for (const u of [
    { key: 'alice', email: 'alice@example.com' },
    { key: 'bob', email: 'bob@example.com' },
    { key: 'charlie', email: 'charlie@example.com' },
    { key: 'diana', email: 'diana@example.com' },
  ]) {
    const r = await req('POST', '/auth/login', { body: { email: u.email, password: 'password' } });
    check(`login ${u.email}`, r, [200, 201]);
    mark('POST /auth/login');
    users[u.key] = { ...u, id: r.body?.user?.id, token: r.body?.token };
  }

  // Register new user
  const newEmail = `test-${Date.now()}@example.com`;
  const reg = await req('POST', '/auth/register', { body: { email: newEmail, name: 'Test Ephemeral', password: 'password' } });
  check(`register ${newEmail}`, reg, [200, 201]);
  mark('POST /auth/register');
  users.ephemeral = { email: newEmail, id: reg.body?.user?.id, token: reg.body?.token };

  const A = users.alice, B = users.bob, C = users.charlie, D = users.diana, E = users.ephemeral;

  console.log('\n━━━ USERS ━━━');
  check('users.search', await req('GET', '/users/search', { token: A.token, query: { keyword: 'bob' } }), [200]);
  mark('GET /users/search');
  check('users.get(B)', await req('GET', `/users/${B.id}`, { token: A.token }), [200]);
  mark('GET /users/{userId}');
  check('users.block(B)', await req('POST', '/users/block', { token: A.token, body: { userId: B.id } }), [200, 201]);
  mark('POST /users/block');
  check('users.blocked list', await req('GET', '/users/blocked', { token: A.token }), [200]);
  mark('GET /users/blocked');
  check('users.unblock(B)', await req('POST', '/users/unblock', { token: A.token, body: { userId: B.id } }), [200, 201]);
  mark('POST /users/unblock');

  console.log('\n━━━ CHANNELS (create) ━━━');
  const direct = await req('POST', '/channels/direct', { token: A.token, body: { userId: B.id } });
  check('channels.direct(A,B)', direct, [200, 201]);
  mark('POST /channels/direct');
  const directId = direct.body?.id;

  const group = await req('POST', '/channels/group', { token: A.token, body: { userIds: [B.id, C.id], name: 'E2E Group' } });
  check('channels.group(A,B,C)', group, [200, 201]);
  mark('POST /channels/group');
  const groupId = group.body?.id;

  check('channels.list', await req('GET', '/channels', { token: A.token }), [200]);
  mark('GET /channels');
  check('channels.unread-count', await req('GET', '/channels/unread-count', { token: A.token }), [200]);
  mark('GET /channels/unread-count');
  check('channels.get', await req('GET', `/channels/${groupId}`, { token: A.token }), [200]);
  mark('GET /channels/{id}');
  check('channels.patch', await req('PATCH', `/channels/${groupId}`, { token: A.token, body: { name: 'E2E Group Renamed' } }), [200]);
  mark('PATCH /channels/{id}');

  console.log('\n━━━ MEMBERS / OPERATORS ━━━');
  check('members.list', await req('GET', `/channels/${groupId}/members`, { token: A.token }), [200]);
  mark('GET /channels/{id}/members');
  check('members.invite(D)', await req('POST', `/channels/${groupId}/members/invite`, { token: A.token, body: { userIds: [D.id] } }), [200, 201]);
  mark('POST /channels/{id}/members/invite');
  check('operators.list', await req('GET', `/channels/${groupId}/operators`, { token: A.token }), [200]);
  mark('GET /channels/{id}/operators');
  check('operators.add(B)', await req('POST', `/channels/${groupId}/operators`, { token: A.token, body: { userIds: [B.id] } }), [200, 201]);
  mark('POST /channels/{id}/operators');
  check('operators.remove(B)', await req('DELETE', `/channels/${groupId}/operators`, { token: A.token, body: { userIds: [B.id] } }), [200, 204]);
  mark('DELETE /channels/{id}/operators');

  console.log('\n━━━ READ / PREFS ━━━');
  check('channels.read', await req('POST', `/channels/${groupId}/read`, { token: A.token }), [200, 201, 204]);
  mark('POST /channels/{id}/read');
  check('push-trigger.set', await req('PUT', `/channels/${groupId}/push-trigger`, { token: A.token, body: { option: 'mention_only' } }), [200]);
  mark('PUT /channels/{id}/push-trigger');
  check('push-trigger.get', await req('GET', `/channels/${groupId}/push-trigger`, { token: A.token }), [200]);
  mark('GET /channels/{id}/push-trigger');
  check('count-preference.set', await req('PUT', `/channels/${groupId}/count-preference`, { token: A.token, body: { preference: 'unread_message_count_only' } }), [200]);
  mark('PUT /channels/{id}/count-preference');
  check('count-preference.get', await req('GET', `/channels/${groupId}/count-preference`, { token: A.token }), [200]);
  mark('GET /channels/{id}/count-preference');

  console.log('\n━━━ METADATA ━━━');
  check('metadata.set', await req('PUT', `/channels/${groupId}/metadata`, { token: A.token, body: { metadata: { color: 'blue', tag: 'e2e' } } }), [200]);
  mark('PUT /channels/{id}/metadata');
  check('metadata.get', await req('GET', `/channels/${groupId}/metadata`, { token: A.token }), [200]);
  mark('GET /channels/{id}/metadata');
  check('metadata.delete(tag)', await req('DELETE', `/channels/${groupId}/metadata/tag`, { token: A.token }), [200, 204]);
  mark('DELETE /channels/{id}/metadata/{key}');

  console.log('\n━━━ MESSAGES ━━━');
  const msg1 = await req('POST', `/channels/${groupId}/messages`, { token: A.token, body: { text: 'Hello E2E world!' } });
  check('messages.send', msg1, [200, 201]);
  mark('POST /channels/{id}/messages');
  const msg1Id = msg1.body?.id;

  const msg2 = await req('POST', `/channels/${groupId}/messages`, { token: B.token, body: { text: `Reply parent`, parentMessageId: msg1Id } });
  check('messages.send reply', msg2, [200, 201]);
  const msg2Id = msg2.body?.id;

  check('messages.list', await req('GET', `/channels/${groupId}/messages`, { token: A.token, query: { limit: 20 } }), [200]);
  mark('GET /channels/{id}/messages');
  check('messages.get', await req('GET', `/channels/${groupId}/messages/${msg1Id}`, { token: A.token }), [200]);
  mark('GET /channels/{id}/messages/{messageId}');
  check('messages.thread', await req('GET', `/channels/${groupId}/messages/${msg1Id}/thread`, { token: A.token }), [200]);
  mark('GET /channels/{id}/messages/{messageId}/thread');
  check('messages.patch', await req('PATCH', `/channels/${groupId}/messages/${msg1Id}`, { token: A.token, body: { text: 'Hello E2E edited' } }), [200]);
  mark('PATCH /channels/{id}/messages/{messageId}');

  // forward
  const msgInDirect = await req('POST', `/channels/${directId}/messages`, { token: A.token, body: { text: 'msg for forward' } });
  const forwardSrc = msgInDirect.body?.id;
  check('messages.forward', await req('POST', `/channels/${directId}/messages/${forwardSrc}/forward`, { token: A.token, body: { targetChannelId: groupId } }), [200, 201]);
  mark('POST /channels/{id}/messages/{messageId}/forward');

  // search
  check('messages.search', await req('POST', '/messages/search', { token: A.token, body: { channelId: groupId, keyword: 'E2E' } }), [200, 201]);
  mark('POST /messages/search');

  console.log('\n━━━ REACTIONS ━━━');
  check('reactions.add', await req('POST', `/channels/${groupId}/messages/${msg1Id}/reactions`, { token: A.token, body: { key: 'thumbs_up' } }), [200, 201]);
  mark('POST /channels/{id}/messages/{messageId}/reactions');
  check('reactions.remove', await req('DELETE', `/channels/${groupId}/messages/${msg1Id}/reactions/thumbs_up`, { token: A.token }), [200, 204]);
  mark('DELETE /channels/{id}/messages/{messageId}/reactions/{key}');

  console.log('\n━━━ PINNED ━━━');
  check('pinned.pin', await req('POST', `/channels/${groupId}/messages/${msg1Id}/pin`, { token: A.token }), [200, 201]);
  mark('POST /channels/{id}/messages/{messageId}/pin');
  check('pinned.list', await req('GET', `/channels/${groupId}/pinned-messages`, { token: A.token }), [200]);
  mark('GET /channels/{id}/pinned-messages');
  check('pinned.unpin', await req('DELETE', `/channels/${groupId}/messages/${msg1Id}/pin`, { token: A.token }), [200, 204]);
  mark('DELETE /channels/{id}/messages/{messageId}/pin');

  console.log('\n━━━ SHARED FILES / REPORT ━━━');
  check('shared-files.list', await req('GET', `/channels/${groupId}/shared-files`, { token: A.token, query: { limit: 20 } }), [200]);
  mark('GET /channels/{id}/shared-files');
  check('channel.report', await req('POST', `/channels/${groupId}/report`, { token: B.token, body: { category: 'spam', description: 'e2e test report' } }), [200, 201]);
  mark('POST /channels/{id}/report');

  console.log('\n━━━ POLLS ━━━');
  const poll = await req('POST', `/channels/${groupId}/polls`, { token: A.token, body: { title: 'Lunch?', options: ['Pizza', 'Sushi'], allowMultipleVotes: false } });
  check('polls.create', poll, [200, 201]);
  mark('POST /channels/{channelId}/polls');
  const pollId = poll.body?.poll?.id;
  const pollOptionId = poll.body?.poll?.options?.[0]?.id;
  const pg = await req('GET', `/channels/${groupId}/polls/${pollId}`, { token: A.token });
  check('polls.get', pg, [200]);
  mark('GET /channels/{channelId}/polls/{pollId}');
  check('polls.vote', await req('POST', `/channels/${groupId}/polls/${pollId}/vote`, { token: B.token, body: { optionIds: [pollOptionId] } }), [200, 201]);
  mark('POST /channels/{channelId}/polls/{pollId}/vote');

  console.log('\n━━━ SCHEDULED ━━━');
  const soon = new Date(Date.now() + 60_000).toISOString();
  const sched = await req('POST', `/channels/${groupId}/scheduled-messages`, { token: A.token, body: { text: 'Scheduled hi', scheduledAt: soon } });
  check('scheduled.create', sched, [200, 201]);
  mark('POST /channels/{channelId}/scheduled-messages');
  const schedId = sched.body?.id;
  check('scheduled.list', await req('GET', `/channels/${groupId}/scheduled-messages`, { token: A.token }), [200]);
  mark('GET /channels/{channelId}/scheduled-messages');
  check('scheduled.patch', await req('PATCH', `/channels/${groupId}/scheduled-messages/${schedId}`, { token: A.token, body: { text: 'Scheduled hi edited' } }), [200]);
  mark('PATCH /channels/{channelId}/scheduled-messages/{scheduledId}');

  // create another then send-now
  const sched2 = await req('POST', `/channels/${groupId}/scheduled-messages`, { token: A.token, body: { text: 'Scheduled to send now', scheduledAt: new Date(Date.now() + 3_600_000).toISOString() } });
  const sched2Id = sched2.body?.id;
  check('scheduled.sendNow', await req('POST', `/channels/${groupId}/scheduled-messages/${sched2Id}/send-now`, { token: A.token }), [200, 201]);
  mark('POST /channels/{channelId}/scheduled-messages/{scheduledId}/send-now');

  check('scheduled.delete', await req('DELETE', `/channels/${groupId}/scheduled-messages/${schedId}`, { token: A.token }), [200, 204]);
  mark('DELETE /channels/{channelId}/scheduled-messages/{scheduledId}');

  console.log('\n━━━ MODERATION (channel-level) ━━━');
  check('channel.freeze', await req('POST', `/channels/${groupId}/freeze`, { token: A.token }), [200, 201]);
  mark('POST /channels/{id}/freeze');
  check('channel.unfreeze', await req('POST', `/channels/${groupId}/unfreeze`, { token: A.token }), [200, 201]);
  mark('POST /channels/{id}/unfreeze');
  check('channel.mute (self)', await req('POST', `/channels/${groupId}/mute`, { token: A.token }), [200, 201]);
  mark('POST /channels/{id}/mute');
  check('channel.unmute (self)', await req('POST', `/channels/${groupId}/unmute`, { token: A.token }), [200, 201]);
  mark('POST /channels/{id}/unmute');

  console.log('\n━━━ MODERATION (member-level) ━━━');
  check('member.mute(D)', await req('POST', `/channels/${groupId}/members/${D.id}/mute`, { token: A.token, body: { seconds: 10 } }), [200, 201]);
  mark('POST /channels/{id}/members/{userId}/mute');
  check('muted.list', await req('GET', `/channels/${groupId}/muted-users`, { token: A.token }), [200]);
  mark('GET /channels/{id}/muted-users');
  check('member.unmute(D)', await req('POST', `/channels/${groupId}/members/${D.id}/unmute`, { token: A.token }), [200, 201]);
  mark('POST /channels/{id}/members/{userId}/unmute');

  check('member.ban(D)', await req('POST', `/channels/${groupId}/members/${D.id}/ban`, { token: A.token, body: { description: 'e2e ban', seconds: 60 } }), [200, 201]);
  mark('POST /channels/{id}/members/{userId}/ban');
  check('banned.list', await req('GET', `/channels/${groupId}/banned-users`, { token: A.token }), [200]);
  mark('GET /channels/{id}/banned-users');
  check('member.unban(D)', await req('POST', `/channels/${groupId}/members/${D.id}/unban`, { token: A.token }), [200, 201]);
  mark('POST /channels/{id}/members/{userId}/unban');

  console.log('\n━━━ VISIBILITY ━━━');
  check('channel.hide', await req('POST', `/channels/${groupId}/hide`, { token: A.token, body: { hidePreviousMessages: false } }), [200, 201]);
  mark('POST /channels/{id}/hide');
  check('channel.unhide', await req('POST', `/channels/${groupId}/unhide`, { token: A.token }), [200, 201]);
  mark('POST /channels/{id}/unhide');
  check('channel.resetHistory', await req('POST', `/channels/${groupId}/reset-history`, { token: A.token }), [200, 201]);
  mark('POST /channels/{id}/reset-history');

  console.log('\n━━━ LEAVE / DELETES ━━━');
  // C leaves the group
  check('channel.leave(C)', await req('POST', `/channels/${groupId}/leave`, { token: C.token }), [200, 201, 204]);
  mark('POST /channels/{id}/leave');
  // Remove D
  check('member.remove(D)', await req('DELETE', `/channels/${groupId}/members/${D.id}`, { token: A.token }), [200, 204]);
  mark('DELETE /channels/{id}/members/{userId}');
  // Delete message
  check('messages.delete', await req('DELETE', `/channels/${groupId}/messages/${msg2Id}`, { token: B.token }), [200, 204]);
  mark('DELETE /channels/{id}/messages/{messageId}');

  console.log('\n━━━ SOCKET.IO ━━━');
  await socketTests(A, B, directId);

  // Delete channel last
  check('channel.delete', await req('DELETE', `/channels/${groupId}`, { token: A.token }), [200, 204]);
  mark('DELETE /channels/{id}');

  // --- Coverage check ---
  console.log('\n━━━ COVERAGE ━━━');
  const missing = ALL_ROUTES.filter(r => !hit.has(r));
  if (missing.length === 0) {
    console.log(`  ✓ All ${ALL_ROUTES.length} REST routes exercised (${ALL_ROUTES.length - 2} SDK + 2 example auth).`);
  } else {
    console.log(`  ✗ Missing ${missing.length} routes:`);
    for (const m of missing) console.log('    -', m);
  }

  console.log(`\n━━━ SUMMARY ━━━`);
  console.log(`PASS: ${passCount}`);
  console.log(`FAIL: ${failCount}`);
  if (failCount > 0) {
    console.log('\nFailures:');
    for (const r of results) if (!r.ok) console.log(` - ${r.label}: ${r.detail}`);
    process.exit(1);
  }
  process.exit(0);
}

async function socketTests(A, B, directId) {
  const sA = io(SOCKET_URL + '/chat', { auth: { token: A.token }, transports: ['websocket'], forceNew: true });
  const sB = io(SOCKET_URL + '/chat', { auth: { token: B.token }, transports: ['websocket'], forceNew: true });

  try {
    await Promise.all([
      new Promise((res, rej) => { sA.once('connect', res); sA.once('connect_error', rej); setTimeout(() => rej(new Error('A connect timeout')), 3000); }),
      new Promise((res, rej) => { sB.once('connect', res); sB.once('connect_error', rej); setTimeout(() => rej(new Error('B connect timeout')), 3000); }),
    ]);
    record('socket.connect A+B', true);
  } catch (e) {
    record('socket.connect A+B', false, e.message);
    sA.close(); sB.close();
    return;
  }

  // Join channel
  sA.emit('chat:join:channel', { channelId: directId });
  sB.emit('chat:join:channel', { channelId: directId });
  await sleep(200);

  // A sends typing → B should receive chat:typing:status:updated
  try {
    const typingProm = waitFor(sB, 'chat:typing:status:updated', 2500);
    sA.emit('chat:typing:start', { channelId: directId });
    const payload = await typingProm;
    record('socket.typing:start → typing:status:updated', !!payload);
  } catch (e) {
    record('socket.typing:start → typing:status:updated', false, e.message);
  }

  // A sends a REST message → B should receive chat:message:received
  try {
    const msgProm = waitFor(sB, 'chat:message:received', 3000);
    const r = await req('POST', `/channels/${directId}/messages`, { token: A.token, body: { text: 'hello via socket test' } });
    if (r.status >= 400) throw new Error(`REST send failed: ${r.status}`);
    const payload = await msgProm;
    record('socket.message:received after REST send', !!payload);
  } catch (e) {
    record('socket.message:received after REST send', false, e.message);
  }

  // Leave channel
  sA.emit('chat:leave:channel', { channelId: directId });
  sB.emit('chat:leave:channel', { channelId: directId });
  await sleep(100);
  sA.close(); sB.close();
  record('socket.close', true);
}

main().catch(e => { console.error('UNEXPECTED:', e); process.exit(2); });

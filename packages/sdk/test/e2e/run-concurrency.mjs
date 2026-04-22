// Tests: DB transactions, race conditions, idempotence.
const BASE = 'http://localhost:3001/chat';

const results = [];
let pass = 0, fail = 0;
function record(label, ok, detail = '') {
  results.push({ label, ok, detail });
  if (ok) { pass++; console.log(`  ✓ ${label}`); }
  else { fail++; console.log(`  ✗ ${label}  — ${detail}`); }
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

async function login(email) {
  const r = await req('POST', '/auth/login', { body: { email, password: 'password' } });
  return { id: r.body.user.id, token: r.body.token };
}

async function main() {
  const A = await login('alice@example.com');
  const B = await login('bob@example.com');
  const C = await login('charlie@example.com');
  console.log('Setup: A, B, C\n');

  // ============================================================
  console.log('━━━ 1. RACE — 2 direct channels simultanés ━━━');
  // Clean slate: delete any existing direct between A and B
  const cleanup1 = await req('POST', '/channels/direct', { token: A.token, body: { userId: C.id } });
  if (cleanup1.body?.id) await req('DELETE', `/channels/${cleanup1.body.id}`, { token: A.token });

  // Fire 20 parallel direct-create requests for A→C (harder race)
  const parallel = await Promise.all(
    Array.from({ length: 20 }, () =>
      req('POST', '/channels/direct', { token: A.token, body: { userId: C.id } }),
    ),
  );
  const ids = new Set(parallel.map((r) => r.body?.id).filter(Boolean));
  const statuses = parallel.map(r => r.status);
  record(`20 parallel direct requests → 1 channel (got ${ids.size})`, ids.size === 1,
    `ids: ${[...ids].join(', ')} statuses: ${[...new Set(statuses)].join(',')}`);

  // Cleanup — but delete ALL channels created to avoid pollution
  for (const id of ids) await req('DELETE', `/channels/${id}`, { token: A.token });

  // ============================================================
  console.log('\n━━━ 2. RACE — direct depuis A et C en même temps ━━━');
  // A creates A→B and C creates C→A at the same time (different pairs, no conflict)
  // But what if two different users BOTH try to create THE SAME pair?
  // Actually the pair (A,B) is symmetric — let's test both sides starting at same time.
  const both = await Promise.all([
    req('POST', '/channels/direct', { token: A.token, body: { userId: B.id } }),
    req('POST', '/channels/direct', { token: B.token, body: { userId: A.id } }),
  ]);
  const idA = both[0].body?.id;
  const idB = both[1].body?.id;
  record('A→B and B→A parallel return same channel', idA === idB,
    `A got ${idA}, B got ${idB}`);
  if (idA) await req('DELETE', `/channels/${idA}`, { token: A.token });
  if (idB && idB !== idA) await req('DELETE', `/channels/${idB}`, { token: B.token });

  // ============================================================
  console.log('\n━━━ 3. IDEMPOTENCE — double-POST message ━━━');
  const g = await req('POST', '/channels/group', { token: A.token, body: { userIds: [B.id], name: 'idem' } });
  const gid = g.body.id;

  // Send same text twice in parallel — do we get 2 messages?
  const dup = await Promise.all([
    req('POST', `/channels/${gid}/messages`, { token: A.token, body: { text: 'double-click' } }),
    req('POST', `/channels/${gid}/messages`, { token: A.token, body: { text: 'double-click' } }),
  ]);
  const msgIds = new Set(dup.map((r) => r.body?.id).filter(Boolean));
  record('double POST same message → 2 messages created', msgIds.size === 2,
    `expected 2 (server has no idempotency), got ${msgIds.size}`);

  // Idempotency-Key header support is intentionally out of scope for now
  // (see CHANGELOG). If added later, re-enable this assertion:
  //
  //   const key = 'test-idem-key-' + Date.now();
  //   const idem = await Promise.all([
  //     req('POST', `/channels/${gid}/messages`, {
  //       token: A.token, body: { text: 'idem-msg' },
  //       headers: { 'idempotency-key': key },
  //     }),
  //     req('POST', `/channels/${gid}/messages`, {
  //       token: A.token, body: { text: 'idem-msg' },
  //       headers: { 'idempotency-key': key },
  //     }),
  //   ]);
  //   const idemIds = new Set(idem.map((r) => r.body?.id).filter(Boolean));
  //   record('POST with same Idempotency-Key → 1 message (dedup)', idemIds.size === 1);

  // ============================================================
  console.log('\n━━━ 4. IDEMPOTENCE — double-POST group channel ━━━');
  const gdup = await Promise.all([
    req('POST', '/channels/group', { token: A.token, body: { userIds: [B.id], name: 'dupgrp' } }),
    req('POST', '/channels/group', { token: A.token, body: { userIds: [B.id], name: 'dupgrp' } }),
  ]);
  const gIds = new Set(gdup.map((r) => r.body?.id).filter(Boolean));
  record('double POST group → 2 distinct groups', gIds.size === 2,
    `groups are NOT deduplicated by (tenantId,name,members): got ${gIds.size}`);
  for (const id of gIds) await req('DELETE', `/channels/${id}`, { token: A.token });

  // ============================================================
  console.log('\n━━━ 5. TRANSACTIONALITY — nested create atomicity ━━━');
  // Try to create a group with a duplicate userId array — should fail (unique constraint on channelId_userId)
  // If not atomic, we could see a channel created with partial members and memberCount wrong.
  const badGroup = await req('POST', '/channels/group', {
    token: A.token,
    body: { userIds: [B.id, B.id, C.id], name: 'dup userids' },
  });
  // Either it creates 1 channel (Set dedup already happened in service) or it errors
  record('group with duplicate userIds handled (no partial create)',
    [200, 201, 400, 409].includes(badGroup.status),
    `HTTP ${badGroup.status} ${JSON.stringify(badGroup.body).slice(0, 200)}`);
  if (badGroup.body?.id) {
    const members = await req('GET', `/channels/${badGroup.body.id}/members`, { token: A.token });
    const memberCount = Array.isArray(members.body) ? members.body.length : (members.body?.members?.length ?? 0);
    record('memberCount matches actual members after dedup', memberCount === 3,
      `got ${memberCount} members`);
    await req('DELETE', `/channels/${badGroup.body.id}`, { token: A.token });
  }

  // ============================================================
  console.log('\n━━━ 6. CONSISTENCY — memberCount vs actual members ━━━');
  const g2 = await req('POST', '/channels/group', { token: A.token, body: { userIds: [B.id, C.id], name: 'count check' } });
  const g2id = g2.body.id;
  // Parallel: A invites D, C leaves
  const D = await login('diana@example.com');
  await Promise.all([
    req('POST', `/channels/${g2id}/members/invite`, { token: A.token, body: { userIds: [D.id] } }),
    req('POST', `/channels/${g2id}/leave`, { token: C.token }),
  ]);
  const after = await req('GET', `/channels/${g2id}`, { token: A.token });
  const actualMembers = await req('GET', `/channels/${g2id}/members`, { token: A.token });
  const actualCount = Array.isArray(actualMembers.body) ? actualMembers.body.filter(m => !m.leftAt).length : 0;
  const reportedCount = after.body?.memberCount;
  record('memberCount stays consistent after parallel invite+leave',
    reportedCount === actualCount,
    `reported=${reportedCount} actual=${actualCount}`);
  await req('DELETE', `/channels/${g2id}`, { token: A.token });

  // ============================================================
  console.log('\n━━━ 7. REACTION — double-POST same key ━━━');
  const g3 = await req('POST', '/channels/group', { token: A.token, body: { userIds: [B.id], name: 'react' } });
  const g3id = g3.body.id;
  const m = await req('POST', `/channels/${g3id}/messages`, { token: A.token, body: { text: 'react me' } });
  const mId = m.body.id;
  const rdup = await Promise.all([
    req('POST', `/channels/${g3id}/messages/${mId}/reactions`, { token: A.token, body: { key: 'fire' } }),
    req('POST', `/channels/${g3id}/messages/${mId}/reactions`, { token: A.token, body: { key: 'fire' } }),
  ]);
  // Check that only 1 reaction row exists (should be idempotent upsert)
  const mr = await req('GET', `/channels/${g3id}/messages`, { token: A.token, query: { includeReactions: true, limit: 5 } });
  const msgs = Array.isArray(mr.body) ? mr.body : (mr.body?.messages || []);
  const found = msgs.find(x => x.id === mId);
  const fireCount = (found?.reactions || []).filter(r => r.key === 'fire' || r.reactionKey === 'fire').length;
  record('double reaction from same user → upserted (1 entry)', fireCount === 1,
    `got ${fireCount} fire reactions; responses: ${rdup.map(r => r.status).join(',')}`);
  await req('DELETE', `/channels/${g3id}`, { token: A.token });

  // ============================================================
  console.log('\n━━━ 8. BLOCK — double-POST same user ━━━');
  const b1 = await req('POST', '/users/block', { token: A.token, body: { userId: B.id } });
  const b2 = await req('POST', '/users/block', { token: A.token, body: { userId: B.id } });
  record('double block same user → both succeed (idempotent)',
    [200, 201].includes(b1.status) && [200, 201].includes(b2.status),
    `b1=${b1.status} b2=${b2.status}`);
  const blockedList = await req('GET', '/users/blocked', { token: A.token });
  const arr = Array.isArray(blockedList.body) ? blockedList.body : (blockedList.body?.users ?? []);
  const count = arr.filter(u => u.id === B.id).length;
  record('B appears only once in blocked list after double block', count === 1, `count=${count}`);
  await req('POST', '/users/unblock', { token: A.token, body: { userId: B.id } });

  // ============================================================
  console.log(`\n━━━ SUMMARY ━━━`);
  console.log(`PASS: ${pass}`);
  console.log(`FAIL: ${fail}`);
  if (fail > 0) {
    console.log('\nFailures:');
    for (const r of results) if (!r.ok) console.log(` - ${r.label}: ${r.detail}`);
  }
  process.exit(fail > 0 ? 1 : 0);
}

main().catch(e => { console.error('UNEXPECTED:', e); process.exit(2); });

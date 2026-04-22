# E2E Tests

Four integration suites that exercise the SDK end-to-end against a running example app. Together they assert **199 behaviors** across REST routes, Socket.IO events, authorization, tenant isolation, concurrency, and security hardening.

## Suites

| Script | Assertions | What it covers |
|---|---|---|
| `run.mjs` | 73 | Golden path — every REST route, basic Socket.IO lifecycle, route coverage check |
| `run-extended.mjs` | 82 | Auth negatives, cross-tenant isolation, non-member/non-operator authz, frozen/banned/muted behavior, ownership rules, invalid payloads, all 33 Socket.IO events |
| `run-hardening.mjs` | 34 | Socket JWT validation, mute/ban auto-expiry, ghost scheduled messages, blocked-user filtering, rate limit, search injection, pagination, metadata size, reset-history |
| `run-concurrency.mjs` | 10 | Race conditions on direct-channel creation, double-POST behavior, nested-create transactionality, memberCount consistency under parallel invite+leave, reaction / block upsert semantics. One assertion (Idempotency-Key) is commented out — feature intentionally out of scope. |

## Prerequisites

Running locally before invoking the suites:

1. **PostgreSQL** on `localhost:5432` with a role `canisius` (or adjust `apps/example/.env`).
2. **Redis** on `localhost:6379`.
3. Apply schemas and seed users:
   ```bash
   # from the repo root
   cd packages/sdk && DATABASE_URL="postgresql://canisius@localhost:5432/chat_service?schema=public" pnpm exec prisma db push
   cd ../../apps/example && DATABASE_URL="postgresql://canisius@localhost:5432/chat_example?schema=public" pnpm exec prisma db push
   pnpm seed  # creates alice / bob / charlie / diana / eve with password "password"
   ```
4. Start the example app in another terminal:
   ```bash
   pnpm --filter @chat-service/example start:dev
   ```
   Wait until `Example app running on http://localhost:3001/chat` appears.

## Running

From the repo root or from `packages/sdk/`:

```bash
pnpm --filter nestjs-chat test:e2e            # run all four suites sequentially
pnpm --filter nestjs-chat test:e2e:golden     # just the golden path (73)
pnpm --filter nestjs-chat test:e2e:extended   # authz + tenant + all socket events (82)
pnpm --filter nestjs-chat test:e2e:hardening  # security + edge cases (34)
pnpm --filter nestjs-chat test:e2e:concurrency # races + transactions (10)
```

Each script prints a per-check log (`✓` / `✗`) and a final `PASS / FAIL` summary. Exit code is `0` on full pass, `1` on any failure, `2` on unexpected runtime error.

## What "pass" means today

All four suites pass 100% against the current `main`. Known intentional non-implementations (no `Idempotency-Key` storage, no upload route, no voice/video endpoints) are not failing tests — they are simply out of scope.

## Extending

Each script uses plain `fetch` + `socket.io-client` — no framework. To add an assertion:

1. Add a `record(label, ok, detail)` call inside the relevant section.
2. Ensure cleanup at the end of the suite (`DELETE` any channels/users you created).
3. Re-run the suite to verify no state leaks between runs.

New feature? New suite file is fine — add a `test:e2e:<name>` entry in `package.json` and list it in this README.

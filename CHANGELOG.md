# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Fixed

- **`ChatExceptionFilter` now auto-registered by `ChatModule`.** Previously the filter lived in `packages/sdk/src/common/filters/` but was never wired up. Integrators could throw `ChatException` subclasses and get HTTP 500 responses with "Internal server error" instead of the mapped status + `code`. The filter is now provided via `APP_FILTER` from both `forRoot` and `forRootAsync`.
- **Exception filter uses duck-typing instead of `instanceof`** for `ChatException` and `HttpException`. Monorepos with multiple `@nestjs/common` versions in the dependency graph (different `class-validator` peer ranges) broke the `instanceof` check across that boundary — validation errors from NestJS appeared as HTTP 500 even though they extended `BadRequestException`. Now we detect exception shape by presence of `getStatus()` + `getResponse()` / `code.startsWith('CHAT_')`.

### Added

- **E2E test suite committed to the repo** under `packages/sdk/test/e2e/` (4 scripts, 199/199 PASS). New npm scripts: `test:e2e`, `test:e2e:golden`, `test:e2e:extended`, `test:e2e:hardening`, `test:e2e:concurrency`. Requires Postgres + Redis + seeded example app running on `:3001`.

## [0.2.0] — 2026-04-20

Security, multi-tenancy, and event-scoping hardening pass. Driven by exhaustive E2E testing (200+ assertions across golden path, authz, tenant isolation, Socket.IO events, and concurrency suites) that surfaced 14 real bugs, all fixed.

### Added

- **Unique constraint on direct channels.** New column `ChatChannel.directKey` (`tenantId:sortedUserIdA:sortedUserIdB`) with `@@unique`. Guarantees at most one active direct channel per user pair per tenant, even under concurrent creation. `createDirectChannel` catches `P2002` to return the winner of the race.
- **Event `chat:channel:unhidden`** (new in `ChatSocketEvent` enum). Emitted to the acting user when they unhide a channel. Fixes multi-tab UX where a user unhiding in tab A couldn't see the channel reappear in tab B.
- **Rate limit on `/auth/login`** in the example app (10 attempts / min per `ip:email`, returns 429). Demo-grade in-memory throttle; production should use `@nestjs/throttler` + Redis.
- **Tenant scoping in `IChatUserResolver.getUser`.** Optional `tenantId` argument propagated through `ChatUserService` and `ChatUserController` so `GET /users/:userId` no longer leaks profiles across tenants. Non-breaking for existing resolver implementations (argument is optional).
- **CLI `chat-migrate`** (via `bin/migrate.js`) bundles Prisma 7 to apply schema migrations without conflicting with the host app's Prisma version.

### Changed

- **Socket authentication is now mandatory and JWT-verified.** The gateway no longer accepts `{ auth: { userId, tenantId } }` from the handshake — it reads a Bearer token (`auth.token` or `Authorization` header), passes a synthetic request to `IChatUserExtractor`, and disconnects clients that don't produce a valid user. Previously any client could impersonate any user by submitting an arbitrary `userId`.
- **HTTP status `MESSAGE_NOT_OWNER` mapped to 403** in `ERROR_HTTP_STATUS` (was defaulting to 500).
- **`ChannelMemberGuard` auto-lifts expired bans/mutes.** When `bannedUntil` / `mutedUntil` is in the past, the guard clears the flag in DB and lets the request through. Previously timed bans stayed effectively permanent until manually unbanned.
- **Channel-mute / channel-unmute / channel-hidden events are now per-user.** `CHANNEL_MUTED`, `CHANNEL_UNMUTED`, `CHANNEL_HIDDEN` used to be broadcast to the whole channel room, leaking personal preference state (and without even including the acting `userId`). They are now emitted via `emitToUser(userId, ...)` only. Payload now includes `userId` for consistency.
- **Invite emits `CHANNEL_MEMBER_COUNT_CHANGED`.** Previously only `leaveChannel` did. Now both `inviteUsers` and `leaveChannel` emit the event, so clients stay in sync in both directions.
- **`createDirectChannel` / `createGroupChannel` validate target user existence.** Previously these accepted arbitrary user IDs (channels got created with phantom members). They now call `userResolver.getUser` / `getUsers` and throw `USER_NOT_FOUND` if any target is missing.
- **Scheduled messages no longer delivered after sender leaves.** `processScheduledMessage` checks `channel.deletedAt` and the sender's membership (`leftAt`, `isBanned`) before invoking `sendTextMessage`; otherwise marks the scheduled message as `FAILED`.
- **Forward-to-frozen-channel now rejected.** `forwardMessage` verifies the target channel is not frozen (unless the sender is operator), and that the sender is not muted in the target.
- **Blocked-user messages filtered from REST message lists.** `getMessages` now excludes `senderId IN (blockerId's blocked list)`. The Socket.IO path was already OK.
- **`ReportDto.category` normalized before Prisma.** DTO accepts `spam/harassment/...` (lowercase); service uppercases to match the `ChatReportCategory` enum. Previously produced HTTP 500 on `POST /channels/:id/report`.

### Fixed

- **`ChannelMetadataDto.metadata`** missing `@IsObject()` — whitelist validation stripped the field, making `PUT /channels/:id/metadata` always fail with "property metadata should not exist".
- **Example app `LoginDto` / `RegisterDto`** missing `class-validator` decorators — `forbidNonWhitelisted: true` rejected every body on `/auth/login` and `/auth/register`.
- **`ChannelMuted` and `ChannelUnmuted` payloads** now carry `userId` (were missing, making the events ambiguous about who muted).

### Removed

- **`x-user-id` / `x-tenant-id` header fallback** in `ExampleAuthGuard` and `ExampleUserExtractor`. These were a dev-mode convenience that became a production-grade impersonation vector if ever deployed.

### Security

- Socket impersonation fix (see *Changed*) is the most critical item — it allowed anyone who knew a user ID to receive that user's private messages.
- Cross-tenant user disclosure via `GET /users/:userId` closed (see *Added*).
- Timed ban/mute now actually expire (see *Changed*).

## [0.1.0] — 2026-04-07

Initial release.

### Added

- Monorepo scaffold: `packages/sdk` (distributable NestJS module) + `packages/client` (React provider) + `apps/example` (reference integration with JWT auth + seeded users).
- `ChatModule.forRoot()` and `ChatModule.forRootAsync()` entry points; integrator provides `IChatAuthGuard`, `IChatUserExtractor`, `IChatUserResolver`, and optionally `IChatStorageProvider`, `IChatEventHandler`.
- 63 REST endpoints covering channels (direct + group), messages (text + threads + forwarding + search), reactions, pinned messages, polls, scheduled messages (BullMQ-backed), users (search + block), moderation (freeze, mute, ban, operators), per-user preferences (push trigger, count preference, hide, reset-history), metadata, reporting, shared files.
- 33 Socket.IO events under the `/chat` namespace with Redis adapter for horizontal scaling.
- Prisma 7 schema with 11 models; PostgreSQL as the chat DB (separate from the host app's DB).
- Swagger docs auto-mounted at `/docs/api`.
- VitePress documentation site under `/docs`.

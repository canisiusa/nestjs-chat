---
title: Architecture
description: Technical architecture of the Chat Service SDK — monorepo structure, modules, error handling, logging.
---

# Architecture

## Monorepo Structure

```
chat-service/
├── packages/
│   ├── sdk/                             # nestjs-chat — the NestJS module
│   │   ├── src/
│   │   │   ├── chat.module.ts           # ChatModule.forRoot() / forRootAsync()
│   │   │   ├── chat-module-options.ts   # ChatModuleOptions & ChatModuleProviders interfaces
│   │   │   ├── index.ts                 # Barrel export (public API)
│   │   │   │
│   │   │   ├── core/                    # SDK contract — what the host must implement
│   │   │   │   ├── interfaces/          # IChatAuthGuard, IChatUserExtractor, IChatUserResolver,
│   │   │   │   │                        # IChatStorageProvider, IChatEventHandler
│   │   │   │   ├── tokens/              # Injection tokens (@Inject(CHAT_AUTH_GUARD), etc.)
│   │   │   │   ├── types/               # Shared types (ChatUser, standardized responses)
│   │   │   │   └── constants/           # Default values, room names, BullMQ queues
│   │   │   │
│   │   │   ├── common/                  # Cross-module shared code
│   │   │   │   ├── prisma/              # PrismaService (PostgreSQL adapter)
│   │   │   │   ├── guards/              # ChatAuthGuard — delegates to the host's guard
│   │   │   │   ├── decorators/          # @CurrentChatUser() — extracts the user from the request
│   │   │   │   ├── exceptions/          # ChatException, ChatErrorCode, handleServiceError
│   │   │   │   ├── filters/             # ChatExceptionFilter (Prisma + HTTP + unknown errors)
│   │   │   │   ├── interceptors/        # ChatResponseInterceptor (standardized response format)
│   │   │   │   ├── logger/              # LoggerModule (Winston 3 transports)
│   │   │   │   └── context/             # AsyncLocalStorage (requestId per request)
│   │   │   │
│   │   │   └── modules/
│   │   │       ├── channel/             # 36 endpoints, 17 WS events
│   │   │       ├── message/             # 13 endpoints, 12 WS events
│   │   │       ├── poll/                # 3 endpoints
│   │   │       ├── user/                # 5 endpoints
│   │   │       ├── scheduled/           # 5 endpoints + BullMQ processor
│   │   │       └── gateway/             # Socket.IO gateway + ChatEventService
│   │   │
│   │   ├── prisma/                      # Chat schema (11 models)
│   │   │   └── schema.prisma
│   │   └── package.json
│   │
│   └── client/                          # @chat-service/client — Frontend provider
│       ├── core/                        # Interfaces + types + errors
│       ├── providers/custom/            # CustomChatProvider + services + mappers
│       └── package.json
│
├── apps/
│   └── example/                         # Example app — working SDK integration
│       ├── src/
│       │   ├── app.module.ts            # Imports ChatModule.forRoot() with real providers
│       │   ├── main.ts                  # Bootstrap with Swagger + global prefix /chat
│       │   ├── auth.controller.ts       # POST /chat/auth/login, /chat/auth/register
│       │   ├── prisma.service.ts        # User table (example's own DB)
│       │   ├── seed.ts                  # Seeds 5 test users
│       │   └── providers/               # ExampleAuthGuard, ExampleUserExtractor, ExampleUserResolver
│       ├── prisma/
│       │   └── schema.prisma            # User schema (example's own DB)
│       └── .env
│
├── docs/                                # VitePress documentation
├── pnpm-workspace.yaml                  # pnpm workspaces config
└── package.json                         # Root scripts
```

### Key Distinction: SDK vs Example App

The **SDK** (`packages/sdk/`) is a library. It has:
- `chat.module.ts` — the `ChatModule` with `forRoot()` and `forRootAsync()` static methods
- `index.ts` — barrel export for all public types, interfaces, and the module
- **No `app.module.ts`** and **no `main.ts`** — it cannot run on its own

The **example app** (`apps/example/`) is a runnable NestJS application that demonstrates how to integrate the SDK. It has:
- `app.module.ts` — imports `ChatModule.forRoot()` with real provider implementations
- `main.ts` — bootstraps the NestJS app with Swagger docs
- Real JWT authentication (login/register endpoints)
- Its own User database (separate from the chat database)
- Seed script to create 5 test users

## Modular Architecture

Each feature is an **independent NestJS module** with its own controllers, services, and DTOs. Modules are registered in `ChatModule` and exported globally.

```
┌───────────────────────────────────────────────────────────────┐
│                       ChatModule (global)                     │
│                                                               │
│  ┌─────────────┐  ┌─────────────┐  ┌──────────────────────┐ │
│  │ChannelModule│  │MessageModule│  │ScheduledMessageModule│ │
│  │ 36 routes   │  │ 13 routes   │  │ 5 routes + BullMQ    │ │
│  └─────────────┘  └─────────────┘  └──────────────────────┘ │
│                                                               │
│  ┌─────────────┐  ┌─────────────┐  ┌──────────────────────┐ │
│  │ PollModule  │  │ChatUserMod. │  │ ChatGatewayModule    │ │
│  │ 3 routes    │  │ 5 routes    │  │ Socket.IO gateway    │ │
│  └─────────────┘  └─────────────┘  └──────────────────────┘ │
│                                                               │
│  ┌─────────────────────────────────────────────────────────┐ │
│  │ PrismaModule (global) — PostgreSQL connection           │ │
│  └─────────────────────────────────────────────────────────┘ │
└───────────────────────────────────────────────────────────────┘
```

## SDK/Plugin Pattern

The core design is the separation between the **contract** (`packages/sdk/src/core/interfaces/`) and the **implementation** (provided by the host application).

### Injection Tokens

`ChatModule` registers the host's providers via injection tokens:

| Token | Interface | Description |
|-------|-----------|-------------|
| `CHAT_AUTH_GUARD` | `IChatAuthGuard` | Validates authentication |
| `CHAT_USER_EXTRACTOR` | `IChatUserExtractor` | Extracts the user from the request |
| `CHAT_USER_RESOLVER` | `IChatUserResolver` | Resolves user profiles |
| `CHAT_STORAGE_PROVIDER` | `IChatStorageProvider` | File upload/deletion |
| `CHAT_EVENT_HANDLER` | `IChatEventHandler` | Hooks on chat events |
| `CHAT_MODULE_OPTIONS` | `ChatModuleOptions` | Configuration (DB, Redis, limits) |

### Authenticated Request Flow

```
HTTP Request
    │
    ▼
ChatAuthGuard (@UseGuards)
    │  delegates to CHAT_AUTH_GUARD (host impl)
    ▼
CHAT_USER_EXTRACTOR
    │  extracts ChatAuthUser { id, tenantId }
    ▼
@CurrentChatUser() decorator
    │  injects the user into the controller
    ▼
Controller → Service → Prisma
    │
    ▼
ChatResponseInterceptor
    │  formats { success, data, requestId, timestamp, path }
    ▼
JSON Response
```

### WebSocket Flow

```
Socket.IO Connection (/chat namespace)
    │
    ▼
handleConnection()
    │  CHAT_AUTH_GUARD.canActivate()
    │  CHAT_USER_EXTRACTOR.extractUser()
    ▼
Join room: tenant:{tenantId}
    │
    ▼
Client sends: chat:join:channel { channelId }
    │  verifies membership
    ▼
Join room: channel:{channelId}
    │
    ▼
Bidirectional events (typing, messages, reactions...)
```

## Error Handling

### ChatException

All business errors go through `ChatException`, which extends `HttpException` with a typed `ChatErrorCode`:

```typescript
throw ChatException.channelNotFound(channelId);
throw ChatException.userMuted();
throw ChatException.pinLimit(5);
throw ChatException.validation('Invalid email format', { field: 'email' });
```

### Error Codes

30 codes organized by domain:

| Category | Codes | HTTP Status |
|----------|-------|-------------|
| **Auth** | `CHAT_AUTH_FAILED`, `CHAT_AUTH_TOKEN_INVALID`, `CHAT_AUTH_FORBIDDEN` | 401, 403 |
| **Channel** | `CHAT_CHANNEL_NOT_FOUND`, `CHAT_CHANNEL_ALREADY_EXISTS`, `CHAT_CHANNEL_FROZEN`, `CHAT_CHANNEL_MEMBER_LIMIT`, `CHAT_CHANNEL_PIN_LIMIT` | 404, 409, 403, 413 |
| **Member** | `CHAT_NOT_CHANNEL_MEMBER`, `CHAT_NOT_CHANNEL_OPERATOR`, `CHAT_ALREADY_CHANNEL_MEMBER`, `CHAT_USER_MUTED`, `CHAT_USER_BANNED` | 403, 409 |
| **Message** | `CHAT_MESSAGE_NOT_FOUND`, `CHAT_MESSAGE_NOT_OWNER`, `CHAT_MESSAGE_TOO_LONG` | 404, 403, 400 |
| **Poll** | `CHAT_POLL_NOT_FOUND`, `CHAT_POLL_CLOSED`, `CHAT_POLL_OPTION_LIMIT`, `CHAT_POLL_ALREADY_VOTED` | 404, 410, 400, 409 |
| **Scheduled** | `CHAT_SCHEDULED_NOT_FOUND`, `CHAT_SCHEDULED_ALREADY_SENT`, `CHAT_SCHEDULED_INVALID_TIME` | 404, 410, 400 |
| **User** | `CHAT_USER_NOT_FOUND`, `CHAT_USER_ALREADY_BLOCKED` | 404, 409 |
| **Storage** | `CHAT_FILE_TOO_LARGE`, `CHAT_FILE_TYPE_NOT_ALLOWED`, `CHAT_UPLOAD_FAILED` | 400, 500 |
| **Generic** | `CHAT_VALIDATION_ERROR`, `CHAT_CONFLICT`, `CHAT_INTERNAL_ERROR`, `CHAT_RATE_LIMITED` | 400, 409, 500, 429 |

### ChatExceptionFilter

The global filter intercepts 3 types of errors and normalizes them:

1. **ChatException**: uses the code and status directly
2. **PrismaClientKnownRequestError**: maps Prisma codes (P2002 = conflict, P2025 = not found)
3. **Unknown errors**: returns `CHAT_INTERNAL_ERROR` (500)

Error response format:

```json
{
  "success": false,
  "error": {
    "code": "CHAT_CHANNEL_NOT_FOUND",
    "message": "Channel not found",
    "details": { "channelId": "abc-123" }
  },
  "requestId": "a1b2c3d4-e5f6-...",
  "statusCode": 404,
  "timestamp": "2026-04-03T10:30:00.000Z",
  "path": "/chat/channels/abc-123"
}
```

## Logging

### Winston with 3 Transports

| Transport | Destination | Level | Rotation |
|-----------|-------------|-------|----------|
| Console | stdout | `debug` (dev) / `info` (prod) | No |
| Error file | `logs/errors.log` | `error` | No |
| Combined file | `logs/combined.log` | `info`+ | No |

### RequestId per Request

Each HTTP request receives a unique `requestId` via `AsyncLocalStorage`. This requestId is:

- Automatically injected into all Winston logs
- Returned in every API response (`requestId` field)
- Propagated in errors for debugging

```
[2026-04-03T10:30:00.123Z] [INFO] [req:a1b2c3d4] ChannelService.createDirect — Creating DM between alice and bob
[2026-04-03T10:30:00.145Z] [INFO] [req:a1b2c3d4] ChannelService.createDirect — DM created: channel-xyz
```

## Database Design

### Two Databases

The Chat Service SDK requires its own **dedicated PostgreSQL database** for chat data. This is separate from your application database:

| Database | Tables | Configured via | Managed by |
|----------|--------|---------------|------------|
| Chat DB | 11 chat tables | `CHAT_DATABASE_URL` (or `database.url` in `ChatModuleOptions`) | SDK (`packages/sdk/prisma/`) |
| App DB | Your application tables | Your app's `DATABASE_URL` | Your application |

In the example app, the App DB contains a single `User` table (`apps/example/prisma/`).

### 11 Prisma Models

```
ChatChannel ──┬── ChatChannelMember (N:1)
              ├── ChatMessage (N:1) ── ChatReaction (N:1)
              ├── ChatPinnedMessage (N:1)
              └── ChatScheduledMessage (N:1)

ChatPoll ── ChatPollOption (N:1) ── ChatPollVote (N:1)

ChatUserBlock (standalone)
ChatReport (standalone)
```

### Multi-tenant Isolation

Each main entity carries a `tenantId` field:
- `ChatChannel.tenantId`
- `ChatChannelMember.tenantId`
- `ChatMessage.tenantId`
- `ChatScheduledMessage.tenantId`
- `ChatPoll.tenantId`
- `ChatUserBlock.tenantId`
- `ChatReport.tenantId`

::: warning No foreign key on tenantId
The `tenantId` is a free `String`, not a reference to a Tenant table. It is up to the host to map its tenant concept (organization, workspace, hotel...) to this field.
:::

### Read Receipts and Unread Count

The read receipts system uses a **per-member cursor** rather than a per-message marker:

- `ChatChannelMember.lastReadAt`: timestamp of the last read message
- `ChatChannelMember.lastReadMessageId`: ID of the last read message
- `ChatChannelMember.lastDeliveredAt`: timestamp of the last delivery

The **unread count** is calculated by counting channel messages with `createdAt > lastReadAt` (or since `historyResetAt` if the history has been reset).

::: tip Performance
This design is more performant than a per-message junction table. A single `UPDATE` on `ChatChannelMember` is enough to mark all messages as read, and the count is done via a simple `COUNT WHERE createdAt > cursor`.
:::

### Indexing

Indexes are optimized for the most frequent queries:

| Table | Index | Usage |
|-------|-------|-------|
| `ChatChannel` | `(tenantId, updatedAt DESC)` | Channel list by tenant |
| `ChatChannel` | `(tenantId, type)` | Filter by type |
| `ChatChannelMember` | `(userId, tenantId, leftAt)` | User's channels |
| `ChatChannelMember` | `(channelId, userId)` UNIQUE | Membership deduplication |
| `ChatMessage` | `(channelId, createdAt DESC)` | Paginated messages |
| `ChatMessage` | `(channelId, deletedAt, createdAt DESC)` | Non-deleted messages |
| `ChatMessage` | `(channelId, parentMessageId, createdAt DESC)` | Threads |
| `ChatScheduledMessage` | `(status, scheduledAt)` | BullMQ polling |

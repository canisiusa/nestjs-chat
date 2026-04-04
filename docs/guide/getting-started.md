---
title: Getting Started
description: Installation guide and first launch of the Chat Service SDK.
---

# Getting Started

This guide walks you through running the example app, which demonstrates a complete integration of the Chat Service SDK.

## Prerequisites

| Tool | Minimum Version | Verification |
|------|----------------|--------------|
| Node.js | 20+ | `node -v` |
| PostgreSQL | 15+ | `psql --version` |
| Redis | 7+ | `redis-cli --version` |
| pnpm | 8+ | `pnpm -v` |

::: warning PostgreSQL and Redis must be running
The service will not start without a connection to PostgreSQL and Redis. If you use Docker:

```bash
docker run -d --name chat-pg -p 5432:5432 \
  -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_DB=chat_service \
  postgres:15

docker run -d --name chat-redis -p 6379:6379 redis:7-alpine
```
:::

## 1. Clone and install

```bash
git clone <repo-url> chat-service
cd chat-service
pnpm install
```

## 2. Environment configuration

```bash
cp apps/example/.env.example apps/example/.env
```

Edit `apps/example/.env` with your values:

```ini
# Chat database (used by the SDK — 11 chat tables)
CHAT_DATABASE_URL="postgresql://postgres:postgres@localhost:5432/chat_service?schema=public"

# Example app database (User table for the example)
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/chat_example?schema=public"

# Redis (for cache + BullMQ scheduled messages)
REDIS_URL="redis://localhost:6379"

# JWT secret for the example app
JWT_SECRET="your-secret-key"

# Server
PORT=3001
NODE_ENV=development

# CORS (origins separated by commas)
CORS_ORIGINS="http://localhost:5173,http://localhost:3000"
```

::: tip Two databases
The Chat Service SDK uses its own dedicated database (`CHAT_DATABASE_URL`) for the 11 chat tables. The example app has a separate database (`DATABASE_URL`) for its User table. In your real project, `DATABASE_URL` would be your existing application database.
:::

## 3. Database setup

```bash
# Generate Prisma clients (both SDK and example)
pnpm prisma:generate

# Apply schemas to both databases
pnpm prisma:push
```

This creates:
- **Chat DB** (11 tables): `ChatChannel`, `ChatChannelMember`, `ChatMessage`, `ChatReaction`, `ChatPinnedMessage`, `ChatScheduledMessage`, `ChatPoll`, `ChatPollOption`, `ChatPollVote`, `ChatUserBlock`, `ChatReport`
- **Example DB** (1 table): `User`

::: info Prisma Studio
To visually explore the databases:
```bash
# Chat database
cd packages/sdk && npx prisma studio

# Example app database
cd apps/example && npx prisma studio
```
Opens a web interface at `http://localhost:5555`.
:::

## 4. Seed test users

```bash
cd apps/example && pnpm seed
```

This creates 5 test users:

| Email | Password |
|-------|----------|
| `alice@example.com` | `password123` |
| `bob@example.com` | `password123` |
| `charlie@example.com` | `password123` |
| `diana@example.com` | `password123` |
| `eve@example.com` | `password123` |

## 5. Starting the service

From the monorepo root:

```bash
pnpm dev
```

This launches the example app, which imports `ChatModule.forRoot()` from the SDK. The server starts on `http://localhost:3001/chat` with:
- REST API on `/chat/*`
- WebSocket Socket.IO on the `/chat` namespace
- Swagger API docs on `http://localhost:3001/docs/api`
- Hot reload enabled (watch mode)

You should see in the logs:

```
[ChatService] Chat service running on http://localhost:3001/chat
[ChatService] WebSocket gateway ready on namespace /chat
```

## 6. Quick test with curl

The example app includes real JWT authentication. First, obtain a token:

### Login

```bash
curl -X POST http://localhost:3001/chat/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "alice@example.com", "password": "password123"}'
```

Response:

```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIs..."
}
```

### Create a direct conversation (DM)

```bash
curl -X POST http://localhost:3001/chat/channels/direct \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <TOKEN>" \
  -d '{"userId": "bob-user-id"}'
```

Response:

```json
{
  "success": true,
  "data": {
    "id": "a1b2c3d4-...",
    "type": "DIRECT",
    "memberCount": 2,
    "members": [
      { "userId": "alice-id", "role": "OPERATOR" },
      { "userId": "bob-id", "role": "MEMBER" }
    ]
  }
}
```

### Send a message

```bash
curl -X POST http://localhost:3001/chat/channels/<CHANNEL_ID>/messages \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <TOKEN>" \
  -d '{"text": "Hello Bob!"}'
```

### List a user's channels

```bash
curl http://localhost:3001/chat/channels/my \
  -H "Authorization: Bearer <TOKEN>"
```

### List messages in a channel

```bash
curl http://localhost:3001/chat/channels/<CHANNEL_ID>/messages \
  -H "Authorization: Bearer <TOKEN>"
```

## Available Scripts

| Script | Command | Description |
|--------|---------|-------------|
| Dev | `pnpm dev` (root) | Start the example app with hot reload |
| Build | `pnpm build` (root) | Build all packages |
| Prisma generate | `pnpm prisma:generate` (root) | Generate Prisma clients for SDK + example |
| Prisma push | `pnpm prisma:push` (root) | Apply schemas to both databases |
| Seed | `pnpm seed` (`apps/example`) | Create 5 test users |
| Prisma studio (chat) | `npx prisma studio` (`packages/sdk`) | Visual interface for chat DB |
| Prisma studio (example) | `npx prisma studio` (`apps/example`) | Visual interface for example DB |
| Docs | `pnpm docs:dev` (root) | VitePress documentation |

## Next Steps

- [Architecture](/guide/architecture) to understand the monorepo structure
- [Configuration](/guide/configuration) to customize limits, CORS, Socket.IO
- [Backend Integration](/integration/backend) to import the SDK into your own NestJS app

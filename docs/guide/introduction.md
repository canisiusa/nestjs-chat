---
title: Introduction
description: Overview of the Chat Service SDK — a real-time chat module for NestJS applications.
---

# Introduction

## What is the Chat Service?

The Chat Service is a **real-time chat SDK for NestJS**. It provides a complete API (REST + WebSocket) to integrate real-time chat into any NestJS project, while maintaining full control over data and infrastructure.

The SDK is distributed as `nestjs-chat` — a NestJS dynamic module that you install and import via `ChatModule.forRoot()`. There is no standalone application to run; it integrates directly into your existing NestJS backend.

::: tip Why a self-hosted SDK?
SaaS solutions charge per message or per active user. With the Chat Service SDK, you only pay for your PostgreSQL + Redis infrastructure. No external dependencies, no artificial limits.
:::

## Architecture: SDK/Plugin Pattern

The Chat Service follows an **SDK/Plugin pattern**: the main `ChatModule` is imported into your NestJS backend via `ChatModule.forRoot()` or `ChatModule.forRootAsync()`.

The host application provides its own implementations for:

| Interface | Role | Required |
|-----------|------|:--------:|
| `IChatAuthGuard` | Validates authentication for HTTP and WebSocket requests | Yes |
| `IChatUserExtractor` | Extracts the current user from the request | Yes |
| `IChatUserResolver` | Resolves user profiles (name, avatar, online status) | Yes |
| `IChatStorageProvider` | File upload/deletion (S3, GCS, local...) | No |
| `IChatEventHandler` | Hooks on events (push notifications, analytics...) | No |

```
┌─────────────────────────────────────────────────────┐
│                    HOST APP (NestJS)                 │
│                                                     │
│  ┌─────────────┐  ┌──────────────┐  ┌────────────┐ │
│  │ AuthGuard   │  │ UserResolver │  │  Storage   │ │
│  │ (your impl) │  │ (your impl)  │  │ (your impl)│ │
│  └──────┬──────┘  └──────┬───────┘  └─────┬──────┘ │
│         │                │                 │        │
│  ┌──────▼────────────────▼─────────────────▼──────┐ │
│  │              ChatModule.forRoot()              │ │
│  │  ┌──────────┐ ┌──────────┐ ┌────────────────┐ │ │
│  │  │ Channels │ │ Messages │ │ Polls/Scheduled│ │ │
│  │  └──────────┘ └──────────┘ └────────────────┘ │ │
│  │  ┌──────────┐ ┌──────────┐ ┌────────────────┐ │ │
│  │  │ Gateway  │ │  Users   │ │   Prisma/PG    │ │ │
│  │  │(Socket.IO│ │          │ │                │ │ │
│  │  └──────────┘ └──────────┘ └────────────────┘ │ │
│  └────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────┘
```

## Monorepo Structure

The project is organized as a pnpm monorepo:

| Package | Path | Description |
|---------|------|-------------|
| `nestjs-chat` | `packages/sdk/` | The NestJS SDK module — `ChatModule.forRoot()` |
| `@chat-service/client` | `packages/client/` | Frontend React provider |
| Example App | `apps/example/` | Working integration example with real JWT auth |

The SDK (`packages/sdk/`) is a **library** — it has no `app.module.ts` and no `main.ts`. It exports `ChatModule` which you import into your own NestJS application.

The example app (`apps/example/`) demonstrates a complete integration: real JWT authentication, a user database, seed data, and all required provider implementations.

## Tech Stack

| Technology | Version | Role |
|------------|---------|------|
| **NestJS** | 10 | Application framework |
| **Prisma** | 7 | ORM (PostgreSQL) |
| **PostgreSQL** | 15+ | Relational database |
| **Socket.IO** | 4 | Real-time WebSocket |
| **BullMQ** | 5 | Scheduled messages (delayed jobs) |
| **Redis** | 7+ | Cache + BullMQ queue |
| **Winston** | 3 | Structured logging (console + files) |

## Features

### Channels
- **Direct Messages** (1:1) with automatic deduplication
- **Group channels** with multiple members
- Customizable key-value metadata
- Custom types to categorize channels
- Freeze/unfreeze for moderation
- Hide/show with history reset

### Messages
- Text, images, videos, audio, files
- Threading (nested replies)
- Message forwarding
- Full-text search
- Edit and delete (soft delete)
- User mentions

### Real-time
- Typing indicators (ephemeral, no persistence)
- Read receipts via `lastReadAt` cursor
- Unread count per channel/user
- Delivered receipts

### Reactions
- Emojis on messages
- Real-time add/remove

### Polls
- Creation with multiple options
- Single or multi-vote
- Automatic scheduled closing
- Option suggestions by users

### Scheduled Messages
- Scheduling via BullMQ (delayed jobs)
- Modification before sending
- Cancellation
- Forced immediate send

### Moderation
- Mute/unmute with optional duration
- Ban/unban with description
- Global block between users
- Reporting (spam, harassment, inappropriate content)

### Notifications
- Configurable push trigger per channel (ALL, MENTION_ONLY, OFF)
- Configurable count preference (ALL, UNREAD_MESSAGE_COUNT_ONLY, OFF)

## By the Numbers

| Metric | Value |
|--------|-------|
| REST Endpoints | **63** |
| WebSocket Events | **42** |
| Prisma Models | **11** |
| Error Codes | **30** |
| NestJS Modules | **6** (Channel, Message, Poll, User, Scheduled, Gateway) |

---
title: Configuration
description: Complete configuration reference for nestjs-chat — module options, providers, environment variables.
---

# Configuration

## ChatModuleOptions

The `ChatModuleOptions` interface configures `nestjs-chat`'s behavior when imported via `ChatModule.forRoot()`.

```typescript
interface ChatModuleOptions {
  database: {
    url: string;
  };
  redis: {
    url: string;
  };
  storage?: {
    maxFileSize?: number;
    allowedMimeTypes?: string[];
  };
  limits?: {
    maxChannelMembers?: number;
    maxPinnedMessages?: number;
    maxMessageLength?: number;
    maxPollOptions?: number;
  };
}
```

### `database` (required)

| Field | Type | Description |
|-------|------|-------------|
| `url` | `string` | PostgreSQL connection string. Format: `postgresql://user:password@host:port/dbname?schema=public` |

```typescript
database: {
  url: 'postgresql://postgres:postgres@localhost:5432/chat_service?schema=public',
}
```

::: warning Dedicated database
The `database.url` must point to a **dedicated PostgreSQL database** (or a separate schema in the same cluster) for chat data. The SDK owns its schema and runs its own migrations — pointing it at your main app's database will cause Prisma migration conflicts.
:::

### `redis` (required)

| Field | Type | Description |
|-------|------|-------------|
| `url` | `string` | Redis connection string. Format: `redis://[:password@]host:port[/db]` |

Redis is used internally by the SDK for two things:
1. **Scheduled messages**: BullMQ job queue for delayed message delivery
2. **Socket.IO adapter**: multi-instance event synchronization for horizontal scaling

::: info No BullMQ setup required
The SDK manages BullMQ internally using `bullmq` directly (not `@nestjs/bullmq`). This avoids conflicts with your host application if it also uses BullMQ. You only need to provide the Redis URL — no `BullModule.forRoot()` or any other configuration.
:::

```typescript
redis: {
  url: 'redis://localhost:6379',
}
```

### `storage` (optional)

Constraints on uploaded files. Only applies if an `IChatStorageProvider` is provided.

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `maxFileSize` | `number` | `10 * 1024 * 1024` (10 MB) | Maximum file size in bytes |
| `allowedMimeTypes` | `string[]` | `['image/*', 'video/*', 'audio/*', 'application/pdf']` | Allowed MIME types (supports wildcards) |

```typescript
storage: {
  maxFileSize: 25 * 1024 * 1024, // 25 MB
  allowedMimeTypes: [
    'image/*',
    'video/*',
    'audio/*',
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.*',
  ],
}
```

### `limits` (optional)

Functional limits to prevent abuse.

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `maxChannelMembers` | `number` | `100` | Maximum number of members per group channel |
| `maxPinnedMessages` | `number` | `5` | Maximum number of pinned messages per channel |
| `maxMessageLength` | `number` | `5000` | Maximum message length in characters |
| `maxPollOptions` | `number` | `10` | Maximum number of options per poll |

```typescript
limits: {
  maxChannelMembers: 200,
  maxPinnedMessages: 10,
  maxMessageLength: 10000,
  maxPollOptions: 20,
}
```

### `logging` (optional)

Winston logging configuration. The SDK writes to both console and file transports.

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `level` | `'debug' \| 'info' \| 'warn' \| 'error'` | `'info'` | Minimum log level |
| `directory` | `string` | `'logs'` | Directory for log files (`chat-errors.log`, `chat-combined.log`) |

```typescript
logging: {
  level: 'debug',
  directory: '/var/log/myapp',
}
```

::: info Zero process.env
The SDK reads **all** its configuration from `ChatModuleOptions`. It never reads `process.env` directly — no `DATABASE_URL`, no `REDIS_URL`, no `NODE_ENV`, no `LOG_DIR`. Everything is explicit and passed by the host.
:::

::: info Exceeding limits
When a limit is reached, the service throws a `ChatException` with the appropriate code (`CHAT_CHANNEL_MEMBER_LIMIT`, `CHAT_CHANNEL_PIN_LIMIT`, etc.) and HTTP status 413.
:::

---

## ChatModuleProviders

The `ChatModuleProviders` interface defines the classes that the host injects into `ChatModule`.

```typescript
interface ChatModuleProviders {
  authGuard: Type<IChatAuthGuard>;
  userExtractor: Type<IChatUserExtractor>;
  userResolver: Type<IChatUserResolver>;
  storageProvider?: Type<IChatStorageProvider>;
  eventHandler?: Type<IChatEventHandler>;
}
```

### `authGuard` (required)

Implements `IChatAuthGuard`. Authentication validator for HTTP and WebSocket requests.

```typescript
interface IChatAuthGuard {
  canActivate(context: ExecutionContext): boolean | Promise<boolean>;
}
```

The guard receives the standard NestJS `ExecutionContext`. It must return `true` if the request is authenticated, `false` or throw an exception otherwise.

```typescript
@Injectable()
class JwtAuthGuard implements IChatAuthGuard {
  constructor(private jwtService: JwtService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const token = request.headers.authorization?.replace('Bearer ', '');
    if (!token) return false;
    try {
      const payload = await this.jwtService.verifyAsync(token);
      request.user = payload;
      return true;
    } catch {
      return false;
    }
  }
}
```

### `userExtractor` (required)

Implements `IChatUserExtractor`. Extracts the current user from the request after the guard has validated authentication.

```typescript
interface IChatUserExtractor {
  extractUser(request: any): ChatAuthUser | null;
}

interface ChatAuthUser {
  id: string;
  tenantId: string;
  email?: string;
  name?: string;
}
```

::: warning The `tenantId` field is critical
It ensures multi-tenant isolation. Every request must carry a `tenantId`. If your app is not multi-tenant, use a fixed value (e.g., `'default'`).
:::

```typescript
@Injectable()
class MyUserExtractor implements IChatUserExtractor {
  extractUser(request: any): ChatAuthUser | null {
    const user = request.user; // populated by the guard
    if (!user) return null;
    return {
      id: user.sub,
      tenantId: user.organizationId,
      email: user.email,
      name: `${user.firstName} ${user.lastName}`,
    };
  }
}
```

### `userResolver` (required)

Implements `IChatUserResolver`. Resolves user profiles from their ID. Used to enrich responses (names, avatars) and for search.

```typescript
interface IChatUserResolver {
  getUser(userId: string): Promise<ChatUser | null>;
  getUsers(userIds: string[]): Promise<ChatUser[]>;
  searchUsers(keyword: string, tenantId: string, limit?: number): Promise<ChatUser[]>;
  isOnline?(userId: string): Promise<boolean>;
}
```

| Method | Usage |
|--------|-------|
| `getUser` | Single user profile (detail view) |
| `getUsers` | Batch profiles (channel member list) |
| `searchUsers` | Search for adding members, mentions |
| `isOnline` | Presence indicator (optional) |

```typescript
@Injectable()
class MyUserResolver implements IChatUserResolver {
  constructor(private prisma: PrismaService) {}

  async getUser(userId: string): Promise<ChatUser | null> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) return null;
    return {
      id: user.id,
      displayName: `${user.firstName} ${user.lastName}`,
      avatarUrl: user.avatarUrl,
    };
  }

  async getUsers(userIds: string[]): Promise<ChatUser[]> {
    const users = await this.prisma.user.findMany({
      where: { id: { in: userIds } },
    });
    return users.map(u => ({
      id: u.id,
      displayName: `${u.firstName} ${u.lastName}`,
      avatarUrl: u.avatarUrl,
    }));
  }

  async searchUsers(keyword: string, tenantId: string, limit = 20): Promise<ChatUser[]> {
    const users = await this.prisma.user.findMany({
      where: {
        organizationId: tenantId,
        OR: [
          { firstName: { contains: keyword, mode: 'insensitive' } },
          { lastName: { contains: keyword, mode: 'insensitive' } },
          { email: { contains: keyword, mode: 'insensitive' } },
        ],
      },
      take: limit,
    });
    return users.map(u => ({
      id: u.id,
      displayName: `${u.firstName} ${u.lastName}`,
      avatarUrl: u.avatarUrl,
    }));
  }
}
```

### `storageProvider` (optional)

Implements `IChatStorageProvider`. File upload and deletion for media messages.

```typescript
interface IChatStorageProvider {
  upload(file: Buffer | Readable, options: ChatUploadOptions): Promise<ChatUploadResult>;
  delete(fileUrl: string): Promise<void>;
  getSignedUrl?(fileUrl: string, expiresIn?: number): Promise<string>;
}

interface ChatUploadOptions {
  fileName: string;
  mimeType: string;
  folder?: string;
  tenantId: string;
}

interface ChatUploadResult {
  fileUrl: string;
  thumbnailUrl?: string;
  fileSize: number;
  mimeType: string;
}
```

::: info Without a storage provider
If no `storageProvider` is provided, message endpoints still accept the `fileUrl`, `fileName`, etc. fields — but it is up to the client to handle the upload and provide the URL directly.
:::

### `eventHandler` (optional)

Implements `IChatEventHandler`. Asynchronous hooks triggered on chat events.

```typescript
interface IChatEventHandler {
  onMessageSent?(channelId: string, message: Record<string, unknown>, tenantId: string): Promise<void>;
  onChannelCreated?(channel: Record<string, unknown>, tenantId: string): Promise<void>;
  onUserMentioned?(userId: string, channelId: string, messageId: string, tenantId: string): Promise<void>;
  onUnreadCountChanged?(userId: string, count: number, tenantId: string): Promise<void>;
}
```

Typical use cases:
- Send **push notifications** when a message is received
- Update a **badge counter** on the mobile app
- Log to an external **analytics system**
- Trigger a **webhook** to a third-party service

```typescript
@Injectable()
class MyEventHandler implements IChatEventHandler {
  constructor(private notificationService: NotificationService) {}

  async onMessageSent(channelId: string, message: Record<string, unknown>, tenantId: string) {
    await this.notificationService.sendPush({
      channelId,
      senderId: message.senderId as string,
      text: message.text as string,
      tenantId,
    });
  }

  async onUserMentioned(userId: string, channelId: string, messageId: string, tenantId: string) {
    await this.notificationService.sendMentionNotification(userId, channelId, messageId);
  }
}
```

---

## Environment variables

**The SDK itself reads zero environment variables.** Everything is passed explicitly through `ChatModuleOptions`. The variable names below are just a convention used in examples — nothing magical happens if you rename them.

You typically bridge env → `ChatModuleOptions` through NestJS's `ConfigModule`:

```ts
ChatModule.forRootAsync({
  inject: [ConfigService],
  useFactory: (config: ConfigService) => ({
    database: { url: config.get('CHAT_DATABASE_URL')! },
    redis: { url: config.get('REDIS_URL')! },
    logging: { level: config.get('NODE_ENV') === 'production' ? 'info' : 'debug' },
  }),
  providers: {
    authGuard: ChatAuthGuard,
    userExtractor: ChatUserExtractor,
    userResolver: ChatUserResolver,
  },
}),
```

A typical `.env` for the chat integration:

```ini
# Dedicated Postgres database (or a separate ?schema= on the same cluster) for chat data
CHAT_DATABASE_URL="postgresql://postgres:postgres@localhost:5432/chat?schema=public"

# Redis: used for BullMQ (scheduled messages) and the Socket.IO adapter
REDIS_URL="redis://localhost:6379"
```

Anything else (JWT secrets, CORS origins, port, Socket.IO path) is your host app's concern — the SDK doesn't touch them.

---

## CORS Configuration

CORS is handled entirely by your host application. `nestjs-chat` does not touch CORS — configure it in your NestJS bootstrap:

```typescript
// Your host app configures its own NestJS CORS
app.enableCors({
  origin: ['https://app.example.com'],
  credentials: true,
});
```

::: danger CORS in production
Never leave `origin: '*'` in production. Explicitly list the allowed origins.
:::

---

## Socket.IO Configuration

### Namespace

By default, the gateway listens on the `/chat` namespace. Clients connect to:

```
wss://api.example.com/chat
```

### Rooms

The service uses Socket.IO rooms to target emissions:

| Room | Format | Usage |
|------|--------|-------|
| Tenant | `tenant:{tenantId}` | Broadcast to the entire tenant |
| Channel | `channel:{channelId}` | Messages, typing, reactions for a channel |
| User | `user:{userId}` | Personal events (notifications, unread count) |

### Client-to-Server Events

| Event | Payload | Description |
|-------|---------|-------------|
| `chat:typing:start` | `{ channelId: string }` | Typing started |
| `chat:typing:stop` | `{ channelId: string }` | Typing stopped |
| `chat:join:channel` | `{ channelId: string }` | Join a channel's room |
| `chat:leave:channel` | `{ channelId: string }` | Leave a channel's room |

### Server-to-Client Events

38 events covering messages, channels, polls, and moderation. All events are prefixed with `chat:` and emitted in the relevant channel's room.

Examples:

| Event | Emitted when |
|-------|-------------|
| `chat:message:sent` | New message in a channel |
| `chat:message:updated` | Message edited |
| `chat:message:deleted` | Message deleted |
| `chat:channel:created` | New channel created |
| `chat:channel:updated` | Channel modified (name, cover...) |
| `chat:member:joined` | New member in a channel |
| `chat:member:left` | Member leaves a channel |
| `chat:typing` | A user is typing in a channel |
| `chat:reaction:added` | Reaction added to a message |
| `chat:poll:voted` | Vote on a poll |
| `chat:channel:frozen` | Channel frozen by an operator |
| `chat:user:muted` | User muted in a channel |
| `chat:user:banned` | User banned from a channel |

---

## Complete integration example

A full working pattern combining `forRootAsync` with all five provider hooks:

```typescript
@Module({
  imports: [
    ChatModule.forRootAsync({
      imports: [ConfigModule, AuthModule, UserModule, StorageModule],
      useFactory: (config: ConfigService) => ({
        database: { url: config.get('CHAT_DATABASE_URL') },
        redis: { url: config.get('REDIS_URL') },
        limits: {
          maxChannelMembers: 200,
          maxPinnedMessages: 10,
          maxMessageLength: 10000,
        },
      }),
      inject: [ConfigService],
      providers: {
        authGuard: JwtAuthGuard,
        userExtractor: JwtUserExtractor,
        userResolver: PrismaUserResolver,
        storageProvider: S3StorageProvider,
        eventHandler: PushNotificationHandler,
      },
    }),
  ],
})
export class AppModule {}
```

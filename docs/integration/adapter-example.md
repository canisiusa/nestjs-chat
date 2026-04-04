# Real-World Adapter Example

This document shows a concrete implementation of the chat SDK integration within a NestJS monorepo. It serves as a reference for wiring the chat module into an application with existing auth, user management, storage, and notification systems.

::: tip
This example assumes your project uses JWT authentication, a `MemberService` for user profiles, and Google Cloud Storage for file uploads. Adapt the code to match your own stack.
:::

## Project Structure

```
apps/api/ (your NestJS API)
└── src/
    └── modules/
        └── chat/           ← Adapter layer
            ├── chat-auth.guard.ts
            ├── chat-user-extractor.ts
            ├── chat-user-resolver.ts
            ├── chat-storage.provider.ts
            ├── chat-event-handler.ts
            └── chat.module.ts
```

---

## ChatAuthGuard

Wraps your existing JWT guard. Your platform already validates JWTs and attaches the authenticated user to the request — this adapter simply delegates to that guard.

```typescript
import { Injectable, ExecutionContext } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { IChatAuthGuard } from '@chat-service/sdk';

@Injectable()
export class ChatAuthGuard implements IChatAuthGuard {
  constructor(private readonly jwtGuard: JwtAuthGuard) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    try {
      // JwtAuthGuard validates the token and attaches req.user
      return await this.jwtGuard.canActivate(context) as boolean;
    } catch {
      return false;
    }
  }
}
```

---

## ChatUserExtractor

Maps your `AuthUser` (attached by the JWT guard) to the chat service's `ChatAuthUser`. The key mapping is your organization/tenant ID to `tenantId`.

```typescript
import { Injectable } from '@nestjs/common';
import { IChatUserExtractor, ChatAuthUser } from '@chat-service/sdk';

@Injectable()
export class ChatUserExtractor implements IChatUserExtractor {
  extractUser(request: any): ChatAuthUser | null {
    const authUser = request.user;
    if (!authUser) return null;

    return {
      id: authUser.memberId || authUser.id,
      tenantId: authUser.organizationId || authUser.tenantId,
      email: authUser.email,
      name: authUser.name || `${authUser.firstName} ${authUser.lastName}`.trim(),
    };
  }
}
```

::: warning Field mapping
Adapt the field names to your JWT payload. The `id` should be the user's unique identifier. The `tenantId` should be whatever scopes your users (organization, workspace, company).
:::

---

## ChatUserResolver

Wraps your `MemberService` (or `UserService`) to resolve user IDs into `ChatUser` profiles. Handles the mapping from your user model to the chat service's `ChatUser` type.

```typescript
import { Injectable } from '@nestjs/common';
import { IChatUserResolver, ChatUser } from '@chat-service/sdk';
import { MemberService } from '../member/member.service';

@Injectable()
export class ChatUserResolver implements IChatUserResolver {
  constructor(private readonly memberService: MemberService) {}

  async getUser(userId: string): Promise<ChatUser | null> {
    const member = await this.memberService.findById(userId);
    if (!member) return null;
    return this.mapUser(member);
  }

  async getUsers(userIds: string[]): Promise<ChatUser[]> {
    const members = await this.memberService.findByIds(userIds);
    return members.map(this.mapUser);
  }

  async searchUsers(keyword: string, tenantId: string, limit = 20): Promise<ChatUser[]> {
    const members = await this.memberService.search({
      keyword,
      organizationId: tenantId,
      limit,
    });
    return members.map(this.mapUser);
  }

  async isOnline(userId: string): Promise<boolean> {
    // Implement using your own presence system (Socket.IO, Redis, etc.)
    return false;
  }

  private mapUser(member: any): ChatUser {
    return {
      id: member.id,
      nickname: `${member.firstName} ${member.lastName}`.trim(),
      profileUrl: member.avatar || member.picture,
      metadata: {
        role: member.role,
        department: member.department,
      },
    };
  }
}
```

::: info
The `metadata` field carries app-specific data (role, department, etc.) that the chat UI can use for display purposes — for example, showing the user's role as a badge next to their name.
:::

---

## ChatStorageProvider (Optional)

Wraps your storage service (GCS, S3, local filesystem) to handle file uploads for chat attachments.

```typescript
import { Injectable } from '@nestjs/common';
import {
  IChatStorageProvider,
  ChatUploadOptions,
  ChatUploadResult,
} from '@chat-service/sdk';
import { StorageService } from '../media/storage.service';
import { Readable } from 'stream';

@Injectable()
export class ChatStorageProvider implements IChatStorageProvider {
  constructor(private readonly storageService: StorageService) {}

  async upload(file: Buffer | Readable, options: ChatUploadOptions): Promise<ChatUploadResult> {
    const path = `chat/${options.tenantId}/${options.folder || 'files'}/${Date.now()}-${options.fileName}`;
    
    const url = await this.storageService.upload(file, {
      path,
      contentType: options.mimeType,
    });

    return {
      fileUrl: url,
      fileSize: Buffer.isBuffer(file) ? file.length : 0,
      mimeType: options.mimeType,
    };
  }

  async delete(fileUrl: string): Promise<void> {
    await this.storageService.delete(fileUrl);
  }

  async getSignedUrl(fileUrl: string, expiresIn = 3600): Promise<string> {
    return this.storageService.getSignedUrl(fileUrl, expiresIn);
  }
}
```

---

## ChatEventHandler (Optional)

Reacts to chat events — publish to your notification system, analytics pipeline, etc.

```typescript
import { Injectable } from '@nestjs/common';
import { IChatEventHandler } from '@chat-service/sdk';
import { NotificationService } from '../notification/notification.service';

@Injectable()
export class ChatEventHandler implements IChatEventHandler {
  constructor(private readonly notificationService: NotificationService) {}

  async onMessageSent(
    channelId: string,
    message: Record<string, unknown>,
    tenantId: string,
  ): Promise<void> {
    // Publish to your notification system
    await this.notificationService.create({
      type: 'CHAT_MESSAGE',
      tenantId,
      data: { channelId, messageId: message.id, senderId: message.senderId },
    });
  }

  async onUserMentioned(
    userId: string,
    channelId: string,
    messageId: string,
    tenantId: string,
  ): Promise<void> {
    await this.notificationService.create({
      type: 'CHAT_MENTION',
      tenantId,
      recipientId: userId,
      data: { channelId, messageId },
    });
  }

  async onUnreadCountChanged(
    userId: string,
    count: number,
    tenantId: string,
  ): Promise<void> {
    // Update your stats/badge system
  }
}
```

---

## ChatModule

Ties all the adapters together into a single NestJS module.

```typescript
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ChatModule } from '@chat-service/sdk';

import { ChatAuthGuard } from './chat-auth.guard';
import { ChatUserExtractor } from './chat-user-extractor';
import { ChatUserResolver } from './chat-user-resolver';
import { ChatStorageProvider } from './chat-storage.provider';
import { ChatEventHandler } from './chat-event-handler';

// Dependencies from your own modules
import { AuthModule } from '../auth/auth.module';
import { MemberModule } from '../member/member.module';
import { MediaModule } from '../media/media.module';
import { NotificationModule } from '../notification/notification.module';

@Module({
  imports: [
    ChatModule.forRootAsync({
      imports: [ConfigModule, AuthModule, MemberModule, MediaModule, NotificationModule],
      useFactory: (config: ConfigService) => ({
        database: { url: config.get('CHAT_DATABASE_URL')! },
        redis: { url: config.get('REDIS_URL')! },
      }),
      inject: [ConfigService],
      providers: {
        authGuard: ChatAuthGuard,
        userExtractor: ChatUserExtractor,
        userResolver: ChatUserResolver,
        storageProvider: ChatStorageProvider,
        eventHandler: ChatEventHandler,
      },
    }),
  ],
})
export class MyChatModule {}
```

Then import `MyChatModule` in your root `AppModule`:

```typescript
@Module({
  imports: [
    // ... your other modules
    MyChatModule,
  ],
})
export class AppModule {}
```

---

## Environment Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `CHAT_DATABASE_URL` | PostgreSQL connection string for the chat database | `postgresql://user:pass@host:5432/my_chat_db` |
| `REDIS_URL` | Redis connection for BullMQ and Socket.IO | `redis://localhost:6379` |

::: warning Dedicated database
The chat SDK uses its own PostgreSQL database, separate from your main database. This is required because the SDK manages its own Prisma schema and models. Use a dedicated `CHAT_DATABASE_URL` that points to a different database.
:::

---

## Summary

| Adapter | Wraps | Maps |
|---------|-------|------|
| `ChatAuthGuard` | Your JWT guard | Delegates JWT validation |
| `ChatUserExtractor` | Request user | Your user ID → `id`, org ID → `tenantId` |
| `ChatUserResolver` | Your user/member service | Your user model → `ChatUser` |
| `ChatStorageProvider` | Your storage service | Upload/delete → `ChatUploadResult` |
| `ChatEventHandler` | Your notification service | Chat events → notifications |

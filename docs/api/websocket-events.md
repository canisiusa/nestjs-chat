# WebSocket Events Reference

The chat-service exposes a Socket.IO namespace at `/chat` for real-time communication.

## Connection

### Connecting

```typescript
import { io } from 'socket.io-client';

const socket = io('https://api.example.com/chat', {
  auth: {
    token: '<jwt-access-token>',
    userId: '<user-id>',
    tenantId: '<tenant-id>',
  },
  transports: ['websocket', 'polling'],
});
```

On connection, the server automatically joins the client to:
- `user:<userId>` -- personal room for direct notifications
- `tenant:<tenantId>` -- tenant-wide broadcasts

### Connection Lifecycle

| Event | Direction | Description |
|-------|-----------|-------------|
| `connect` | Server | Client successfully connected. Auto-joined to user and tenant rooms. |
| `disconnect` | Server | Client disconnected. Automatically leaves all rooms. |

---

## Rooms

The server uses three room types for targeted event delivery:

| Room Pattern | Description | Joined via |
|--------------|-------------|------------|
| `channel:<channelId>` | All members currently viewing a channel | `chat:join:channel` event |
| `user:<userId>` | All socket connections of a single user | Automatic on connect |
| `tenant:<tenantId>` | All users in a tenant | Automatic on connect |

---

## Client to Server Events (4)

These are events the client emits to the server.

### `chat:typing:start`

Notify that the user started typing in a channel.

**Payload:**

```typescript
interface TypingStartPayload {
  channelId: string;
}
```

**Behavior:** Broadcasts `chat:typing:status:updated` to the channel room (excluding the sender) with `isTyping: true`.

---

### `chat:typing:stop`

Notify that the user stopped typing.

**Payload:**

```typescript
interface TypingStopPayload {
  channelId: string;
}
```

**Behavior:** Broadcasts `chat:typing:status:updated` to the channel room (excluding the sender) with `isTyping: false`.

---

### `chat:join:channel`

Join a channel's WebSocket room to receive real-time updates for that channel.

**Payload:**

```typescript
interface JoinChannelPayload {
  channelId: string;
}
```

**Behavior:** Adds the client socket to the `channel:<channelId>` room. The client will now receive all channel-scoped events.

::: tip
Call this when the user opens a channel conversation view. Call `chat:leave:channel` when they navigate away.
:::

---

### `chat:leave:channel`

Leave a channel's WebSocket room.

**Payload:**

```typescript
interface LeaveChannelPayload {
  channelId: string;
}
```

**Behavior:** Removes the client socket from the `channel:<channelId>` room.

---

## Server to Client Events (38)

These are events the server emits to connected clients.

### Messages (8 events)

#### `chat:message:received`

A new message was sent in a channel.

**Target room:** `channel:<channelId>`

**Payload:**

```typescript
interface MessageReceivedPayload {
  channelId: string;
  message: {
    id: string;
    channelId: string;
    tenantId: string;
    senderId: string;
    type: 'TEXT' | 'IMAGE' | 'VIDEO' | 'AUDIO' | 'FILE' | 'ADMIN' | 'POLL';
    text: string | null;
    fileUrl: string | null;
    fileName: string | null;
    fileSize: number | null;
    mimeType: string | null;
    thumbnailUrl: string | null;
    parentMessageId: string | null;
    isForwarded: boolean;
    forwardedFromId: string | null;
    isEdited: boolean;
    mentionedUserIds: string[];
    metadata: Record<string, any> | null;
    linkMetadata: Record<string, any> | null;
    pollId: string | null;
    createdAt: string;
    updatedAt: string;
  };
}
```

---

#### `chat:message:updated`

A message was edited.

**Target room:** `channel:<channelId>`

**Payload:**

```typescript
interface MessageUpdatedPayload {
  channelId: string;
  message: {
    id: string;
    text: string;
    isEdited: true;
    updatedAt: string;
  };
}
```

---

#### `chat:message:deleted`

A message was deleted (soft-delete).

**Target room:** `channel:<channelId>`

**Payload:**

```typescript
interface MessageDeletedPayload {
  channelId: string;
  messageId: string;
  deletedAt: string;
}
```

---

#### `chat:reaction:updated`

A reaction was added or removed on a message.

**Target room:** `channel:<channelId>`

**Payload:**

```typescript
interface ReactionUpdatedPayload {
  channelId: string;
  messageId: string;
  reactions: Array<{
    key: string;
    userIds: string[];
    count: number;
  }>;
}
```

---

#### `chat:mention:received`

The current user was mentioned in a message. Sent to the individual user room.

**Target room:** `user:<userId>`

**Payload:**

```typescript
interface MentionReceivedPayload {
  channelId: string;
  message: {
    id: string;
    senderId: string;
    text: string;
    channelId: string;
    createdAt: string;
  };
}
```

---

#### `chat:typing:status:updated`

A user started or stopped typing in a channel.

**Target room:** `channel:<channelId>` (excluding the typing user)

**Payload:**

```typescript
interface TypingStatusPayload {
  channelId: string;
  userId: string;
  isTyping: boolean;
}
```

::: tip
Typing status automatically expires after 5 seconds (`CHAT_DEFAULTS.TYPING_TIMEOUT_MS`). Clients should stop showing the typing indicator if no `isTyping: true` is received within that window.
:::

---

#### `chat:read:receipt:updated`

A user marked a channel as read.

**Target room:** `channel:<channelId>`

**Payload:**

```typescript
interface ReadReceiptUpdatedPayload {
  channelId: string;
  userId: string;
  lastReadAt: string;
  lastReadMessageId: string | null;
}
```

---

#### `chat:pinned:message:updated`

A message was pinned or unpinned in a channel.

**Target room:** `channel:<channelId>`

**Payload:**

```typescript
interface PinnedMessageUpdatedPayload {
  channelId: string;
  messageId: string;
  action: 'pinned' | 'unpinned';
  pinnedById: string | null;
}
```

---

### Polls (3 events)

#### `chat:poll:voted`

A user voted on a poll.

**Target room:** `channel:<channelId>`

**Payload:**

```typescript
interface PollVotedPayload {
  channelId: string;
  pollId: string;
  optionId: string;
  userId: string;
  voterCount: number;
  options: Array<{
    id: string;
    text: string;
    voteCount: number;
  }>;
}
```

---

#### `chat:poll:updated`

A poll was updated (e.g., closed, new option added).

**Target room:** `channel:<channelId>`

**Payload:**

```typescript
interface PollUpdatedPayload {
  channelId: string;
  pollId: string;
  status: 'OPEN' | 'CLOSED';
  voterCount: number;
  options: Array<{
    id: string;
    text: string;
    voteCount: number;
  }>;
  updatedAt: string;
}
```

---

#### `chat:poll:deleted`

A poll was deleted.

**Target room:** `channel:<channelId>`

**Payload:**

```typescript
interface PollDeletedPayload {
  channelId: string;
  pollId: string;
}
```

---

### Channels (11 events)

#### `chat:channel:changed`

A channel's properties were updated (name, cover, customType, etc.).

**Target room:** `channel:<channelId>`

**Payload:**

```typescript
interface ChannelChangedPayload {
  channelId: string;
  changes: {
    name?: string;
    coverUrl?: string;
    customType?: string;
    lastMessageAt?: string;
    memberCount?: number;
  };
  updatedAt: string;
}
```

---

#### `chat:channel:deleted`

A channel was deleted.

**Target room:** `channel:<channelId>`

**Payload:**

```typescript
interface ChannelDeletedPayload {
  channelId: string;
  deletedAt: string;
}
```

---

#### `chat:user:joined`

A user joined or was invited to the channel.

**Target room:** `channel:<channelId>`

**Payload:**

```typescript
interface UserJoinedPayload {
  channelId: string;
  userId: string;
  role: 'OPERATOR' | 'MEMBER';
  joinedAt: string;
  memberCount: number;
}
```

---

#### `chat:user:left`

A user left or was removed from the channel.

**Target room:** `channel:<channelId>`

**Payload:**

```typescript
interface UserLeftPayload {
  channelId: string;
  userId: string;
  memberCount: number;
}
```

---

#### `chat:unread:count:changed`

The user's total unread count changed. Sent to the individual user room.

**Target room:** `user:<userId>`

**Payload:**

```typescript
interface UnreadCountChangedPayload {
  totalUnreadCount: number;
}
```

---

#### `chat:channel:frozen`

A channel was frozen by an operator.

**Target room:** `channel:<channelId>`

**Payload:**

```typescript
interface ChannelFrozenPayload {
  channelId: string;
  isFrozen: true;
}
```

---

#### `chat:channel:unfrozen`

A channel was unfrozen.

**Target room:** `channel:<channelId>`

**Payload:**

```typescript
interface ChannelUnfrozenPayload {
  channelId: string;
  isFrozen: false;
}
```

---

#### `chat:channel:muted`

The current user muted a channel (notification suppression).

**Target room:** `user:<userId>`

**Payload:**

```typescript
interface ChannelMutedPayload {
  channelId: string;
  isMuted: true;
}
```

---

#### `chat:channel:unmuted`

The current user unmuted a channel.

**Target room:** `user:<userId>`

**Payload:**

```typescript
interface ChannelUnmutedPayload {
  channelId: string;
  isMuted: false;
}
```

---

#### `chat:metadata:changed`

A channel's custom metadata was updated.

**Target room:** `channel:<channelId>`

**Payload:**

```typescript
interface MetadataChangedPayload {
  channelId: string;
  metadata: Record<string, string>;
}
```

---

#### `chat:channel:hidden`

A channel was hidden for the current user.

**Target room:** `user:<userId>`

**Payload:**

```typescript
interface ChannelHiddenPayload {
  channelId: string;
  isHidden: true;
  hidePreviousMessages: boolean;
}
```

---

#### `chat:channel:member:count:changed`

The member count of a channel changed (user joined, left, banned, etc.).

**Target room:** `channel:<channelId>`

**Payload:**

```typescript
interface MemberCountChangedPayload {
  channelId: string;
  memberCount: number;
}
```

---

### Moderation (5 events)

#### `chat:user:banned`

A user was banned from a channel.

**Target room:** `channel:<channelId>` + `user:<bannedUserId>`

**Payload:**

```typescript
interface UserBannedPayload {
  channelId: string;
  userId: string;
  description: string | null;
  bannedUntil: string | null;
}
```

---

#### `chat:user:unbanned`

A user was unbanned from a channel.

**Target room:** `channel:<channelId>` + `user:<unbannedUserId>`

**Payload:**

```typescript
interface UserUnbannedPayload {
  channelId: string;
  userId: string;
}
```

---

#### `chat:user:muted`

A user was muted in a channel (by an operator).

**Target room:** `channel:<channelId>` + `user:<mutedUserId>`

**Payload:**

```typescript
interface UserMutedPayload {
  channelId: string;
  userId: string;
  mutedUntil: string | null;
}
```

---

#### `chat:user:unmuted`

A user was unmuted in a channel.

**Target room:** `channel:<channelId>` + `user:<unmutedUserId>`

**Payload:**

```typescript
interface UserUnmutedPayload {
  channelId: string;
  userId: string;
}
```

---

#### `chat:operator:updated`

A user's operator status changed.

**Target room:** `channel:<channelId>`

**Payload:**

```typescript
interface OperatorUpdatedPayload {
  channelId: string;
  userId: string;
  role: 'OPERATOR' | 'MEMBER';
}
```

---

## Event Summary Table

| # | Event | Direction | Category | Target Room |
|---|-------|-----------|----------|-------------|
| 1 | `chat:typing:start` | Client -> Server | Messages | - |
| 2 | `chat:typing:stop` | Client -> Server | Messages | - |
| 3 | `chat:join:channel` | Client -> Server | Connection | - |
| 4 | `chat:leave:channel` | Client -> Server | Connection | - |
| 5 | `chat:message:received` | Server -> Client | Messages | `channel:<id>` |
| 6 | `chat:message:updated` | Server -> Client | Messages | `channel:<id>` |
| 7 | `chat:message:deleted` | Server -> Client | Messages | `channel:<id>` |
| 8 | `chat:reaction:updated` | Server -> Client | Messages | `channel:<id>` |
| 9 | `chat:mention:received` | Server -> Client | Messages | `user:<id>` |
| 10 | `chat:typing:status:updated` | Server -> Client | Messages | `channel:<id>` |
| 11 | `chat:read:receipt:updated` | Server -> Client | Messages | `channel:<id>` |
| 12 | `chat:pinned:message:updated` | Server -> Client | Messages | `channel:<id>` |
| 13 | `chat:poll:voted` | Server -> Client | Polls | `channel:<id>` |
| 14 | `chat:poll:updated` | Server -> Client | Polls | `channel:<id>` |
| 15 | `chat:poll:deleted` | Server -> Client | Polls | `channel:<id>` |
| 16 | `chat:channel:changed` | Server -> Client | Channels | `channel:<id>` |
| 17 | `chat:channel:deleted` | Server -> Client | Channels | `channel:<id>` |
| 18 | `chat:user:joined` | Server -> Client | Channels | `channel:<id>` |
| 19 | `chat:user:left` | Server -> Client | Channels | `channel:<id>` |
| 20 | `chat:unread:count:changed` | Server -> Client | Channels | `user:<id>` |
| 21 | `chat:channel:frozen` | Server -> Client | Channels | `channel:<id>` |
| 22 | `chat:channel:unfrozen` | Server -> Client | Channels | `channel:<id>` |
| 23 | `chat:channel:muted` | Server -> Client | Channels | `user:<id>` |
| 24 | `chat:channel:unmuted` | Server -> Client | Channels | `user:<id>` |
| 25 | `chat:metadata:changed` | Server -> Client | Channels | `channel:<id>` |
| 26 | `chat:channel:hidden` | Server -> Client | Channels | `user:<id>` |
| 27 | `chat:channel:member:count:changed` | Server -> Client | Channels | `channel:<id>` |
| 28 | `chat:user:banned` | Server -> Client | Moderation | `channel:<id>` + `user:<id>` |
| 29 | `chat:user:unbanned` | Server -> Client | Moderation | `channel:<id>` + `user:<id>` |
| 30 | `chat:user:muted` | Server -> Client | Moderation | `channel:<id>` + `user:<id>` |
| 31 | `chat:user:unmuted` | Server -> Client | Moderation | `channel:<id>` + `user:<id>` |
| 32 | `chat:operator:updated` | Server -> Client | Moderation | `channel:<id>` |

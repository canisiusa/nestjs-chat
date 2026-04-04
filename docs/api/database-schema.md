# Database Schema Reference

The chat-service uses **PostgreSQL** with **Prisma 6** as the ORM. All models are defined in `prisma/schema.prisma`.

## Enums

### ChatChannelType

| Value | Description |
|-------|-------------|
| `DIRECT` | 1-to-1 private conversation between two users |
| `GROUP` | Multi-user group channel |

### ChatMessageType

| Value | Description |
|-------|-------------|
| `TEXT` | Plain text message |
| `IMAGE` | Image attachment |
| `VIDEO` | Video attachment |
| `AUDIO` | Audio attachment |
| `FILE` | Generic file attachment |
| `ADMIN` | System-generated admin message (e.g., "User X joined") |
| `POLL` | Message containing a poll reference |

### ChatMemberRole

| Value | Description |
|-------|-------------|
| `OPERATOR` | Can manage channel settings, moderate users, invite/remove members |
| `MEMBER` | Standard member with read/write access |

### ChatPushTrigger

| Value | Description |
|-------|-------------|
| `ALL` | Receive push notifications for all messages |
| `MENTION_ONLY` | Only receive push when mentioned |
| `OFF` | No push notifications for this channel |

### ChatCountPreference

| Value | Description |
|-------|-------------|
| `ALL` | Count all unread messages and mentions |
| `UNREAD_MESSAGE_COUNT_ONLY` | Only count unread messages (no mention tracking) |
| `OFF` | Do not count unread messages for this channel |

### ChatScheduledStatus

| Value | Description |
|-------|-------------|
| `PENDING` | Waiting to be sent at the scheduled time |
| `SENT` | Successfully sent |
| `FAILED` | Sending failed (see `errorMessage` field) |
| `CANCELED` | Canceled by the user before sending |

### ChatPollStatus

| Value | Description |
|-------|-------------|
| `OPEN` | Accepting votes |
| `CLOSED` | Voting closed (manually or via `closeAt` expiry) |

### ChatReportCategory

| Value | Description |
|-------|-------------|
| `SPAM` | Spam or unwanted content |
| `HARASSMENT` | Harassment or bullying |
| `INAPPROPRIATE` | Inappropriate or offensive content |
| `OTHER` | Other reason (see `description` field) |

---

## Models

### ChatChannel

The core channel model. Supports both direct (1:1) and group conversations.

| Field | Type | Default | Nullable | Description |
|-------|------|---------|----------|-------------|
| `id` | `String (CUID)` | `cuid()` | No | Primary key |
| `tenantId` | `String` | - | No | Tenant isolation key |
| `type` | `ChatChannelType` | - | No | `DIRECT` or `GROUP` |
| `name` | `String` | - | Yes | Display name (typically null for direct channels) |
| `coverUrl` | `String` | - | Yes | Channel cover image URL |
| `customType` | `String` | - | Yes | Application-defined type tag for filtering |
| `isFrozen` | `Boolean` | `false` | No | When true, no new messages can be sent |
| `metadata` | `Json` | `"{}"` | Yes | Custom key-value metadata store |
| `lastMessageAt` | `DateTime` | - | Yes | Timestamp of the most recent message |
| `memberCount` | `Int` | `0` | No | Denormalized count of active members |
| `createdById` | `String` | - | No | User ID of the channel creator |
| `createdAt` | `DateTime` | `now()` | No | Creation timestamp |
| `updatedAt` | `DateTime` | `@updatedAt` | No | Last modification timestamp |
| `deletedAt` | `DateTime` | - | Yes | Soft-delete timestamp (null = active) |

**Indexes:**
- `[tenantId, updatedAt DESC]` -- Channel list queries ordered by recent activity
- `[tenantId, type]` -- Filter channels by type within a tenant
- `[deletedAt]` -- Efficiently exclude soft-deleted channels

**Relations:**
- `members` -> `ChatChannelMember[]` (one-to-many)
- `messages` -> `ChatMessage[]` (one-to-many)
- `pinnedMessages` -> `ChatPinnedMessage[]` (one-to-many)
- `scheduledMessages` -> `ChatScheduledMessage[]` (one-to-many)

**Design decisions:**
- `memberCount` is denormalized for performance (avoids counting joins on every channel list query).
- `lastMessageAt` is denormalized to enable efficient "sort by last message" ordering.
- Soft-delete via `deletedAt` preserves channel data for compliance/audit while hiding it from users.

---

### ChatChannelMember

Join table between channels and users. Stores per-user preferences and moderation state.

| Field | Type | Default | Nullable | Description |
|-------|------|---------|----------|-------------|
| `id` | `String (CUID)` | `cuid()` | No | Primary key |
| `channelId` | `String` | - | No | FK to `ChatChannel.id` |
| `userId` | `String` | - | No | External user ID |
| `tenantId` | `String` | - | No | Tenant isolation key |
| `role` | `ChatMemberRole` | `MEMBER` | No | `OPERATOR` or `MEMBER` |
| `isMuted` | `Boolean` | `false` | No | Whether the user is muted by an operator |
| `mutedUntil` | `DateTime` | - | Yes | Mute expiration (null = indefinite if muted) |
| `isBanned` | `Boolean` | `false` | No | Whether the user is banned |
| `bannedUntil` | `DateTime` | - | Yes | Ban expiration (null = permanent if banned) |
| `banDescription` | `String` | - | Yes | Reason for the ban |
| `isHidden` | `Boolean` | `false` | No | Channel hidden from user's list |
| `hidePrevMessages` | `Boolean` | `false` | No | Also hide messages before the hide action |
| `pushTrigger` | `ChatPushTrigger` | `ALL` | No | Push notification preference |
| `countPreference` | `ChatCountPreference` | `ALL` | No | Unread count preference |
| `lastReadAt` | `DateTime` | - | Yes | When the user last read the channel |
| `lastReadMessageId` | `String` | - | Yes | ID of the last message the user has read |
| `lastDeliveredAt` | `DateTime` | - | Yes | When the last message was delivered to the user |
| `historyResetAt` | `DateTime` | - | Yes | Messages before this timestamp are hidden |
| `joinedAt` | `DateTime` | `now()` | No | When the user joined the channel |
| `leftAt` | `DateTime` | - | Yes | When the user left (null = still a member) |
| `createdAt` | `DateTime` | `now()` | No | Record creation timestamp |
| `updatedAt` | `DateTime` | `@updatedAt` | No | Last modification timestamp |

**Unique constraints:**
- `[channelId, userId]` -- A user can only be a member of a channel once

**Indexes:**
- `[userId, tenantId, leftAt]` -- List channels for a user (excluding left channels)
- `[channelId, isBanned]` -- Quickly find banned users in a channel
- `[channelId, isMuted]` -- Quickly find muted users in a channel
- `[channelId, role]` -- List operators in a channel

**Relations:**
- `channel` -> `ChatChannel` (many-to-one, cascade delete)

**Design decisions:**
- **Read receipt cursor**: `lastReadAt` + `lastReadMessageId` form a cursor-based read receipt system. The message ID provides precise tracking while the timestamp enables time-range queries.
- **History reset**: `historyResetAt` allows users to "clear" their view of old messages without affecting other members. Messages before this timestamp are filtered out in queries.
- **Temporal bans/mutes**: `bannedUntil` and `mutedUntil` support time-limited moderation. Application logic checks expiry and auto-clears the flag.
- **Soft membership**: `leftAt` is used instead of deleting the record, preserving membership history for analytics and re-join scenarios.

---

### ChatMessage

Individual chat messages within a channel.

| Field | Type | Default | Nullable | Description |
|-------|------|---------|----------|-------------|
| `id` | `String (CUID)` | `cuid()` | No | Primary key |
| `channelId` | `String` | - | No | FK to `ChatChannel.id` |
| `tenantId` | `String` | - | No | Tenant isolation key |
| `senderId` | `String` | - | No | External user ID of the sender |
| `type` | `ChatMessageType` | `TEXT` | No | Message content type |
| `text` | `String` | - | Yes | Message text content |
| `fileUrl` | `String` | - | Yes | URL of attached file |
| `fileName` | `String` | - | Yes | Original filename |
| `fileSize` | `Int` | - | Yes | File size in bytes |
| `mimeType` | `String` | - | Yes | MIME type of attached file |
| `thumbnailUrl` | `String` | - | Yes | Thumbnail URL for images/videos |
| `parentMessageId` | `String` | - | Yes | Parent message ID for threading |
| `isForwarded` | `Boolean` | `false` | No | Whether this message was forwarded |
| `forwardedFromId` | `String` | - | Yes | Original message ID if forwarded |
| `isEdited` | `Boolean` | `false` | No | Whether the message was edited |
| `linkMetadata` | `Json` | - | Yes | Link preview data (URL, title, description, image) |
| `mentionedUserIds` | `String[]` | `[]` | No | Array of mentioned user IDs |
| `metadata` | `Json` | - | Yes | Custom application metadata |
| `pollId` | `String` | - | Yes | Reference to a `ChatPoll` (for POLL-type messages) |
| `createdAt` | `DateTime` | `now()` | No | Creation timestamp |
| `updatedAt` | `DateTime` | `@updatedAt` | No | Last modification timestamp |
| `deletedAt` | `DateTime` | - | Yes | Soft-delete timestamp |

**Indexes:**
- `[channelId, createdAt DESC]` -- Default message list pagination
- `[channelId, deletedAt, createdAt DESC]` -- Message list excluding deleted
- `[channelId, parentMessageId, createdAt DESC]` -- Thread reply listing
- `[tenantId]` -- Tenant-scoped queries
- `[senderId]` -- Messages by a specific user
- `[pollId]` -- Find the message associated with a poll

**Relations:**
- `channel` -> `ChatChannel` (many-to-one, cascade delete)
- `reactions` -> `ChatReaction[]` (one-to-many)

**Design decisions:**
- **Flat threading**: Uses `parentMessageId` for single-level threading (replies to a parent, no nested threads).
- **Forwarding provenance**: `isForwarded` + `forwardedFromId` tracks the chain of forwarded messages.
- **Denormalized mentions**: `mentionedUserIds` is stored as a string array directly on the message for efficient mention queries without joins.
- **Soft-delete**: Messages are soft-deleted via `deletedAt` rather than permanently removed.

---

### ChatReaction

Emoji reactions on messages. Each user can add one reaction per key per message.

| Field | Type | Default | Nullable | Description |
|-------|------|---------|----------|-------------|
| `id` | `String (CUID)` | `cuid()` | No | Primary key |
| `messageId` | `String` | - | No | FK to `ChatMessage.id` |
| `userId` | `String` | - | No | User who reacted |
| `key` | `String` | - | No | Reaction identifier (e.g., `thumbsup`, `heart`) |
| `createdAt` | `DateTime` | `now()` | No | When the reaction was added |

**Unique constraints:**
- `[messageId, userId, key]` -- One reaction per key per user per message

**Indexes:**
- `[messageId]` -- All reactions for a message

**Relations:**
- `message` -> `ChatMessage` (many-to-one, cascade delete)

---

### ChatPinnedMessage

Pinned messages in a channel. Limited to 5 per channel (`CHAT_DEFAULTS.MAX_PINNED_MESSAGES`).

| Field | Type | Default | Nullable | Description |
|-------|------|---------|----------|-------------|
| `id` | `String (CUID)` | `cuid()` | No | Primary key |
| `channelId` | `String` | - | No | FK to `ChatChannel.id` |
| `messageId` | `String` | - | No | The pinned message ID |
| `pinnedById` | `String` | - | No | User who pinned the message |
| `createdAt` | `DateTime` | `now()` | No | When the message was pinned |

**Unique constraints:**
- `[channelId, messageId]` -- A message can only be pinned once per channel

**Indexes:**
- `[channelId]` -- List pinned messages in a channel

**Relations:**
- `channel` -> `ChatChannel` (many-to-one, cascade delete)

---

### ChatScheduledMessage

Messages scheduled to be sent at a future time. Processed by a BullMQ worker.

| Field | Type | Default | Nullable | Description |
|-------|------|---------|----------|-------------|
| `id` | `String (CUID)` | `cuid()` | No | Primary key |
| `channelId` | `String` | - | No | FK to `ChatChannel.id` |
| `tenantId` | `String` | - | No | Tenant isolation key |
| `senderId` | `String` | - | No | User who scheduled the message |
| `type` | `ChatMessageType` | `TEXT` | No | Message type |
| `text` | `String` | - | Yes | Message text |
| `fileUrl` | `String` | - | Yes | Attached file URL |
| `fileName` | `String` | - | Yes | Attached file name |
| `fileSize` | `Int` | - | Yes | Attached file size in bytes |
| `mimeType` | `String` | - | Yes | Attached file MIME type |
| `thumbnailUrl` | `String` | - | Yes | Thumbnail URL |
| `mentionedUserIds` | `String[]` | `[]` | No | Mentioned user IDs |
| `metadata` | `Json` | - | Yes | Custom metadata |
| `scheduledAt` | `DateTime` | - | No | When to send the message |
| `status` | `ChatScheduledStatus` | `PENDING` | No | Current status |
| `sentMessageId` | `String` | - | Yes | ID of the actual message after sending |
| `errorMessage` | `String` | - | Yes | Error details if sending failed |
| `createdAt` | `DateTime` | `now()` | No | Creation timestamp |
| `updatedAt` | `DateTime` | `@updatedAt` | No | Last modification timestamp |

**Indexes:**
- `[channelId, status, scheduledAt]` -- Find pending messages for a channel ordered by send time
- `[status, scheduledAt]` -- BullMQ worker: find all pending messages due for sending
- `[senderId]` -- List scheduled messages by a user

**Relations:**
- `channel` -> `ChatChannel` (many-to-one, cascade delete)

**Design decisions:**
- The `status` state machine is: `PENDING` -> `SENT` | `FAILED` | `CANCELED`. Only `PENDING` messages can be updated or sent.
- `sentMessageId` links back to the actual `ChatMessage` created when the scheduled message is dispatched.
- The BullMQ queue (`chat-scheduled-messages`) polls the `[status, scheduledAt]` index to find due messages.

---

### ChatPoll

Polls embedded in channel messages.

| Field | Type | Default | Nullable | Description |
|-------|------|---------|----------|-------------|
| `id` | `String (CUID)` | `cuid()` | No | Primary key |
| `channelId` | `String` | - | No | Channel where the poll was created |
| `tenantId` | `String` | - | No | Tenant isolation key |
| `title` | `String` | - | No | Poll question/title |
| `allowMultipleVotes` | `Boolean` | `false` | No | Whether users can vote on multiple options |
| `allowUserSuggestion` | `Boolean` | `false` | No | Whether users can add new options |
| `closeAt` | `DateTime` | - | Yes | Auto-close timestamp (null = no auto-close) |
| `status` | `ChatPollStatus` | `OPEN` | No | `OPEN` or `CLOSED` |
| `voterCount` | `Int` | `0` | No | Denormalized total unique voter count |
| `createdById` | `String` | - | No | User who created the poll |
| `createdAt` | `DateTime` | `now()` | No | Creation timestamp |
| `updatedAt` | `DateTime` | `@updatedAt` | No | Last modification timestamp |

**Indexes:**
- `[channelId]` -- Find polls in a channel

**Relations:**
- `options` -> `ChatPollOption[]` (one-to-many)

**Design decisions:**
- `voterCount` is denormalized to avoid counting distinct voters across options on every read.
- A `ChatMessage` with `type: POLL` and `pollId` referencing this model is created alongside the poll, so the poll appears inline in the message timeline.

---

### ChatPollOption

Individual options within a poll.

| Field | Type | Default | Nullable | Description |
|-------|------|---------|----------|-------------|
| `id` | `String (CUID)` | `cuid()` | No | Primary key |
| `pollId` | `String` | - | No | FK to `ChatPoll.id` |
| `text` | `String` | - | No | Option text |
| `voteCount` | `Int` | `0` | No | Denormalized vote count |
| `position` | `Int` | `0` | No | Display order |
| `createdAt` | `DateTime` | `now()` | No | Creation timestamp |
| `updatedAt` | `DateTime` | `@updatedAt` | No | Last modification timestamp |

**Indexes:**
- `[pollId]` -- List options for a poll

**Relations:**
- `poll` -> `ChatPoll` (many-to-one, cascade delete)
- `votes` -> `ChatPollVote[]` (one-to-many)

---

### ChatPollVote

Individual votes on poll options. Each user can vote once per option.

| Field | Type | Default | Nullable | Description |
|-------|------|---------|----------|-------------|
| `id` | `String (CUID)` | `cuid()` | No | Primary key |
| `optionId` | `String` | - | No | FK to `ChatPollOption.id` |
| `userId` | `String` | - | No | User who voted |
| `createdAt` | `DateTime` | `now()` | No | When the vote was cast |

**Unique constraints:**
- `[optionId, userId]` -- One vote per user per option

**Indexes:**
- `[userId]` -- Find all votes by a user (useful for checking if they already voted)

**Relations:**
- `option` -> `ChatPollOption` (many-to-one, cascade delete)

---

### ChatUserBlock

User-to-user blocking within a tenant.

| Field | Type | Default | Nullable | Description |
|-------|------|---------|----------|-------------|
| `id` | `String (CUID)` | `cuid()` | No | Primary key |
| `tenantId` | `String` | - | No | Tenant isolation key |
| `blockerId` | `String` | - | No | User who initiated the block |
| `blockedId` | `String` | - | No | User who was blocked |
| `createdAt` | `DateTime` | `now()` | No | When the block was created |

**Unique constraints:**
- `[blockerId, blockedId]` -- A user can only block another user once

**Indexes:**
- `[blockerId, tenantId]` -- List users blocked by a specific user
- `[blockedId, tenantId]` -- Check if a user is blocked by anyone (used for direct channel creation filtering)

**Design decisions:**
- Blocking is directional: if A blocks B, B can still see A unless B also blocks A.
- Blocking prevents creating new direct channels and hides existing direct channels from the blocked user's list.

---

### ChatReport

User-submitted reports for moderation review.

| Field | Type | Default | Nullable | Description |
|-------|------|---------|----------|-------------|
| `id` | `String (CUID)` | `cuid()` | No | Primary key |
| `tenantId` | `String` | - | No | Tenant isolation key |
| `reporterId` | `String` | - | No | User who filed the report |
| `category` | `ChatReportCategory` | - | No | Report category |
| `description` | `String` | - | Yes | Additional details from the reporter |
| `targetType` | `String` | - | No | Type of reported entity: `"channel"`, `"user"`, or `"message"` |
| `targetId` | `String` | - | No | ID of the reported entity |
| `channelId` | `String` | - | Yes | Channel context (for message reports) |
| `createdAt` | `DateTime` | `now()` | No | When the report was submitted |

**Indexes:**
- `[tenantId, targetType]` -- List reports by type within a tenant (admin moderation dashboard)
- `[reporterId]` -- Find all reports by a specific user

**Design decisions:**
- `targetType` is a string discriminator (`"channel"`, `"user"`, `"message"`) rather than separate tables, keeping the reporting system flexible and simple.
- Reports are write-only from the user perspective. Moderation review is handled externally.

---

## Entity Relationship Diagram

```
ChatChannel 1──* ChatChannelMember
ChatChannel 1──* ChatMessage
ChatChannel 1──* ChatPinnedMessage
ChatChannel 1──* ChatScheduledMessage

ChatMessage 1──* ChatReaction

ChatPoll    1──* ChatPollOption
ChatPollOption 1──* ChatPollVote

ChatMessage ..> ChatPoll (via pollId)
```

---

## Tenant Isolation

All models include a `tenantId` field ensuring strict data isolation between tenants. Queries always include `tenantId` in their WHERE clause. Key indexes are prefixed with `tenantId` to ensure efficient tenant-scoped queries:

- `ChatChannel`: `[tenantId, updatedAt]`, `[tenantId, type]`
- `ChatChannelMember`: `[userId, tenantId, leftAt]`
- `ChatMessage`: `[tenantId]`
- `ChatUserBlock`: `[blockerId, tenantId]`, `[blockedId, tenantId]`
- `ChatReport`: `[tenantId, targetType]`

---

## Constants

Default limits defined in `src/core/constants/chat.constants.ts`:

| Constant | Value | Description |
|----------|-------|-------------|
| `MAX_CHANNEL_MEMBERS` | 100 | Maximum members per channel |
| `MAX_PINNED_MESSAGES` | 5 | Maximum pinned messages per channel |
| `MAX_MESSAGE_LENGTH` | 5000 | Maximum characters per message |
| `MAX_POLL_OPTIONS` | 10 | Maximum options per poll |
| `MAX_FILE_SIZE` | 25 MB (26,214,400 bytes) | Maximum file upload size |
| `MESSAGE_PAGE_SIZE` | 30 | Default messages per page |
| `CHANNEL_PAGE_SIZE` | 20 | Default channels per page |
| `TYPING_TIMEOUT_MS` | 5000 | Typing indicator timeout |
| `CHAT_CACHE_TTL` | 30 seconds | Redis cache TTL |

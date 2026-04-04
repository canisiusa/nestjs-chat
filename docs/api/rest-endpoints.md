# REST API Reference

All endpoints are prefixed with the chat-service base URL (e.g. `https://api.example.com/chat/`).

Every request requires a valid JWT token in the `Authorization: Bearer <token>` header. The token must contain `userId` and `tenantId` claims.

## Response Format

**Success responses** return the resource directly (object or array).

**Error responses** follow a consistent envelope:

```json
{
  "success": false,
  "error": {
    "code": "CHAT_CHANNEL_NOT_FOUND",
    "message": "Channel not found",
    "details": { "channelId": "abc-123" }
  },
  "requestId": "req_xyz",
  "statusCode": 404,
  "timestamp": "2026-04-03T12:00:00.000Z",
  "path": "/channels/abc-123"
}
```

See [Error Codes Reference](./error-codes.md) for all possible error codes.

## Guards Reference

| Guard | Description |
|-------|-------------|
| `ChatAuthGuard` | Validates JWT, extracts `userId` and `tenantId`. Applied to all endpoints. |
| `ChannelMemberGuard` | Verifies the caller is a member of the target channel. |
| `ChannelOperatorGuard` | Verifies the caller has the `OPERATOR` role in the channel. |
| `ChannelNotFrozenGuard` | Rejects the request if the channel is frozen. |
| `UserNotMutedGuard` | Rejects the request if the caller is muted in the channel. |
| `UserNotBannedGuard` | Rejects the request if the caller is banned from the channel. |

---

## Quick Reference Table

### Channels (36 endpoints)

| # | Method | Path | Description | Guards |
|---|--------|------|-------------|--------|
| 1 | `GET` | `/channels` | List user's channels | Auth |
| 2 | `GET` | `/channels/unread-count` | Get total unread count | Auth |
| 3 | `GET` | `/channels/:id` | Get channel details | Auth, Member |
| 4 | `POST` | `/channels/direct` | Create direct channel | Auth |
| 5 | `POST` | `/channels/group` | Create group channel | Auth |
| 6 | `PATCH` | `/channels/:id` | Update channel | Auth, Member, Operator |
| 7 | `DELETE` | `/channels/:id` | Delete channel | Auth, Member, Operator |
| 8 | `POST` | `/channels/:id/leave` | Leave channel | Auth, Member |
| 9 | `GET` | `/channels/:id/members` | List members | Auth, Member |
| 10 | `POST` | `/channels/:id/members/invite` | Invite members | Auth, Member, Operator |
| 11 | `DELETE` | `/channels/:id/members/:userId` | Remove a member | Auth, Member, Operator |
| 12 | `GET` | `/channels/:id/operators` | List operators | Auth, Member |
| 13 | `POST` | `/channels/:id/operators` | Add operators | Auth, Member, Operator |
| 14 | `DELETE` | `/channels/:id/operators` | Remove operators | Auth, Member, Operator |
| 15 | `POST` | `/channels/:id/read` | Mark channel as read | Auth, Member |
| 16 | `PUT` | `/channels/:id/push-trigger` | Set push notification preference | Auth, Member |
| 17 | `GET` | `/channels/:id/push-trigger` | Get push notification preference | Auth, Member |
| 18 | `PUT` | `/channels/:id/count-preference` | Set unread count preference | Auth, Member |
| 19 | `GET` | `/channels/:id/count-preference` | Get unread count preference | Auth, Member |
| 20 | `POST` | `/channels/:id/freeze` | Freeze channel | Auth, Member, Operator |
| 21 | `POST` | `/channels/:id/unfreeze` | Unfreeze channel | Auth, Member, Operator |
| 22 | `POST` | `/channels/:id/mute` | Mute channel for self | Auth, Member |
| 23 | `POST` | `/channels/:id/unmute` | Unmute channel for self | Auth, Member |
| 24 | `POST` | `/channels/:id/members/:userId/mute` | Mute a user | Auth, Member, Operator |
| 25 | `POST` | `/channels/:id/members/:userId/unmute` | Unmute a user | Auth, Member, Operator |
| 26 | `GET` | `/channels/:id/muted-users` | List muted users | Auth, Member, Operator |
| 27 | `POST` | `/channels/:id/members/:userId/ban` | Ban a user | Auth, Member, Operator |
| 28 | `POST` | `/channels/:id/members/:userId/unban` | Unban a user | Auth, Member, Operator |
| 29 | `GET` | `/channels/:id/banned-users` | List banned users | Auth, Member, Operator |
| 30 | `POST` | `/channels/:id/hide` | Hide channel | Auth, Member |
| 31 | `POST` | `/channels/:id/unhide` | Unhide channel | Auth, Member |
| 32 | `POST` | `/channels/:id/reset-history` | Reset message history | Auth, Member |
| 33 | `GET` | `/channels/:id/metadata` | Get channel metadata | Auth, Member |
| 34 | `PUT` | `/channels/:id/metadata` | Set channel metadata | Auth, Member |
| 35 | `DELETE` | `/channels/:id/metadata/:key` | Delete metadata key | Auth, Member |
| 36 | `POST` | `/channels/:id/messages/:messageId/pin` | Pin a message | Auth, Member |
| 37 | `DELETE` | `/channels/:id/messages/:messageId/pin` | Unpin a message | Auth, Member |
| 38 | `GET` | `/channels/:id/pinned-messages` | List pinned messages | Auth, Member |
| 39 | `GET` | `/channels/:id/shared-files` | List shared files | Auth, Member |
| 40 | `POST` | `/channels/:id/report` | Report channel | Auth, Member |

### Messages (13 endpoints)

| # | Method | Path | Description | Guards |
|---|--------|------|-------------|--------|
| 41 | `GET` | `/channels/:id/messages` | List messages | Auth, Member |
| 42 | `GET` | `/channels/:id/messages/:messageId` | Get single message | Auth, Member |
| 43 | `POST` | `/channels/:id/messages` | Send a text message | Auth, Member, NotFrozen, NotMuted, NotBanned |
| 44 | `PATCH` | `/channels/:id/messages/:messageId` | Edit a message | Auth, Member |
| 45 | `DELETE` | `/channels/:id/messages/:messageId` | Delete a message | Auth, Member |
| 46 | `GET` | `/channels/:id/messages/:messageId/thread` | Get thread replies | Auth, Member |
| 47 | `POST` | `/channels/:id/messages/:messageId/forward` | Forward a message | Auth, Member |
| 48 | `POST` | `/messages/search` | Search messages | Auth |
| 49 | `POST` | `/channels/:id/messages/:messageId/reactions` | Add a reaction | Auth, Member |
| 50 | `DELETE` | `/channels/:id/messages/:messageId/reactions/:key` | Remove a reaction | Auth, Member |

### Polls (3 endpoints)

| # | Method | Path | Description | Guards |
|---|--------|------|-------------|--------|
| 51 | `POST` | `/channels/:channelId/polls` | Create a poll | Auth, Member |
| 52 | `POST` | `/channels/:channelId/polls/:pollId/vote` | Vote on a poll | Auth, Member |
| 53 | `GET` | `/channels/:channelId/polls/:pollId` | Get poll details | Auth, Member |

### Users (5 endpoints)

| # | Method | Path | Description | Guards |
|---|--------|------|-------------|--------|
| 54 | `GET` | `/users/search` | Search users | Auth |
| 55 | `GET` | `/users/blocked` | List blocked users | Auth |
| 56 | `GET` | `/users/:userId` | Get user profile | Auth |
| 57 | `POST` | `/users/block` | Block a user | Auth |
| 58 | `POST` | `/users/unblock` | Unblock a user | Auth |

### Scheduled Messages (5 endpoints)

| # | Method | Path | Description | Guards |
|---|--------|------|-------------|--------|
| 59 | `GET` | `/channels/:channelId/scheduled-messages` | List scheduled messages | Auth, Member |
| 60 | `POST` | `/channels/:channelId/scheduled-messages` | Create scheduled message | Auth, Member |
| 61 | `PATCH` | `/channels/:channelId/scheduled-messages/:scheduledId` | Update scheduled message | Auth, Member |
| 62 | `DELETE` | `/channels/:channelId/scheduled-messages/:scheduledId` | Cancel scheduled message | Auth, Member |
| 63 | `POST` | `/channels/:channelId/scheduled-messages/:scheduledId/send-now` | Send scheduled message immediately | Auth, Member |

---

## Detailed Endpoint Documentation

### Channels

#### `GET /channels`

List all channels the authenticated user is a member of.

**Query Parameters:**

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `limit` | `integer` | `20` | Results per page (1-100) |
| `includeEmpty` | `boolean` | `false` | Include channels with no messages |
| `order` | `string` | `latest_last_message` | Sort order: `latest_last_message` or `chronological` |
| `search` | `string` | - | Filter channels by name |

**Response:**

```json
{
  "channels": [
    {
      "id": "ch_abc123",
      "tenantId": "tenant_1",
      "type": "GROUP",
      "name": "Team Chat",
      "coverUrl": "https://...",
      "customType": null,
      "isFrozen": false,
      "metadata": {},
      "lastMessageAt": "2026-04-03T10:30:00.000Z",
      "memberCount": 5,
      "createdById": "user_1",
      "createdAt": "2026-01-15T08:00:00.000Z",
      "updatedAt": "2026-04-03T10:30:00.000Z",
      "unreadCount": 3,
      "lastMessage": {
        "id": "msg_xyz",
        "text": "Hello team!",
        "senderId": "user_2",
        "createdAt": "2026-04-03T10:30:00.000Z"
      }
    }
  ]
}
```

---

#### `GET /channels/unread-count`

Get the total unread message count across all channels.

**Response:**

```json
{
  "totalUnreadCount": 12
}
```

---

#### `GET /channels/:id`

Get full details of a single channel.

**Path Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | `string (CUID)` | Channel ID |

**Response:**

```json
{
  "id": "ch_abc123",
  "tenantId": "tenant_1",
  "type": "GROUP",
  "name": "Team Chat",
  "coverUrl": null,
  "customType": null,
  "isFrozen": false,
  "metadata": {},
  "lastMessageAt": "2026-04-03T10:30:00.000Z",
  "memberCount": 5,
  "createdById": "user_1",
  "createdAt": "2026-01-15T08:00:00.000Z",
  "updatedAt": "2026-04-03T10:30:00.000Z",
  "members": [
    {
      "userId": "user_1",
      "role": "OPERATOR",
      "joinedAt": "2026-01-15T08:00:00.000Z"
    }
  ]
}
```

---

#### `POST /channels/direct`

Create a direct (1-to-1) channel with another user. If a direct channel already exists between both users, it is returned instead.

**Request Body:**

```json
{
  "userId": "user_target_id"
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `userId` | `string` | Yes | The other user's ID |

**Response:** Channel object (same as `GET /channels/:id`).

---

#### `POST /channels/group`

Create a group channel with multiple members.

**Request Body:**

```json
{
  "userIds": ["user_2", "user_3", "user_4"],
  "name": "Project Alpha",
  "coverUrl": "https://example.com/cover.jpg"
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `userIds` | `string[]` | Yes | User IDs to invite (min 1) |
| `name` | `string` | No | Channel display name |
| `coverUrl` | `string` | No | Channel cover image URL |

**Response:** Channel object.

---

#### `PATCH /channels/:id`

Update a group channel's properties. Requires operator role.

**Request Body:**

```json
{
  "name": "New Channel Name",
  "coverUrl": "https://example.com/new-cover.jpg",
  "customType": "project"
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | `string` | No | New channel name |
| `coverUrl` | `string` | No | New cover image URL |
| `customType` | `string` | No | Custom type tag |

**Response:** Updated channel object.

---

#### `DELETE /channels/:id`

Permanently delete a channel and all its messages. Requires operator role.

**Response:** `204 No Content`

---

#### `POST /channels/:id/leave`

Leave a channel. If the last member leaves, the channel is soft-deleted.

**Response:**

```json
{
  "success": true
}
```

---

#### `GET /channels/:id/members`

List all active members of a channel.

**Response:**

```json
{
  "members": [
    {
      "id": "cm_abc",
      "userId": "user_1",
      "role": "OPERATOR",
      "isMuted": false,
      "isBanned": false,
      "joinedAt": "2026-01-15T08:00:00.000Z"
    }
  ]
}
```

---

#### `POST /channels/:id/members/invite`

Invite users to a group channel. Requires operator role.

**Request Body:**

```json
{
  "userIds": ["user_5", "user_6"]
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `userIds` | `string[]` | Yes | User IDs to invite (min 1) |

**Errors:** `CHAT_CHANNEL_MEMBER_LIMIT` (413) if adding would exceed 100 members.

---

#### `DELETE /channels/:id/members/:userId`

Remove a user from the channel. Requires operator role.

**Response:**

```json
{
  "success": true
}
```

---

#### `GET /channels/:id/operators`

List all operators in a channel.

**Response:**

```json
{
  "operators": [
    { "userId": "user_1", "role": "OPERATOR" }
  ]
}
```

---

#### `POST /channels/:id/operators`

Promote members to operator role. Requires operator role.

**Request Body:**

```json
{
  "userIds": ["user_2", "user_3"]
}
```

---

#### `DELETE /channels/:id/operators`

Demote operators back to member role. Requires operator role.

**Request Body:**

```json
{
  "userIds": ["user_2"]
}
```

---

#### `POST /channels/:id/read`

Mark the channel as read for the authenticated user. Updates `lastReadAt` and `lastReadMessageId`.

**Response:**

```json
{
  "success": true
}
```

Emits `chat:read:receipt:updated` via WebSocket.

---

#### `PUT /channels/:id/push-trigger`

Set the push notification preference for this channel.

**Request Body:**

```json
{
  "option": "mention_only"
}
```

| Field | Type | Required | Values |
|-------|------|----------|--------|
| `option` | `string` | Yes | `all`, `mention_only`, `off` |

---

#### `GET /channels/:id/push-trigger`

Get the current push notification preference.

**Response:**

```json
{
  "pushTrigger": "ALL"
}
```

---

#### `PUT /channels/:id/count-preference`

Set the unread count preference.

**Request Body:**

```json
{
  "preference": "unread_message_count_only"
}
```

| Field | Type | Required | Values |
|-------|------|----------|--------|
| `preference` | `string` | Yes | `all`, `unread_message_count_only`, `off` |

---

#### `GET /channels/:id/count-preference`

Get the current unread count preference.

**Response:**

```json
{
  "countPreference": "ALL"
}
```

---

#### `POST /channels/:id/freeze`

Freeze a channel, preventing new messages. Requires operator role.

Emits `chat:channel:frozen` via WebSocket.

---

#### `POST /channels/:id/unfreeze`

Unfreeze a channel. Requires operator role.

Emits `chat:channel:unfrozen` via WebSocket.

---

#### `POST /channels/:id/mute`

Mute a channel for the current user (suppresses notifications).

Emits `chat:channel:muted` via WebSocket.

---

#### `POST /channels/:id/unmute`

Unmute a channel for the current user.

Emits `chat:channel:unmuted` via WebSocket.

---

#### `POST /channels/:id/members/:userId/mute`

Mute a specific user in the channel. Requires operator role.

**Request Body:**

```json
{
  "seconds": 3600
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `seconds` | `integer` | No | Duration in seconds (0 = indefinite) |

Emits `chat:user:muted` via WebSocket.

---

#### `POST /channels/:id/members/:userId/unmute`

Unmute a user in the channel. Requires operator role.

Emits `chat:user:unmuted` via WebSocket.

---

#### `GET /channels/:id/muted-users`

List all muted users in the channel. Requires operator role.

---

#### `POST /channels/:id/members/:userId/ban`

Ban a user from the channel. Requires operator role.

**Request Body:**

```json
{
  "description": "Repeated spam",
  "seconds": 86400
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `description` | `string` | No | Reason for banning |
| `seconds` | `integer` | No | Duration in seconds (0 = permanent) |

Emits `chat:user:banned` via WebSocket.

---

#### `POST /channels/:id/members/:userId/unban`

Unban a user from the channel. Requires operator role.

Emits `chat:user:unbanned` via WebSocket.

---

#### `GET /channels/:id/banned-users`

List all banned users in the channel. Requires operator role.

---

#### `POST /channels/:id/hide`

Hide a channel from the user's channel list.

**Request Body:**

```json
{
  "hidePreviousMessages": false
}
```

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `hidePreviousMessages` | `boolean` | No | `false` | Also hide messages sent before hiding |

Emits `chat:channel:hidden` via WebSocket.

---

#### `POST /channels/:id/unhide`

Unhide a previously hidden channel.

---

#### `POST /channels/:id/reset-history`

Reset the message history for the current user. Messages before this point become invisible to the user.

---

#### `GET /channels/:id/metadata`

Get the channel's custom metadata key-value store.

**Response:**

```json
{
  "metadata": {
    "department": "engineering",
    "priority": "high"
  }
}
```

---

#### `PUT /channels/:id/metadata`

Replace the entire channel metadata.

**Request Body:**

```json
{
  "metadata": {
    "department": "marketing",
    "region": "EU"
  }
}
```

Emits `chat:metadata:changed` via WebSocket.

---

#### `DELETE /channels/:id/metadata/:key`

Delete a single key from channel metadata.

**Path Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `key` | `string` | Metadata key to delete |

---

#### `POST /channels/:id/messages/:messageId/pin`

Pin a message in the channel. Maximum 5 pinned messages per channel.

Emits `chat:pinned:message:updated` via WebSocket.

**Errors:** `CHAT_CHANNEL_PIN_LIMIT` (413) if limit reached.

---

#### `DELETE /channels/:id/messages/:messageId/pin`

Unpin a message.

Emits `chat:pinned:message:updated` via WebSocket.

---

#### `GET /channels/:id/pinned-messages`

List all pinned message IDs in the channel.

**Response:**

```json
{
  "pinnedMessages": [
    {
      "messageId": "msg_abc",
      "pinnedById": "user_1",
      "createdAt": "2026-04-03T09:00:00.000Z"
    }
  ]
}
```

---

#### `GET /channels/:id/shared-files`

List all file messages shared in the channel.

**Query Parameters:**

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `limit` | `number` | - | Max number of files to return |

**Response:**

```json
{
  "files": [
    {
      "id": "msg_file1",
      "fileUrl": "https://...",
      "fileName": "report.pdf",
      "fileSize": 1048576,
      "mimeType": "application/pdf",
      "senderId": "user_1",
      "createdAt": "2026-04-01T14:00:00.000Z"
    }
  ]
}
```

---

#### `POST /channels/:id/report`

Report a channel for moderation.

**Request Body:**

```json
{
  "category": "spam",
  "description": "This channel is sending unsolicited promotional content."
}
```

| Field | Type | Required | Values |
|-------|------|----------|--------|
| `category` | `string` | Yes | `spam`, `harassment`, `inappropriate`, `other` |
| `description` | `string` | No | Additional details |

---

### Messages

#### `GET /channels/:id/messages`

List messages in a channel with cursor-based pagination.

**Query Parameters:**

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `limit` | `integer` | `30` | Results per page (1-100) |
| `before` | `ISO 8601 date` | - | Fetch messages before this timestamp |
| `after` | `ISO 8601 date` | - | Fetch messages after this timestamp |
| `includeReactions` | `boolean` | `true` | Include reaction data |
| `includeThreadInfo` | `boolean` | `true` | Include thread reply counts |

**Response:**

```json
{
  "messages": [
    {
      "id": "msg_abc",
      "channelId": "ch_123",
      "senderId": "user_1",
      "type": "TEXT",
      "text": "Hello everyone!",
      "mentionedUserIds": [],
      "isEdited": false,
      "isForwarded": false,
      "parentMessageId": null,
      "reactions": [
        { "key": "thumbsup", "userIds": ["user_2"] }
      ],
      "createdAt": "2026-04-03T10:30:00.000Z",
      "updatedAt": "2026-04-03T10:30:00.000Z"
    }
  ]
}
```

---

#### `GET /channels/:id/messages/:messageId`

Get a single message by ID.

---

#### `POST /channels/:id/messages`

Send a text message to a channel. The channel must not be frozen, and the user must not be muted or banned.

**Request Body:**

```json
{
  "text": "Hello team!",
  "mentionedUserIds": ["user_2", "user_3"],
  "parentMessageId": "msg_parent_id",
  "metadata": { "customKey": "value" },
  "linkMetadata": {
    "url": "https://example.com",
    "title": "Example",
    "description": "An example link",
    "imageUrl": "https://example.com/og.png",
    "siteName": "Example Site"
  }
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `text` | `string` | Yes | Message text (max 5000 chars) |
| `mentionedUserIds` | `string[]` | No | User IDs mentioned in the message |
| `parentMessageId` | `string` | No | Parent message ID for threading |
| `metadata` | `object` | No | Custom metadata |
| `linkMetadata` | `object` | No | Link preview data |

Emits `chat:message:received` and optionally `chat:mention:received` via WebSocket.

**Errors:** `CHAT_MESSAGE_TOO_LONG` (400), `CHAT_CHANNEL_FROZEN` (403), `CHAT_USER_MUTED` (403), `CHAT_USER_BANNED` (403).

---

#### `PATCH /channels/:id/messages/:messageId`

Edit a message. Only the message sender can edit their own messages.

**Request Body:**

```json
{
  "text": "Updated message text"
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `text` | `string` | Yes | New message text (max 5000 chars) |

Emits `chat:message:updated` via WebSocket.

**Errors:** `CHAT_MESSAGE_NOT_OWNER` (403).

---

#### `DELETE /channels/:id/messages/:messageId`

Soft-delete a message. Only the message sender can delete their own messages (operators may also delete).

Emits `chat:message:deleted` via WebSocket.

---

#### `GET /channels/:id/messages/:messageId/thread`

Get all threaded replies to a parent message.

**Response:**

```json
{
  "messages": [
    {
      "id": "msg_reply1",
      "parentMessageId": "msg_parent",
      "text": "This is a reply",
      "senderId": "user_2",
      "createdAt": "2026-04-03T10:35:00.000Z"
    }
  ]
}
```

---

#### `POST /channels/:id/messages/:messageId/forward`

Forward a message to another channel.

**Request Body:**

```json
{
  "targetChannelId": "ch_target_456"
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `targetChannelId` | `string` | Yes | Destination channel ID |

The forwarded message will have `isForwarded: true` and `forwardedFromId` set to the original message ID.

---

#### `POST /messages/search`

Search messages across all channels the user has access to.

**Request Body:**

```json
{
  "keyword": "quarterly report",
  "channelId": "ch_optional_filter",
  "limit": 20,
  "order": "timestamp",
  "exactMatch": false,
  "timestampFrom": "2026-01-01T00:00:00.000Z",
  "timestampTo": "2026-04-03T23:59:59.000Z"
}
```

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `keyword` | `string` | Yes | - | Search term |
| `channelId` | `string` | No | - | Restrict to a specific channel |
| `limit` | `integer` | No | `20` | Results per page (1-100) |
| `order` | `string` | No | `timestamp` | Sort: `score` or `timestamp` |
| `exactMatch` | `boolean` | No | `false` | Exact phrase matching |
| `timestampFrom` | `ISO 8601 date` | No | - | Start of time range |
| `timestampTo` | `ISO 8601 date` | No | - | End of time range |

---

#### `POST /channels/:id/messages/:messageId/reactions`

Add an emoji reaction to a message.

**Request Body:**

```json
{
  "key": "thumbsup"
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `key` | `string` | Yes | Reaction emoji key (e.g. `thumbsup`, `heart`) |

Emits `chat:reaction:updated` via WebSocket.

---

#### `DELETE /channels/:id/messages/:messageId/reactions/:key`

Remove your reaction from a message.

**Path Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `key` | `string` | Reaction key to remove |

Emits `chat:reaction:updated` via WebSocket.

---

### Polls

#### `POST /channels/:channelId/polls`

Create a poll in a channel. This also sends a message of type `POLL` to the channel.

**Request Body:**

```json
{
  "title": "Where should we have the team lunch?",
  "options": ["Italian", "Japanese", "Mexican"],
  "allowMultipleVotes": false,
  "allowUserSuggestion": true,
  "closeAt": "2026-04-04T18:00:00.000Z"
}
```

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `title` | `string` | Yes | - | Poll question |
| `options` | `string[]` | Yes | - | Answer options (2-10) |
| `allowMultipleVotes` | `boolean` | No | `false` | Allow voting on multiple options |
| `allowUserSuggestion` | `boolean` | No | `false` | Allow users to add options |
| `closeAt` | `ISO 8601 date` | No | - | Auto-close timestamp |

**Errors:** `CHAT_POLL_OPTION_LIMIT` (400) if more than 10 options.

---

#### `POST /channels/:channelId/polls/:pollId/vote`

Vote on one or more poll options.

**Request Body:**

```json
{
  "optionIds": ["opt_abc", "opt_def"]
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `optionIds` | `string[]` | Yes | Option IDs to vote for (min 1) |

Emits `chat:poll:voted` via WebSocket.

**Errors:** `CHAT_POLL_CLOSED` (410), `CHAT_POLL_ALREADY_VOTED` (409).

---

#### `GET /channels/:channelId/polls/:pollId`

Get poll details including options and vote counts.

**Response:**

```json
{
  "id": "poll_abc",
  "channelId": "ch_123",
  "title": "Where should we have the team lunch?",
  "allowMultipleVotes": false,
  "allowUserSuggestion": true,
  "closeAt": "2026-04-04T18:00:00.000Z",
  "status": "OPEN",
  "voterCount": 8,
  "createdById": "user_1",
  "options": [
    { "id": "opt_1", "text": "Italian", "voteCount": 5, "position": 0 },
    { "id": "opt_2", "text": "Japanese", "voteCount": 2, "position": 1 },
    { "id": "opt_3", "text": "Mexican", "voteCount": 1, "position": 2 }
  ],
  "createdAt": "2026-04-03T09:00:00.000Z"
}
```

---

### Users

#### `GET /users/search`

Search users within the same tenant.

**Query Parameters:**

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `keyword` | `string` | (required) | Search term |
| `limit` | `integer` | `20` | Max results (1-50) |

---

#### `GET /users/blocked`

List all users blocked by the authenticated user.

---

#### `GET /users/:userId`

Get a user's profile.

---

#### `POST /users/block`

Block a user. Blocked users cannot send direct messages.

**Request Body:**

```json
{
  "userId": "user_to_block"
}
```

**Errors:** `CHAT_USER_ALREADY_BLOCKED` (409).

---

#### `POST /users/unblock`

Unblock a previously blocked user.

**Request Body:**

```json
{
  "userId": "user_to_unblock"
}
```

---

### Scheduled Messages

#### `GET /channels/:channelId/scheduled-messages`

List all pending scheduled messages for the current user in a channel.

---

#### `POST /channels/:channelId/scheduled-messages`

Schedule a message to be sent at a future time.

**Request Body:**

```json
{
  "text": "Good morning team! Don't forget the standup at 10am.",
  "scheduledAt": "2026-04-04T08:00:00.000Z",
  "mentionedUserIds": ["user_2"],
  "metadata": {}
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `text` | `string` | Yes | Message text (max 5000 chars) |
| `scheduledAt` | `ISO 8601 date` | Yes | When to send (must be in the future) |
| `mentionedUserIds` | `string[]` | No | User IDs to mention |
| `metadata` | `object` | No | Custom metadata |

**Errors:** `CHAT_SCHEDULED_INVALID_TIME` (400) if `scheduledAt` is in the past.

---

#### `PATCH /channels/:channelId/scheduled-messages/:scheduledId`

Update a pending scheduled message.

**Request Body:**

```json
{
  "text": "Updated reminder text",
  "scheduledAt": "2026-04-04T09:00:00.000Z"
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `text` | `string` | No | Updated text (max 5000 chars) |
| `scheduledAt` | `ISO 8601 date` | No | Updated send time |

**Errors:** `CHAT_SCHEDULED_ALREADY_SENT` (410) if already sent.

---

#### `DELETE /channels/:channelId/scheduled-messages/:scheduledId`

Cancel a pending scheduled message (sets status to `CANCELED`).

**Errors:** `CHAT_SCHEDULED_ALREADY_SENT` (410).

---

#### `POST /channels/:channelId/scheduled-messages/:scheduledId/send-now`

Send a pending scheduled message immediately instead of waiting for the scheduled time.

**Errors:** `CHAT_SCHEDULED_ALREADY_SENT` (410).

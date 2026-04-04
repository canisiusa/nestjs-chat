# Error Codes Reference

All error responses from the chat-service follow this format:

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

The `details` field is optional and provides additional context depending on the error.

---

## Error Codes by Category

### Auth Errors

| Code | HTTP Status | Description | When it occurs |
|------|-------------|-------------|----------------|
| `CHAT_AUTH_FAILED` | 401 | Authentication failed | Missing or expired JWT token |
| `CHAT_AUTH_TOKEN_INVALID` | 401 | Token is invalid | Malformed JWT, wrong signing key, or token cannot be decoded |
| `CHAT_AUTH_FORBIDDEN` | 403 | Access denied | User lacks permission for the requested action |

#### Example: `CHAT_AUTH_FAILED`

```json
{
  "success": false,
  "error": {
    "code": "CHAT_AUTH_FAILED",
    "message": "Authentication failed"
  },
  "statusCode": 401,
  "timestamp": "2026-04-03T12:00:00.000Z",
  "path": "/channels"
}
```

---

### Channel Errors

| Code | HTTP Status | Description | When it occurs |
|------|-------------|-------------|----------------|
| `CHAT_CHANNEL_NOT_FOUND` | 404 | Channel does not exist | Accessing a deleted or non-existent channel |
| `CHAT_CHANNEL_ALREADY_EXISTS` | 409 | Channel already exists | Creating a duplicate direct channel between the same two users |
| `CHAT_CHANNEL_FROZEN` | 403 | Channel is frozen | Attempting to send a message in a frozen channel |
| `CHAT_CHANNEL_MEMBER_LIMIT` | 413 | Member limit exceeded | Inviting members when the channel already has 100 members |
| `CHAT_CHANNEL_PIN_LIMIT` | 413 | Pin limit exceeded | Pinning a message when 5 messages are already pinned |

#### Example: `CHAT_CHANNEL_MEMBER_LIMIT`

```json
{
  "success": false,
  "error": {
    "code": "CHAT_CHANNEL_MEMBER_LIMIT",
    "message": "Channel cannot have more than 100 members",
    "details": {
      "maxMembers": 100
    }
  },
  "statusCode": 413,
  "timestamp": "2026-04-03T12:00:00.000Z",
  "path": "/channels/ch_abc/members/invite"
}
```

#### Example: `CHAT_CHANNEL_PIN_LIMIT`

```json
{
  "success": false,
  "error": {
    "code": "CHAT_CHANNEL_PIN_LIMIT",
    "message": "Cannot pin more than 5 messages",
    "details": {
      "maxPinned": 5
    }
  },
  "statusCode": 413,
  "timestamp": "2026-04-03T12:00:00.000Z",
  "path": "/channels/ch_abc/messages/msg_xyz/pin"
}
```

---

### Member Errors

| Code | HTTP Status | Description | When it occurs |
|------|-------------|-------------|----------------|
| `CHAT_NOT_CHANNEL_MEMBER` | 403 | Not a channel member | Accessing a channel you are not a member of |
| `CHAT_NOT_CHANNEL_OPERATOR` | 403 | Not a channel operator | Performing an operator-only action (ban, mute, invite, update, etc.) |
| `CHAT_ALREADY_CHANNEL_MEMBER` | 409 | Already a member | Inviting a user who is already in the channel |
| `CHAT_USER_MUTED` | 403 | User is muted | Attempting to send a message while muted in the channel |
| `CHAT_USER_BANNED` | 403 | User is banned | Attempting any action while banned from the channel |

#### Example: `CHAT_NOT_CHANNEL_OPERATOR`

```json
{
  "success": false,
  "error": {
    "code": "CHAT_NOT_CHANNEL_OPERATOR",
    "message": "Only channel operators can perform this action"
  },
  "statusCode": 403,
  "timestamp": "2026-04-03T12:00:00.000Z",
  "path": "/channels/ch_abc/freeze"
}
```

#### Example: `CHAT_USER_MUTED`

```json
{
  "success": false,
  "error": {
    "code": "CHAT_USER_MUTED",
    "message": "You are muted in this channel"
  },
  "statusCode": 403,
  "timestamp": "2026-04-03T12:00:00.000Z",
  "path": "/channels/ch_abc/messages"
}
```

---

### Message Errors

| Code | HTTP Status | Description | When it occurs |
|------|-------------|-------------|----------------|
| `CHAT_MESSAGE_NOT_FOUND` | 404 | Message does not exist | Accessing a deleted or non-existent message |
| `CHAT_MESSAGE_NOT_OWNER` | 403 | Not the message owner | Editing or deleting another user's message |
| `CHAT_MESSAGE_TOO_LONG` | 400 | Message exceeds max length | Sending or editing a message longer than 5000 characters |

#### Example: `CHAT_MESSAGE_NOT_FOUND`

```json
{
  "success": false,
  "error": {
    "code": "CHAT_MESSAGE_NOT_FOUND",
    "message": "Message not found",
    "details": {
      "messageId": "msg_nonexistent"
    }
  },
  "statusCode": 404,
  "timestamp": "2026-04-03T12:00:00.000Z",
  "path": "/channels/ch_abc/messages/msg_nonexistent"
}
```

---

### Poll Errors

| Code | HTTP Status | Description | When it occurs |
|------|-------------|-------------|----------------|
| `CHAT_POLL_NOT_FOUND` | 404 | Poll does not exist | Accessing a non-existent poll |
| `CHAT_POLL_CLOSED` | 410 | Poll is closed | Voting on a poll that has been closed or expired |
| `CHAT_POLL_OPTION_LIMIT` | 400 | Too many options | Creating a poll with more than 10 options |
| `CHAT_POLL_ALREADY_VOTED` | 409 | Already voted | Voting again on a single-vote poll |

#### Example: `CHAT_POLL_CLOSED`

```json
{
  "success": false,
  "error": {
    "code": "CHAT_POLL_CLOSED",
    "message": "Poll is closed"
  },
  "statusCode": 410,
  "timestamp": "2026-04-03T12:00:00.000Z",
  "path": "/channels/ch_abc/polls/poll_xyz/vote"
}
```

---

### Scheduled Message Errors

| Code | HTTP Status | Description | When it occurs |
|------|-------------|-------------|----------------|
| `CHAT_SCHEDULED_NOT_FOUND` | 404 | Scheduled message not found | Accessing a non-existent scheduled message |
| `CHAT_SCHEDULED_ALREADY_SENT` | 410 | Already sent | Updating, canceling, or sending a scheduled message that was already dispatched |
| `CHAT_SCHEDULED_INVALID_TIME` | 400 | Invalid scheduled time | Setting `scheduledAt` to a time in the past |

#### Example: `CHAT_SCHEDULED_ALREADY_SENT`

```json
{
  "success": false,
  "error": {
    "code": "CHAT_SCHEDULED_ALREADY_SENT",
    "message": "Scheduled message has already been sent"
  },
  "statusCode": 410,
  "timestamp": "2026-04-03T12:00:00.000Z",
  "path": "/channels/ch_abc/scheduled-messages/sch_xyz/send-now"
}
```

---

### User Errors

| Code | HTTP Status | Description | When it occurs |
|------|-------------|-------------|----------------|
| `CHAT_USER_NOT_FOUND` | 404 | User does not exist | Looking up a non-existent user ID |
| `CHAT_USER_ALREADY_BLOCKED` | 409 | User already blocked | Blocking a user who is already blocked |

#### Example: `CHAT_USER_ALREADY_BLOCKED`

```json
{
  "success": false,
  "error": {
    "code": "CHAT_USER_ALREADY_BLOCKED",
    "message": "User is already blocked"
  },
  "statusCode": 409,
  "timestamp": "2026-04-03T12:00:00.000Z",
  "path": "/users/block"
}
```

---

### Storage Errors

| Code | HTTP Status | Description | When it occurs |
|------|-------------|-------------|----------------|
| `CHAT_FILE_TOO_LARGE` | 400 | File exceeds size limit | Uploading a file larger than 25MB |
| `CHAT_FILE_TYPE_NOT_ALLOWED` | 400 | File type not permitted | Uploading a file with a disallowed MIME type |
| `CHAT_UPLOAD_FAILED` | 500 | Upload failed | Internal storage error during file upload |

#### Example: `CHAT_FILE_TOO_LARGE`

```json
{
  "success": false,
  "error": {
    "code": "CHAT_FILE_TOO_LARGE",
    "message": "File exceeds maximum size of 25MB",
    "details": {
      "maxFileSize": 26214400
    }
  },
  "statusCode": 400,
  "timestamp": "2026-04-03T12:00:00.000Z",
  "path": "/channels/ch_abc/messages"
}
```

---

### Generic Errors

| Code | HTTP Status | Description | When it occurs |
|------|-------------|-------------|----------------|
| `CHAT_VALIDATION_ERROR` | 400 | Validation failed | Request body fails DTO validation, Prisma validation, or foreign key constraint |
| `CHAT_CONFLICT` | 409 | Conflict | Unique constraint violation (e.g., duplicate reaction, duplicate block) |
| `CHAT_INTERNAL_ERROR` | 500 | Internal server error | Unexpected server error or database connection failure |
| `CHAT_RATE_LIMITED` | 429 | Rate limit exceeded | Too many requests from the same client |

#### Example: `CHAT_VALIDATION_ERROR`

```json
{
  "success": false,
  "error": {
    "code": "CHAT_VALIDATION_ERROR",
    "message": "text must be shorter than or equal to 5000 characters; text should not be empty",
    "details": {
      "validationErrors": [
        "text must be shorter than or equal to 5000 characters",
        "text should not be empty"
      ]
    }
  },
  "statusCode": 400,
  "timestamp": "2026-04-03T12:00:00.000Z",
  "path": "/channels/ch_abc/messages"
}
```

#### Example: `CHAT_CONFLICT`

```json
{
  "success": false,
  "error": {
    "code": "CHAT_CONFLICT",
    "message": "Duplicate value for channelId, userId",
    "details": {
      "fields": ["channelId", "userId"]
    }
  },
  "statusCode": 409,
  "timestamp": "2026-04-03T12:00:00.000Z",
  "path": "/channels/ch_abc/members/invite"
}
```

---

## Complete Error Code Table

| # | Code | HTTP Status | Category |
|---|------|-------------|----------|
| 1 | `CHAT_AUTH_FAILED` | 401 | Auth |
| 2 | `CHAT_AUTH_TOKEN_INVALID` | 401 | Auth |
| 3 | `CHAT_AUTH_FORBIDDEN` | 403 | Auth |
| 4 | `CHAT_CHANNEL_NOT_FOUND` | 404 | Channel |
| 5 | `CHAT_CHANNEL_ALREADY_EXISTS` | 409 | Channel |
| 6 | `CHAT_CHANNEL_FROZEN` | 403 | Channel |
| 7 | `CHAT_CHANNEL_MEMBER_LIMIT` | 413 | Channel |
| 8 | `CHAT_CHANNEL_PIN_LIMIT` | 413 | Channel |
| 9 | `CHAT_NOT_CHANNEL_MEMBER` | 403 | Member |
| 10 | `CHAT_NOT_CHANNEL_OPERATOR` | 403 | Member |
| 11 | `CHAT_ALREADY_CHANNEL_MEMBER` | 409 | Member |
| 12 | `CHAT_USER_MUTED` | 403 | Member |
| 13 | `CHAT_USER_BANNED` | 403 | Member |
| 14 | `CHAT_MESSAGE_NOT_FOUND` | 404 | Message |
| 15 | `CHAT_MESSAGE_NOT_OWNER` | 403 | Message |
| 16 | `CHAT_MESSAGE_TOO_LONG` | 400 | Message |
| 17 | `CHAT_POLL_NOT_FOUND` | 404 | Poll |
| 18 | `CHAT_POLL_CLOSED` | 410 | Poll |
| 19 | `CHAT_POLL_OPTION_LIMIT` | 400 | Poll |
| 20 | `CHAT_POLL_ALREADY_VOTED` | 409 | Poll |
| 21 | `CHAT_SCHEDULED_NOT_FOUND` | 404 | Scheduled |
| 22 | `CHAT_SCHEDULED_ALREADY_SENT` | 410 | Scheduled |
| 23 | `CHAT_SCHEDULED_INVALID_TIME` | 400 | Scheduled |
| 24 | `CHAT_USER_NOT_FOUND` | 404 | User |
| 25 | `CHAT_USER_ALREADY_BLOCKED` | 409 | User |
| 26 | `CHAT_FILE_TOO_LARGE` | 400 | Storage |
| 27 | `CHAT_FILE_TYPE_NOT_ALLOWED` | 400 | Storage |
| 28 | `CHAT_UPLOAD_FAILED` | 500 | Storage |
| 29 | `CHAT_VALIDATION_ERROR` | 400 | Generic |
| 30 | `CHAT_CONFLICT` | 409 | Generic |
| 31 | `CHAT_INTERNAL_ERROR` | 500 | Generic |
| 32 | `CHAT_RATE_LIMITED` | 429 | Generic |

---

## Prisma Error Mapping

Database-level errors from Prisma are automatically mapped to chat error codes:

| Prisma Code | Chat Error Code | HTTP Status | Description |
|-------------|----------------|-------------|-------------|
| `P2002` | `CHAT_CONFLICT` | 409 | Unique constraint violation |
| `P2025` | `CHAT_CHANNEL_NOT_FOUND` | 404 | Record not found |
| `P2003` | `CHAT_VALIDATION_ERROR` | 400 | Foreign key constraint failure |
| `P2014` | `CHAT_VALIDATION_ERROR` | 400 | Required relation violation |
| Other | `CHAT_INTERNAL_ERROR` | 500 | Unhandled database error |

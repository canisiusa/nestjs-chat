export enum ChatSocketEvent {
  // Client → Server
  TYPING_START = 'chat:typing:start',
  TYPING_STOP = 'chat:typing:stop',
  JOIN_CHANNEL = 'chat:join:channel',
  LEAVE_CHANNEL = 'chat:leave:channel',

  // Server → Client: Messages
  MESSAGE_RECEIVED = 'chat:message:received',
  MESSAGE_UPDATED = 'chat:message:updated',
  MESSAGE_DELETED = 'chat:message:deleted',
  REACTION_UPDATED = 'chat:reaction:updated',
  MENTION_RECEIVED = 'chat:mention:received',
  TYPING_STATUS = 'chat:typing:status:updated',
  READ_RECEIPT_UPDATED = 'chat:read:receipt:updated',
  PINNED_MESSAGE_UPDATED = 'chat:pinned:message:updated',

  // Server → Client: Polls
  POLL_VOTED = 'chat:poll:voted',
  POLL_UPDATED = 'chat:poll:updated',
  POLL_DELETED = 'chat:poll:deleted',

  // Server → Client: Channels
  CHANNEL_CHANGED = 'chat:channel:changed',
  CHANNEL_DELETED = 'chat:channel:deleted',
  USER_JOINED = 'chat:user:joined',
  USER_LEFT = 'chat:user:left',
  UNREAD_COUNT_CHANGED = 'chat:unread:count:changed',
  CHANNEL_FROZEN = 'chat:channel:frozen',
  CHANNEL_UNFROZEN = 'chat:channel:unfrozen',
  CHANNEL_MUTED = 'chat:channel:muted',
  CHANNEL_UNMUTED = 'chat:channel:unmuted',
  METADATA_CHANGED = 'chat:metadata:changed',
  CHANNEL_HIDDEN = 'chat:channel:hidden',
  CHANNEL_MEMBER_COUNT_CHANGED = 'chat:channel:member:count:changed',

  // Server → Client: Moderation
  USER_BANNED = 'chat:user:banned',
  USER_UNBANNED = 'chat:user:unbanned',
  USER_MUTED = 'chat:user:muted',
  USER_UNMUTED = 'chat:user:unmuted',
  OPERATOR_UPDATED = 'chat:operator:updated',
}

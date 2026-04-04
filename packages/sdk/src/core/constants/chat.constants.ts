export const CHAT_QUEUE_NAME = 'chat-scheduled-messages';

export const CHAT_CACHE_PREFIX = 'chat';
export const CHAT_CACHE_TTL = 30; // seconds

export const CHAT_DEFAULTS = {
  MAX_CHANNEL_MEMBERS: 100,
  MAX_PINNED_MESSAGES: 5,
  MAX_MESSAGE_LENGTH: 5000,
  MAX_POLL_OPTIONS: 10,
  MAX_FILE_SIZE: 25 * 1024 * 1024, // 25MB
  MESSAGE_PAGE_SIZE: 30,
  CHANNEL_PAGE_SIZE: 20,
  TYPING_TIMEOUT_MS: 5000,
} as const;

export const CHAT_ROOMS = {
  channel: (channelId: string) => `channel:${channelId}`,
  user: (userId: string) => `user:${userId}`,
  tenant: (tenantId: string) => `tenant:${tenantId}`,
} as const;

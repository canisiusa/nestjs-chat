import { ChatUser } from './chat-user.types';

export type MessageType = 'TEXT' | 'IMAGE' | 'VIDEO' | 'AUDIO' | 'FILE' | 'ADMIN' | 'POLL';
export type ScheduledStatus = 'PENDING' | 'SENT' | 'FAILED' | 'CANCELED';

export interface LinkMetadata {
  url: string;
  title?: string;
  description?: string;
  imageUrl?: string;
  siteName?: string;
}

export interface MessageReactionResponse {
  key: string;
  userIds: string[];
  count: number;
}

export interface ThreadInfo {
  replyCount: number;
  lastRepliedAt: string;
}

export interface MessageResponse {
  id: string;
  channelId: string;
  tenantId: string;
  senderId: string;
  sender?: ChatUser;
  type: MessageType;
  text?: string;

  fileUrl?: string;
  fileName?: string;
  fileSize?: number;
  mimeType?: string;
  thumbnailUrl?: string;

  parentMessageId?: string;
  parentMessage?: MessageResponse;
  threadInfo?: ThreadInfo;

  isForwarded: boolean;
  isEdited: boolean;
  isPinned: boolean;

  linkMetadata?: LinkMetadata;
  mentionedUserIds: string[];
  mentionedUsers?: ChatUser[];
  metadata?: Record<string, any>;

  reactions: MessageReactionResponse[];
  readCount: number;
  deliveryCount: number;

  pollId?: string;
  poll?: any;

  createdAt: string;
  updatedAt: string;
  deletedAt?: string;
}

export interface ScheduledMessageResponse {
  id: string;
  channelId: string;
  senderId: string;
  type: MessageType;
  text?: string;
  fileUrl?: string;
  fileName?: string;
  scheduledAt: string;
  status: ScheduledStatus;
  createdAt: string;
  updatedAt: string;
}

import { ChatUser } from './chat-user.types';

export type ChannelType = 'DIRECT' | 'GROUP';
export type MemberRole = 'OPERATOR' | 'MEMBER';
export type PushTrigger = 'ALL' | 'MENTION_ONLY' | 'OFF';
export type CountPreference = 'ALL' | 'UNREAD_MESSAGE_COUNT_ONLY' | 'OFF';

export interface ChannelResponse {
  id: string;
  tenantId: string;
  type: ChannelType;
  name?: string;
  coverUrl?: string;
  customType?: string;
  isFrozen: boolean;
  metadata?: Record<string, any>;
  lastMessageAt?: string;
  memberCount: number;
  unreadCount: number;
  lastMessage?: any;
  members: ChannelMemberResponse[];
  createdById: string;
  createdAt: string;
  updatedAt: string;
}

export interface ChannelMemberResponse {
  id: string;
  userId: string;
  role: MemberRole;
  isMuted: boolean;
  isBanned: boolean;
  isHidden: boolean;
  pushTrigger: PushTrigger;
  countPreference: CountPreference;
  lastReadAt?: string;
  joinedAt: string;
  user?: ChatUser;
}

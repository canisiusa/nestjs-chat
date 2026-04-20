import { ChatUser } from '../types/chat-user.types';

export interface IChatUserResolver {
  getUser(userId: string, tenantId?: string): Promise<ChatUser | null>;
  getUsers(userIds: string[]): Promise<ChatUser[]>;
  searchUsers(keyword: string, tenantId: string, limit?: number): Promise<ChatUser[]>;
  isOnline?(userId: string): Promise<boolean>;
}

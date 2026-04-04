export interface ChatUser {
  id: string;
  nickname: string;
  profileUrl?: string;
  metadata?: Record<string, string>;
  isOnline?: boolean;
  lastSeenAt?: Date;
}

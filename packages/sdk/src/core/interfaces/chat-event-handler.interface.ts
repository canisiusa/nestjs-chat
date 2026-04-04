export interface IChatEventHandler {
  onMessageSent?(
    channelId: string,
    message: Record<string, unknown>,
    tenantId: string,
  ): Promise<void>;
  onChannelCreated?(channel: Record<string, unknown>, tenantId: string): Promise<void>;
  onUserMentioned?(
    userId: string,
    channelId: string,
    messageId: string,
    tenantId: string,
  ): Promise<void>;
  onUnreadCountChanged?(userId: string, count: number, tenantId: string): Promise<void>;
}

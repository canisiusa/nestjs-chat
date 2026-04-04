import { Injectable, Inject, Optional } from '@nestjs/common';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';
import { Logger } from 'winston';
import { ChatGateway } from './chat.gateway';
import { ChatSocketEvent } from '../../core/types/chat-socket.types';
import { CHAT_EVENT_HANDLER } from '../../core/tokens/injection-tokens';
import { IChatEventHandler } from '../../core/interfaces/chat-event-handler.interface';

@Injectable()
export class ChatEventService {
  constructor(
    private readonly gateway: ChatGateway,
    @Inject(WINSTON_MODULE_PROVIDER) private readonly logger: Logger,
    @Optional() @Inject(CHAT_EVENT_HANDLER) private readonly eventHandler?: IChatEventHandler,
  ) {}

  emitToChannel(channelId: string, event: ChatSocketEvent, payload: unknown) {
    this.gateway.emitToChannel(channelId, event, payload);
  }

  emitToUser(userId: string, event: ChatSocketEvent, payload: unknown) {
    this.gateway.emitToUser(userId, event, payload);
  }

  emitToTenant(tenantId: string, event: ChatSocketEvent, payload: unknown) {
    this.gateway.emitToTenant(tenantId, event, payload);
  }

  async notifyMessageSent(channelId: string, message: Record<string, unknown>, tenantId: string) {
    this.emitToChannel(channelId, ChatSocketEvent.MESSAGE_RECEIVED, { channelId, message });
    try {
      await this.eventHandler?.onMessageSent?.(channelId, message, tenantId);
    } catch (error) {
      this.logger.error('Event handler onMessageSent failed', {
        channelId,
        tenantId,
        error: (error as Error).message,
      });
    }
  }

  async notifyChannelCreated(channel: Record<string, unknown>, tenantId: string) {
    try {
      await this.eventHandler?.onChannelCreated?.(channel, tenantId);
    } catch (error) {
      this.logger.error('Event handler onChannelCreated failed', {
        channelId: channel.id,
        tenantId,
        error: (error as Error).message,
      });
    }
  }

  async notifyMentioned(
    userIds: string[],
    channelId: string,
    messageId: string,
    message: Record<string, unknown>,
    tenantId: string,
  ) {
    for (const userId of userIds) {
      this.emitToUser(userId, ChatSocketEvent.MENTION_RECEIVED, { channelId, message });
      try {
        await this.eventHandler?.onUserMentioned?.(userId, channelId, messageId, tenantId);
      } catch (error) {
        this.logger.error('Event handler onUserMentioned failed', {
          userId,
          channelId,
          messageId,
          error: (error as Error).message,
        });
      }
    }
  }

  async notifyUnreadCountChanged(userId: string, count: number, tenantId: string) {
    this.emitToUser(userId, ChatSocketEvent.UNREAD_COUNT_CHANGED, { totalUnreadCount: count });
    try {
      await this.eventHandler?.onUnreadCountChanged?.(userId, count, tenantId);
    } catch (error) {
      this.logger.error('Event handler onUnreadCountChanged failed', {
        userId,
        count,
        error: (error as Error).message,
      });
    }
  }
}

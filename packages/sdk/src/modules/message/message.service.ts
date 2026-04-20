import { Inject, Injectable } from '@nestjs/common';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';
import { Logger } from 'winston';
import { ChatException, handleServiceError } from '../../common/exceptions';
import { PrismaService } from '../../common/prisma/prisma.service';
import { ChatEventService } from '../gateway/chat-event.service';
import { ChatSocketEvent } from '../../core/types/chat-socket.types';
import { ChatMessageType, ChatMessage, ChatReaction, Prisma } from 'src/generated/prisma/client';
import {
  SendTextMessageDto,
  UpdateMessageDto,
  MessageListQueryDto,
  MessageSearchDto,
  ForwardMessageDto,
  AddReactionDto,
} from './dto';

@Injectable()
export class MessageService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly events: ChatEventService,
    @Inject(WINSTON_MODULE_PROVIDER) private readonly logger: Logger,
  ) {}

  // ─── Message CRUD ────────────────────────────────────────────────────

  async getMessages(channelId: string, userId: string, query: MessageListQueryDto) {
    try {
      const memberFilter = await this.getMemberHistoryFilter(channelId, userId);

      const blocked = await this.prisma.chatUserBlock.findMany({
        where: { blockerId: userId },
        select: { blockedId: true },
      });
      const blockedIds = blocked.map((b) => b.blockedId);

      const where: Prisma.ChatMessageWhereInput = {
        channelId,
        deletedAt: null,
        ...memberFilter,
        ...(blockedIds.length ? { senderId: { notIn: blockedIds } } : {}),
      };

      const createdAtFilter: Prisma.DateTimeFilter = {};
      if (query.before) createdAtFilter.lt = new Date(query.before);
      if (query.after) createdAtFilter.gt = new Date(query.after);
      if (Object.keys(createdAtFilter).length) {
        where.createdAt = { ...(where.createdAt as Prisma.DateTimeFilter), ...createdAtFilter };
      }

      const messages = await this.prisma.chatMessage.findMany({
        where,
        include: query.includeReactions ? { reactions: true } : undefined,
        orderBy: { createdAt: 'desc' },
        take: query.limit,
      });

      return Promise.all(
        messages.map((msg) => this.enrichMessage(msg, channelId, userId, query.includeThreadInfo)),
      );
    } catch (error) {
      throw handleServiceError(error, this.logger, 'MessageService.getMessages', {
        channelId,
        userId,
      });
    }
  }

  async getMessage(channelId: string, messageId: string, userId: string) {
    try {
      const message = await this.prisma.chatMessage.findFirst({
        where: { id: messageId, channelId, deletedAt: null },
        include: { reactions: true },
      });

      if (!message) throw ChatException.messageNotFound(messageId);
      return this.enrichMessage(message, channelId, userId, true);
    } catch (error) {
      throw handleServiceError(error, this.logger, 'MessageService.getMessage', {
        channelId,
        messageId,
        userId,
      });
    }
  }

  async sendTextMessage(
    channelId: string,
    senderId: string,
    tenantId: string,
    dto: SendTextMessageDto,
  ) {
    try {
      const message = await this.prisma.chatMessage.create({
        data: {
          channelId,
          tenantId,
          senderId,
          type: ChatMessageType.TEXT,
          text: dto.text,
          mentionedUserIds: dto.mentionedUserIds ?? [],
          parentMessageId: dto.parentMessageId,
          metadata: dto.metadata,
          linkMetadata: dto.linkMetadata,
        },
        include: { reactions: true },
      });

      await this.prisma.chatChannel.update({
        where: { id: channelId },
        data: { lastMessageAt: message.createdAt },
      });

      const enriched = await this.enrichMessage(message, channelId, senderId, true);
      this.logger.info('Text message sent', {
        messageId: message.id,
        channelId,
        senderId,
        tenantId,
        hasThread: !!dto.parentMessageId,
      });
      await this.events.notifyMessageSent(channelId, enriched, tenantId);

      if (dto.mentionedUserIds?.length) {
        this.logger.info('Users mentioned', {
          messageId: message.id,
          channelId,
          mentionedUserIds: dto.mentionedUserIds,
        });
        await this.events.notifyMentioned(
          dto.mentionedUserIds,
          channelId,
          message.id,
          enriched,
          tenantId,
        );
      }

      await this.notifyUnreadToMembers(channelId, senderId, tenantId);

      return enriched;
    } catch (error) {
      throw handleServiceError(error, this.logger, 'MessageService.sendTextMessage', {
        channelId,
        senderId,
        tenantId,
      });
    }
  }

  async sendFileMessage(
    channelId: string,
    senderId: string,
    tenantId: string,
    fileData: {
      fileUrl: string;
      fileName: string;
      fileSize: number;
      mimeType: string;
      thumbnailUrl?: string;
    },
    options?: { parentMessageId?: string; metadata?: Record<string, any> },
  ) {
    try {
      const typeMap: Record<string, ChatMessageType> = {
        image: ChatMessageType.IMAGE,
        video: ChatMessageType.VIDEO,
        audio: ChatMessageType.AUDIO,
      };
      const category = fileData.mimeType.split('/')[0];
      const type = typeMap[category] || ChatMessageType.FILE;

      const message = await this.prisma.chatMessage.create({
        data: {
          channelId,
          tenantId,
          senderId,
          type,
          fileUrl: fileData.fileUrl,
          fileName: fileData.fileName,
          fileSize: fileData.fileSize,
          mimeType: fileData.mimeType,
          thumbnailUrl: fileData.thumbnailUrl,
          parentMessageId: options?.parentMessageId,
          metadata: options?.metadata,
        },
        include: { reactions: true },
      });

      await this.prisma.chatChannel.update({
        where: { id: channelId },
        data: { lastMessageAt: message.createdAt },
      });

      const enriched = await this.enrichMessage(message, channelId, senderId, true);
      this.logger.info('File message sent', {
        messageId: message.id,
        channelId,
        senderId,
        type: message.type,
        mimeType: fileData.mimeType,
      });
      await this.events.notifyMessageSent(channelId, enriched, tenantId);
      await this.notifyUnreadToMembers(channelId, senderId, tenantId);

      return enriched;
    } catch (error) {
      throw handleServiceError(error, this.logger, 'MessageService.sendFileMessage', {
        channelId,
        senderId,
        tenantId,
      });
    }
  }

  async updateMessage(
    channelId: string,
    messageId: string,
    senderId: string,
    dto: UpdateMessageDto,
  ) {
    try {
      const message = await this.prisma.chatMessage.findFirst({
        where: { id: messageId, channelId, deletedAt: null },
      });

      if (!message) throw ChatException.messageNotFound(messageId);
      if (message.senderId !== senderId) throw ChatException.messageNotOwner();

      const updated = await this.prisma.chatMessage.update({
        where: { id: messageId },
        data: { text: dto.text, isEdited: true },
        include: { reactions: true },
      });

      const enriched = await this.enrichMessage(updated, channelId, senderId, true);
      this.logger.info('Message updated', { messageId, channelId, senderId });
      this.events.emitToChannel(channelId, ChatSocketEvent.MESSAGE_UPDATED, {
        channelId,
        message: enriched,
      });
      return enriched;
    } catch (error) {
      throw handleServiceError(error, this.logger, 'MessageService.updateMessage', {
        channelId,
        messageId,
        senderId,
      });
    }
  }

  async deleteMessage(channelId: string, messageId: string, senderId: string) {
    try {
      const message = await this.prisma.chatMessage.findFirst({
        where: { id: messageId, channelId, deletedAt: null },
      });

      if (!message) throw ChatException.messageNotFound(messageId);
      if (message.senderId !== senderId) {
        // Check if sender is operator (can delete anyone's messages)
        const member = await this.prisma.chatChannelMember.findUnique({
          where: { channelId_userId: { channelId, userId: senderId } },
          select: { role: true },
        });
        if (member?.role !== 'OPERATOR') throw ChatException.messageNotOwner();
      }

      await this.prisma.chatMessage.update({
        where: { id: messageId },
        data: { deletedAt: new Date() },
      });

      this.logger.info('Message deleted', {
        messageId,
        channelId,
        deletedBy: senderId,
        ownedBy: message.senderId,
      });
      this.events.emitToChannel(channelId, ChatSocketEvent.MESSAGE_DELETED, {
        channelId,
        messageId,
      });
    } catch (error) {
      throw handleServiceError(error, this.logger, 'MessageService.deleteMessage', {
        channelId,
        messageId,
        senderId,
      });
    }
  }

  // ─── Threading ───────────────────────────────────────────────────────

  async getThreadedMessages(channelId: string, parentMessageId: string, userId: string) {
    try {
      const messages = await this.prisma.chatMessage.findMany({
        where: { channelId, parentMessageId, deletedAt: null },
        include: { reactions: true },
        orderBy: { createdAt: 'asc' },
      });

      return Promise.all(messages.map((msg) => this.enrichMessage(msg, channelId, userId, false)));
    } catch (error) {
      throw handleServiceError(error, this.logger, 'MessageService.getThreadedMessages', {
        channelId,
        parentMessageId,
        userId,
      });
    }
  }

  // ─── Forwarding ──────────────────────────────────────────────────────

  async forwardMessage(
    channelId: string,
    messageId: string,
    senderId: string,
    tenantId: string,
    dto: ForwardMessageDto,
  ) {
    try {
      const original = await this.prisma.chatMessage.findFirst({
        where: { id: messageId, channelId, deletedAt: null },
      });
      if (!original) throw ChatException.messageNotFound(messageId);

      // Verify sender is member of target channel
      const targetMember = await this.prisma.chatChannelMember.findUnique({
        where: { channelId_userId: { channelId: dto.targetChannelId, userId: senderId } },
      });
      if (!targetMember || targetMember.leftAt || targetMember.isBanned) {
        throw ChatException.notChannelMember();
      }
      if (
        targetMember.isMuted &&
        (!targetMember.mutedUntil || new Date(targetMember.mutedUntil) > new Date())
      ) {
        throw ChatException.userMuted();
      }

      const targetChannel = await this.prisma.chatChannel.findUnique({
        where: { id: dto.targetChannelId, deletedAt: null },
      });
      if (!targetChannel) throw ChatException.channelNotFound(dto.targetChannelId);
      if (targetChannel.isFrozen && targetMember.role !== 'OPERATOR') {
        throw ChatException.channelFrozen();
      }

      const forwarded = await this.prisma.chatMessage.create({
        data: {
          channelId: dto.targetChannelId,
          tenantId,
          senderId,
          type: original.type,
          text: original.text,
          fileUrl: original.fileUrl,
          fileName: original.fileName,
          fileSize: original.fileSize,
          mimeType: original.mimeType,
          thumbnailUrl: original.thumbnailUrl,
          isForwarded: true,
          forwardedFromId: original.id,
          linkMetadata: original.linkMetadata ?? undefined,
          metadata: original.metadata ?? undefined,
        },
        include: { reactions: true },
      });

      await this.prisma.chatChannel.update({
        where: { id: dto.targetChannelId },
        data: { lastMessageAt: forwarded.createdAt },
      });

      const enriched = await this.enrichMessage(forwarded, dto.targetChannelId, senderId, true);
      this.logger.info('Message forwarded', {
        originalId: original.id,
        forwardedId: forwarded.id,
        from: channelId,
        to: dto.targetChannelId,
        senderId,
      });
      await this.events.notifyMessageSent(dto.targetChannelId, enriched, tenantId);
      return enriched;
    } catch (error) {
      throw handleServiceError(error, this.logger, 'MessageService.forwardMessage', {
        channelId,
        messageId,
        senderId,
        tenantId,
      });
    }
  }

  // ─── Search ──────────────────────────────────────────────────────────

  async searchMessages(tenantId: string, userId: string, dto: MessageSearchDto) {
    try {
      const where: Prisma.ChatMessageWhereInput = {
        tenantId,
        deletedAt: null,
      };

      if (dto.channelId) {
        where.channelId = dto.channelId;
      }

      if (dto.exactMatch) {
        where.text = { contains: dto.keyword, mode: 'insensitive' };
      } else {
        where.text = { contains: dto.keyword, mode: 'insensitive' };
      }

      const searchDateFilter: Prisma.DateTimeFilter = {};
      if (dto.timestampFrom) searchDateFilter.gte = new Date(dto.timestampFrom);
      if (dto.timestampTo) searchDateFilter.lte = new Date(dto.timestampTo);
      if (Object.keys(searchDateFilter).length) {
        where.createdAt = searchDateFilter;
      }

      const messages = await this.prisma.chatMessage.findMany({
        where,
        include: { reactions: true },
        orderBy: dto.order === 'timestamp' ? { createdAt: 'desc' } : { createdAt: 'desc' },
        take: dto.limit,
      });

      return Promise.all(
        messages.map((msg) => this.enrichMessage(msg, msg.channelId, userId, false)),
      );
    } catch (error) {
      throw handleServiceError(error, this.logger, 'MessageService.searchMessages', {
        tenantId,
        userId,
      });
    }
  }

  // ─── Reactions ───────────────────────────────────────────────────────

  async addReaction(channelId: string, messageId: string, userId: string, dto: AddReactionDto) {
    try {
      await this.prisma.chatReaction.upsert({
        where: { messageId_userId_key: { messageId, userId, key: dto.key } },
        create: { messageId, userId, key: dto.key },
        update: {},
      });

      const reactions = await this.getReactionsForMessage(messageId);
      this.events.emitToChannel(channelId, ChatSocketEvent.REACTION_UPDATED, {
        channelId,
        messageId,
        reactions,
      });
    } catch (error) {
      throw handleServiceError(error, this.logger, 'MessageService.addReaction', {
        channelId,
        messageId,
        userId,
      });
    }
  }

  async removeReaction(channelId: string, messageId: string, userId: string, key: string) {
    try {
      await this.prisma.chatReaction.deleteMany({
        where: { messageId, userId, key },
      });

      const reactions = await this.getReactionsForMessage(messageId);
      this.events.emitToChannel(channelId, ChatSocketEvent.REACTION_UPDATED, {
        channelId,
        messageId,
        reactions,
      });
    } catch (error) {
      throw handleServiceError(error, this.logger, 'MessageService.removeReaction', {
        channelId,
        messageId,
        userId,
      });
    }
  }

  // ─── Helpers ─────────────────────────────────────────────────────────

  private async getReactionsForMessage(messageId: string) {
    const raw = await this.prisma.chatReaction.findMany({ where: { messageId } });

    const grouped: Record<string, string[]> = {};
    for (const r of raw) {
      if (!grouped[r.key]) grouped[r.key] = [];
      grouped[r.key].push(r.userId);
    }

    return Object.entries(grouped).map(([key, userIds]) => ({
      key,
      userIds,
      count: userIds.length,
    }));
  }

  private async enrichMessage(
    message: ChatMessage & { reactions?: ChatReaction[] },
    channelId: string,
    currentUserId: string,
    includeThreadInfo?: boolean,
  ) {
    const reactions = message.reactions
      ? this.groupReactions(message.reactions)
      : await this.getReactionsForMessage(message.id);

    const isPinned = !!(await this.prisma.chatPinnedMessage.findUnique({
      where: { channelId_messageId: { channelId, messageId: message.id } },
    }));

    let threadInfo;
    if (includeThreadInfo && !message.parentMessageId) {
      const replyCount = await this.prisma.chatMessage.count({
        where: { parentMessageId: message.id, deletedAt: null },
      });
      if (replyCount > 0) {
        const lastReply = await this.prisma.chatMessage.findFirst({
          where: { parentMessageId: message.id, deletedAt: null },
          orderBy: { createdAt: 'desc' },
          select: { createdAt: true },
        });
        threadInfo = { replyCount, lastRepliedAt: lastReply?.createdAt?.toISOString() };
      }
    }

    const memberCount = await this.prisma.chatChannelMember.count({
      where: { channelId, leftAt: null, isBanned: false },
    });

    const readCount = await this.prisma.chatChannelMember.count({
      where: {
        channelId,
        leftAt: null,
        isBanned: false,
        userId: { not: message.senderId },
        lastReadAt: { gte: message.createdAt },
      },
    });

    return {
      ...message,
      reactions,
      isPinned,
      threadInfo,
      readCount,
      deliveryCount: memberCount - 1,
      deletedAt: undefined,
    };
  }

  private groupReactions(reactions: ChatReaction[]) {
    const grouped: Record<string, string[]> = {};
    for (const r of reactions) {
      if (!grouped[r.key]) grouped[r.key] = [];
      grouped[r.key].push(r.userId);
    }
    return Object.entries(grouped).map(([key, userIds]) => ({
      key,
      userIds,
      count: userIds.length,
    }));
  }

  private async getMemberHistoryFilter(channelId: string, userId: string) {
    const member = await this.prisma.chatChannelMember.findUnique({
      where: { channelId_userId: { channelId, userId } },
      select: { historyResetAt: true },
    });

    if (member?.historyResetAt) {
      return { createdAt: { gt: member.historyResetAt } };
    }
    return {};
  }

  private async notifyUnreadToMembers(channelId: string, senderId: string, tenantId: string) {
    const members = await this.prisma.chatChannelMember.findMany({
      where: { channelId, leftAt: null, isBanned: false, userId: { not: senderId } },
      select: { userId: true },
    });

    for (const m of members) {
      this.events.emitToUser(m.userId, ChatSocketEvent.UNREAD_COUNT_CHANGED, {
        totalUnreadCount: -1, // -1 signals client to refetch
      });
    }
  }
}

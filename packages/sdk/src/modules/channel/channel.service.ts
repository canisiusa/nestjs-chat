import { Inject, Injectable } from '@nestjs/common';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';
import { Logger } from 'winston';
import { ChatException, handleServiceError } from '../../common/exceptions';
import { PrismaService } from '../../common/prisma/prisma.service';
import { ChatEventService } from '../gateway/chat-event.service';
import { ChatSocketEvent } from '../../core/types/chat-socket.types';
import {
  ChatChannelType,
  ChatMemberRole,
  ChatPushTrigger,
  ChatCountPreference,
  ChatReportCategory,
  ChatChannelMember,
  ChatPinnedMessage,
  ChatChannel,
  Prisma,
} from 'src/generated/prisma/client';
import { CHAT_DEFAULTS } from '../../core/constants';
import {
  CreateDirectChannelDto,
  CreateGroupChannelDto,
  UpdateChannelDto,
  ChannelListQueryDto,
  InviteMembersDto,
  BanUserDto,
  MuteUserDto,
  SetPushTriggerDto,
  SetCountPreferenceDto,
  HideChannelDto,
  ReportDto,
} from './dto';

@Injectable()
export class ChannelService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly events: ChatEventService,
    @Inject(WINSTON_MODULE_PROVIDER) private readonly logger: Logger,
  ) {}

  // ─── Channel CRUD ────────────────────────────────────────────────────

  async getChannels(userId: string, tenantId: string, query: ChannelListQueryDto) {
    try {
      const where: Prisma.ChatChannelWhereInput = {
        tenantId,
        deletedAt: null,
        members: {
          some: {
            userId,
            leftAt: null,
            isBanned: false,
            isHidden: false,
          },
        },
      };

      if (query.search) {
        where.name = { contains: query.search, mode: 'insensitive' };
      }

      if (!query.includeEmpty) {
        where.lastMessageAt = { not: null };
      }

      const channels = await this.prisma.chatChannel.findMany({
        where,
        include: {
          members: { where: { leftAt: null, isBanned: false }, take: 10 },
          pinnedMessages: true,
        },
        orderBy:
          query.order === 'chronological'
            ? { createdAt: 'desc' }
            : { lastMessageAt: { sort: 'desc', nulls: 'last' } },
        take: query.limit,
      });

      return Promise.all(channels.map((ch) => this.enrichChannel(ch, userId)));
    } catch (error) {
      throw handleServiceError(error, this.logger, 'ChannelService.getChannels', {
        userId,
        tenantId,
      });
    }
  }

  async getChannel(channelId: string, userId: string) {
    try {
      const channel = await this.prisma.chatChannel.findUnique({
        where: { id: channelId, deletedAt: null },
        include: {
          members: { where: { leftAt: null, isBanned: false } },
          pinnedMessages: true,
        },
      });

      if (!channel) throw ChatException.channelNotFound(channelId);
      return this.enrichChannel(channel, userId);
    } catch (error) {
      throw handleServiceError(error, this.logger, 'ChannelService.getChannel', {
        channelId,
        userId,
      });
    }
  }

  async createDirectChannel(userId: string, tenantId: string, dto: CreateDirectChannelDto) {
    try {
      const targetUserId = dto.userId;

      const existing = await this.prisma.chatChannel.findFirst({
        where: {
          tenantId,
          type: ChatChannelType.DIRECT,
          deletedAt: null,
          AND: [
            { members: { some: { userId, leftAt: null } } },
            { members: { some: { userId: targetUserId, leftAt: null } } },
          ],
        },
        include: { members: { where: { leftAt: null } } },
      });

      if (existing) return this.enrichChannel(existing, userId);

      const channel = await this.prisma.chatChannel.create({
        data: {
          tenantId,
          type: ChatChannelType.DIRECT,
          createdById: userId,
          memberCount: 2,
          members: {
            create: [
              { userId, tenantId, role: ChatMemberRole.OPERATOR },
              { userId: targetUserId, tenantId, role: ChatMemberRole.OPERATOR },
            ],
          },
        },
        include: { members: true },
      });

      this.logger.info('Direct channel created', {
        channelId: channel.id,
        userId,
        targetUserId,
        tenantId,
      });
      await this.events.notifyChannelCreated(channel, tenantId);
      return this.enrichChannel(channel, userId);
    } catch (error) {
      throw handleServiceError(error, this.logger, 'ChannelService.createDirectChannel', {
        userId,
        tenantId,
        targetUserId: dto.userId,
      });
    }
  }

  async createGroupChannel(userId: string, tenantId: string, dto: CreateGroupChannelDto) {
    try {
      const allUserIds = [...new Set([userId, ...dto.userIds])];

      if (allUserIds.length > CHAT_DEFAULTS.MAX_CHANNEL_MEMBERS) {
        throw ChatException.memberLimit(CHAT_DEFAULTS.MAX_CHANNEL_MEMBERS);
      }

      const channel = await this.prisma.chatChannel.create({
        data: {
          tenantId,
          type: ChatChannelType.GROUP,
          name: dto.name,
          coverUrl: dto.coverUrl,
          createdById: userId,
          memberCount: allUserIds.length,
          members: {
            create: allUserIds.map((uid) => ({
              userId: uid,
              tenantId,
              role: uid === userId ? ChatMemberRole.OPERATOR : ChatMemberRole.MEMBER,
            })),
          },
        },
        include: { members: true },
      });

      this.logger.info('Group channel created', {
        channelId: channel.id,
        userId,
        memberCount: allUserIds.length,
        tenantId,
      });
      await this.events.notifyChannelCreated(channel, tenantId);
      return this.enrichChannel(channel, userId);
    } catch (error) {
      throw handleServiceError(error, this.logger, 'ChannelService.createGroupChannel', {
        userId,
        tenantId,
      });
    }
  }

  async updateChannel(channelId: string, dto: UpdateChannelDto) {
    try {
      const channel = await this.prisma.chatChannel.update({
        where: { id: channelId },
        data: { name: dto.name, coverUrl: dto.coverUrl, customType: dto.customType },
        include: { members: { where: { leftAt: null } } },
      });

      this.events.emitToChannel(channelId, ChatSocketEvent.CHANNEL_CHANGED, { channel });
      return channel;
    } catch (error) {
      throw handleServiceError(error, this.logger, 'ChannelService.updateChannel', { channelId });
    }
  }

  async deleteChannel(channelId: string) {
    try {
      await this.ensureChannel(channelId);
      await this.prisma.chatChannel.update({
        where: { id: channelId },
        data: { deletedAt: new Date() },
      });
      this.logger.info('Channel deleted', { channelId });
      this.events.emitToChannel(channelId, ChatSocketEvent.CHANNEL_DELETED, { channelId });
    } catch (error) {
      throw handleServiceError(error, this.logger, 'ChannelService.deleteChannel', { channelId });
    }
  }

  async leaveChannel(channelId: string, userId: string) {
    try {
      await this.prisma.chatChannelMember.update({
        where: { channelId_userId: { channelId, userId } },
        data: { leftAt: new Date() },
      });

      await this.prisma.chatChannel.update({
        where: { id: channelId },
        data: { memberCount: { decrement: 1 } },
      });

      this.events.emitToChannel(channelId, ChatSocketEvent.USER_LEFT, { channelId, userId });
      this.events.emitToChannel(channelId, ChatSocketEvent.CHANNEL_MEMBER_COUNT_CHANGED, {
        channelId,
        memberCount: (
          await this.prisma.chatChannel.findUnique({
            where: { id: channelId },
            select: { memberCount: true },
          })
        )?.memberCount,
      });
    } catch (error) {
      throw handleServiceError(error, this.logger, 'ChannelService.leaveChannel', {
        channelId,
        userId,
      });
    }
  }

  // ─── Members ─────────────────────────────────────────────────────────

  async getMembers(channelId: string) {
    try {
      return this.prisma.chatChannelMember.findMany({
        where: { channelId, leftAt: null, isBanned: false },
      });
    } catch (error) {
      throw handleServiceError(error, this.logger, 'ChannelService.getMembers', { channelId });
    }
  }

  async inviteUsers(channelId: string, tenantId: string, dto: InviteMembersDto) {
    try {
      const channel = await this.prisma.chatChannel.findUnique({
        where: { id: channelId },
        select: { memberCount: true },
      });

      if ((channel?.memberCount ?? 0) + dto.userIds.length > CHAT_DEFAULTS.MAX_CHANNEL_MEMBERS) {
        throw ChatException.memberLimit(CHAT_DEFAULTS.MAX_CHANNEL_MEMBERS);
      }

      for (const userId of dto.userIds) {
        await this.prisma.chatChannelMember.upsert({
          where: { channelId_userId: { channelId, userId } },
          create: { channelId, userId, tenantId, role: ChatMemberRole.MEMBER },
          update: { leftAt: null, isBanned: false },
        });

        this.events.emitToChannel(channelId, ChatSocketEvent.USER_JOINED, { channelId, userId });
      }

      await this.prisma.chatChannel.update({
        where: { id: channelId },
        data: { memberCount: { increment: dto.userIds.length } },
      });

      return this.getChannel(channelId, dto.userIds[0]);
    } catch (error) {
      throw handleServiceError(error, this.logger, 'ChannelService.inviteUsers', {
        channelId,
        tenantId,
      });
    }
  }

  async removeUser(channelId: string, targetUserId: string) {
    try {
      await this.ensureTargetMember(channelId, targetUserId);
      await this.prisma.chatChannelMember.update({
        where: { channelId_userId: { channelId, userId: targetUserId } },
        data: { leftAt: new Date() },
      });

      await this.prisma.chatChannel.update({
        where: { id: channelId },
        data: { memberCount: { decrement: 1 } },
      });

      this.events.emitToChannel(channelId, ChatSocketEvent.USER_LEFT, {
        channelId,
        userId: targetUserId,
      });
    } catch (error) {
      throw handleServiceError(error, this.logger, 'ChannelService.removeUser', {
        channelId,
        targetUserId,
      });
    }
  }

  // ─── Operators ───────────────────────────────────────────────────────

  async getOperators(channelId: string) {
    try {
      return this.prisma.chatChannelMember.findMany({
        where: { channelId, role: ChatMemberRole.OPERATOR, leftAt: null },
      });
    } catch (error) {
      throw handleServiceError(error, this.logger, 'ChannelService.getOperators', { channelId });
    }
  }

  async addOperators(channelId: string, userIds: string[]) {
    try {
      await this.prisma.chatChannelMember.updateMany({
        where: { channelId, userId: { in: userIds } },
        data: { role: ChatMemberRole.OPERATOR },
      });

      const operators = await this.getOperators(channelId);
      this.events.emitToChannel(channelId, ChatSocketEvent.OPERATOR_UPDATED, {
        channelId,
        operators,
      });
    } catch (error) {
      throw handleServiceError(error, this.logger, 'ChannelService.addOperators', {
        channelId,
        userIds,
      });
    }
  }

  async removeOperators(channelId: string, userIds: string[]) {
    try {
      await this.prisma.chatChannelMember.updateMany({
        where: { channelId, userId: { in: userIds } },
        data: { role: ChatMemberRole.MEMBER },
      });

      const operators = await this.getOperators(channelId);
      this.events.emitToChannel(channelId, ChatSocketEvent.OPERATOR_UPDATED, {
        channelId,
        operators,
      });
    } catch (error) {
      throw handleServiceError(error, this.logger, 'ChannelService.removeOperators', {
        channelId,
        userIds,
      });
    }
  }

  // ─── Read / Unread ───────────────────────────────────────────────────

  async markAsRead(channelId: string, userId: string) {
    try {
      const now = new Date();
      await this.prisma.chatChannelMember.update({
        where: { channelId_userId: { channelId, userId } },
        data: { lastReadAt: now },
      });

      this.events.emitToChannel(channelId, ChatSocketEvent.READ_RECEIPT_UPDATED, {
        channelId,
        userId,
        lastReadAt: now.toISOString(),
      });
    } catch (error) {
      throw handleServiceError(error, this.logger, 'ChannelService.markAsRead', {
        channelId,
        userId,
      });
    }
  }

  async getUnreadCount(userId: string, tenantId: string): Promise<number> {
    try {
      const memberships = await this.prisma.chatChannelMember.findMany({
        where: { userId, tenantId, leftAt: null, isBanned: false, isHidden: false },
        select: { channelId: true, lastReadAt: true, historyResetAt: true },
      });

      let total = 0;
      for (const m of memberships) {
        const afterDate =
          m.lastReadAt && m.historyResetAt
            ? m.lastReadAt > m.historyResetAt
              ? m.lastReadAt
              : m.historyResetAt
            : m.lastReadAt || m.historyResetAt;

        const count = await this.prisma.chatMessage.count({
          where: {
            channelId: m.channelId,
            deletedAt: null,
            senderId: { not: userId },
            ...(afterDate ? { createdAt: { gt: afterDate } } : {}),
          },
        });
        total += count;
      }

      return total;
    } catch (error) {
      throw handleServiceError(error, this.logger, 'ChannelService.getUnreadCount', {
        userId,
        tenantId,
      });
    }
  }

  // ─── Notification Preferences ────────────────────────────────────────

  async setPushTrigger(channelId: string, userId: string, dto: SetPushTriggerDto) {
    try {
      const map: Record<string, ChatPushTrigger> = {
        all: ChatPushTrigger.ALL,
        mention_only: ChatPushTrigger.MENTION_ONLY,
        off: ChatPushTrigger.OFF,
      };
      await this.prisma.chatChannelMember.update({
        where: { channelId_userId: { channelId, userId } },
        data: { pushTrigger: map[dto.option] },
      });
    } catch (error) {
      throw handleServiceError(error, this.logger, 'ChannelService.setPushTrigger', {
        channelId,
        userId,
      });
    }
  }

  async getPushTrigger(channelId: string, userId: string) {
    try {
      const member = await this.prisma.chatChannelMember.findUnique({
        where: { channelId_userId: { channelId, userId } },
        select: { pushTrigger: true },
      });
      return member?.pushTrigger?.toLowerCase() ?? 'all';
    } catch (error) {
      throw handleServiceError(error, this.logger, 'ChannelService.getPushTrigger', {
        channelId,
        userId,
      });
    }
  }

  async setCountPreference(channelId: string, userId: string, dto: SetCountPreferenceDto) {
    try {
      const map: Record<string, ChatCountPreference> = {
        all: ChatCountPreference.ALL,
        unread_message_count_only: ChatCountPreference.UNREAD_MESSAGE_COUNT_ONLY,
        off: ChatCountPreference.OFF,
      };
      await this.prisma.chatChannelMember.update({
        where: { channelId_userId: { channelId, userId } },
        data: { countPreference: map[dto.preference] },
      });
    } catch (error) {
      throw handleServiceError(error, this.logger, 'ChannelService.setCountPreference', {
        channelId,
        userId,
      });
    }
  }

  async getCountPreference(channelId: string, userId: string) {
    try {
      const member = await this.prisma.chatChannelMember.findUnique({
        where: { channelId_userId: { channelId, userId } },
        select: { countPreference: true },
      });
      return member?.countPreference?.toLowerCase() ?? 'all';
    } catch (error) {
      throw handleServiceError(error, this.logger, 'ChannelService.getCountPreference', {
        channelId,
        userId,
      });
    }
  }

  // ─── Moderation ──────────────────────────────────────────────────────

  async freezeChannel(channelId: string) {
    try {
      await this.prisma.chatChannel.update({ where: { id: channelId }, data: { isFrozen: true } });
      this.logger.info('Channel frozen', { channelId });
      this.events.emitToChannel(channelId, ChatSocketEvent.CHANNEL_FROZEN, { channelId });
    } catch (error) {
      throw handleServiceError(error, this.logger, 'ChannelService.freezeChannel', { channelId });
    }
  }

  async unfreezeChannel(channelId: string) {
    try {
      await this.prisma.chatChannel.update({ where: { id: channelId }, data: { isFrozen: false } });
      this.logger.info('Channel unfrozen', { channelId });
      this.events.emitToChannel(channelId, ChatSocketEvent.CHANNEL_UNFROZEN, { channelId });
    } catch (error) {
      throw handleServiceError(error, this.logger, 'ChannelService.unfreezeChannel', { channelId });
    }
  }

  async muteChannel(channelId: string, userId: string) {
    try {
      await this.prisma.chatChannelMember.update({
        where: { channelId_userId: { channelId, userId } },
        data: { isMuted: true },
      });
      this.events.emitToChannel(channelId, ChatSocketEvent.CHANNEL_MUTED, { channelId });
    } catch (error) {
      throw handleServiceError(error, this.logger, 'ChannelService.muteChannel', {
        channelId,
        userId,
      });
    }
  }

  async unmuteChannel(channelId: string, userId: string) {
    try {
      await this.prisma.chatChannelMember.update({
        where: { channelId_userId: { channelId, userId } },
        data: { isMuted: false, mutedUntil: null },
      });
      this.events.emitToChannel(channelId, ChatSocketEvent.CHANNEL_UNMUTED, { channelId });
    } catch (error) {
      throw handleServiceError(error, this.logger, 'ChannelService.unmuteChannel', {
        channelId,
        userId,
      });
    }
  }

  async muteUser(channelId: string, targetUserId: string, dto: MuteUserDto) {
    try {
      await this.ensureTargetMember(channelId, targetUserId);
      await this.prisma.chatChannelMember.update({
        where: { channelId_userId: { channelId, userId: targetUserId } },
        data: {
          isMuted: true,
          mutedUntil: dto.seconds ? new Date(Date.now() + dto.seconds * 1000) : null,
        },
      });
      this.logger.warn('User muted in channel', { channelId, targetUserId, seconds: dto.seconds });
      this.events.emitToChannel(channelId, ChatSocketEvent.USER_MUTED, {
        channelId,
        userId: targetUserId,
      });
    } catch (error) {
      throw handleServiceError(error, this.logger, 'ChannelService.muteUser', {
        channelId,
        targetUserId,
      });
    }
  }

  async unmuteUser(channelId: string, targetUserId: string) {
    try {
      await this.ensureTargetMember(channelId, targetUserId);
      await this.prisma.chatChannelMember.update({
        where: { channelId_userId: { channelId, userId: targetUserId } },
        data: { isMuted: false, mutedUntil: null },
      });
      this.events.emitToChannel(channelId, ChatSocketEvent.USER_UNMUTED, {
        channelId,
        userId: targetUserId,
      });
    } catch (error) {
      throw handleServiceError(error, this.logger, 'ChannelService.unmuteUser', {
        channelId,
        targetUserId,
      });
    }
  }

  async getMutedUsers(channelId: string) {
    try {
      return this.prisma.chatChannelMember.findMany({
        where: { channelId, isMuted: true, leftAt: null },
      });
    } catch (error) {
      throw handleServiceError(error, this.logger, 'ChannelService.getMutedUsers', { channelId });
    }
  }

  async banUser(channelId: string, targetUserId: string, dto: BanUserDto) {
    try {
      await this.ensureTargetMember(channelId, targetUserId);
      await this.prisma.chatChannelMember.update({
        where: { channelId_userId: { channelId, userId: targetUserId } },
        data: {
          isBanned: true,
          banDescription: dto.description,
          bannedUntil: dto.seconds ? new Date(Date.now() + dto.seconds * 1000) : null,
        },
      });

      await this.prisma.chatChannel.update({
        where: { id: channelId },
        data: { memberCount: { decrement: 1 } },
      });

      this.logger.warn('User banned from channel', {
        channelId,
        targetUserId,
        description: dto.description,
        seconds: dto.seconds,
      });
      this.events.emitToChannel(channelId, ChatSocketEvent.USER_BANNED, {
        channelId,
        userId: targetUserId,
      });
    } catch (error) {
      throw handleServiceError(error, this.logger, 'ChannelService.banUser', {
        channelId,
        targetUserId,
      });
    }
  }

  async unbanUser(channelId: string, targetUserId: string) {
    try {
      const member = await this.prisma.chatChannelMember.findUnique({
        where: { channelId_userId: { channelId, userId: targetUserId } },
      });
      if (!member) throw ChatException.userNotFound(targetUserId);
      if (!member.isBanned) throw ChatException.validation('User is not banned');

      await this.prisma.chatChannelMember.update({
        where: { channelId_userId: { channelId, userId: targetUserId } },
        data: { isBanned: false, bannedUntil: null, banDescription: null },
      });

      await this.prisma.chatChannel.update({
        where: { id: channelId },
        data: { memberCount: { increment: 1 } },
      });

      this.events.emitToChannel(channelId, ChatSocketEvent.USER_UNBANNED, {
        channelId,
        userId: targetUserId,
      });
    } catch (error) {
      throw handleServiceError(error, this.logger, 'ChannelService.unbanUser', {
        channelId,
        targetUserId,
      });
    }
  }

  async getBannedUsers(channelId: string) {
    try {
      return this.prisma.chatChannelMember.findMany({
        where: { channelId, isBanned: true },
      });
    } catch (error) {
      throw handleServiceError(error, this.logger, 'ChannelService.getBannedUsers', { channelId });
    }
  }

  // ─── Visibility ──────────────────────────────────────────────────────

  async hideChannel(channelId: string, userId: string, dto: HideChannelDto) {
    try {
      await this.prisma.chatChannelMember.update({
        where: { channelId_userId: { channelId, userId } },
        data: {
          isHidden: true,
          hidePrevMessages: dto.hidePreviousMessages ?? false,
          ...(dto.hidePreviousMessages ? { historyResetAt: new Date() } : {}),
        },
      });
      this.events.emitToUser(userId, ChatSocketEvent.CHANNEL_HIDDEN, { channelId });
    } catch (error) {
      throw handleServiceError(error, this.logger, 'ChannelService.hideChannel', {
        channelId,
        userId,
      });
    }
  }

  async unhideChannel(channelId: string, userId: string) {
    try {
      await this.prisma.chatChannelMember.update({
        where: { channelId_userId: { channelId, userId } },
        data: { isHidden: false, hidePrevMessages: false },
      });
    } catch (error) {
      throw handleServiceError(error, this.logger, 'ChannelService.unhideChannel', {
        channelId,
        userId,
      });
    }
  }

  async resetHistory(channelId: string, userId: string) {
    try {
      await this.prisma.chatChannelMember.update({
        where: { channelId_userId: { channelId, userId } },
        data: { historyResetAt: new Date() },
      });
    } catch (error) {
      throw handleServiceError(error, this.logger, 'ChannelService.resetHistory', {
        channelId,
        userId,
      });
    }
  }

  // ─── Metadata ────────────────────────────────────────────────────────

  async getMetadata(channelId: string): Promise<Record<string, string>> {
    try {
      const channel = await this.prisma.chatChannel.findUnique({
        where: { id: channelId },
        select: { metadata: true },
      });
      return (channel?.metadata as Record<string, string>) ?? {};
    } catch (error) {
      throw handleServiceError(error, this.logger, 'ChannelService.getMetadata', { channelId });
    }
  }

  async setMetadata(channelId: string, metadata: Record<string, string>) {
    try {
      const existing = await this.getMetadata(channelId);
      const merged = { ...existing, ...metadata };
      await this.prisma.chatChannel.update({
        where: { id: channelId },
        data: { metadata: merged },
      });
      this.events.emitToChannel(channelId, ChatSocketEvent.METADATA_CHANGED, {
        channelId,
        metadata: merged,
      });
      return merged;
    } catch (error) {
      throw handleServiceError(error, this.logger, 'ChannelService.setMetadata', { channelId });
    }
  }

  async deleteMetadataKey(channelId: string, key: string) {
    try {
      const existing = await this.getMetadata(channelId);
      delete existing[key];
      await this.prisma.chatChannel.update({
        where: { id: channelId },
        data: { metadata: existing },
      });
      this.events.emitToChannel(channelId, ChatSocketEvent.METADATA_CHANGED, {
        channelId,
        metadata: existing,
      });
    } catch (error) {
      throw handleServiceError(error, this.logger, 'ChannelService.deleteMetadataKey', {
        channelId,
        key,
      });
    }
  }

  // ─── Pinning ─────────────────────────────────────────────────────────

  async pinMessage(channelId: string, messageId: string, userId: string) {
    try {
      const count = await this.prisma.chatPinnedMessage.count({ where: { channelId } });
      if (count >= CHAT_DEFAULTS.MAX_PINNED_MESSAGES) {
        throw ChatException.pinLimit(CHAT_DEFAULTS.MAX_PINNED_MESSAGES);
      }

      await this.prisma.chatPinnedMessage.create({
        data: { channelId, messageId, pinnedById: userId },
      });

      const pinnedIds = await this.getPinnedMessageIds(channelId);
      this.events.emitToChannel(channelId, ChatSocketEvent.PINNED_MESSAGE_UPDATED, {
        channelId,
        pinnedMessageIds: pinnedIds,
      });
    } catch (error) {
      throw handleServiceError(error, this.logger, 'ChannelService.pinMessage', {
        channelId,
        messageId,
        userId,
      });
    }
  }

  async unpinMessage(channelId: string, messageId: string) {
    try {
      await this.prisma.chatPinnedMessage.delete({
        where: { channelId_messageId: { channelId, messageId } },
      });

      const pinnedIds = await this.getPinnedMessageIds(channelId);
      this.events.emitToChannel(channelId, ChatSocketEvent.PINNED_MESSAGE_UPDATED, {
        channelId,
        pinnedMessageIds: pinnedIds,
      });
    } catch (error) {
      throw handleServiceError(error, this.logger, 'ChannelService.unpinMessage', {
        channelId,
        messageId,
      });
    }
  }

  async getPinnedMessageIds(channelId: string): Promise<string[]> {
    try {
      const pinned = await this.prisma.chatPinnedMessage.findMany({
        where: { channelId },
        select: { messageId: true },
        orderBy: { createdAt: 'desc' },
      });
      return pinned.map((p) => p.messageId);
    } catch (error) {
      throw handleServiceError(error, this.logger, 'ChannelService.getPinnedMessageIds', {
        channelId,
      });
    }
  }

  // ─── Shared Files ────────────────────────────────────────────────────

  async getSharedFiles(channelId: string, limit = 20) {
    try {
      return this.prisma.chatMessage.findMany({
        where: {
          channelId,
          deletedAt: null,
          type: { in: ['IMAGE', 'VIDEO', 'AUDIO', 'FILE'] },
        },
        select: {
          id: true,
          fileUrl: true,
          fileName: true,
          mimeType: true,
          fileSize: true,
          createdAt: true,
        },
        orderBy: { createdAt: 'desc' },
        take: limit,
      });
    } catch (error) {
      throw handleServiceError(error, this.logger, 'ChannelService.getSharedFiles', {
        channelId,
        limit,
      });
    }
  }

  // ─── Reporting ───────────────────────────────────────────────────────

  async reportChannel(channelId: string, reporterId: string, tenantId: string, dto: ReportDto) {
    try {
      return this.prisma.chatReport.create({
        data: {
          tenantId,
          reporterId,
          category: dto.category as ChatReportCategory,
          description: dto.description,
          targetType: 'channel',
          targetId: channelId,
          channelId,
        },
      });
    } catch (error) {
      throw handleServiceError(error, this.logger, 'ChannelService.reportChannel', {
        channelId,
        reporterId,
        tenantId,
      });
    }
  }

  async reportUser(targetUserId: string, reporterId: string, tenantId: string, dto: ReportDto) {
    try {
      return this.prisma.chatReport.create({
        data: {
          tenantId,
          reporterId,
          category: dto.category as ChatReportCategory,
          description: dto.description,
          targetType: 'user',
          targetId: targetUserId,
        },
      });
    } catch (error) {
      throw handleServiceError(error, this.logger, 'ChannelService.reportUser', {
        targetUserId,
        reporterId,
        tenantId,
      });
    }
  }

  // ─── Helpers ─────────────────────────────────────────────────────────

  private async ensureChannel(channelId: string) {
    const channel = await this.prisma.chatChannel.findUnique({
      where: { id: channelId, deletedAt: null },
    });
    if (!channel) throw ChatException.channelNotFound(channelId);
    return channel;
  }

  private async ensureTargetMember(channelId: string, userId: string) {
    const member = await this.prisma.chatChannelMember.findUnique({
      where: { channelId_userId: { channelId, userId } },
    });
    if (!member || member.leftAt) throw ChatException.userNotFound(userId);
    return member;
  }

  private async enrichChannel(
    channel: ChatChannel & { members?: ChatChannelMember[]; pinnedMessages?: ChatPinnedMessage[] },
    currentUserId: string,
  ) {
    const currentMember = channel.members?.find(
      (m: ChatChannelMember) => m.userId === currentUserId,
    );

    const unreadCount = currentMember?.lastReadAt
      ? await this.prisma.chatMessage.count({
          where: {
            channelId: channel.id,
            deletedAt: null,
            senderId: { not: currentUserId },
            createdAt: { gt: currentMember.lastReadAt },
          },
        })
      : await this.prisma.chatMessage.count({
          where: { channelId: channel.id, deletedAt: null, senderId: { not: currentUserId } },
        });

    const lastMessage = await this.prisma.chatMessage.findFirst({
      where: { channelId: channel.id, deletedAt: null },
      orderBy: { createdAt: 'desc' },
    });

    return {
      ...channel,
      unreadCount,
      lastMessage,
      myRole: currentMember?.role?.toLowerCase() ?? 'member',
      isMuted: currentMember?.isMuted ?? false,
      isCurrentUserMuted: currentMember?.isMuted ?? false,
    };
  }
}

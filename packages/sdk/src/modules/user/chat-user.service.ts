import { Inject, Injectable } from '@nestjs/common';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';
import { Logger } from 'winston';
import { PrismaService } from '../../common/prisma/prisma.service';
import { CHAT_USER_RESOLVER } from '../../core/tokens/injection-tokens';
import { IChatUserResolver } from '../../core/interfaces/chat-user-resolver.interface';
import { ChatException, handleServiceError } from '../../common/exceptions';
import { BlockUserDto } from './dto';

@Injectable()
export class ChatUserService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(CHAT_USER_RESOLVER) private readonly userResolver: IChatUserResolver,
    @Inject(WINSTON_MODULE_PROVIDER) private readonly logger: Logger,
  ) {}

  async getUser(userId: string, tenantId?: string) {
    try {
      const user = await this.userResolver.getUser(userId, tenantId);
      if (!user) throw ChatException.userNotFound(userId);

      const isOnline = this.userResolver.isOnline
        ? await this.userResolver.isOnline(userId)
        : undefined;

      return { ...user, isOnline };
    } catch (error) {
      throw handleServiceError(error, this.logger, 'ChatUserService.getUser', { userId });
    }
  }

  async searchUsers(keyword: string, tenantId: string, limit?: number) {
    try {
      return this.userResolver.searchUsers(keyword, tenantId, limit);
    } catch (error) {
      throw handleServiceError(error, this.logger, 'ChatUserService.searchUsers', { tenantId });
    }
  }

  async blockUser(blockerId: string, tenantId: string, dto: BlockUserDto) {
    try {
      await this.prisma.chatUserBlock.upsert({
        where: { blockerId_blockedId: { blockerId, blockedId: dto.userId } },
        create: { tenantId, blockerId, blockedId: dto.userId },
        update: {},
      });
      this.logger.info('User blocked', { blockerId, blockedId: dto.userId, tenantId });
    } catch (error) {
      throw handleServiceError(error, this.logger, 'ChatUserService.blockUser', {
        blockerId,
        blockedId: dto.userId,
        tenantId,
      });
    }
  }

  async unblockUser(blockerId: string, dto: BlockUserDto) {
    try {
      await this.prisma.chatUserBlock.deleteMany({
        where: { blockerId, blockedId: dto.userId },
      });
      this.logger.info('User unblocked', { blockerId, blockedId: dto.userId });
    } catch (error) {
      throw handleServiceError(error, this.logger, 'ChatUserService.unblockUser', {
        blockerId,
        blockedId: dto.userId,
      });
    }
  }

  async getBlockedUsers(blockerId: string, tenantId: string) {
    try {
      const blocks = await this.prisma.chatUserBlock.findMany({
        where: { blockerId, tenantId },
        select: { blockedId: true },
      });

      const userIds = blocks.map((b) => b.blockedId);
      if (!userIds.length) return [];

      return this.userResolver.getUsers(userIds);
    } catch (error) {
      throw handleServiceError(error, this.logger, 'ChatUserService.getBlockedUsers', {
        blockerId,
        tenantId,
      });
    }
  }

  async isUserBlocked(blockerId: string, targetUserId: string): Promise<boolean> {
    try {
      const block = await this.prisma.chatUserBlock.findUnique({
        where: { blockerId_blockedId: { blockerId, blockedId: targetUserId } },
      });
      return !!block;
    } catch (error) {
      throw handleServiceError(error, this.logger, 'ChatUserService.isUserBlocked', {
        blockerId,
        targetUserId,
      });
    }
  }
}

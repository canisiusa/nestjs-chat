import { Inject, Injectable } from '@nestjs/common';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';
import { Logger } from 'winston';
import { PrismaService } from '../../common/prisma/prisma.service';
import { ChatEventService } from '../gateway/chat-event.service';
import { ChatSocketEvent } from '../../core/types/chat-socket.types';
import { ChatException, handleServiceError } from '../../common/exceptions';
import {
  ChatMessageType,
  ChatPoll,
  ChatPollOption,
  ChatPollStatus,
  ChatPollVote,
} from 'src/generated/prisma/client';
import { CreatePollDto, VotePollDto } from './dto';

@Injectable()
export class PollService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly events: ChatEventService,
    @Inject(WINSTON_MODULE_PROVIDER) private readonly logger: Logger,
  ) {}

  async createPoll(channelId: string, senderId: string, tenantId: string, dto: CreatePollDto) {
    try {
      const poll = await this.prisma.chatPoll.create({
        data: {
          channelId,
          tenantId,
          title: dto.title,
          allowMultipleVotes: dto.allowMultipleVotes ?? false,
          allowUserSuggestion: dto.allowUserSuggestion ?? false,
          closeAt: dto.closeAt ? new Date(dto.closeAt) : undefined,
          createdById: senderId,
          options: {
            create: dto.options.map((text, i) => ({ text, position: i })),
          },
        },
        include: { options: { include: { votes: true }, orderBy: { position: 'asc' } } },
      });

      const message = await this.prisma.chatMessage.create({
        data: {
          channelId,
          tenantId,
          senderId,
          type: ChatMessageType.POLL,
          text: dto.title,
          pollId: poll.id,
        },
      });

      await this.prisma.chatChannel.update({
        where: { id: channelId },
        data: { lastMessageAt: message.createdAt },
      });

      const enrichedPoll = this.enrichPoll(poll, senderId);

      this.logger.info('Poll created', { pollId: poll.id, channelId, senderId });
      this.events.emitToChannel(channelId, ChatSocketEvent.MESSAGE_RECEIVED, {
        channelId,
        message: { ...message, poll: enrichedPoll },
      });

      return { message, poll: enrichedPoll };
    } catch (error) {
      throw handleServiceError(error, this.logger, 'PollService.createPoll', {
        channelId,
        senderId,
        tenantId,
      });
    }
  }

  async votePoll(channelId: string, pollId: string, userId: string, dto: VotePollDto) {
    try {
      const poll = await this.prisma.chatPoll.findUnique({
        where: { id: pollId },
        include: { options: true },
      });

      if (!poll) throw ChatException.pollNotFound(pollId);
      if (poll.status === ChatPollStatus.CLOSED) throw ChatException.pollClosed();

      if (!poll.allowMultipleVotes && dto.optionIds.length > 1) {
        throw ChatException.validation('This poll does not allow multiple votes');
      }

      // Remove previous votes if not multi-vote
      if (!poll.allowMultipleVotes) {
        const optionIds = poll.options.map((o) => o.id);
        await this.prisma.chatPollVote.deleteMany({
          where: { userId, optionId: { in: optionIds } },
        });
        // Decrement counts for removed votes
        for (const opt of poll.options) {
          const hadVote = await this.prisma.chatPollVote.findUnique({
            where: { optionId_userId: { optionId: opt.id, userId } },
          });
          if (hadVote) {
            await this.prisma.chatPollOption.update({
              where: { id: opt.id },
              data: { voteCount: { decrement: 1 } },
            });
          }
        }
      }

      // Add new votes
      for (const optionId of dto.optionIds) {
        await this.prisma.chatPollVote.upsert({
          where: { optionId_userId: { optionId, userId } },
          create: { optionId, userId },
          update: {},
        });
        await this.prisma.chatPollOption.update({
          where: { id: optionId },
          data: { voteCount: { increment: 1 } },
        });
      }

      // Update voter count
      const distinctVoters = await this.prisma.chatPollVote.findMany({
        where: { option: { pollId } },
        distinct: ['userId'],
        select: { userId: true },
      });

      await this.prisma.chatPoll.update({
        where: { id: pollId },
        data: { voterCount: distinctVoters.length },
      });

      const updated = await this.prisma.chatPoll.findUnique({
        where: { id: pollId },
        include: { options: { include: { votes: true }, orderBy: { position: 'asc' } } },
      });

      const enriched = this.enrichPoll(updated!, userId);

      this.logger.info('Poll voted', { pollId, channelId, userId, optionIds: dto.optionIds });
      this.events.emitToChannel(channelId, ChatSocketEvent.POLL_VOTED, {
        channelId,
        pollId,
        poll: enriched,
      });

      return enriched;
    } catch (error) {
      throw handleServiceError(error, this.logger, 'PollService.votePoll', {
        channelId,
        pollId,
        userId,
      });
    }
  }

  async getPoll(channelId: string, pollId: string, userId: string) {
    try {
      const poll = await this.prisma.chatPoll.findUnique({
        where: { id: pollId },
        include: { options: { include: { votes: true }, orderBy: { position: 'asc' } } },
      });

      if (!poll) throw ChatException.pollNotFound(pollId);
      return this.enrichPoll(poll, userId);
    } catch (error) {
      throw handleServiceError(error, this.logger, 'PollService.getPoll', {
        channelId,
        pollId,
        userId,
      });
    }
  }

  private enrichPoll(
    poll: ChatPoll & { options: (ChatPollOption & { votes: ChatPollVote[] })[] },
    currentUserId: string,
  ) {
    const votedOptionIds: string[] = [];

    const options = poll.options.map((opt) => {
      const votedUserIds = (opt.votes || []).map((v) => v.userId);
      if (votedUserIds.includes(currentUserId)) {
        votedOptionIds.push(opt.id);
      }
      return {
        id: opt.id,
        text: opt.text,
        voteCount: opt.voteCount,
        votedUserIds,
        position: opt.position,
      };
    });

    return {
      id: poll.id,
      channelId: poll.channelId,
      title: poll.title,
      options,
      allowMultipleVotes: poll.allowMultipleVotes,
      allowUserSuggestion: poll.allowUserSuggestion,
      closeAt: poll.closeAt?.toISOString(),
      status: poll.status,
      voterCount: poll.voterCount,
      createdById: poll.createdById,
      createdAt: poll.createdAt.toISOString(),
      updatedAt: poll.updatedAt.toISOString(),
      votedPollOptionIds: votedOptionIds,
    };
  }
}

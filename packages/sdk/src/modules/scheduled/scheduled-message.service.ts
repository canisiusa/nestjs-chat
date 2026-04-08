import { Inject, Injectable } from '@nestjs/common';
import { Queue } from 'bullmq';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';
import { Logger } from 'winston';
import { PrismaService } from '../../common/prisma/prisma.service';
import { MessageService } from '../message/message.service';
import { ChatException, handleServiceError } from '../../common/exceptions';
import { ChatScheduledStatus, Prisma } from 'src/generated/prisma/client';
import { CreateScheduledMessageDto, UpdateScheduledMessageDto } from './dto';
import { CHAT_QUEUE_TOKEN } from './scheduled-queue.provider';

@Injectable()
export class ScheduledMessageService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly messageService: MessageService,
    @Inject(CHAT_QUEUE_TOKEN) private readonly queue: Queue,
    @Inject(WINSTON_MODULE_PROVIDER) private readonly logger: Logger,
  ) {}

  async getScheduledMessages(channelId: string, senderId: string) {
    try {
      return this.prisma.chatScheduledMessage.findMany({
        where: { channelId, senderId, status: ChatScheduledStatus.PENDING },
        orderBy: { scheduledAt: 'asc' },
      });
    } catch (error) {
      throw handleServiceError(error, this.logger, 'ScheduledMessageService.getScheduledMessages', {
        channelId,
        senderId,
      });
    }
  }

  async createScheduledMessage(
    channelId: string,
    senderId: string,
    tenantId: string,
    dto: CreateScheduledMessageDto,
  ) {
    try {
      const scheduledAt = new Date(dto.scheduledAt);
      if (scheduledAt <= new Date()) {
        throw ChatException.scheduledInvalidTime();
      }

      const scheduled = await this.prisma.chatScheduledMessage.create({
        data: {
          channelId,
          tenantId,
          senderId,
          text: dto.text,
          mentionedUserIds: dto.mentionedUserIds ?? [],
          metadata: dto.metadata,
          scheduledAt,
        },
      });

      const delay = scheduledAt.getTime() - Date.now();
      await this.queue.add(
        'send-scheduled-message',
        { scheduledMessageId: scheduled.id },
        {
          delay,
          jobId: `scheduled-${scheduled.id}`,
          removeOnComplete: true,
          removeOnFail: { count: 3 },
          attempts: 3,
          backoff: { type: 'exponential', delay: 5000 },
        },
      );

      this.logger.info('Scheduled message created', {
        id: scheduled.id,
        channelId,
        senderId,
        scheduledAt: dto.scheduledAt,
      });
      return scheduled;
    } catch (error) {
      throw handleServiceError(
        error,
        this.logger,
        'ScheduledMessageService.createScheduledMessage',
        { channelId, senderId, tenantId },
      );
    }
  }

  async updateScheduledMessage(
    channelId: string,
    scheduledId: string,
    senderId: string,
    dto: UpdateScheduledMessageDto,
  ) {
    try {
      const existing = await this.prisma.chatScheduledMessage.findUnique({
        where: { id: scheduledId },
      });

      if (!existing) throw ChatException.scheduledNotFound();
      if (existing.senderId !== senderId) throw ChatException.messageNotOwner();
      if (existing.status !== ChatScheduledStatus.PENDING)
        throw ChatException.scheduledAlreadySent();

      const data: Prisma.ChatScheduledMessageUpdateInput = {};
      if (dto.text) data.text = dto.text;
      if (dto.scheduledAt) {
        const scheduledAt = new Date(dto.scheduledAt);
        if (scheduledAt <= new Date()) {
          throw ChatException.scheduledInvalidTime();
        }
        data.scheduledAt = scheduledAt;
      }

      const updated = await this.prisma.chatScheduledMessage.update({
        where: { id: scheduledId },
        data,
      });

      // Reschedule BullMQ job
      await this.queue.remove(`scheduled-${scheduledId}`);
      const delay = updated.scheduledAt.getTime() - Date.now();
      await this.queue.add(
        'send-scheduled-message',
        { scheduledMessageId: scheduledId },
        {
          delay,
          jobId: `scheduled-${scheduledId}`,
          removeOnComplete: true,
          removeOnFail: { count: 3 },
          attempts: 3,
          backoff: { type: 'exponential', delay: 5000 },
        },
      );

      this.logger.info('Scheduled message updated', { id: scheduledId, channelId });
      return updated;
    } catch (error) {
      throw handleServiceError(
        error,
        this.logger,
        'ScheduledMessageService.updateScheduledMessage',
        { channelId, scheduledId, senderId },
      );
    }
  }

  async cancelScheduledMessage(channelId: string, scheduledId: string, senderId: string) {
    try {
      const existing = await this.prisma.chatScheduledMessage.findUnique({
        where: { id: scheduledId },
      });

      if (!existing) throw ChatException.scheduledNotFound();
      if (existing.senderId !== senderId) throw ChatException.messageNotOwner();
      if (existing.status !== ChatScheduledStatus.PENDING)
        throw ChatException.scheduledAlreadySent();

      await this.prisma.chatScheduledMessage.update({
        where: { id: scheduledId },
        data: { status: ChatScheduledStatus.CANCELED },
      });

      await this.queue.remove(`scheduled-${scheduledId}`);
      this.logger.info('Scheduled message canceled', { id: scheduledId, channelId });
    } catch (error) {
      throw handleServiceError(
        error,
        this.logger,
        'ScheduledMessageService.cancelScheduledMessage',
        { channelId, scheduledId, senderId },
      );
    }
  }

  async sendScheduledMessageNow(channelId: string, scheduledId: string, senderId: string) {
    try {
      const existing = await this.prisma.chatScheduledMessage.findUnique({
        where: { id: scheduledId },
      });

      if (!existing) throw ChatException.scheduledNotFound();
      if (existing.senderId !== senderId) throw ChatException.messageNotOwner();
      if (existing.status !== ChatScheduledStatus.PENDING)
        throw ChatException.scheduledAlreadySent();

      await this.queue.remove(`scheduled-${scheduledId}`);
      return this.processScheduledMessage(scheduledId);
    } catch (error) {
      throw handleServiceError(
        error,
        this.logger,
        'ScheduledMessageService.sendScheduledMessageNow',
        { channelId, scheduledId, senderId },
      );
    }
  }

  async processScheduledMessage(scheduledMessageId: string) {
    try {
      const scheduled = await this.prisma.chatScheduledMessage.findUnique({
        where: { id: scheduledMessageId },
      });

      if (!scheduled || scheduled.status !== ChatScheduledStatus.PENDING) return;

      try {
        const message = await this.messageService.sendTextMessage(
          scheduled.channelId,
          scheduled.senderId,
          scheduled.tenantId,
          {
            text: scheduled.text ?? '',
            mentionedUserIds: scheduled.mentionedUserIds,
            metadata: (scheduled.metadata as Record<string, any>) ?? undefined,
          },
        );

        await this.prisma.chatScheduledMessage.update({
          where: { id: scheduledMessageId },
          data: { status: ChatScheduledStatus.SENT, sentMessageId: message.id },
        });

        this.logger.info('Scheduled message sent', {
          id: scheduledMessageId,
          messageId: message.id,
        });
        return message;
      } catch (error) {
        await this.prisma.chatScheduledMessage.update({
          where: { id: scheduledMessageId },
          data: { status: ChatScheduledStatus.FAILED, errorMessage: (error as Error).message },
        });

        this.logger.error('Scheduled message failed', {
          id: scheduledMessageId,
          error: (error as Error).message,
        });
      }
    } catch (error) {
      throw handleServiceError(
        error,
        this.logger,
        'ScheduledMessageService.processScheduledMessage',
        { scheduledMessageId },
      );
    }
  }
}

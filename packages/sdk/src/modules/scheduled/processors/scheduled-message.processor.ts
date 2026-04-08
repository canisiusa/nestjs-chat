import { Injectable, Inject, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { Worker, Job } from 'bullmq';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';
import { Logger } from 'winston';
import { CHAT_QUEUE_NAME } from '../../../core/constants';
import { CHAT_MODULE_OPTIONS } from '../../../core/tokens/injection-tokens';
import { ChatModuleOptions } from '../../../chat-module-options';
import { ScheduledMessageService } from '../scheduled-message.service';

/**
 * BullMQ Worker for scheduled messages.
 *
 * Uses bullmq directly (not @nestjs/bullmq) to avoid conflicts
 * with the host application's BullModule.forRoot(). Since this SDK
 * is imported as a library, two BullModule.forRoot() calls in the
 * same NestJS app cause a BullExplorer dependency resolution error.
 */
@Injectable()
export class ScheduledMessageProcessor implements OnModuleInit, OnModuleDestroy {
  private worker: Worker | null = null;

  constructor(
    private readonly scheduledService: ScheduledMessageService,
    @Inject(CHAT_MODULE_OPTIONS) private readonly options: ChatModuleOptions,
    @Inject(WINSTON_MODULE_PROVIDER) private readonly logger: Logger,
  ) {}

  onModuleInit() {
    this.worker = new Worker(
      CHAT_QUEUE_NAME,
      async (job: Job<{ scheduledMessageId: string }>) => {
        this.logger.info('Processing scheduled message', {
          jobId: job.id,
          scheduledMessageId: job.data.scheduledMessageId,
        });
        await this.scheduledService.processScheduledMessage(job.data.scheduledMessageId);
      },
      {
        connection: { url: this.options.redis.url },
        prefix: 'chat:bull',
      },
    );

    this.worker.on('failed', (job, err) => {
      this.logger.error('Scheduled message job failed', {
        jobId: job?.id,
        error: err.message,
      });
    });

    this.logger.info('Scheduled message worker started');
  }

  async onModuleDestroy() {
    if (this.worker) {
      await this.worker.close();
      this.logger.info('Scheduled message worker stopped');
    }
  }
}

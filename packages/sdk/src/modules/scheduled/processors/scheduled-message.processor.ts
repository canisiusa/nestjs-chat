import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Inject } from '@nestjs/common';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';
import { Logger } from 'winston';
import { Job } from 'bullmq';
import { CHAT_QUEUE_NAME } from '../../../core/constants';
import { ScheduledMessageService } from '../scheduled-message.service';

@Processor(CHAT_QUEUE_NAME)
export class ScheduledMessageProcessor extends WorkerHost {
  constructor(
    private readonly scheduledService: ScheduledMessageService,
    @Inject(WINSTON_MODULE_PROVIDER) private readonly logger: Logger,
  ) {
    super();
  }

  async process(job: Job<{ scheduledMessageId: string }>) {
    this.logger.info('Processing scheduled message', {
      jobId: job.id,
      scheduledMessageId: job.data.scheduledMessageId,
    });
    await this.scheduledService.processScheduledMessage(job.data.scheduledMessageId);
  }
}

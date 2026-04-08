import { Module, forwardRef } from '@nestjs/common';
import { ScheduledMessageService } from './scheduled-message.service';
import { ScheduledMessageController } from './scheduled-message.controller';
import { ScheduledMessageProcessor } from './processors/scheduled-message.processor';
import { MessageModule } from '../message';
import { CHAT_SCHEDULED_QUEUE } from './scheduled-queue.provider';

@Module({
  imports: [forwardRef(() => MessageModule)],
  controllers: [ScheduledMessageController],
  providers: [CHAT_SCHEDULED_QUEUE, ScheduledMessageService, ScheduledMessageProcessor],
  exports: [ScheduledMessageService],
})
export class ScheduledMessageModule {}

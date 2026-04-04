import { Module, forwardRef } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { CHAT_QUEUE_NAME } from '../../core/constants';
import { ScheduledMessageService } from './scheduled-message.service';
import { ScheduledMessageController } from './scheduled-message.controller';
import { ScheduledMessageProcessor } from './processors/scheduled-message.processor';
import { MessageModule } from '../message';

@Module({
  imports: [BullModule.registerQueue({ name: CHAT_QUEUE_NAME }), forwardRef(() => MessageModule)],
  controllers: [ScheduledMessageController],
  providers: [ScheduledMessageService, ScheduledMessageProcessor],
  exports: [ScheduledMessageService],
})
export class ScheduledMessageModule {}

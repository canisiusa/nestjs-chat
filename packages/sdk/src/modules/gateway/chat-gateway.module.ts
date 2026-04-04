import { Module } from '@nestjs/common';
import { ChatGateway } from './chat.gateway';
import { ChatEventService } from './chat-event.service';

@Module({
  providers: [ChatGateway, ChatEventService],
  exports: [ChatGateway, ChatEventService],
})
export class ChatGatewayModule {}

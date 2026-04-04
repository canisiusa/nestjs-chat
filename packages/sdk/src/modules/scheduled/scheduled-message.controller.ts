import { Controller, UseGuards, Get, Post, Patch, Delete, Param, Body } from '@nestjs/common';
import { ChatAuthGuard } from '../../common/guards';
import { CurrentChatUser } from '../../common/decorators';
import { ChatAuthUser } from '../../core/interfaces/chat-auth.interface';
import { ChannelMemberGuard } from '../channel/guards/channel-member.guard';
import { ScheduledMessageService } from './scheduled-message.service';
import { CreateScheduledMessageDto, UpdateScheduledMessageDto } from './dto';

@Controller('channels/:channelId/scheduled-messages')
@UseGuards(ChatAuthGuard, ChannelMemberGuard)
export class ScheduledMessageController {
  constructor(private readonly scheduledService: ScheduledMessageService) {}

  @Get()
  list(@Param('channelId') channelId: string, @CurrentChatUser() user: ChatAuthUser) {
    return this.scheduledService.getScheduledMessages(channelId, user.id);
  }

  @Post()
  create(
    @Param('channelId') channelId: string,
    @CurrentChatUser() user: ChatAuthUser,
    @Body() dto: CreateScheduledMessageDto,
  ) {
    return this.scheduledService.createScheduledMessage(channelId, user.id, user.tenantId, dto);
  }

  @Patch(':scheduledId')
  update(
    @Param('channelId') channelId: string,
    @Param('scheduledId') scheduledId: string,
    @CurrentChatUser() user: ChatAuthUser,
    @Body() dto: UpdateScheduledMessageDto,
  ) {
    return this.scheduledService.updateScheduledMessage(channelId, scheduledId, user.id, dto);
  }

  @Delete(':scheduledId')
  cancel(
    @Param('channelId') channelId: string,
    @Param('scheduledId') scheduledId: string,
    @CurrentChatUser() user: ChatAuthUser,
  ) {
    return this.scheduledService.cancelScheduledMessage(channelId, scheduledId, user.id);
  }

  @Post(':scheduledId/send-now')
  sendNow(
    @Param('channelId') channelId: string,
    @Param('scheduledId') scheduledId: string,
    @CurrentChatUser() user: ChatAuthUser,
  ) {
    return this.scheduledService.sendScheduledMessageNow(channelId, scheduledId, user.id);
  }
}

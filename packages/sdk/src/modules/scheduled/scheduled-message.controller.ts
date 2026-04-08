import { Controller, UseGuards, Get, Post, Patch, Delete, Param, Body } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiParam } from '@nestjs/swagger';
import { ChatAuthGuard } from '../../common/guards';
import { CurrentChatUser } from '../../common/decorators';
import { ChatAuthUser } from '../../core/interfaces/chat-auth.interface';
import { ChannelMemberGuard } from '../channel/guards/channel-member.guard';
import { ScheduledMessageService } from './scheduled-message.service';
import { CreateScheduledMessageDto, UpdateScheduledMessageDto } from './dto';

@ApiTags('Scheduled Messages')
@ApiBearerAuth()
@Controller('channels/:channelId/scheduled-messages')
@UseGuards(ChatAuthGuard, ChannelMemberGuard)
export class ScheduledMessageController {
  constructor(private readonly scheduledService: ScheduledMessageService) {}

  @Get()
  @ApiOperation({ summary: 'List all scheduled messages in a channel' })
  @ApiParam({ name: 'channelId', description: 'Channel ID' })
  @ApiResponse({ status: 200, description: 'Scheduled messages retrieved successfully' })
  list(@Param('channelId') channelId: string, @CurrentChatUser() user: ChatAuthUser) {
    return this.scheduledService.getScheduledMessages(channelId, user.id);
  }

  @Post()
  @ApiOperation({ summary: 'Create a scheduled message' })
  @ApiParam({ name: 'channelId', description: 'Channel ID' })
  @ApiResponse({ status: 201, description: 'Scheduled message created successfully' })
  @ApiResponse({ status: 400, description: 'Invalid scheduled message data' })
  create(
    @Param('channelId') channelId: string,
    @CurrentChatUser() user: ChatAuthUser,
    @Body() dto: CreateScheduledMessageDto,
  ) {
    return this.scheduledService.createScheduledMessage(channelId, user.id, user.tenantId, dto);
  }

  @Patch(':scheduledId')
  @ApiOperation({ summary: 'Update a scheduled message' })
  @ApiParam({ name: 'channelId', description: 'Channel ID' })
  @ApiParam({ name: 'scheduledId', description: 'Scheduled message ID' })
  @ApiResponse({ status: 200, description: 'Scheduled message updated successfully' })
  @ApiResponse({ status: 404, description: 'Scheduled message not found' })
  update(
    @Param('channelId') channelId: string,
    @Param('scheduledId') scheduledId: string,
    @CurrentChatUser() user: ChatAuthUser,
    @Body() dto: UpdateScheduledMessageDto,
  ) {
    return this.scheduledService.updateScheduledMessage(channelId, scheduledId, user.id, dto);
  }

  @Delete(':scheduledId')
  @ApiOperation({ summary: 'Cancel a scheduled message' })
  @ApiParam({ name: 'channelId', description: 'Channel ID' })
  @ApiParam({ name: 'scheduledId', description: 'Scheduled message ID' })
  @ApiResponse({ status: 200, description: 'Scheduled message cancelled successfully' })
  @ApiResponse({ status: 404, description: 'Scheduled message not found' })
  cancel(
    @Param('channelId') channelId: string,
    @Param('scheduledId') scheduledId: string,
    @CurrentChatUser() user: ChatAuthUser,
  ) {
    return this.scheduledService.cancelScheduledMessage(channelId, scheduledId, user.id);
  }

  @Post(':scheduledId/send-now')
  @ApiOperation({ summary: 'Send a scheduled message immediately' })
  @ApiParam({ name: 'channelId', description: 'Channel ID' })
  @ApiParam({ name: 'scheduledId', description: 'Scheduled message ID' })
  @ApiResponse({ status: 201, description: 'Scheduled message sent immediately' })
  @ApiResponse({ status: 404, description: 'Scheduled message not found' })
  sendNow(
    @Param('channelId') channelId: string,
    @Param('scheduledId') scheduledId: string,
    @CurrentChatUser() user: ChatAuthUser,
  ) {
    return this.scheduledService.sendScheduledMessageNow(channelId, scheduledId, user.id);
  }
}

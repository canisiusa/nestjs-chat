import {
  Controller,
  UseGuards,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Query,
  Body,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiParam } from '@nestjs/swagger';
import { ChatAuthGuard } from '../../common/guards';
import { CurrentChatUser } from '../../common/decorators';
import { ChatAuthUser } from '../../core/interfaces/chat-auth.interface';
import { ChannelMemberGuard } from '../channel/guards/channel-member.guard';
import { ChannelNotFrozenGuard } from '../channel/guards/channel-not-frozen.guard';
import { UserNotMutedGuard } from './guards/user-not-muted.guard';
import { UserNotBannedGuard } from './guards/user-not-banned.guard';
import { MessageService } from './message.service';
import {
  SendTextMessageDto,
  UpdateMessageDto,
  MessageListQueryDto,
  MessageSearchDto,
  ForwardMessageDto,
  AddReactionDto,
} from './dto';

@ApiTags('Messages')
@ApiBearerAuth()
@Controller()
@UseGuards(ChatAuthGuard)
export class MessageController {
  constructor(private readonly messageService: MessageService) {}

  // ─── Message CRUD ────────────────────────────────────────────────────

  @ApiOperation({ summary: 'List messages in a channel' })
  @ApiParam({ name: 'id', description: 'Channel ID' })
  @ApiResponse({ status: 200, description: 'Messages returned successfully' })
  @ApiResponse({ status: 403, description: 'Not a member of this channel' })
  @Get('channels/:id/messages')
  @UseGuards(ChannelMemberGuard)
  getMessages(
    @Param('id') channelId: string,
    @CurrentChatUser() user: ChatAuthUser,
    @Query() query: MessageListQueryDto,
  ) {
    return this.messageService.getMessages(channelId, user.id, query);
  }

  @ApiOperation({ summary: 'Get a single message by ID' })
  @ApiParam({ name: 'id', description: 'Channel ID' })
  @ApiParam({ name: 'messageId', description: 'Message ID' })
  @ApiResponse({ status: 200, description: 'Message returned successfully' })
  @ApiResponse({ status: 403, description: 'Not a member of this channel' })
  @Get('channels/:id/messages/:messageId')
  @UseGuards(ChannelMemberGuard)
  getMessage(
    @Param('id') channelId: string,
    @Param('messageId') messageId: string,
    @CurrentChatUser() user: ChatAuthUser,
  ) {
    return this.messageService.getMessage(channelId, messageId, user.id);
  }

  @ApiOperation({ summary: 'Send a text message to a channel' })
  @ApiParam({ name: 'id', description: 'Channel ID' })
  @ApiResponse({ status: 201, description: 'Message sent successfully' })
  @ApiResponse({
    status: 403,
    description: 'Not a member, channel frozen, user muted, or user banned',
  })
  @Post('channels/:id/messages')
  @UseGuards(ChannelMemberGuard, ChannelNotFrozenGuard, UserNotMutedGuard, UserNotBannedGuard)
  sendTextMessage(
    @Param('id') channelId: string,
    @CurrentChatUser() user: ChatAuthUser,
    @Body() dto: SendTextMessageDto,
  ) {
    return this.messageService.sendTextMessage(channelId, user.id, user.tenantId, dto);
  }

  @ApiOperation({ summary: 'Update a message' })
  @ApiParam({ name: 'id', description: 'Channel ID' })
  @ApiParam({ name: 'messageId', description: 'Message ID' })
  @ApiResponse({ status: 200, description: 'Message updated successfully' })
  @ApiResponse({ status: 403, description: 'Not a member of this channel' })
  @Patch('channels/:id/messages/:messageId')
  @UseGuards(ChannelMemberGuard)
  updateMessage(
    @Param('id') channelId: string,
    @Param('messageId') messageId: string,
    @CurrentChatUser() user: ChatAuthUser,
    @Body() dto: UpdateMessageDto,
  ) {
    return this.messageService.updateMessage(channelId, messageId, user.id, dto);
  }

  @ApiOperation({ summary: 'Delete a message' })
  @ApiParam({ name: 'id', description: 'Channel ID' })
  @ApiParam({ name: 'messageId', description: 'Message ID' })
  @ApiResponse({ status: 200, description: 'Message deleted successfully' })
  @ApiResponse({ status: 403, description: 'Not a member of this channel' })
  @Delete('channels/:id/messages/:messageId')
  @UseGuards(ChannelMemberGuard)
  deleteMessage(
    @Param('id') channelId: string,
    @Param('messageId') messageId: string,
    @CurrentChatUser() user: ChatAuthUser,
  ) {
    return this.messageService.deleteMessage(channelId, messageId, user.id);
  }

  // ─── Threading ───────────────────────────────────────────────────────

  @ApiOperation({ summary: 'Get threaded replies for a message' })
  @ApiParam({ name: 'id', description: 'Channel ID' })
  @ApiParam({ name: 'messageId', description: 'Parent message ID' })
  @ApiResponse({ status: 200, description: 'Thread messages returned successfully' })
  @ApiResponse({ status: 403, description: 'Not a member of this channel' })
  @Get('channels/:id/messages/:messageId/thread')
  @UseGuards(ChannelMemberGuard)
  getThread(
    @Param('id') channelId: string,
    @Param('messageId') messageId: string,
    @CurrentChatUser() user: ChatAuthUser,
  ) {
    return this.messageService.getThreadedMessages(channelId, messageId, user.id);
  }

  // ─── Forwarding ──────────────────────────────────────────────────────

  @ApiOperation({ summary: 'Forward a message to another channel' })
  @ApiParam({ name: 'id', description: 'Source channel ID' })
  @ApiParam({ name: 'messageId', description: 'Message ID to forward' })
  @ApiResponse({ status: 201, description: 'Message forwarded successfully' })
  @ApiResponse({ status: 403, description: 'Not a member of this channel' })
  @Post('channels/:id/messages/:messageId/forward')
  @UseGuards(ChannelMemberGuard)
  forwardMessage(
    @Param('id') channelId: string,
    @Param('messageId') messageId: string,
    @CurrentChatUser() user: ChatAuthUser,
    @Body() dto: ForwardMessageDto,
  ) {
    return this.messageService.forwardMessage(channelId, messageId, user.id, user.tenantId, dto);
  }

  // ─── Search ──────────────────────────────────────────────────────────

  @ApiOperation({ summary: 'Search messages across channels' })
  @ApiResponse({ status: 200, description: 'Search results returned successfully' })
  @Post('messages/search')
  searchMessages(@CurrentChatUser() user: ChatAuthUser, @Body() dto: MessageSearchDto) {
    return this.messageService.searchMessages(user.tenantId, user.id, dto);
  }

  // ─── Reactions ───────────────────────────────────────────────────────

  @ApiOperation({ summary: 'Add a reaction to a message' })
  @ApiParam({ name: 'id', description: 'Channel ID' })
  @ApiParam({ name: 'messageId', description: 'Message ID' })
  @ApiResponse({ status: 201, description: 'Reaction added successfully' })
  @ApiResponse({ status: 403, description: 'Not a member of this channel' })
  @Post('channels/:id/messages/:messageId/reactions')
  @UseGuards(ChannelMemberGuard)
  addReaction(
    @Param('id') channelId: string,
    @Param('messageId') messageId: string,
    @CurrentChatUser() user: ChatAuthUser,
    @Body() dto: AddReactionDto,
  ) {
    return this.messageService.addReaction(channelId, messageId, user.id, dto);
  }

  @ApiOperation({ summary: 'Remove a reaction from a message' })
  @ApiParam({ name: 'id', description: 'Channel ID' })
  @ApiParam({ name: 'messageId', description: 'Message ID' })
  @ApiParam({ name: 'key', description: 'Reaction key to remove' })
  @ApiResponse({ status: 200, description: 'Reaction removed successfully' })
  @ApiResponse({ status: 403, description: 'Not a member of this channel' })
  @Delete('channels/:id/messages/:messageId/reactions/:key')
  @UseGuards(ChannelMemberGuard)
  removeReaction(
    @Param('id') channelId: string,
    @Param('messageId') messageId: string,
    @Param('key') key: string,
    @CurrentChatUser() user: ChatAuthUser,
  ) {
    return this.messageService.removeReaction(channelId, messageId, user.id, key);
  }
}

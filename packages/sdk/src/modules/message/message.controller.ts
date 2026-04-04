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

@Controller()
@UseGuards(ChatAuthGuard)
export class MessageController {
  constructor(private readonly messageService: MessageService) {}

  // ─── Message CRUD ────────────────────────────────────────────────────

  @Get('channels/:id/messages')
  @UseGuards(ChannelMemberGuard)
  getMessages(
    @Param('id') channelId: string,
    @CurrentChatUser() user: ChatAuthUser,
    @Query() query: MessageListQueryDto,
  ) {
    return this.messageService.getMessages(channelId, user.id, query);
  }

  @Get('channels/:id/messages/:messageId')
  @UseGuards(ChannelMemberGuard)
  getMessage(
    @Param('id') channelId: string,
    @Param('messageId') messageId: string,
    @CurrentChatUser() user: ChatAuthUser,
  ) {
    return this.messageService.getMessage(channelId, messageId, user.id);
  }

  @Post('channels/:id/messages')
  @UseGuards(ChannelMemberGuard, ChannelNotFrozenGuard, UserNotMutedGuard, UserNotBannedGuard)
  sendTextMessage(
    @Param('id') channelId: string,
    @CurrentChatUser() user: ChatAuthUser,
    @Body() dto: SendTextMessageDto,
  ) {
    return this.messageService.sendTextMessage(channelId, user.id, user.tenantId, dto);
  }

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

  @Post('messages/search')
  searchMessages(@CurrentChatUser() user: ChatAuthUser, @Body() dto: MessageSearchDto) {
    return this.messageService.searchMessages(user.tenantId, user.id, dto);
  }

  // ─── Reactions ───────────────────────────────────────────────────────

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

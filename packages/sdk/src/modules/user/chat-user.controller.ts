import { Controller, UseGuards, Get, Post, Param, Query, Body } from '@nestjs/common';
import { ChatAuthGuard } from '../../common/guards';
import { CurrentChatUser } from '../../common/decorators';
import { ChatAuthUser } from '../../core/interfaces/chat-auth.interface';
import { ChatUserService } from './chat-user.service';
import { SearchUsersDto, BlockUserDto } from './dto';

@Controller('users')
@UseGuards(ChatAuthGuard)
export class ChatUserController {
  constructor(private readonly chatUserService: ChatUserService) {}

  @Get('search')
  search(@CurrentChatUser() user: ChatAuthUser, @Query() dto: SearchUsersDto) {
    return this.chatUserService.searchUsers(dto.keyword, user.tenantId, dto.limit);
  }

  @Get('blocked')
  getBlocked(@CurrentChatUser() user: ChatAuthUser) {
    return this.chatUserService.getBlockedUsers(user.id, user.tenantId);
  }

  @Get(':userId')
  getUser(@Param('userId') userId: string) {
    return this.chatUserService.getUser(userId);
  }

  @Post('block')
  block(@CurrentChatUser() user: ChatAuthUser, @Body() dto: BlockUserDto) {
    return this.chatUserService.blockUser(user.id, user.tenantId, dto);
  }

  @Post('unblock')
  unblock(@CurrentChatUser() user: ChatAuthUser, @Body() dto: BlockUserDto) {
    return this.chatUserService.unblockUser(user.id, dto);
  }
}

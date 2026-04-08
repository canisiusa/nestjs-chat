import { Controller, UseGuards, Get, Post, Param, Query, Body } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiParam } from '@nestjs/swagger';
import { ChatAuthGuard } from '../../common/guards';
import { CurrentChatUser } from '../../common/decorators';
import { ChatAuthUser } from '../../core/interfaces/chat-auth.interface';
import { ChatUserService } from './chat-user.service';
import { SearchUsersDto, BlockUserDto } from './dto';

@ApiTags('Users')
@ApiBearerAuth()
@Controller('users')
@UseGuards(ChatAuthGuard)
export class ChatUserController {
  constructor(private readonly chatUserService: ChatUserService) {}

  @Get('search')
  @ApiOperation({ summary: 'Search users by keyword' })
  @ApiResponse({ status: 200, description: 'Users matching the keyword' })
  search(@CurrentChatUser() user: ChatAuthUser, @Query() dto: SearchUsersDto) {
    return this.chatUserService.searchUsers(dto.keyword, user.tenantId, dto.limit);
  }

  @Get('blocked')
  @ApiOperation({ summary: 'Get list of blocked users' })
  @ApiResponse({ status: 200, description: 'Blocked users retrieved successfully' })
  getBlocked(@CurrentChatUser() user: ChatAuthUser) {
    return this.chatUserService.getBlockedUsers(user.id, user.tenantId);
  }

  @Get(':userId')
  @ApiOperation({ summary: 'Get a user by ID' })
  @ApiParam({ name: 'userId', description: 'User ID' })
  @ApiResponse({ status: 200, description: 'User retrieved successfully' })
  @ApiResponse({ status: 404, description: 'User not found' })
  getUser(@Param('userId') userId: string) {
    return this.chatUserService.getUser(userId);
  }

  @Post('block')
  @ApiOperation({ summary: 'Block a user' })
  @ApiResponse({ status: 201, description: 'User blocked successfully' })
  @ApiResponse({ status: 404, description: 'User not found' })
  block(@CurrentChatUser() user: ChatAuthUser, @Body() dto: BlockUserDto) {
    return this.chatUserService.blockUser(user.id, user.tenantId, dto);
  }

  @Post('unblock')
  @ApiOperation({ summary: 'Unblock a user' })
  @ApiResponse({ status: 201, description: 'User unblocked successfully' })
  @ApiResponse({ status: 404, description: 'User not found' })
  unblock(@CurrentChatUser() user: ChatAuthUser, @Body() dto: BlockUserDto) {
    return this.chatUserService.unblockUser(user.id, dto);
  }
}

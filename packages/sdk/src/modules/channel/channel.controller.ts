import {
  Controller,
  UseGuards,
  Get,
  Post,
  Patch,
  Put,
  Delete,
  Param,
  Query,
  Body,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiParam } from '@nestjs/swagger';
import { ChatAuthGuard } from '../../common/guards';
import { CurrentChatUser } from '../../common/decorators';
import { ChatAuthUser } from '../../core/interfaces/chat-auth.interface';
import { ChannelMemberGuard } from './guards/channel-member.guard';
import { ChannelOperatorGuard } from './guards/channel-operator.guard';
import { ChannelService } from './channel.service';
import {
  CreateDirectChannelDto,
  CreateGroupChannelDto,
  UpdateChannelDto,
  ChannelListQueryDto,
  InviteMembersDto,
  BanUserDto,
  MuteUserDto,
  SetPushTriggerDto,
  SetCountPreferenceDto,
  HideChannelDto,
  ChannelMetadataDto,
  ReportDto,
} from './dto';

@ApiTags('Channels')
@ApiBearerAuth()
@Controller('channels')
@UseGuards(ChatAuthGuard)
export class ChannelController {
  constructor(private readonly channelService: ChannelService) {}

  // ─── Channel CRUD ────────────────────────────────────────────────────

  @ApiOperation({ summary: 'List channels for the current user' })
  @ApiResponse({ status: 200, description: 'List of channels returned successfully' })
  @Get()
  getChannels(@CurrentChatUser() user: ChatAuthUser, @Query() query: ChannelListQueryDto) {
    return this.channelService.getChannels(user.id, user.tenantId, query);
  }

  @ApiOperation({ summary: 'Get total unread message count across all channels' })
  @ApiResponse({ status: 200, description: 'Unread count returned successfully' })
  @Get('unread-count')
  getUnreadCount(@CurrentChatUser() user: ChatAuthUser) {
    return this.channelService.getUnreadCount(user.id, user.tenantId);
  }

  @ApiOperation({ summary: 'Get a channel by ID' })
  @ApiParam({ name: 'id', description: 'Channel ID' })
  @ApiResponse({ status: 200, description: 'Channel returned successfully' })
  @ApiResponse({ status: 403, description: 'Not a member of this channel' })
  @Get(':id')
  @UseGuards(ChannelMemberGuard)
  getChannel(@Param('id') id: string, @CurrentChatUser() user: ChatAuthUser) {
    return this.channelService.getChannel(id, user.id);
  }

  @ApiOperation({ summary: 'Create a direct (1-on-1) channel' })
  @ApiResponse({ status: 201, description: 'Direct channel created successfully' })
  @Post('direct')
  createDirect(@CurrentChatUser() user: ChatAuthUser, @Body() dto: CreateDirectChannelDto) {
    return this.channelService.createDirectChannel(user.id, user.tenantId, dto);
  }

  @ApiOperation({ summary: 'Create a group channel' })
  @ApiResponse({ status: 201, description: 'Group channel created successfully' })
  @Post('group')
  createGroup(@CurrentChatUser() user: ChatAuthUser, @Body() dto: CreateGroupChannelDto) {
    return this.channelService.createGroupChannel(user.id, user.tenantId, dto);
  }

  @ApiOperation({ summary: 'Update a channel' })
  @ApiParam({ name: 'id', description: 'Channel ID' })
  @ApiResponse({ status: 200, description: 'Channel updated successfully' })
  @ApiResponse({ status: 403, description: 'Not a member or not an operator' })
  @Patch(':id')
  @UseGuards(ChannelMemberGuard, ChannelOperatorGuard)
  update(@Param('id') id: string, @Body() dto: UpdateChannelDto) {
    return this.channelService.updateChannel(id, dto);
  }

  @ApiOperation({ summary: 'Delete a channel' })
  @ApiParam({ name: 'id', description: 'Channel ID' })
  @ApiResponse({ status: 200, description: 'Channel deleted successfully' })
  @ApiResponse({ status: 403, description: 'Not a member or not an operator' })
  @Delete(':id')
  @UseGuards(ChannelMemberGuard, ChannelOperatorGuard)
  delete(@Param('id') id: string) {
    return this.channelService.deleteChannel(id);
  }

  @ApiOperation({ summary: 'Leave a channel' })
  @ApiParam({ name: 'id', description: 'Channel ID' })
  @ApiResponse({ status: 200, description: 'Left the channel successfully' })
  @ApiResponse({ status: 403, description: 'Not a member of this channel' })
  @Post(':id/leave')
  @UseGuards(ChannelMemberGuard)
  leave(@Param('id') id: string, @CurrentChatUser() user: ChatAuthUser) {
    return this.channelService.leaveChannel(id, user.id);
  }

  // ─── Members ─────────────────────────────────────────────────────────

  @ApiOperation({ summary: 'List members of a channel' })
  @ApiParam({ name: 'id', description: 'Channel ID' })
  @ApiResponse({ status: 200, description: 'Channel members returned successfully' })
  @ApiResponse({ status: 403, description: 'Not a member of this channel' })
  @Get(':id/members')
  @UseGuards(ChannelMemberGuard)
  getMembers(@Param('id') id: string) {
    return this.channelService.getMembers(id);
  }

  @ApiOperation({ summary: 'Invite users to a channel' })
  @ApiParam({ name: 'id', description: 'Channel ID' })
  @ApiResponse({ status: 201, description: 'Users invited successfully' })
  @ApiResponse({ status: 403, description: 'Not a member or not an operator' })
  @Post(':id/members/invite')
  @UseGuards(ChannelMemberGuard, ChannelOperatorGuard)
  invite(
    @Param('id') id: string,
    @CurrentChatUser() user: ChatAuthUser,
    @Body() dto: InviteMembersDto,
  ) {
    return this.channelService.inviteUsers(id, user.tenantId, dto);
  }

  @ApiOperation({ summary: 'Remove a member from a channel' })
  @ApiParam({ name: 'id', description: 'Channel ID' })
  @ApiParam({ name: 'userId', description: 'User ID to remove' })
  @ApiResponse({ status: 200, description: 'Member removed successfully' })
  @ApiResponse({ status: 403, description: 'Not a member or not an operator' })
  @Delete(':id/members/:userId')
  @UseGuards(ChannelMemberGuard, ChannelOperatorGuard)
  removeMember(@Param('id') id: string, @Param('userId') userId: string) {
    return this.channelService.removeUser(id, userId);
  }

  // ─── Operators ───────────────────────────────────────────────────────

  @ApiOperation({ summary: 'List operators of a channel' })
  @ApiParam({ name: 'id', description: 'Channel ID' })
  @ApiResponse({ status: 200, description: 'Channel operators returned successfully' })
  @ApiResponse({ status: 403, description: 'Not a member of this channel' })
  @Get(':id/operators')
  @UseGuards(ChannelMemberGuard)
  getOperators(@Param('id') id: string) {
    return this.channelService.getOperators(id);
  }

  @ApiOperation({ summary: 'Add operators to a channel' })
  @ApiParam({ name: 'id', description: 'Channel ID' })
  @ApiResponse({ status: 201, description: 'Operators added successfully' })
  @ApiResponse({ status: 403, description: 'Not a member or not an operator' })
  @Post(':id/operators')
  @UseGuards(ChannelMemberGuard, ChannelOperatorGuard)
  addOperators(@Param('id') id: string, @Body() dto: InviteMembersDto) {
    return this.channelService.addOperators(id, dto.userIds);
  }

  @ApiOperation({ summary: 'Remove operators from a channel' })
  @ApiParam({ name: 'id', description: 'Channel ID' })
  @ApiResponse({ status: 200, description: 'Operators removed successfully' })
  @ApiResponse({ status: 403, description: 'Not a member or not an operator' })
  @Delete(':id/operators')
  @UseGuards(ChannelMemberGuard, ChannelOperatorGuard)
  removeOperators(@Param('id') id: string, @Body() dto: InviteMembersDto) {
    return this.channelService.removeOperators(id, dto.userIds);
  }

  // ─── Read ────────────────────────────────────────────────────────────

  @ApiOperation({ summary: 'Mark all messages in a channel as read' })
  @ApiParam({ name: 'id', description: 'Channel ID' })
  @ApiResponse({ status: 200, description: 'Channel marked as read' })
  @ApiResponse({ status: 403, description: 'Not a member of this channel' })
  @Post(':id/read')
  @UseGuards(ChannelMemberGuard)
  markAsRead(@Param('id') id: string, @CurrentChatUser() user: ChatAuthUser) {
    return this.channelService.markAsRead(id, user.id);
  }

  // ─── Notification Preferences ────────────────────────────────────────

  @ApiOperation({ summary: 'Set push notification trigger for a channel' })
  @ApiParam({ name: 'id', description: 'Channel ID' })
  @ApiResponse({ status: 200, description: 'Push trigger updated successfully' })
  @ApiResponse({ status: 403, description: 'Not a member of this channel' })
  @Put(':id/push-trigger')
  @UseGuards(ChannelMemberGuard)
  setPushTrigger(
    @Param('id') id: string,
    @CurrentChatUser() user: ChatAuthUser,
    @Body() dto: SetPushTriggerDto,
  ) {
    return this.channelService.setPushTrigger(id, user.id, dto);
  }

  @ApiOperation({ summary: 'Get push notification trigger for a channel' })
  @ApiParam({ name: 'id', description: 'Channel ID' })
  @ApiResponse({ status: 200, description: 'Push trigger returned successfully' })
  @ApiResponse({ status: 403, description: 'Not a member of this channel' })
  @Get(':id/push-trigger')
  @UseGuards(ChannelMemberGuard)
  getPushTrigger(@Param('id') id: string, @CurrentChatUser() user: ChatAuthUser) {
    return this.channelService.getPushTrigger(id, user.id);
  }

  @ApiOperation({ summary: 'Set unread count preference for a channel' })
  @ApiParam({ name: 'id', description: 'Channel ID' })
  @ApiResponse({ status: 200, description: 'Count preference updated successfully' })
  @ApiResponse({ status: 403, description: 'Not a member of this channel' })
  @Put(':id/count-preference')
  @UseGuards(ChannelMemberGuard)
  setCountPreference(
    @Param('id') id: string,
    @CurrentChatUser() user: ChatAuthUser,
    @Body() dto: SetCountPreferenceDto,
  ) {
    return this.channelService.setCountPreference(id, user.id, dto);
  }

  @ApiOperation({ summary: 'Get unread count preference for a channel' })
  @ApiParam({ name: 'id', description: 'Channel ID' })
  @ApiResponse({ status: 200, description: 'Count preference returned successfully' })
  @ApiResponse({ status: 403, description: 'Not a member of this channel' })
  @Get(':id/count-preference')
  @UseGuards(ChannelMemberGuard)
  getCountPreference(@Param('id') id: string, @CurrentChatUser() user: ChatAuthUser) {
    return this.channelService.getCountPreference(id, user.id);
  }

  // ─── Moderation ──────────────────────────────────────────────────────

  @ApiOperation({ summary: 'Freeze a channel (prevent new messages)' })
  @ApiParam({ name: 'id', description: 'Channel ID' })
  @ApiResponse({ status: 200, description: 'Channel frozen successfully' })
  @ApiResponse({ status: 403, description: 'Not a member or not an operator' })
  @Post(':id/freeze')
  @UseGuards(ChannelMemberGuard, ChannelOperatorGuard)
  freeze(@Param('id') id: string) {
    return this.channelService.freezeChannel(id);
  }

  @ApiOperation({ summary: 'Unfreeze a channel' })
  @ApiParam({ name: 'id', description: 'Channel ID' })
  @ApiResponse({ status: 200, description: 'Channel unfrozen successfully' })
  @ApiResponse({ status: 403, description: 'Not a member or not an operator' })
  @Post(':id/unfreeze')
  @UseGuards(ChannelMemberGuard, ChannelOperatorGuard)
  unfreeze(@Param('id') id: string) {
    return this.channelService.unfreezeChannel(id);
  }

  @ApiOperation({ summary: 'Mute a channel for the current user' })
  @ApiParam({ name: 'id', description: 'Channel ID' })
  @ApiResponse({ status: 200, description: 'Channel muted successfully' })
  @ApiResponse({ status: 403, description: 'Not a member of this channel' })
  @Post(':id/mute')
  @UseGuards(ChannelMemberGuard)
  mute(@Param('id') id: string, @CurrentChatUser() user: ChatAuthUser) {
    return this.channelService.muteChannel(id, user.id);
  }

  @ApiOperation({ summary: 'Unmute a channel for the current user' })
  @ApiParam({ name: 'id', description: 'Channel ID' })
  @ApiResponse({ status: 200, description: 'Channel unmuted successfully' })
  @ApiResponse({ status: 403, description: 'Not a member of this channel' })
  @Post(':id/unmute')
  @UseGuards(ChannelMemberGuard)
  unmute(@Param('id') id: string, @CurrentChatUser() user: ChatAuthUser) {
    return this.channelService.unmuteChannel(id, user.id);
  }

  @ApiOperation({ summary: 'Mute a user in a channel' })
  @ApiParam({ name: 'id', description: 'Channel ID' })
  @ApiParam({ name: 'userId', description: 'User ID to mute' })
  @ApiResponse({ status: 200, description: 'User muted successfully' })
  @ApiResponse({ status: 403, description: 'Not a member or not an operator' })
  @Post(':id/members/:userId/mute')
  @UseGuards(ChannelMemberGuard, ChannelOperatorGuard)
  muteUser(@Param('id') id: string, @Param('userId') userId: string, @Body() dto: MuteUserDto) {
    return this.channelService.muteUser(id, userId, dto);
  }

  @ApiOperation({ summary: 'Unmute a user in a channel' })
  @ApiParam({ name: 'id', description: 'Channel ID' })
  @ApiParam({ name: 'userId', description: 'User ID to unmute' })
  @ApiResponse({ status: 200, description: 'User unmuted successfully' })
  @ApiResponse({ status: 403, description: 'Not a member or not an operator' })
  @Post(':id/members/:userId/unmute')
  @UseGuards(ChannelMemberGuard, ChannelOperatorGuard)
  unmuteUser(@Param('id') id: string, @Param('userId') userId: string) {
    return this.channelService.unmuteUser(id, userId);
  }

  @ApiOperation({ summary: 'List muted users in a channel' })
  @ApiParam({ name: 'id', description: 'Channel ID' })
  @ApiResponse({ status: 200, description: 'Muted users returned successfully' })
  @ApiResponse({ status: 403, description: 'Not a member or not an operator' })
  @Get(':id/muted-users')
  @UseGuards(ChannelMemberGuard, ChannelOperatorGuard)
  getMutedUsers(@Param('id') id: string) {
    return this.channelService.getMutedUsers(id);
  }

  @ApiOperation({ summary: 'Ban a user from a channel' })
  @ApiParam({ name: 'id', description: 'Channel ID' })
  @ApiParam({ name: 'userId', description: 'User ID to ban' })
  @ApiResponse({ status: 200, description: 'User banned successfully' })
  @ApiResponse({ status: 403, description: 'Not a member or not an operator' })
  @Post(':id/members/:userId/ban')
  @UseGuards(ChannelMemberGuard, ChannelOperatorGuard)
  ban(@Param('id') id: string, @Param('userId') userId: string, @Body() dto: BanUserDto) {
    return this.channelService.banUser(id, userId, dto);
  }

  @ApiOperation({ summary: 'Unban a user from a channel' })
  @ApiParam({ name: 'id', description: 'Channel ID' })
  @ApiParam({ name: 'userId', description: 'User ID to unban' })
  @ApiResponse({ status: 200, description: 'User unbanned successfully' })
  @ApiResponse({ status: 403, description: 'Not a member or not an operator' })
  @Post(':id/members/:userId/unban')
  @UseGuards(ChannelMemberGuard, ChannelOperatorGuard)
  unban(@Param('id') id: string, @Param('userId') userId: string) {
    return this.channelService.unbanUser(id, userId);
  }

  @ApiOperation({ summary: 'List banned users in a channel' })
  @ApiParam({ name: 'id', description: 'Channel ID' })
  @ApiResponse({ status: 200, description: 'Banned users returned successfully' })
  @ApiResponse({ status: 403, description: 'Not a member or not an operator' })
  @Get(':id/banned-users')
  @UseGuards(ChannelMemberGuard, ChannelOperatorGuard)
  getBannedUsers(@Param('id') id: string) {
    return this.channelService.getBannedUsers(id);
  }

  // ─── Visibility ──────────────────────────────────────────────────────

  @ApiOperation({ summary: 'Hide a channel from the channel list' })
  @ApiParam({ name: 'id', description: 'Channel ID' })
  @ApiResponse({ status: 200, description: 'Channel hidden successfully' })
  @ApiResponse({ status: 403, description: 'Not a member of this channel' })
  @Post(':id/hide')
  @UseGuards(ChannelMemberGuard)
  hide(
    @Param('id') id: string,
    @CurrentChatUser() user: ChatAuthUser,
    @Body() dto: HideChannelDto,
  ) {
    return this.channelService.hideChannel(id, user.id, dto);
  }

  @ApiOperation({ summary: 'Unhide a channel' })
  @ApiParam({ name: 'id', description: 'Channel ID' })
  @ApiResponse({ status: 200, description: 'Channel unhidden successfully' })
  @ApiResponse({ status: 403, description: 'Not a member of this channel' })
  @Post(':id/unhide')
  @UseGuards(ChannelMemberGuard)
  unhide(@Param('id') id: string, @CurrentChatUser() user: ChatAuthUser) {
    return this.channelService.unhideChannel(id, user.id);
  }

  @ApiOperation({ summary: 'Reset message history for the current user' })
  @ApiParam({ name: 'id', description: 'Channel ID' })
  @ApiResponse({ status: 200, description: 'History reset successfully' })
  @ApiResponse({ status: 403, description: 'Not a member of this channel' })
  @Post(':id/reset-history')
  @UseGuards(ChannelMemberGuard)
  resetHistory(@Param('id') id: string, @CurrentChatUser() user: ChatAuthUser) {
    return this.channelService.resetHistory(id, user.id);
  }

  // ─── Metadata ────────────────────────────────────────────────────────

  @ApiOperation({ summary: 'Get channel metadata' })
  @ApiParam({ name: 'id', description: 'Channel ID' })
  @ApiResponse({ status: 200, description: 'Metadata returned successfully' })
  @ApiResponse({ status: 403, description: 'Not a member of this channel' })
  @Get(':id/metadata')
  @UseGuards(ChannelMemberGuard)
  getMetadata(@Param('id') id: string) {
    return this.channelService.getMetadata(id);
  }

  @ApiOperation({ summary: 'Set channel metadata' })
  @ApiParam({ name: 'id', description: 'Channel ID' })
  @ApiResponse({ status: 200, description: 'Metadata updated successfully' })
  @ApiResponse({ status: 403, description: 'Not a member of this channel' })
  @Put(':id/metadata')
  @UseGuards(ChannelMemberGuard)
  setMetadata(@Param('id') id: string, @Body() dto: ChannelMetadataDto) {
    return this.channelService.setMetadata(id, dto.metadata);
  }

  @ApiOperation({ summary: 'Delete a specific metadata key from a channel' })
  @ApiParam({ name: 'id', description: 'Channel ID' })
  @ApiParam({ name: 'key', description: 'Metadata key to delete' })
  @ApiResponse({ status: 200, description: 'Metadata key deleted successfully' })
  @ApiResponse({ status: 403, description: 'Not a member of this channel' })
  @Delete(':id/metadata/:key')
  @UseGuards(ChannelMemberGuard)
  deleteMetadataKey(@Param('id') id: string, @Param('key') key: string) {
    return this.channelService.deleteMetadataKey(id, key);
  }

  // ─── Pinning ─────────────────────────────────────────────────────────

  @ApiOperation({ summary: 'Pin a message in a channel' })
  @ApiParam({ name: 'id', description: 'Channel ID' })
  @ApiParam({ name: 'messageId', description: 'Message ID to pin' })
  @ApiResponse({ status: 200, description: 'Message pinned successfully' })
  @ApiResponse({ status: 403, description: 'Not a member of this channel' })
  @Post(':id/messages/:messageId/pin')
  @UseGuards(ChannelMemberGuard)
  pinMessage(
    @Param('id') id: string,
    @Param('messageId') msgId: string,
    @CurrentChatUser() user: ChatAuthUser,
  ) {
    return this.channelService.pinMessage(id, msgId, user.id);
  }

  @ApiOperation({ summary: 'Unpin a message from a channel' })
  @ApiParam({ name: 'id', description: 'Channel ID' })
  @ApiParam({ name: 'messageId', description: 'Message ID to unpin' })
  @ApiResponse({ status: 200, description: 'Message unpinned successfully' })
  @ApiResponse({ status: 403, description: 'Not a member of this channel' })
  @Delete(':id/messages/:messageId/pin')
  @UseGuards(ChannelMemberGuard)
  unpinMessage(@Param('id') id: string, @Param('messageId') msgId: string) {
    return this.channelService.unpinMessage(id, msgId);
  }

  @ApiOperation({ summary: 'List pinned messages in a channel' })
  @ApiParam({ name: 'id', description: 'Channel ID' })
  @ApiResponse({ status: 200, description: 'Pinned messages returned successfully' })
  @ApiResponse({ status: 403, description: 'Not a member of this channel' })
  @Get(':id/pinned-messages')
  @UseGuards(ChannelMemberGuard)
  getPinnedMessages(@Param('id') id: string) {
    return this.channelService.getPinnedMessageIds(id);
  }

  // ─── Shared Files ────────────────────────────────────────────────────

  @ApiOperation({ summary: 'List shared files in a channel' })
  @ApiParam({ name: 'id', description: 'Channel ID' })
  @ApiResponse({ status: 200, description: 'Shared files returned successfully' })
  @ApiResponse({ status: 403, description: 'Not a member of this channel' })
  @Get(':id/shared-files')
  @UseGuards(ChannelMemberGuard)
  getSharedFiles(@Param('id') id: string, @Query('limit') limit?: number) {
    return this.channelService.getSharedFiles(id, limit);
  }

  // ─── Reporting ───────────────────────────────────────────────────────

  @ApiOperation({ summary: 'Report a channel' })
  @ApiParam({ name: 'id', description: 'Channel ID' })
  @ApiResponse({ status: 201, description: 'Channel reported successfully' })
  @ApiResponse({ status: 403, description: 'Not a member of this channel' })
  @Post(':id/report')
  @UseGuards(ChannelMemberGuard)
  reportChannel(
    @Param('id') id: string,
    @CurrentChatUser() user: ChatAuthUser,
    @Body() dto: ReportDto,
  ) {
    return this.channelService.reportChannel(id, user.id, user.tenantId, dto);
  }
}

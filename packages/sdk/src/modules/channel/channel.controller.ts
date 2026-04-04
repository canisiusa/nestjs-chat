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

@Controller('channels')
@UseGuards(ChatAuthGuard)
export class ChannelController {
  constructor(private readonly channelService: ChannelService) {}

  // ─── Channel CRUD ────────────────────────────────────────────────────

  @Get()
  getChannels(@CurrentChatUser() user: ChatAuthUser, @Query() query: ChannelListQueryDto) {
    return this.channelService.getChannels(user.id, user.tenantId, query);
  }

  @Get('unread-count')
  getUnreadCount(@CurrentChatUser() user: ChatAuthUser) {
    return this.channelService.getUnreadCount(user.id, user.tenantId);
  }

  @Get(':id')
  @UseGuards(ChannelMemberGuard)
  getChannel(@Param('id') id: string, @CurrentChatUser() user: ChatAuthUser) {
    return this.channelService.getChannel(id, user.id);
  }

  @Post('direct')
  createDirect(@CurrentChatUser() user: ChatAuthUser, @Body() dto: CreateDirectChannelDto) {
    return this.channelService.createDirectChannel(user.id, user.tenantId, dto);
  }

  @Post('group')
  createGroup(@CurrentChatUser() user: ChatAuthUser, @Body() dto: CreateGroupChannelDto) {
    return this.channelService.createGroupChannel(user.id, user.tenantId, dto);
  }

  @Patch(':id')
  @UseGuards(ChannelMemberGuard, ChannelOperatorGuard)
  update(@Param('id') id: string, @Body() dto: UpdateChannelDto) {
    return this.channelService.updateChannel(id, dto);
  }

  @Delete(':id')
  @UseGuards(ChannelMemberGuard, ChannelOperatorGuard)
  delete(@Param('id') id: string) {
    return this.channelService.deleteChannel(id);
  }

  @Post(':id/leave')
  @UseGuards(ChannelMemberGuard)
  leave(@Param('id') id: string, @CurrentChatUser() user: ChatAuthUser) {
    return this.channelService.leaveChannel(id, user.id);
  }

  // ─── Members ─────────────────────────────────────────────────────────

  @Get(':id/members')
  @UseGuards(ChannelMemberGuard)
  getMembers(@Param('id') id: string) {
    return this.channelService.getMembers(id);
  }

  @Post(':id/members/invite')
  @UseGuards(ChannelMemberGuard, ChannelOperatorGuard)
  invite(
    @Param('id') id: string,
    @CurrentChatUser() user: ChatAuthUser,
    @Body() dto: InviteMembersDto,
  ) {
    return this.channelService.inviteUsers(id, user.tenantId, dto);
  }

  @Delete(':id/members/:userId')
  @UseGuards(ChannelMemberGuard, ChannelOperatorGuard)
  removeMember(@Param('id') id: string, @Param('userId') userId: string) {
    return this.channelService.removeUser(id, userId);
  }

  // ─── Operators ───────────────────────────────────────────────────────

  @Get(':id/operators')
  @UseGuards(ChannelMemberGuard)
  getOperators(@Param('id') id: string) {
    return this.channelService.getOperators(id);
  }

  @Post(':id/operators')
  @UseGuards(ChannelMemberGuard, ChannelOperatorGuard)
  addOperators(@Param('id') id: string, @Body() dto: InviteMembersDto) {
    return this.channelService.addOperators(id, dto.userIds);
  }

  @Delete(':id/operators')
  @UseGuards(ChannelMemberGuard, ChannelOperatorGuard)
  removeOperators(@Param('id') id: string, @Body() dto: InviteMembersDto) {
    return this.channelService.removeOperators(id, dto.userIds);
  }

  // ─── Read ────────────────────────────────────────────────────────────

  @Post(':id/read')
  @UseGuards(ChannelMemberGuard)
  markAsRead(@Param('id') id: string, @CurrentChatUser() user: ChatAuthUser) {
    return this.channelService.markAsRead(id, user.id);
  }

  // ─── Notification Preferences ────────────────────────────────────────

  @Put(':id/push-trigger')
  @UseGuards(ChannelMemberGuard)
  setPushTrigger(
    @Param('id') id: string,
    @CurrentChatUser() user: ChatAuthUser,
    @Body() dto: SetPushTriggerDto,
  ) {
    return this.channelService.setPushTrigger(id, user.id, dto);
  }

  @Get(':id/push-trigger')
  @UseGuards(ChannelMemberGuard)
  getPushTrigger(@Param('id') id: string, @CurrentChatUser() user: ChatAuthUser) {
    return this.channelService.getPushTrigger(id, user.id);
  }

  @Put(':id/count-preference')
  @UseGuards(ChannelMemberGuard)
  setCountPreference(
    @Param('id') id: string,
    @CurrentChatUser() user: ChatAuthUser,
    @Body() dto: SetCountPreferenceDto,
  ) {
    return this.channelService.setCountPreference(id, user.id, dto);
  }

  @Get(':id/count-preference')
  @UseGuards(ChannelMemberGuard)
  getCountPreference(@Param('id') id: string, @CurrentChatUser() user: ChatAuthUser) {
    return this.channelService.getCountPreference(id, user.id);
  }

  // ─── Moderation ──────────────────────────────────────────────────────

  @Post(':id/freeze')
  @UseGuards(ChannelMemberGuard, ChannelOperatorGuard)
  freeze(@Param('id') id: string) {
    return this.channelService.freezeChannel(id);
  }

  @Post(':id/unfreeze')
  @UseGuards(ChannelMemberGuard, ChannelOperatorGuard)
  unfreeze(@Param('id') id: string) {
    return this.channelService.unfreezeChannel(id);
  }

  @Post(':id/mute')
  @UseGuards(ChannelMemberGuard)
  mute(@Param('id') id: string, @CurrentChatUser() user: ChatAuthUser) {
    return this.channelService.muteChannel(id, user.id);
  }

  @Post(':id/unmute')
  @UseGuards(ChannelMemberGuard)
  unmute(@Param('id') id: string, @CurrentChatUser() user: ChatAuthUser) {
    return this.channelService.unmuteChannel(id, user.id);
  }

  @Post(':id/members/:userId/mute')
  @UseGuards(ChannelMemberGuard, ChannelOperatorGuard)
  muteUser(@Param('id') id: string, @Param('userId') userId: string, @Body() dto: MuteUserDto) {
    return this.channelService.muteUser(id, userId, dto);
  }

  @Post(':id/members/:userId/unmute')
  @UseGuards(ChannelMemberGuard, ChannelOperatorGuard)
  unmuteUser(@Param('id') id: string, @Param('userId') userId: string) {
    return this.channelService.unmuteUser(id, userId);
  }

  @Get(':id/muted-users')
  @UseGuards(ChannelMemberGuard, ChannelOperatorGuard)
  getMutedUsers(@Param('id') id: string) {
    return this.channelService.getMutedUsers(id);
  }

  @Post(':id/members/:userId/ban')
  @UseGuards(ChannelMemberGuard, ChannelOperatorGuard)
  ban(@Param('id') id: string, @Param('userId') userId: string, @Body() dto: BanUserDto) {
    return this.channelService.banUser(id, userId, dto);
  }

  @Post(':id/members/:userId/unban')
  @UseGuards(ChannelMemberGuard, ChannelOperatorGuard)
  unban(@Param('id') id: string, @Param('userId') userId: string) {
    return this.channelService.unbanUser(id, userId);
  }

  @Get(':id/banned-users')
  @UseGuards(ChannelMemberGuard, ChannelOperatorGuard)
  getBannedUsers(@Param('id') id: string) {
    return this.channelService.getBannedUsers(id);
  }

  // ─── Visibility ──────────────────────────────────────────────────────

  @Post(':id/hide')
  @UseGuards(ChannelMemberGuard)
  hide(
    @Param('id') id: string,
    @CurrentChatUser() user: ChatAuthUser,
    @Body() dto: HideChannelDto,
  ) {
    return this.channelService.hideChannel(id, user.id, dto);
  }

  @Post(':id/unhide')
  @UseGuards(ChannelMemberGuard)
  unhide(@Param('id') id: string, @CurrentChatUser() user: ChatAuthUser) {
    return this.channelService.unhideChannel(id, user.id);
  }

  @Post(':id/reset-history')
  @UseGuards(ChannelMemberGuard)
  resetHistory(@Param('id') id: string, @CurrentChatUser() user: ChatAuthUser) {
    return this.channelService.resetHistory(id, user.id);
  }

  // ─── Metadata ────────────────────────────────────────────────────────

  @Get(':id/metadata')
  @UseGuards(ChannelMemberGuard)
  getMetadata(@Param('id') id: string) {
    return this.channelService.getMetadata(id);
  }

  @Put(':id/metadata')
  @UseGuards(ChannelMemberGuard)
  setMetadata(@Param('id') id: string, @Body() dto: ChannelMetadataDto) {
    return this.channelService.setMetadata(id, dto.metadata);
  }

  @Delete(':id/metadata/:key')
  @UseGuards(ChannelMemberGuard)
  deleteMetadataKey(@Param('id') id: string, @Param('key') key: string) {
    return this.channelService.deleteMetadataKey(id, key);
  }

  // ─── Pinning ─────────────────────────────────────────────────────────

  @Post(':id/messages/:messageId/pin')
  @UseGuards(ChannelMemberGuard)
  pinMessage(
    @Param('id') id: string,
    @Param('messageId') msgId: string,
    @CurrentChatUser() user: ChatAuthUser,
  ) {
    return this.channelService.pinMessage(id, msgId, user.id);
  }

  @Delete(':id/messages/:messageId/pin')
  @UseGuards(ChannelMemberGuard)
  unpinMessage(@Param('id') id: string, @Param('messageId') msgId: string) {
    return this.channelService.unpinMessage(id, msgId);
  }

  @Get(':id/pinned-messages')
  @UseGuards(ChannelMemberGuard)
  getPinnedMessages(@Param('id') id: string) {
    return this.channelService.getPinnedMessageIds(id);
  }

  // ─── Shared Files ────────────────────────────────────────────────────

  @Get(':id/shared-files')
  @UseGuards(ChannelMemberGuard)
  getSharedFiles(@Param('id') id: string, @Query('limit') limit?: number) {
    return this.channelService.getSharedFiles(id, limit);
  }

  // ─── Reporting ───────────────────────────────────────────────────────

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

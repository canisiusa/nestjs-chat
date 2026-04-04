import { Controller, UseGuards, Post, Get, Param, Body } from '@nestjs/common';
import { ChatAuthGuard } from '../../common/guards';
import { CurrentChatUser } from '../../common/decorators';
import { ChatAuthUser } from '../../core/interfaces/chat-auth.interface';
import { ChannelMemberGuard } from '../channel/guards/channel-member.guard';
import { PollService } from './poll.service';
import { CreatePollDto, VotePollDto } from './dto';

@Controller('channels/:channelId/polls')
@UseGuards(ChatAuthGuard, ChannelMemberGuard)
export class PollController {
  constructor(private readonly pollService: PollService) {}

  @Post()
  create(
    @Param('channelId') channelId: string,
    @CurrentChatUser() user: ChatAuthUser,
    @Body() dto: CreatePollDto,
  ) {
    return this.pollService.createPoll(channelId, user.id, user.tenantId, dto);
  }

  @Post(':pollId/vote')
  vote(
    @Param('channelId') channelId: string,
    @Param('pollId') pollId: string,
    @CurrentChatUser() user: ChatAuthUser,
    @Body() dto: VotePollDto,
  ) {
    return this.pollService.votePoll(channelId, pollId, user.id, dto);
  }

  @Get(':pollId')
  get(
    @Param('channelId') channelId: string,
    @Param('pollId') pollId: string,
    @CurrentChatUser() user: ChatAuthUser,
  ) {
    return this.pollService.getPoll(channelId, pollId, user.id);
  }
}

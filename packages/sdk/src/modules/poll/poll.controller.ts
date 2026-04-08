import { Controller, UseGuards, UsePipes, ValidationPipe, Post, Get, Param, Body } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiParam } from '@nestjs/swagger';
import { ChatAuthGuard } from '../../common/guards';
import { CurrentChatUser } from '../../common/decorators';
import { ChatAuthUser } from '../../core/interfaces/chat-auth.interface';
import { ChannelMemberGuard } from '../channel/guards/channel-member.guard';
import { PollService } from './poll.service';
import { CreatePollDto, VotePollDto } from './dto';

@ApiTags('Polls')
@ApiBearerAuth()
@Controller('channels/:channelId/polls')
@UseGuards(ChatAuthGuard, ChannelMemberGuard)
export class PollController {
  constructor(private readonly pollService: PollService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new poll in a channel' })
  @ApiParam({ name: 'channelId', description: 'Channel ID' })
  @ApiResponse({ status: 201, description: 'Poll created successfully' })
  @ApiResponse({ status: 400, description: 'Invalid poll data' })
  create(
    @Param('channelId') channelId: string,
    @CurrentChatUser() user: ChatAuthUser,
    @Body() dto: CreatePollDto,
  ) {
    return this.pollService.createPoll(channelId, user.id, user.tenantId, dto);
  }

  @Post(':pollId/vote')
  @ApiOperation({ summary: 'Vote on a poll' })
  @ApiParam({ name: 'channelId', description: 'Channel ID' })
  @ApiParam({ name: 'pollId', description: 'Poll ID' })
  @ApiResponse({ status: 201, description: 'Vote recorded successfully' })
  @ApiResponse({ status: 404, description: 'Poll not found' })
  vote(
    @Param('channelId') channelId: string,
    @Param('pollId') pollId: string,
    @CurrentChatUser() user: ChatAuthUser,
    @Body() dto: VotePollDto,
  ) {
    return this.pollService.votePoll(channelId, pollId, user.id, dto);
  }

  @Get(':pollId')
  @ApiOperation({ summary: 'Get poll details and results' })
  @ApiParam({ name: 'channelId', description: 'Channel ID' })
  @ApiParam({ name: 'pollId', description: 'Poll ID' })
  @ApiResponse({ status: 200, description: 'Poll retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Poll not found' })
  get(
    @Param('channelId') channelId: string,
    @Param('pollId') pollId: string,
    @CurrentChatUser() user: ChatAuthUser,
  ) {
    return this.pollService.getPoll(channelId, pollId, user.id);
  }
}

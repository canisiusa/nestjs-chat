import { Test } from '@nestjs/testing';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';
import { PollService } from './poll.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import { ChatEventService } from '../gateway/chat-event.service';
import { ChatSocketEvent } from '../../core/types/chat-socket.types';
import { ChatErrorCode } from '../../common/exceptions/chat-error-codes';
import { ChatException } from '../../common/exceptions';
import {
  createMockLogger,
  createMockPrisma,
  createMockEmitter,
  MockPrisma,
} from '../../common/testing/mocks';

describe('PollService', () => {
  let service: PollService;
  let prisma: MockPrisma;
  let events: ReturnType<typeof createMockEmitter>;
  let logger: ReturnType<typeof createMockLogger>;

  beforeEach(async () => {
    prisma = createMockPrisma();
    events = createMockEmitter();
    logger = createMockLogger();

    const moduleRef = await Test.createTestingModule({
      providers: [
        PollService,
        { provide: PrismaService, useValue: prisma },
        { provide: ChatEventService, useValue: events },
        { provide: WINSTON_MODULE_PROVIDER, useValue: logger },
      ],
    }).compile();

    service = moduleRef.get(PollService);
  });

  describe('createPoll', () => {
    const baseDto = {
      title: 'Best color?',
      options: ['red', 'blue', 'green'],
    };

    it('creates poll + companion message, emits MESSAGE_RECEIVED and returns both', async () => {
      prisma.chatPoll.create.mockResolvedValue({
        id: 'poll_1',
        channelId: 'c1',
        title: baseDto.title,
        allowMultipleVotes: false,
        allowUserSuggestion: false,
        status: 'OPEN',
        voterCount: 0,
        createdById: 'u1',
        createdAt: new Date('2026-01-01T00:00:00Z'),
        updatedAt: new Date('2026-01-01T00:00:00Z'),
        closeAt: null,
        options: baseDto.options.map((text, i) => ({
          id: `opt_${i}`,
          text,
          position: i,
          voteCount: 0,
          votes: [],
        })),
      } as never);

      prisma.chatMessage.create.mockResolvedValue({
        id: 'm1',
        createdAt: new Date('2026-01-01T00:00:00Z'),
      } as never);
      prisma.chatChannel.update.mockResolvedValue({} as never);

      const result = await service.createPoll('c1', 'u1', 't1', baseDto);

      expect(prisma.chatPoll.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            channelId: 'c1',
            tenantId: 't1',
            title: 'Best color?',
            createdById: 'u1',
            allowMultipleVotes: false,
          }),
        }),
      );
      expect(prisma.chatMessage.create).toHaveBeenCalled();
      expect(prisma.chatChannel.update).toHaveBeenCalledWith({
        where: { id: 'c1' },
        data: { lastMessageAt: expect.any(Date) },
      });
      expect(events.emitToChannel).toHaveBeenCalledWith(
        'c1',
        ChatSocketEvent.MESSAGE_RECEIVED,
        expect.objectContaining({ channelId: 'c1' }),
      );
      expect(result.poll.id).toBe('poll_1');
      expect(result.poll.options).toHaveLength(3);
      expect(result.message.id).toBe('m1');
    });

    it('converts closeAt string to Date', async () => {
      prisma.chatPoll.create.mockResolvedValue({
        id: 'p',
        channelId: 'c1',
        title: 't',
        allowMultipleVotes: false,
        allowUserSuggestion: false,
        status: 'OPEN',
        voterCount: 0,
        createdById: 'u1',
        createdAt: new Date(),
        updatedAt: new Date(),
        closeAt: null,
        options: [],
      } as never);
      prisma.chatMessage.create.mockResolvedValue({ id: 'm', createdAt: new Date() } as never);
      prisma.chatChannel.update.mockResolvedValue({} as never);

      await service.createPoll('c1', 'u1', 't1', {
        title: 't',
        options: ['a'],
        closeAt: '2026-12-31T00:00:00Z',
      });

      const arg = prisma.chatPoll.create.mock.calls[0][0];
      expect(arg.data.closeAt).toBeInstanceOf(Date);
    });

    it('wraps Prisma failures in ChatException', async () => {
      prisma.chatPoll.create.mockRejectedValue(new Error('db down'));
      await expect(service.createPoll('c1', 'u1', 't1', baseDto)).rejects.toBeInstanceOf(
        ChatException,
      );
    });
  });

  describe('votePoll', () => {
    const openPoll = {
      id: 'p1',
      status: 'OPEN',
      allowMultipleVotes: false,
      options: [
        { id: 'opt_red' },
        { id: 'opt_blue' },
      ],
    };

    const enrichedPoll = (overrides = {}) => ({
      id: 'p1',
      channelId: 'c1',
      title: 't',
      allowMultipleVotes: false,
      allowUserSuggestion: false,
      status: 'OPEN',
      voterCount: 1,
      createdById: 'u1',
      createdAt: new Date(),
      updatedAt: new Date(),
      closeAt: null,
      options: [
        {
          id: 'opt_red',
          text: 'red',
          position: 0,
          voteCount: 1,
          votes: [{ userId: 'u2' }],
        },
      ],
      ...overrides,
    });

    it('throws POLL_NOT_FOUND when the poll does not exist', async () => {
      prisma.chatPoll.findUnique.mockResolvedValue(null as never);
      await expect(
        service.votePoll('c1', 'p1', 'u2', { optionIds: ['opt_red'] }),
      ).rejects.toMatchObject({ code: ChatErrorCode.POLL_NOT_FOUND });
    });

    it('throws POLL_CLOSED when the poll status is CLOSED', async () => {
      prisma.chatPoll.findUnique.mockResolvedValue({ ...openPoll, status: 'CLOSED' } as never);
      await expect(
        service.votePoll('c1', 'p1', 'u2', { optionIds: ['opt_red'] }),
      ).rejects.toMatchObject({ code: ChatErrorCode.POLL_CLOSED });
    });

    it('throws VALIDATION_ERROR when multiple votes are sent on a single-vote poll', async () => {
      prisma.chatPoll.findUnique.mockResolvedValue(openPoll as never);
      await expect(
        service.votePoll('c1', 'p1', 'u2', { optionIds: ['opt_red', 'opt_blue'] }),
      ).rejects.toMatchObject({ code: ChatErrorCode.VALIDATION_ERROR });
    });

    it('removes previous votes on single-vote polls before adding the new one', async () => {
      prisma.chatPoll.findUnique
        .mockResolvedValueOnce(openPoll as never)
        .mockResolvedValueOnce(enrichedPoll() as never);
      prisma.chatPollVote.deleteMany.mockResolvedValue({ count: 1 } as never);
      prisma.chatPollVote.findUnique.mockResolvedValue(null as never);
      prisma.chatPollVote.upsert.mockResolvedValue({} as never);
      prisma.chatPollOption.update.mockResolvedValue({} as never);
      prisma.chatPollVote.findMany.mockResolvedValue([{ userId: 'u2' }] as never);
      prisma.chatPoll.update.mockResolvedValue({} as never);

      await service.votePoll('c1', 'p1', 'u2', { optionIds: ['opt_red'] });

      expect(prisma.chatPollVote.deleteMany).toHaveBeenCalledWith({
        where: { userId: 'u2', optionId: { in: ['opt_red', 'opt_blue'] } },
      });
    });

    it('upserts the new vote and increments the option count', async () => {
      prisma.chatPoll.findUnique
        .mockResolvedValueOnce(openPoll as never)
        .mockResolvedValueOnce(enrichedPoll() as never);
      prisma.chatPollVote.deleteMany.mockResolvedValue({ count: 0 } as never);
      prisma.chatPollVote.findUnique.mockResolvedValue(null as never);
      prisma.chatPollVote.upsert.mockResolvedValue({} as never);
      prisma.chatPollOption.update.mockResolvedValue({} as never);
      prisma.chatPollVote.findMany.mockResolvedValue([{ userId: 'u2' }] as never);
      prisma.chatPoll.update.mockResolvedValue({} as never);

      await service.votePoll('c1', 'p1', 'u2', { optionIds: ['opt_red'] });

      expect(prisma.chatPollVote.upsert).toHaveBeenCalledWith({
        where: { optionId_userId: { optionId: 'opt_red', userId: 'u2' } },
        create: { optionId: 'opt_red', userId: 'u2' },
        update: {},
      });
      expect(prisma.chatPollOption.update).toHaveBeenCalledWith({
        where: { id: 'opt_red' },
        data: { voteCount: { increment: 1 } },
      });
    });

    it('updates voterCount to the number of distinct voters', async () => {
      prisma.chatPoll.findUnique
        .mockResolvedValueOnce(openPoll as never)
        .mockResolvedValueOnce(enrichedPoll() as never);
      prisma.chatPollVote.deleteMany.mockResolvedValue({ count: 0 } as never);
      prisma.chatPollVote.findUnique.mockResolvedValue(null as never);
      prisma.chatPollVote.upsert.mockResolvedValue({} as never);
      prisma.chatPollOption.update.mockResolvedValue({} as never);
      prisma.chatPollVote.findMany.mockResolvedValue([
        { userId: 'u2' },
        { userId: 'u3' },
      ] as never);
      prisma.chatPoll.update.mockResolvedValue({} as never);

      await service.votePoll('c1', 'p1', 'u2', { optionIds: ['opt_red'] });

      expect(prisma.chatPoll.update).toHaveBeenCalledWith({
        where: { id: 'p1' },
        data: { voterCount: 2 },
      });
    });

    it('emits POLL_VOTED on the channel', async () => {
      prisma.chatPoll.findUnique
        .mockResolvedValueOnce(openPoll as never)
        .mockResolvedValueOnce(enrichedPoll() as never);
      prisma.chatPollVote.deleteMany.mockResolvedValue({ count: 0 } as never);
      prisma.chatPollVote.findUnique.mockResolvedValue(null as never);
      prisma.chatPollVote.upsert.mockResolvedValue({} as never);
      prisma.chatPollOption.update.mockResolvedValue({} as never);
      prisma.chatPollVote.findMany.mockResolvedValue([{ userId: 'u2' }] as never);
      prisma.chatPoll.update.mockResolvedValue({} as never);

      await service.votePoll('c1', 'p1', 'u2', { optionIds: ['opt_red'] });

      expect(events.emitToChannel).toHaveBeenCalledWith(
        'c1',
        ChatSocketEvent.POLL_VOTED,
        expect.objectContaining({ channelId: 'c1', pollId: 'p1' }),
      );
    });
  });

  describe('getPoll', () => {
    it('throws POLL_NOT_FOUND if missing', async () => {
      prisma.chatPoll.findUnique.mockResolvedValue(null as never);
      await expect(service.getPoll('c1', 'p1', 'u1')).rejects.toMatchObject({
        code: ChatErrorCode.POLL_NOT_FOUND,
      });
    });

    it('marks options the current user has voted for in votedPollOptionIds', async () => {
      prisma.chatPoll.findUnique.mockResolvedValue({
        id: 'p1',
        channelId: 'c1',
        title: 't',
        allowMultipleVotes: true,
        allowUserSuggestion: false,
        status: 'OPEN',
        voterCount: 2,
        createdById: 'u0',
        createdAt: new Date(),
        updatedAt: new Date(),
        closeAt: null,
        options: [
          {
            id: 'opt_a',
            text: 'a',
            position: 0,
            voteCount: 2,
            votes: [{ userId: 'u1' }, { userId: 'u2' }],
          },
          {
            id: 'opt_b',
            text: 'b',
            position: 1,
            voteCount: 1,
            votes: [{ userId: 'u2' }],
          },
        ],
      } as never);

      const result = await service.getPoll('c1', 'p1', 'u1');

      expect(result.votedPollOptionIds).toEqual(['opt_a']);
      expect(result.options[0].votedUserIds).toEqual(['u1', 'u2']);
    });

    it('wraps Prisma errors into ChatException', async () => {
      prisma.chatPoll.findUnique.mockRejectedValue(new Error('db'));
      await expect(service.getPoll('c1', 'p1', 'u1')).rejects.toBeInstanceOf(ChatException);
    });
  });
});

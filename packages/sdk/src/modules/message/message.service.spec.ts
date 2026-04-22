import { Test } from '@nestjs/testing';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';
import { MessageService } from './message.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import { ChatEventService } from '../gateway/chat-event.service';
import { ChatSocketEvent } from '../../core/types/chat-socket.types';
import { ChatException } from '../../common/exceptions';
import { ChatErrorCode } from '../../common/exceptions/chat-error-codes';
import {
  createMockEmitter,
  createMockLogger,
  createMockPrisma,
  MockPrisma,
} from '../../common/testing/mocks';

const baseMessage = (overrides: Record<string, unknown> = {}) => ({
  id: 'm1',
  channelId: 'c1',
  tenantId: 't1',
  senderId: 'u1',
  type: 'TEXT',
  text: 'hi',
  mentionedUserIds: [],
  parentMessageId: null,
  createdAt: new Date('2026-01-01T00:00:00Z'),
  updatedAt: new Date('2026-01-01T00:00:00Z'),
  deletedAt: null,
  isEdited: false,
  isForwarded: false,
  forwardedFromId: null,
  metadata: null,
  linkMetadata: null,
  fileUrl: null,
  fileName: null,
  fileSize: null,
  mimeType: null,
  thumbnailUrl: null,
  reactions: [],
  ...overrides,
});

describe('MessageService', () => {
  let service: MessageService;
  let prisma: MockPrisma;
  let events: ReturnType<typeof createMockEmitter>;
  let logger: ReturnType<typeof createMockLogger>;

  beforeEach(async () => {
    prisma = createMockPrisma();
    events = createMockEmitter();
    logger = createMockLogger();

    // Default mocks that enrichMessage needs on most paths
    prisma.chatPinnedMessage.findUnique.mockResolvedValue(null as never);
    prisma.chatMessage.count.mockResolvedValue(0 as never);
    prisma.chatChannelMember.count.mockResolvedValue(0 as never);
    prisma.chatReaction.findMany.mockResolvedValue([] as never);
    prisma.chatChannelMember.findMany.mockResolvedValue([] as never);

    const moduleRef = await Test.createTestingModule({
      providers: [
        MessageService,
        { provide: PrismaService, useValue: prisma },
        { provide: ChatEventService, useValue: events },
        { provide: WINSTON_MODULE_PROVIDER, useValue: logger },
      ],
    }).compile();

    service = moduleRef.get(MessageService);
  });

  describe('getMessage', () => {
    it('throws MESSAGE_NOT_FOUND when the message does not exist', async () => {
      prisma.chatMessage.findFirst.mockResolvedValue(null as never);
      await expect(service.getMessage('c1', 'm1', 'u1')).rejects.toMatchObject({
        code: ChatErrorCode.MESSAGE_NOT_FOUND,
      });
    });

    it('returns the enriched message when it exists', async () => {
      prisma.chatMessage.findFirst.mockResolvedValue(baseMessage() as never);
      const result = await service.getMessage('c1', 'm1', 'u1');
      expect(result.id).toBe('m1');
      expect(result.isPinned).toBe(false);
    });
  });

  describe('sendTextMessage', () => {
    it('persists the message, updates lastMessageAt, and emits MESSAGE_RECEIVED', async () => {
      prisma.chatMessage.create.mockResolvedValue(baseMessage() as never);
      prisma.chatChannel.update.mockResolvedValue({} as never);
      prisma.chatChannelMember.findMany.mockResolvedValue([] as never);

      const result = await service.sendTextMessage('c1', 'u1', 't1', { text: 'hi' });

      expect(prisma.chatMessage.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            channelId: 'c1',
            tenantId: 't1',
            senderId: 'u1',
            type: 'TEXT',
            text: 'hi',
            mentionedUserIds: [],
          }),
        }),
      );
      expect(prisma.chatChannel.update).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'c1' } }),
      );
      expect(events.notifyMessageSent).toHaveBeenCalledWith('c1', expect.any(Object), 't1');
      expect(result.id).toBe('m1');
    });

    it('notifies mentioned users when mentionedUserIds is non-empty', async () => {
      prisma.chatMessage.create.mockResolvedValue(
        baseMessage({ mentionedUserIds: ['u2'] }) as never,
      );
      prisma.chatChannel.update.mockResolvedValue({} as never);

      await service.sendTextMessage('c1', 'u1', 't1', { text: 'hi', mentionedUserIds: ['u2'] });

      expect(events.notifyMentioned).toHaveBeenCalledWith(
        ['u2'],
        'c1',
        'm1',
        expect.any(Object),
        't1',
      );
    });

    it('does not call notifyMentioned when no one is mentioned', async () => {
      prisma.chatMessage.create.mockResolvedValue(baseMessage() as never);
      prisma.chatChannel.update.mockResolvedValue({} as never);

      await service.sendTextMessage('c1', 'u1', 't1', { text: 'hi' });

      expect(events.notifyMentioned).not.toHaveBeenCalled();
    });

    it('wraps Prisma failures in ChatException', async () => {
      prisma.chatMessage.create.mockRejectedValue(new Error('db'));
      await expect(
        service.sendTextMessage('c1', 'u1', 't1', { text: 'hi' }),
      ).rejects.toBeInstanceOf(ChatException);
    });
  });

  describe('sendFileMessage', () => {
    it('picks IMAGE type from image/* mime', async () => {
      prisma.chatMessage.create.mockResolvedValue(baseMessage({ type: 'IMAGE' }) as never);
      prisma.chatChannel.update.mockResolvedValue({} as never);

      await service.sendFileMessage('c1', 'u1', 't1', {
        fileUrl: 'https://x',
        fileName: 'pic.png',
        fileSize: 1000,
        mimeType: 'image/png',
      });

      const arg = prisma.chatMessage.create.mock.calls[0][0];
      expect(arg.data.type).toBe('IMAGE');
    });

    it('falls back to FILE type for unknown mime categories', async () => {
      prisma.chatMessage.create.mockResolvedValue(baseMessage({ type: 'FILE' }) as never);
      prisma.chatChannel.update.mockResolvedValue({} as never);

      await service.sendFileMessage('c1', 'u1', 't1', {
        fileUrl: 'https://x',
        fileName: 'doc.pdf',
        fileSize: 1000,
        mimeType: 'application/pdf',
      });

      const arg = prisma.chatMessage.create.mock.calls[0][0];
      expect(arg.data.type).toBe('FILE');
    });
  });

  describe('updateMessage', () => {
    it('throws MESSAGE_NOT_FOUND when the message does not exist', async () => {
      prisma.chatMessage.findFirst.mockResolvedValue(null as never);
      await expect(service.updateMessage('c1', 'm1', 'u1', { text: 'new' })).rejects.toMatchObject({
        code: ChatErrorCode.MESSAGE_NOT_FOUND,
      });
    });

    it('throws MESSAGE_NOT_OWNER when editing someone else’s message', async () => {
      prisma.chatMessage.findFirst.mockResolvedValue(baseMessage({ senderId: 'other' }) as never);
      await expect(service.updateMessage('c1', 'm1', 'u1', { text: 'new' })).rejects.toMatchObject({
        code: ChatErrorCode.MESSAGE_NOT_OWNER,
      });
    });

    it('updates the message, sets isEdited, and emits MESSAGE_UPDATED', async () => {
      prisma.chatMessage.findFirst.mockResolvedValue(baseMessage() as never);
      prisma.chatMessage.update.mockResolvedValue(
        baseMessage({ text: 'new', isEdited: true }) as never,
      );

      await service.updateMessage('c1', 'm1', 'u1', { text: 'new' });

      expect(prisma.chatMessage.update).toHaveBeenCalledWith({
        where: { id: 'm1' },
        data: { text: 'new', isEdited: true },
        include: { reactions: true },
      });
      expect(events.emitToChannel).toHaveBeenCalledWith(
        'c1',
        ChatSocketEvent.MESSAGE_UPDATED,
        expect.any(Object),
      );
    });
  });

  describe('deleteMessage', () => {
    it('throws MESSAGE_NOT_FOUND when missing', async () => {
      prisma.chatMessage.findFirst.mockResolvedValue(null as never);
      await expect(service.deleteMessage('c1', 'm1', 'u1')).rejects.toMatchObject({
        code: ChatErrorCode.MESSAGE_NOT_FOUND,
      });
    });

    it('lets the sender delete their own message', async () => {
      prisma.chatMessage.findFirst.mockResolvedValue(baseMessage() as never);
      prisma.chatMessage.update.mockResolvedValue({} as never);

      await service.deleteMessage('c1', 'm1', 'u1');

      expect(prisma.chatMessage.update).toHaveBeenCalledWith({
        where: { id: 'm1' },
        data: { deletedAt: expect.any(Date) },
      });
      expect(events.emitToChannel).toHaveBeenCalledWith(
        'c1',
        ChatSocketEvent.MESSAGE_DELETED,
        expect.any(Object),
      );
    });

    it('refuses deletion by a non-operator third party', async () => {
      prisma.chatMessage.findFirst.mockResolvedValue(baseMessage({ senderId: 'u_owner' }) as never);
      prisma.chatChannelMember.findUnique.mockResolvedValue({ role: 'MEMBER' } as never);

      await expect(service.deleteMessage('c1', 'm1', 'u1')).rejects.toMatchObject({
        code: ChatErrorCode.MESSAGE_NOT_OWNER,
      });
    });

    it('lets a channel OPERATOR delete anyone’s message', async () => {
      prisma.chatMessage.findFirst.mockResolvedValue(baseMessage({ senderId: 'u_owner' }) as never);
      prisma.chatChannelMember.findUnique.mockResolvedValue({ role: 'OPERATOR' } as never);
      prisma.chatMessage.update.mockResolvedValue({} as never);

      await service.deleteMessage('c1', 'm1', 'u_operator');

      expect(prisma.chatMessage.update).toHaveBeenCalled();
    });
  });

  describe('forwardMessage', () => {
    it('throws MESSAGE_NOT_FOUND when the original does not exist', async () => {
      prisma.chatMessage.findFirst.mockResolvedValue(null as never);
      await expect(
        service.forwardMessage('c1', 'm1', 'u1', 't1', { targetChannelId: 'c2' }),
      ).rejects.toMatchObject({ code: ChatErrorCode.MESSAGE_NOT_FOUND });
    });

    it('throws NOT_CHANNEL_MEMBER when sender is not in target channel', async () => {
      prisma.chatMessage.findFirst.mockResolvedValue(baseMessage() as never);
      prisma.chatChannelMember.findUnique.mockResolvedValue(null as never);
      await expect(
        service.forwardMessage('c1', 'm1', 'u1', 't1', { targetChannelId: 'c2' }),
      ).rejects.toMatchObject({ code: ChatErrorCode.NOT_CHANNEL_MEMBER });
    });

    it('throws CHANNEL_FROZEN when target channel is frozen for non-operators', async () => {
      prisma.chatMessage.findFirst.mockResolvedValue(baseMessage() as never);
      prisma.chatChannelMember.findUnique.mockResolvedValue({
        leftAt: null,
        isBanned: false,
        isMuted: false,
        role: 'MEMBER',
      } as never);
      prisma.chatChannel.findUnique.mockResolvedValue({
        id: 'c2',
        isFrozen: true,
      } as never);

      await expect(
        service.forwardMessage('c1', 'm1', 'u1', 't1', { targetChannelId: 'c2' }),
      ).rejects.toMatchObject({ code: ChatErrorCode.CHANNEL_FROZEN });
    });

    it('creates a forwarded message in the target channel with isForwarded=true', async () => {
      prisma.chatMessage.findFirst.mockResolvedValue(baseMessage({ id: 'orig' }) as never);
      prisma.chatChannelMember.findUnique.mockResolvedValue({
        leftAt: null,
        isBanned: false,
        isMuted: false,
        role: 'MEMBER',
      } as never);
      prisma.chatChannel.findUnique.mockResolvedValue({
        id: 'c2',
        isFrozen: false,
      } as never);
      prisma.chatMessage.create.mockResolvedValue(
        baseMessage({
          id: 'fwd',
          channelId: 'c2',
          isForwarded: true,
          forwardedFromId: 'orig',
        }) as never,
      );
      prisma.chatChannel.update.mockResolvedValue({} as never);

      const result = await service.forwardMessage('c1', 'orig', 'u1', 't1', {
        targetChannelId: 'c2',
      });

      const arg = prisma.chatMessage.create.mock.calls[0][0];
      expect(arg.data.isForwarded).toBe(true);
      expect(arg.data.forwardedFromId).toBe('orig');
      expect(arg.data.channelId).toBe('c2');
      expect(events.notifyMessageSent).toHaveBeenCalledWith('c2', expect.any(Object), 't1');
      expect(result.id).toBe('fwd');
    });
  });

  describe('reactions', () => {
    it('addReaction upserts the row and re-emits the grouped reactions list', async () => {
      prisma.chatReaction.upsert.mockResolvedValue({} as never);
      prisma.chatReaction.findMany.mockResolvedValue([
        { key: '👍', userId: 'u1' },
        { key: '👍', userId: 'u2' },
        { key: '❤️', userId: 'u3' },
      ] as never);

      await service.addReaction('c1', 'm1', 'u1', { key: '👍' });

      expect(prisma.chatReaction.upsert).toHaveBeenCalledWith({
        where: { messageId_userId_key: { messageId: 'm1', userId: 'u1', key: '👍' } },
        create: { messageId: 'm1', userId: 'u1', key: '👍' },
        update: {},
      });
      expect(events.emitToChannel).toHaveBeenCalledWith(
        'c1',
        ChatSocketEvent.REACTION_UPDATED,
        expect.objectContaining({
          reactions: expect.arrayContaining([
            expect.objectContaining({ key: '👍', count: 2, userIds: ['u1', 'u2'] }),
          ]),
        }),
      );
    });

    it('removeReaction deletes only the matching row and re-emits', async () => {
      prisma.chatReaction.deleteMany.mockResolvedValue({ count: 1 } as never);
      prisma.chatReaction.findMany.mockResolvedValue([] as never);

      await service.removeReaction('c1', 'm1', 'u1', '👍');

      expect(prisma.chatReaction.deleteMany).toHaveBeenCalledWith({
        where: { messageId: 'm1', userId: 'u1', key: '👍' },
      });
      expect(events.emitToChannel).toHaveBeenCalledWith(
        'c1',
        ChatSocketEvent.REACTION_UPDATED,
        expect.any(Object),
      );
    });
  });

  describe('searchMessages', () => {
    it('filters by tenant and keyword, optionally by channel and date range', async () => {
      prisma.chatMessage.findMany.mockResolvedValue([baseMessage()] as never);

      await service.searchMessages('t1', 'u1', {
        keyword: 'hello',
        channelId: 'c1',
        timestampFrom: '2026-01-01T00:00:00Z',
        timestampTo: '2026-02-01T00:00:00Z',
        limit: 10,
      });

      const arg = prisma.chatMessage.findMany.mock.calls[0][0];
      expect(arg.where.tenantId).toBe('t1');
      expect(arg.where.channelId).toBe('c1');
      expect(arg.where.text.contains).toBe('hello');
      expect(arg.where.createdAt.gte).toBeInstanceOf(Date);
      expect(arg.where.createdAt.lte).toBeInstanceOf(Date);
      expect(arg.take).toBe(10);
    });
  });
});

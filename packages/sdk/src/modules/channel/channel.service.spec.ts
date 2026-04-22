import { Test } from '@nestjs/testing';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';
import { ChannelService } from './channel.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import { ChatEventService } from '../gateway/chat-event.service';
import { CHAT_USER_RESOLVER } from '../../core/tokens/injection-tokens';
import { ChatSocketEvent } from '../../core/types/chat-socket.types';
import { ChatException } from '../../common/exceptions';
import { ChatErrorCode } from '../../common/exceptions/chat-error-codes';
import { CHAT_DEFAULTS } from '../../core/constants';
import {
  createMockEmitter,
  createMockLogger,
  createMockPrisma,
  createMockUserResolver,
  MockPrisma,
} from '../../common/testing/mocks';

describe('ChannelService', () => {
  let service: ChannelService;
  let prisma: MockPrisma;
  let events: ReturnType<typeof createMockEmitter>;
  let userResolver: ReturnType<typeof createMockUserResolver>;
  let logger: ReturnType<typeof createMockLogger>;

  beforeEach(async () => {
    prisma = createMockPrisma();
    events = createMockEmitter();
    userResolver = createMockUserResolver();
    logger = createMockLogger();

    const moduleRef = await Test.createTestingModule({
      providers: [
        ChannelService,
        { provide: PrismaService, useValue: prisma },
        { provide: ChatEventService, useValue: events },
        { provide: CHAT_USER_RESOLVER, useValue: userResolver },
        { provide: WINSTON_MODULE_PROVIDER, useValue: logger },
      ],
    }).compile();

    service = moduleRef.get(ChannelService);
  });

  describe('getChannel', () => {
    it('throws CHANNEL_NOT_FOUND when the channel does not exist', async () => {
      prisma.chatChannel.findUnique.mockResolvedValue(null as never);
      await expect(service.getChannel('c1', 'u1')).rejects.toMatchObject({
        code: ChatErrorCode.CHANNEL_NOT_FOUND,
      });
    });

    it('returns an enriched channel when found', async () => {
      prisma.chatChannel.findUnique.mockResolvedValue({
        id: 'c1',
        tenantId: 't1',
        type: 'GROUP',
        members: [{ userId: 'u1' }, { userId: 'u2' }],
        pinnedMessages: [],
      } as never);

      const result = await service.getChannel('c1', 'u1');
      expect(result).toMatchObject({ id: 'c1' });
    });
  });

  describe('createDirectChannel', () => {
    const dto = { userId: 'u2' };

    it('throws USER_NOT_FOUND when the target user cannot be resolved', async () => {
      userResolver.getUser.mockResolvedValue(null);
      await expect(service.createDirectChannel('u1', 't1', dto)).rejects.toMatchObject({
        code: ChatErrorCode.USER_NOT_FOUND,
      });
    });

    it('returns the existing channel when one already exists for the pair', async () => {
      userResolver.getUser.mockResolvedValue({ id: 'u2' } as never);
      prisma.chatChannel.findUnique.mockResolvedValue({
        id: 'existing',
        deletedAt: null,
        members: [{ userId: 'u1' }, { userId: 'u2' }],
      } as never);

      const result = await service.createDirectChannel('u1', 't1', dto);

      expect(result.id).toBe('existing');
      expect(prisma.chatChannel.create).not.toHaveBeenCalled();
    });

    it('creates a new DIRECT channel with both users as OPERATOR', async () => {
      userResolver.getUser.mockResolvedValue({ id: 'u2' } as never);
      prisma.chatChannel.findUnique.mockResolvedValue(null as never);
      prisma.chatChannel.create.mockResolvedValue({
        id: 'c_new',
        type: 'DIRECT',
        members: [],
      } as never);

      const result = await service.createDirectChannel('u1', 't1', dto);

      expect(prisma.chatChannel.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            type: 'DIRECT',
            tenantId: 't1',
            memberCount: 2,
            members: expect.objectContaining({
              create: expect.arrayContaining([
                expect.objectContaining({ userId: 'u1', role: 'OPERATOR' }),
                expect.objectContaining({ userId: 'u2', role: 'OPERATOR' }),
              ]),
            }),
          }),
        }),
      );
      expect(events.notifyChannelCreated).toHaveBeenCalled();
      expect(result.id).toBe('c_new');
    });

    it('recovers from P2002 races by returning the winner channel', async () => {
      userResolver.getUser.mockResolvedValue({ id: 'u2' } as never);
      prisma.chatChannel.findUnique
        .mockResolvedValueOnce(null as never)
        .mockResolvedValueOnce({ id: 'c_winner', members: [] } as never);
      const p2002 = Object.assign(new Error('unique'), { code: 'P2002' });
      prisma.chatChannel.create.mockRejectedValue(p2002);

      const result = await service.createDirectChannel('u1', 't1', dto);
      expect(result.id).toBe('c_winner');
    });
  });

  describe('createGroupChannel', () => {
    it('enforces the channel member limit', async () => {
      const tooMany = Array.from({ length: CHAT_DEFAULTS.MAX_CHANNEL_MEMBERS }, (_, i) => `u${i}`);

      await expect(
        service.createGroupChannel('creator', 't1', {
          name: 'big',
          userIds: tooMany,
        }),
      ).rejects.toMatchObject({ code: ChatErrorCode.CHANNEL_MEMBER_LIMIT });
    });

    it('throws USER_NOT_FOUND when a member cannot be resolved', async () => {
      userResolver.getUsers.mockResolvedValue([{ id: 'creator' }] as never);

      await expect(
        service.createGroupChannel('creator', 't1', {
          name: 'g',
          userIds: ['u2', 'u3'],
        }),
      ).rejects.toMatchObject({ code: ChatErrorCode.USER_NOT_FOUND });
    });

    it('creates the channel with creator as OPERATOR and others as MEMBER', async () => {
      userResolver.getUsers.mockResolvedValue([
        { id: 'creator' },
        { id: 'u2' },
        { id: 'u3' },
      ] as never);
      prisma.chatChannel.create.mockResolvedValue({
        id: 'g1',
        type: 'GROUP',
        members: [],
      } as never);

      await service.createGroupChannel('creator', 't1', {
        name: 'team',
        userIds: ['u2', 'u3'],
      });

      const arg = prisma.chatChannel.create.mock.calls[0][0];
      const created = arg.data.members.create;
      const creatorMember = created.find((m: { userId: string }) => m.userId === 'creator');
      const otherMember = created.find((m: { userId: string }) => m.userId === 'u2');
      expect(creatorMember.role).toBe('OPERATOR');
      expect(otherMember.role).toBe('MEMBER');
      expect(arg.data.memberCount).toBe(3);
      expect(events.notifyChannelCreated).toHaveBeenCalled();
    });
  });

  describe('updateChannel', () => {
    it('emits CHANNEL_CHANGED after update', async () => {
      prisma.chatChannel.update.mockResolvedValue({ id: 'c1', name: 'new' } as never);
      await service.updateChannel('c1', { name: 'new' });
      expect(events.emitToChannel).toHaveBeenCalledWith(
        'c1',
        ChatSocketEvent.CHANNEL_CHANGED,
        expect.any(Object),
      );
    });
  });

  describe('leaveChannel', () => {
    it('marks the member as left, decrements count, and emits USER_LEFT', async () => {
      prisma.chatChannelMember.update.mockResolvedValue({} as never);
      prisma.chatChannel.update.mockResolvedValue({ memberCount: 2 } as never);
      prisma.chatChannel.findUnique.mockResolvedValue({ memberCount: 2 } as never);

      await service.leaveChannel('c1', 'u1');

      expect(prisma.chatChannelMember.update).toHaveBeenCalledWith({
        where: { channelId_userId: { channelId: 'c1', userId: 'u1' } },
        data: { leftAt: expect.any(Date) },
      });
      expect(prisma.chatChannel.update).toHaveBeenCalledWith({
        where: { id: 'c1' },
        data: { memberCount: { decrement: 1 } },
      });
      expect(events.emitToChannel).toHaveBeenCalledWith(
        'c1',
        ChatSocketEvent.USER_LEFT,
        expect.any(Object),
      );
    });
  });

  describe('inviteUsers', () => {
    it('enforces the member limit', async () => {
      prisma.chatChannel.findUnique.mockResolvedValue({
        memberCount: CHAT_DEFAULTS.MAX_CHANNEL_MEMBERS - 1,
      } as never);
      await expect(
        service.inviteUsers('c1', 't1', { userIds: ['u2', 'u3'] }),
      ).rejects.toMatchObject({ code: ChatErrorCode.CHANNEL_MEMBER_LIMIT });
    });

    it('upserts members and emits USER_JOINED for each', async () => {
      prisma.chatChannel.findUnique.mockResolvedValue({ memberCount: 1 } as never);
      prisma.chatChannelMember.upsert.mockResolvedValue({} as never);
      prisma.chatChannel.update.mockResolvedValue({ memberCount: 3 } as never);

      await service.inviteUsers('c1', 't1', { userIds: ['u2', 'u3'] });

      expect(prisma.chatChannelMember.upsert).toHaveBeenCalledTimes(2);
      expect(events.emitToChannel).toHaveBeenCalledWith(
        'c1',
        ChatSocketEvent.USER_JOINED,
        expect.objectContaining({ userId: 'u2' }),
      );
      expect(events.emitToChannel).toHaveBeenCalledWith(
        'c1',
        ChatSocketEvent.USER_JOINED,
        expect.objectContaining({ userId: 'u3' }),
      );
    });
  });

  describe('moderation', () => {
    it('freezeChannel sets isFrozen and emits CHANNEL_FROZEN', async () => {
      prisma.chatChannel.update.mockResolvedValue({} as never);
      await service.freezeChannel('c1');
      expect(prisma.chatChannel.update).toHaveBeenCalledWith({
        where: { id: 'c1' },
        data: { isFrozen: true },
      });
      expect(events.emitToChannel).toHaveBeenCalledWith(
        'c1',
        ChatSocketEvent.CHANNEL_FROZEN,
        expect.any(Object),
      );
    });

    it('unfreezeChannel clears isFrozen and emits CHANNEL_UNFROZEN', async () => {
      prisma.chatChannel.update.mockResolvedValue({} as never);
      await service.unfreezeChannel('c1');
      expect(prisma.chatChannel.update).toHaveBeenCalledWith({
        where: { id: 'c1' },
        data: { isFrozen: false },
      });
      expect(events.emitToChannel).toHaveBeenCalledWith(
        'c1',
        ChatSocketEvent.CHANNEL_UNFROZEN,
        expect.any(Object),
      );
    });

    it('muteUser uses the DTO duration to compute mutedUntil', async () => {
      prisma.chatChannelMember.findUnique.mockResolvedValue({
        userId: 'target',
        leftAt: null,
        isBanned: false,
      } as never);
      prisma.chatChannelMember.update.mockResolvedValue({} as never);

      await service.muteUser('c1', 'target', { seconds: 300 });

      const call = prisma.chatChannelMember.update.mock.calls[0][0];
      expect(call.data.isMuted).toBe(true);
      expect(call.data.mutedUntil).toBeInstanceOf(Date);
    });

    it('muteUser without duration sets mutedUntil to null (indefinite)', async () => {
      prisma.chatChannelMember.findUnique.mockResolvedValue({
        userId: 'target',
        leftAt: null,
        isBanned: false,
      } as never);
      prisma.chatChannelMember.update.mockResolvedValue({} as never);

      await service.muteUser('c1', 'target', {});

      const call = prisma.chatChannelMember.update.mock.calls[0][0];
      expect(call.data.mutedUntil).toBeNull();
    });

    it('muteChannel emits CHANNEL_MUTED to the user only', async () => {
      prisma.chatChannelMember.update.mockResolvedValue({} as never);
      await service.muteChannel('c1', 'u1');
      expect(events.emitToUser).toHaveBeenCalledWith(
        'u1',
        ChatSocketEvent.CHANNEL_MUTED,
        expect.any(Object),
      );
    });
  });

  describe('pinning', () => {
    it('throws CHANNEL_PIN_LIMIT when the max number of pins is reached', async () => {
      prisma.chatPinnedMessage.count.mockResolvedValue(CHAT_DEFAULTS.MAX_PINNED_MESSAGES as never);

      await expect(service.pinMessage('c1', 'm1', 'u1')).rejects.toMatchObject({
        code: ChatErrorCode.CHANNEL_PIN_LIMIT,
      });
      expect(prisma.chatPinnedMessage.create).not.toHaveBeenCalled();
    });

    it('pins the message and emits PINNED_MESSAGE_UPDATED with the new list', async () => {
      prisma.chatPinnedMessage.count.mockResolvedValue(1 as never);
      prisma.chatPinnedMessage.create.mockResolvedValue({} as never);
      prisma.chatPinnedMessage.findMany.mockResolvedValue([
        { messageId: 'm1' },
        { messageId: 'm0' },
      ] as never);

      await service.pinMessage('c1', 'm1', 'u1');

      expect(prisma.chatPinnedMessage.create).toHaveBeenCalledWith({
        data: { channelId: 'c1', messageId: 'm1', pinnedById: 'u1' },
      });
      expect(events.emitToChannel).toHaveBeenCalledWith(
        'c1',
        ChatSocketEvent.PINNED_MESSAGE_UPDATED,
        { channelId: 'c1', pinnedMessageIds: ['m1', 'm0'] },
      );
    });

    it('unpinMessage deletes the pin row and re-emits the updated list', async () => {
      prisma.chatPinnedMessage.delete.mockResolvedValue({} as never);
      prisma.chatPinnedMessage.findMany.mockResolvedValue([] as never);

      await service.unpinMessage('c1', 'm1');

      expect(prisma.chatPinnedMessage.delete).toHaveBeenCalledWith({
        where: { channelId_messageId: { channelId: 'c1', messageId: 'm1' } },
      });
      expect(events.emitToChannel).toHaveBeenCalledWith(
        'c1',
        ChatSocketEvent.PINNED_MESSAGE_UPDATED,
        { channelId: 'c1', pinnedMessageIds: [] },
      );
    });

    it('getPinnedMessageIds returns the list of pinned messageIds newest-first', async () => {
      prisma.chatPinnedMessage.findMany.mockResolvedValue([
        { messageId: 'm2' },
        { messageId: 'm1' },
      ] as never);
      await expect(service.getPinnedMessageIds('c1')).resolves.toEqual(['m2', 'm1']);
    });
  });

  describe('metadata', () => {
    it('getMetadata returns an empty object when the channel has no metadata', async () => {
      prisma.chatChannel.findUnique.mockResolvedValue({ metadata: null } as never);
      await expect(service.getMetadata('c1')).resolves.toEqual({});
    });

    it('setMetadata merges with existing values and emits METADATA_CHANGED', async () => {
      prisma.chatChannel.findUnique.mockResolvedValue({
        metadata: { foo: '1' },
      } as never);
      prisma.chatChannel.update.mockResolvedValue({} as never);

      const result = await service.setMetadata('c1', { bar: '2' });

      expect(result).toEqual({ foo: '1', bar: '2' });
      expect(events.emitToChannel).toHaveBeenCalledWith(
        'c1',
        ChatSocketEvent.METADATA_CHANGED,
        expect.objectContaining({ metadata: { foo: '1', bar: '2' } }),
      );
    });

    it('deleteMetadataKey removes one key and keeps the rest', async () => {
      prisma.chatChannel.findUnique.mockResolvedValue({
        metadata: { foo: '1', bar: '2' },
      } as never);
      prisma.chatChannel.update.mockResolvedValue({} as never);

      await service.deleteMetadataKey('c1', 'foo');

      const arg = prisma.chatChannel.update.mock.calls[0][0];
      expect(arg.data.metadata).toEqual({ bar: '2' });
    });
  });

  describe('preferences', () => {
    it('getPushTrigger returns "all" when member has no explicit setting', async () => {
      prisma.chatChannelMember.findUnique.mockResolvedValue({ pushTrigger: null } as never);
      await expect(service.getPushTrigger('c1', 'u1')).resolves.toBe('all');
    });

    it('getCountPreference lowercases the stored enum value', async () => {
      prisma.chatChannelMember.findUnique.mockResolvedValue({
        countPreference: 'UNREAD_MESSAGE_COUNT_ONLY',
      } as never);
      await expect(service.getCountPreference('c1', 'u1')).resolves.toBe(
        'unread_message_count_only',
      );
    });

    it('setCountPreference maps DTO keys to the right Prisma enum values', async () => {
      prisma.chatChannelMember.update.mockResolvedValue({} as never);
      await service.setCountPreference('c1', 'u1', { preference: 'off' });
      const call = prisma.chatChannelMember.update.mock.calls[0][0];
      expect(call.data.countPreference).toBe('OFF');
    });
  });

  describe('error wrapping', () => {
    it('wraps unexpected Prisma errors in ChatException (leaveChannel)', async () => {
      prisma.chatChannelMember.update.mockRejectedValue(new Error('db'));
      await expect(service.leaveChannel('c1', 'u1')).rejects.toBeInstanceOf(ChatException);
    });

    it('wraps unexpected Prisma errors in ChatException (pinMessage)', async () => {
      prisma.chatPinnedMessage.count.mockRejectedValue(new Error('db'));
      await expect(service.pinMessage('c1', 'm1', 'u1')).rejects.toBeInstanceOf(ChatException);
    });
  });
});

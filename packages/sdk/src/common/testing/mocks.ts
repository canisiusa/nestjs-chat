/* istanbul ignore file */
/// <reference types="jest" />
import type { Logger } from 'winston';
import type { IChatUserResolver } from '../../core/interfaces/chat-user-resolver.interface';
import type { IChatEventHandler } from '../../core/interfaces/chat-event-handler.interface';
import type { IChatStorageProvider } from '../../core/interfaces/chat-storage-provider.interface';

type ModelMock = {
  findUnique: jest.Mock;
  findFirst: jest.Mock;
  findMany: jest.Mock;
  create: jest.Mock;
  createMany: jest.Mock;
  update: jest.Mock;
  updateMany: jest.Mock;
  upsert: jest.Mock;
  delete: jest.Mock;
  deleteMany: jest.Mock;
  count: jest.Mock;
  aggregate: jest.Mock;
  groupBy: jest.Mock;
};

const CHAT_MODELS = [
  'chatChannel',
  'chatChannelMember',
  'chatMessage',
  'chatReaction',
  'chatPinnedMessage',
  'chatScheduledMessage',
  'chatPoll',
  'chatPollOption',
  'chatPollVote',
  'chatCall',
  'chatCallParticipant',
  'chatUserBlock',
  'chatReport',
] as const;

type ChatModelName = (typeof CHAT_MODELS)[number];

export type MockPrisma = Record<ChatModelName, ModelMock> & {
  $transaction: jest.Mock;
  $connect: jest.Mock;
  $disconnect: jest.Mock;
};

function modelMock(): ModelMock {
  return {
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    createMany: jest.fn(),
    update: jest.fn(),
    updateMany: jest.fn(),
    upsert: jest.fn(),
    delete: jest.fn(),
    deleteMany: jest.fn(),
    count: jest.fn(),
    aggregate: jest.fn(),
    groupBy: jest.fn(),
  };
}

export function createMockPrisma(): MockPrisma {
  const base = {
    $connect: jest.fn(),
    $disconnect: jest.fn(),
    $transaction: jest.fn((arg) => (typeof arg === 'function' ? arg(base) : Promise.all(arg))),
  } as unknown as MockPrisma;

  for (const name of CHAT_MODELS) {
    (base as Record<string, unknown>)[name] = modelMock();
  }

  return base;
}

export function createMockLogger(): jest.Mocked<Logger> {
  return {
    error: jest.fn(),
    warn: jest.fn(),
    info: jest.fn(),
    debug: jest.fn(),
    verbose: jest.fn(),
    log: jest.fn(),
    child: jest.fn().mockReturnThis(),
  } as unknown as jest.Mocked<Logger>;
}

export function createMockUserResolver(): jest.Mocked<IChatUserResolver> {
  return {
    getUser: jest.fn(),
    getUsers: jest.fn(),
    searchUsers: jest.fn(),
    isOnline: jest.fn(),
  } as unknown as jest.Mocked<IChatUserResolver>;
}

export function createMockEventHandler(): jest.Mocked<IChatEventHandler> {
  return {
    onMessageSent: jest.fn(),
    onChannelCreated: jest.fn(),
    onUserMentioned: jest.fn(),
    onUnreadCountChanged: jest.fn(),
  } as unknown as jest.Mocked<IChatEventHandler>;
}

export function createMockStorageProvider(): jest.Mocked<IChatStorageProvider> {
  return {
    upload: jest.fn(),
    delete: jest.fn(),
    getSignedUrl: jest.fn(),
  } as unknown as jest.Mocked<IChatStorageProvider>;
}

export function createMockEmitter() {
  return {
    emitToChannel: jest.fn(),
    emitToUser: jest.fn(),
    emitToTenant: jest.fn(),
    broadcast: jest.fn(),
  };
}

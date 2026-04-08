import { Type } from '@nestjs/common';
import { IChatAuthGuard, IChatUserExtractor } from './core/interfaces/chat-auth.interface';
import { IChatUserResolver } from './core/interfaces/chat-user-resolver.interface';
import { IChatStorageProvider } from './core/interfaces/chat-storage-provider.interface';
import { IChatEventHandler } from './core/interfaces/chat-event-handler.interface';

export interface ChatModuleOptions {
  database: {
    url: string;
  };
  redis: {
    url: string;
  };
  storage?: {
    maxFileSize?: number;
    allowedMimeTypes?: string[];
  };
  limits?: {
    maxChannelMembers?: number;
    maxPinnedMessages?: number;
    maxMessageLength?: number;
    maxPollOptions?: number;
  };
  logging?: {
    level?: 'debug' | 'info' | 'warn' | 'error';
    directory?: string;
  };
}

export interface ChatModuleProviders {
  authGuard: Type<IChatAuthGuard>;
  userExtractor: Type<IChatUserExtractor>;
  userResolver: Type<IChatUserResolver>;
  storageProvider?: Type<IChatStorageProvider>;
  eventHandler?: Type<IChatEventHandler>;
}

export interface ChatModuleAsyncOptions {
  imports?: any[];
  useFactory: (...args: any[]) => ChatModuleOptions | Promise<ChatModuleOptions>;
  inject?: any[];
  providers: ChatModuleProviders;
  logging?: {
    level?: 'debug' | 'info' | 'warn' | 'error';
    directory?: string;
  };
}

import { DynamicModule, Module } from '@nestjs/common';
import { PrismaModule } from './common/prisma/prisma.module';
import { LoggerModule } from './common/logger';
import {
  ChatModuleOptions,
  ChatModuleAsyncOptions,
  ChatModuleProviders,
} from './chat-module-options';
import {
  CHAT_MODULE_OPTIONS,
  CHAT_AUTH_GUARD,
  CHAT_USER_EXTRACTOR,
  CHAT_USER_RESOLVER,
  CHAT_STORAGE_PROVIDER,
  CHAT_EVENT_HANDLER,
} from './core/tokens/injection-tokens';
import { ChannelModule } from './modules/channel';
import { MessageModule } from './modules/message';
import { PollModule } from './modules/poll';
import { ChatUserModule } from './modules/user';
import { ScheduledMessageModule } from './modules/scheduled';
import { ChatGatewayModule } from './modules/gateway';

const FEATURE_MODULES = [
  ChannelModule,
  MessageModule,
  PollModule,
  ChatUserModule,
  ScheduledMessageModule,
  ChatGatewayModule,
];

function buildProviders(chatProviders: ChatModuleProviders) {
  return [
    { provide: CHAT_AUTH_GUARD, useClass: chatProviders.authGuard },
    { provide: CHAT_USER_EXTRACTOR, useClass: chatProviders.userExtractor },
    { provide: CHAT_USER_RESOLVER, useClass: chatProviders.userResolver },
    ...(chatProviders.storageProvider
      ? [{ provide: CHAT_STORAGE_PROVIDER, useClass: chatProviders.storageProvider }]
      : []),
    ...(chatProviders.eventHandler
      ? [{ provide: CHAT_EVENT_HANDLER, useClass: chatProviders.eventHandler }]
      : []),
  ];
}

@Module({})
export class ChatModule {
  static forRoot(options: ChatModuleOptions & { providers: ChatModuleProviders }): DynamicModule {
    const { providers: chatProviders, ...config } = options;

    return {
      module: ChatModule,
      global: true,
      imports: [PrismaModule, LoggerModule.register(config.logging), ...FEATURE_MODULES],
      providers: [
        { provide: CHAT_MODULE_OPTIONS, useValue: config },
        ...buildProviders(chatProviders),
      ],
      exports: [
        CHAT_AUTH_GUARD,
        CHAT_USER_EXTRACTOR,
        CHAT_USER_RESOLVER,
        CHAT_MODULE_OPTIONS,
        ...FEATURE_MODULES,
      ],
    };
  }

  static forRootAsync(options: ChatModuleAsyncOptions): DynamicModule {
    return {
      module: ChatModule,
      global: true,
      imports: [
        ...(options.imports || []),
        PrismaModule,
        LoggerModule.register(options.logging),

        ...FEATURE_MODULES,
      ],
      providers: [
        {
          provide: CHAT_MODULE_OPTIONS,
          useFactory: options.useFactory,
          inject: options.inject || [],
        },
        ...buildProviders(options.providers),
      ],
      exports: [
        CHAT_AUTH_GUARD,
        CHAT_USER_EXTRACTOR,
        CHAT_USER_RESOLVER,
        CHAT_MODULE_OPTIONS,
        ...FEATURE_MODULES,
      ],
    };
  }
}

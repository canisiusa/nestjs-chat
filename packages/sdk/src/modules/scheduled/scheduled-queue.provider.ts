import { Provider } from '@nestjs/common';
import { Queue } from 'bullmq';
import { CHAT_MODULE_OPTIONS } from '../../core/tokens/injection-tokens';
import { CHAT_QUEUE_NAME } from '../../core/constants';
import { ChatModuleOptions } from '../../chat-module-options';

export const CHAT_QUEUE_TOKEN = Symbol('CHAT_QUEUE_TOKEN');

/**
 * Provides a BullMQ Queue instance using bullmq directly.
 *
 * We intentionally avoid @nestjs/bullmq (BullModule.forRoot / registerQueue)
 * because this SDK is imported as a library into host applications that may
 * already have their own BullModule.forRoot(). Two forRoot() calls in the
 * same NestJS app cause a BullExplorer dependency resolution conflict.
 *
 * Instead, we create the Queue manually with the Redis URL from ChatModuleOptions.
 * The host only needs to provide redis.url — no BullMQ setup required.
 */
export const CHAT_SCHEDULED_QUEUE: Provider = {
  provide: CHAT_QUEUE_TOKEN,
  inject: [CHAT_MODULE_OPTIONS],
  useFactory: (options: ChatModuleOptions) => {
    return new Queue(CHAT_QUEUE_NAME, {
      connection: { url: options.redis.url },
      prefix: 'chat:bull',
    });
  },
};

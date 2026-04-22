// Module
export { ChatModule } from './chat.module';
export {
  ChatModuleOptions,
  ChatModuleProviders,
  ChatModuleAsyncOptions,
} from './chat-module-options';

// Interfaces (for host app to implement)
export {
  IChatAuthGuard,
  IChatUserExtractor,
  ChatAuthUser,
} from './core/interfaces/chat-auth.interface';
export { IChatUserResolver } from './core/interfaces/chat-user-resolver.interface';
export {
  IChatStorageProvider,
  ChatUploadOptions,
  ChatUploadResult,
} from './core/interfaces/chat-storage-provider.interface';
export { IChatEventHandler } from './core/interfaces/chat-event-handler.interface';

// Types
export { ChatUser } from './core/types/chat-user.types';
export * from './core/types/chat-socket.types';
export * from './core/constants';

// Decorator
export { CurrentChatUser } from './common/decorators/current-chat-user.decorator';

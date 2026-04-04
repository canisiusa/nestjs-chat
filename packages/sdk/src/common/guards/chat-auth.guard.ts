import { CanActivate, ExecutionContext, Inject, Injectable } from '@nestjs/common';
import { CHAT_AUTH_GUARD, CHAT_USER_EXTRACTOR } from '../../core/tokens/injection-tokens';
import { IChatAuthGuard, IChatUserExtractor } from '../../core/interfaces/chat-auth.interface';
import { ChatException, ChatErrorCode } from '../exceptions';

@Injectable()
export class ChatAuthGuard implements CanActivate {
  constructor(
    @Inject(CHAT_AUTH_GUARD) private readonly authGuard: IChatAuthGuard,
    @Inject(CHAT_USER_EXTRACTOR) private readonly userExtractor: IChatUserExtractor,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const allowed = await this.authGuard.canActivate(context);
    if (!allowed) {
      throw new ChatException(ChatErrorCode.AUTH_FAILED, 'Authentication failed');
    }

    const request = context.switchToHttp().getRequest();
    const user = this.userExtractor.extractUser(request);
    if (!user) {
      throw new ChatException(
        ChatErrorCode.AUTH_TOKEN_INVALID,
        'Could not extract user from request',
      );
    }

    request.chatUser = user;
    return true;
  }
}

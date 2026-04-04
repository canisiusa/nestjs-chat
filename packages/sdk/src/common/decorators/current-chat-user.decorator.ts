import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { ChatAuthUser } from '../../core/interfaces/chat-auth.interface';

export const CurrentChatUser = createParamDecorator(
  (data: keyof ChatAuthUser | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    const user: ChatAuthUser = request.chatUser;
    return data ? user?.[data] : user;
  },
);

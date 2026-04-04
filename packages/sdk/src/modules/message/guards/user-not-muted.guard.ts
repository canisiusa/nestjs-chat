import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { ChatException } from '../../../common/exceptions';

@Injectable()
export class UserNotMutedGuard implements CanActivate {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const member = request.channelMember;

    if (!member) throw ChatException.notChannelMember();

    if (member.isMuted) {
      if (member.mutedUntil && new Date(member.mutedUntil) < new Date()) {
        return true;
      }
      throw ChatException.userMuted();
    }

    return true;
  }
}

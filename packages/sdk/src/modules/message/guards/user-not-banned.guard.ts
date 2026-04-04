import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { ChatException } from '../../../common/exceptions';

@Injectable()
export class UserNotBannedGuard implements CanActivate {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const member = request.channelMember;

    if (!member) throw ChatException.notChannelMember();

    if (member.isBanned) {
      if (member.bannedUntil && new Date(member.bannedUntil) < new Date()) {
        return true;
      }
      throw ChatException.userBanned();
    }

    return true;
  }
}

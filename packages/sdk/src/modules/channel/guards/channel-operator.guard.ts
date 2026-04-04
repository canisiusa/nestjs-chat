import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { ChatMemberRole } from 'src/generated/prisma/client';
import { ChatException } from '../../../common/exceptions';

@Injectable()
export class ChannelOperatorGuard implements CanActivate {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const member = request.channelMember;

    if (!member || member.role !== ChatMemberRole.OPERATOR) {
      throw ChatException.notChannelOperator();
    }

    return true;
  }
}

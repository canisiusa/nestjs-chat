import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { ChatMemberRole } from 'src/generated/prisma/client';
import { ChatException } from '../../../common/exceptions';

@Injectable()
export class ChannelNotFrozenGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const channelId = request.params.id || request.params.channelId;
    const member = request.channelMember;

    if (member?.role === ChatMemberRole.OPERATOR) return true;

    const channel = await this.prisma.chatChannel.findUnique({
      where: { id: channelId },
      select: { isFrozen: true },
    });

    if (channel?.isFrozen) {
      throw ChatException.channelFrozen();
    }

    return true;
  }
}

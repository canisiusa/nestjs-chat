import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { ChatAuthUser } from '../../../core/interfaces/chat-auth.interface';
import { ChatException } from '../../../common/exceptions';

@Injectable()
export class ChannelMemberGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const user: ChatAuthUser = request.chatUser;
    const channelId = request.params.id || request.params.channelId;

    if (!user || !channelId) throw ChatException.notChannelMember();

    const member = await this.prisma.chatChannelMember.findUnique({
      where: { channelId_userId: { channelId, userId: user.id } },
    });

    if (!member || member.leftAt) throw ChatException.notChannelMember();
    if (member.isBanned) throw ChatException.userBanned();

    request.channelMember = member;
    return true;
  }
}

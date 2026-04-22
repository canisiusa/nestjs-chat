import { Injectable } from '@nestjs/common';
import { IChatUserResolver, ChatUser } from 'nestjs-chat';
import { PrismaService } from '../prisma.service';

@Injectable()
export class ExampleUserResolver implements IChatUserResolver {
  constructor(private readonly prisma: PrismaService) {}

  async getUser(userId: string, tenantId?: string): Promise<ChatUser | null> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) return null;
    if (tenantId && user.organizationId !== tenantId) return null;
    return this.mapUser(user);
  }

  async getUsers(userIds: string[]): Promise<ChatUser[]> {
    const users = await this.prisma.user.findMany({
      where: { id: { in: userIds } },
    });
    return users.map(this.mapUser);
  }

  async searchUsers(keyword: string, tenantId: string, limit = 20): Promise<ChatUser[]> {
    const users = await this.prisma.user.findMany({
      where: {
        organizationId: tenantId,
        OR: [
          { name: { contains: keyword, mode: 'insensitive' } },
          { email: { contains: keyword, mode: 'insensitive' } },
        ],
      },
      take: limit,
    });
    return users.map(this.mapUser);
  }

  private mapUser(user: { id: string; name: string; avatar: string | null }): ChatUser {
    return {
      id: user.id,
      nickname: user.name,
      profileUrl: user.avatar ?? undefined,
    };
  }
}

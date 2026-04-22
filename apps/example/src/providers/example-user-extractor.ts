import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { IChatUserExtractor, ChatAuthUser } from 'nestjs-chat';

@Injectable()
export class ExampleUserExtractor implements IChatUserExtractor {
  constructor(private readonly jwtService: JwtService) {}

  extractUser(request: any): ChatAuthUser | null {
    // From verified JWT (set by ExampleAuthGuard on HTTP requests)
    if (request.jwtPayload) {
      return this.fromPayload(request.jwtPayload);
    }

    // Verify Bearer token directly (used by socket connections where no guard runs)
    const auth = request.headers?.authorization;
    if (typeof auth === 'string' && auth.startsWith('Bearer ')) {
      try {
        const payload = this.jwtService.verify(auth.slice(7));
        return this.fromPayload(payload);
      } catch {
        return null;
      }
    }

    return null;
  }

  private fromPayload(p: any): ChatAuthUser {
    return {
      id: p.sub,
      tenantId: p.organizationId || 'default',
      email: p.email,
      name: p.name,
    };
  }
}

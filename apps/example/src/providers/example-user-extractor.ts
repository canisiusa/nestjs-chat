import { Injectable } from '@nestjs/common';
import { IChatUserExtractor, ChatAuthUser } from '@chat-service/sdk';

@Injectable()
export class ExampleUserExtractor implements IChatUserExtractor {
  extractUser(request: any): ChatAuthUser | null {
    // From verified JWT
    if (request.jwtPayload) {
      const p = request.jwtPayload;
      return {
        id: p.sub,
        tenantId: p.organizationId || 'default',
        email: p.email,
        name: p.name,
      };
    }

    // Dev fallback: custom headers
    const userId = request.headers['x-user-id'];
    if (userId) {
      return {
        id: userId,
        tenantId: request.headers['x-tenant-id'] || 'default',
      };
    }

    return null;
  }
}

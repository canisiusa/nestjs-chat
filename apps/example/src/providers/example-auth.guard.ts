import { Injectable, ExecutionContext } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { IChatAuthGuard } from '@chat-service/sdk';

@Injectable()
export class ExampleAuthGuard implements IChatAuthGuard {
  constructor(private readonly jwtService: JwtService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();

    // Bearer token
    const auth = request.headers.authorization;
    if (auth?.startsWith('Bearer ')) {
      try {
        const token = auth.replace('Bearer ', '');
        request.jwtPayload = this.jwtService.verify(token);
        return true;
      } catch {
        return false;
      }
    }

    // Dev fallback: x-user-id header
    if (request.headers['x-user-id']) {
      return true;
    }

    return false;
  }
}

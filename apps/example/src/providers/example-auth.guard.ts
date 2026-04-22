import { Injectable, ExecutionContext } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { IChatAuthGuard } from 'nestjs-chat';

@Injectable()
export class ExampleAuthGuard implements IChatAuthGuard {
  constructor(private readonly jwtService: JwtService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const auth = request.headers.authorization;
    if (auth?.startsWith('Bearer ')) {
      try {
        request.jwtPayload = this.jwtService.verify(auth.slice(7));
        return true;
      } catch {
        return false;
      }
    }
    return false;
  }
}

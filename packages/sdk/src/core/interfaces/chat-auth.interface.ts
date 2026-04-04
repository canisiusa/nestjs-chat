import { ExecutionContext } from '@nestjs/common';

export interface ChatAuthUser {
  id: string;
  tenantId: string;
  email?: string;
  name?: string;
}

export interface IChatAuthGuard {
  canActivate(context: ExecutionContext): boolean | Promise<boolean>;
}

export interface IChatUserExtractor {
  extractUser(request: any): ChatAuthUser | null;
}

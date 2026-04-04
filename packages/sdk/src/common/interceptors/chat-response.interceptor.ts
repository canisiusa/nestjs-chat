import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { Observable, map } from 'rxjs';
import { Request } from 'express';
import { getRequestId } from '../context/request-context';

export interface ChatApiResponse<T = any> {
  success: true;
  data: T;
  requestId?: string;
  timestamp: string;
  path: string;
}

@Injectable()
export class ChatResponseInterceptor<T> implements NestInterceptor<T, ChatApiResponse<T>> {
  intercept(context: ExecutionContext, next: CallHandler): Observable<ChatApiResponse<T>> {
    const request = context.switchToHttp().getRequest<Request>();
    const requestId = (request as any).requestId || getRequestId();

    return next.handle().pipe(
      map((data) => ({
        success: true as const,
        data,
        requestId,
        timestamp: new Date().toISOString(),
        path: request.url,
      })),
    );
  }
}

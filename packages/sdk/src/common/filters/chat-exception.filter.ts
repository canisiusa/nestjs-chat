import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  LoggerService,
} from '@nestjs/common';
import { Response, Request } from 'express';
import { Prisma } from 'src/generated/prisma/client';
import { ChatException } from '../exceptions/chat.exception';
import { ChatErrorCode } from '../exceptions/chat-error-codes';
import { getRequestId } from '../context/request-context';

interface ErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    details?: Record<string, any>;
  };
  requestId?: string;
  statusCode: number;
  timestamp: string;
  path: string;
}

@Catch()
export class ChatExceptionFilter implements ExceptionFilter {
  constructor(private readonly logger: LoggerService) {}

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();
    const requestId = (request as any).requestId || getRequestId();

    const errorResponse = this.buildErrorResponse(exception, request, requestId);

    const logPayload = {
      requestId,
      code: errorResponse.error.code,
      statusCode: errorResponse.statusCode,
      path: errorResponse.path,
      method: request.method,
      details: errorResponse.error.details,
      userId: (request as any).chatUser?.id,
      tenantId: (request as any).chatUser?.tenantId,
    };

    if (errorResponse.statusCode >= 500) {
      this.logger.error(
        `[${errorResponse.error.code}] ${errorResponse.error.message}`,
        exception instanceof Error ? exception.stack : JSON.stringify(exception),
        'ChatExceptionFilter',
      );
      this.logger.error(JSON.stringify(logPayload), undefined, 'ChatExceptionFilter');
    } else if (errorResponse.statusCode >= 400) {
      this.logger.warn(
        `[${errorResponse.error.code}] ${errorResponse.error.message} | ${JSON.stringify(logPayload)}`,
        'ChatExceptionFilter',
      );
    }

    response.status(errorResponse.statusCode).json(errorResponse);
  }

  private buildErrorResponse(
    exception: unknown,
    request: Request,
    requestId?: string,
  ): ErrorResponse {
    const base = {
      success: false as const,
      requestId,
      timestamp: new Date().toISOString(),
      path: request.url,
    };

    if (exception instanceof ChatException) {
      return {
        ...base,
        statusCode: exception.getStatus(),
        error: {
          code: exception.code,
          message: exception.message,
          details: exception.details,
        },
      };
    }

    if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      return { ...base, ...this.handlePrismaError(exception) };
    }

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const exResponse = exception.getResponse();
      const message = typeof exResponse === 'string' ? exResponse : (exResponse as any).message;

      return {
        ...base,
        statusCode: status,
        error: {
          code: this.httpStatusToCode(status),
          message: Array.isArray(message) ? message.join('; ') : message,
          details: Array.isArray(message) ? { validationErrors: message } : undefined,
        },
      };
    }

    return {
      ...base,
      statusCode: 500,
      error: {
        code: ChatErrorCode.INTERNAL_ERROR,
        message: 'An unexpected error occurred',
      },
    };
  }

  private handlePrismaError(error: Prisma.PrismaClientKnownRequestError): {
    statusCode: number;
    error: { code: string; message: string; details?: Record<string, any> };
  } {
    switch (error.code) {
      case 'P2002': {
        const target = (error.meta?.target as string[])?.join(', ') ?? 'unknown';
        return {
          statusCode: 409,
          error: {
            code: ChatErrorCode.CONFLICT,
            message: `A record with this ${target} already exists`,
            details: { fields: error.meta?.target },
          },
        };
      }
      case 'P2025':
        return {
          statusCode: 404,
          error: {
            code: ChatErrorCode.CHANNEL_NOT_FOUND,
            message: 'Record not found',
          },
        };
      case 'P2003':
        return {
          statusCode: 400,
          error: {
            code: ChatErrorCode.VALIDATION_ERROR,
            message: 'Related record not found (foreign key constraint)',
            details: { field: error.meta?.field_name },
          },
        };
      case 'P2014':
        return {
          statusCode: 400,
          error: {
            code: ChatErrorCode.VALIDATION_ERROR,
            message: 'Required relation violation',
          },
        };
      default:
        return {
          statusCode: 500,
          error: {
            code: ChatErrorCode.INTERNAL_ERROR,
            message: 'Database error',
          },
        };
    }
  }

  private httpStatusToCode(status: number): string {
    switch (status) {
      case 400:
        return ChatErrorCode.VALIDATION_ERROR;
      case 401:
        return ChatErrorCode.AUTH_FAILED;
      case 403:
        return ChatErrorCode.AUTH_FORBIDDEN;
      case 404:
        return ChatErrorCode.CHANNEL_NOT_FOUND;
      case 409:
        return ChatErrorCode.CONFLICT;
      case 429:
        return ChatErrorCode.RATE_LIMITED;
      default:
        return ChatErrorCode.INTERNAL_ERROR;
    }
  }
}

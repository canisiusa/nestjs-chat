import { Logger } from 'winston';
import { ChatException } from './chat.exception';
import { ChatErrorCode } from './chat-error-codes';

/**
 * Handles errors caught in service methods.
 * Re-throws ChatExceptions as-is, maps Prisma errors, logs and wraps unknown errors.
 *
 * Usage:
 * ```
 * try {
 *   // service logic
 * } catch (error) {
 *   throw handleServiceError(error, this.logger, 'ServiceName.methodName', { channelId });
 * }
 * ```
 */
export function handleServiceError(
  error: unknown,
  logger: Logger,
  context: string,
  meta?: Record<string, any>,
): ChatException {
  if (error instanceof ChatException) {
    return error;
  }

  const err = error instanceof Error ? error : new Error(String(error));

  // Prisma known request errors (P2002, P2025, etc.) have a `code` property
  if (isPrismaKnownError(error)) {
    logger.error(`[${context}] Prisma error ${error.code}`, {
      prismaCode: error.code,
      ...meta,
      prismaMeta: error.meta,
    });
    return mapPrismaError(error);
  }

  // Prisma validation errors
  if (err.name === 'PrismaClientValidationError') {
    logger.error(`[${context}] Prisma validation error`, {
      message: err.message.slice(0, 500),
      ...meta,
    });
    return new ChatException(ChatErrorCode.VALIDATION_ERROR, 'Invalid data provided');
  }

  // Prisma connection errors
  if (err.name === 'PrismaClientInitializationError') {
    logger.error(`[${context}] Database connection failed`, {
      message: err.message,
      ...meta,
    });
    return new ChatException(ChatErrorCode.INTERNAL_ERROR, 'Service temporarily unavailable');
  }

  // Unknown errors
  const methodName = context.split('.').pop() ?? 'unknown';
  logger.error(`[${context}] Unexpected error`, {
    error: err.message,
    stack: err.stack,
    ...meta,
  });

  return ChatException.internal(`Failed to ${methodName}`);
}

interface PrismaKnownError {
  code: string;
  meta?: Record<string, any>;
  message: string;
}

function isPrismaKnownError(error: unknown): error is PrismaKnownError {
  return (
    error instanceof Error &&
    'code' in error &&
    typeof (error as any).code === 'string' &&
    (error as any).code.startsWith('P')
  );
}

function mapPrismaError(error: PrismaKnownError): ChatException {
  switch (error.code) {
    case 'P2002': {
      const target = (error.meta?.target as string[])?.join(', ') ?? 'field';
      return ChatException.conflict(`Duplicate value for ${target}`);
    }
    case 'P2025':
      return new ChatException(ChatErrorCode.CHANNEL_NOT_FOUND, 'Record not found');
    case 'P2003':
      return ChatException.validation('Referenced record does not exist', {
        field: error.meta?.field_name,
      });
    case 'P2014':
      return ChatException.validation('Required relation violation');
    default:
      return ChatException.internal('Database operation failed');
  }
}

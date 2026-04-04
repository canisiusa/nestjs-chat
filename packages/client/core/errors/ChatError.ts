export enum ChatErrorCode {
  // Connection
  CONNECTION_FAILED = 'CONNECTION_FAILED',
  NOT_CONNECTED = 'NOT_CONNECTED',

  // Authentication
  AUTH_FAILED = 'AUTH_FAILED',
  INVALID_TOKEN = 'INVALID_TOKEN',

  // Channels
  CHANNEL_NOT_FOUND = 'CHANNEL_NOT_FOUND',
  CHANNEL_CREATE_FAILED = 'CHANNEL_CREATE_FAILED',

  // Messages
  MESSAGE_SEND_FAILED = 'MESSAGE_SEND_FAILED',
  MESSAGE_NOT_FOUND = 'MESSAGE_NOT_FOUND',

  // Media
  UPLOAD_FAILED = 'UPLOAD_FAILED',
  INVALID_FILE_TYPE = 'INVALID_FILE_TYPE',
  FILE_TOO_LARGE = 'FILE_TOO_LARGE',

  // Permissions
  PERMISSION_DENIED = 'PERMISSION_DENIED',

  // Generic
  UNKNOWN_ERROR = 'UNKNOWN_ERROR',
}

export class ChatError extends Error {
  constructor(
    public code: ChatErrorCode,
    message: string,
    public originalError?: any
  ) {
    super(message)
    this.name = 'ChatError'
  }

  static fromError(error: any): ChatError {
    if (error instanceof ChatError) {
      return error
    }

    return new ChatError(
      ChatErrorCode.UNKNOWN_ERROR,
      error.message || 'An unknown error occurred',
      error
    )
  }
}

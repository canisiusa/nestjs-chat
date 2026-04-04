import { HttpException } from '@nestjs/common';
import { ChatErrorCode, ERROR_HTTP_STATUS } from './chat-error-codes';

export class ChatException extends HttpException {
  public readonly code: ChatErrorCode;
  public readonly details?: Record<string, any>;

  constructor(code: ChatErrorCode, message: string, details?: Record<string, any>) {
    const status = ERROR_HTTP_STATUS[code] ?? 500;
    super({ code, message, details }, status);
    this.code = code;
    this.details = details;
  }

  // ─── Factory methods ─────────────────────────────────────────────────

  static channelNotFound(channelId?: string) {
    return new ChatException(
      ChatErrorCode.CHANNEL_NOT_FOUND,
      'Channel not found',
      channelId ? { channelId } : undefined,
    );
  }

  static messageNotFound(messageId?: string) {
    return new ChatException(
      ChatErrorCode.MESSAGE_NOT_FOUND,
      'Message not found',
      messageId ? { messageId } : undefined,
    );
  }

  static notChannelMember() {
    return new ChatException(
      ChatErrorCode.NOT_CHANNEL_MEMBER,
      'You are not a member of this channel',
    );
  }

  static notChannelOperator() {
    return new ChatException(
      ChatErrorCode.NOT_CHANNEL_OPERATOR,
      'Only channel operators can perform this action',
    );
  }

  static userMuted() {
    return new ChatException(ChatErrorCode.USER_MUTED, 'You are muted in this channel');
  }

  static userBanned() {
    return new ChatException(ChatErrorCode.USER_BANNED, 'You are banned from this channel');
  }

  static channelFrozen() {
    return new ChatException(ChatErrorCode.CHANNEL_FROZEN, 'Channel is frozen');
  }

  static messageNotOwner() {
    return new ChatException(
      ChatErrorCode.MESSAGE_NOT_OWNER,
      'You can only edit or delete your own messages',
    );
  }

  static memberLimit(max: number) {
    return new ChatException(
      ChatErrorCode.CHANNEL_MEMBER_LIMIT,
      `Channel cannot have more than ${max} members`,
      { maxMembers: max },
    );
  }

  static pinLimit(max: number) {
    return new ChatException(
      ChatErrorCode.CHANNEL_PIN_LIMIT,
      `Cannot pin more than ${max} messages`,
      { maxPinned: max },
    );
  }

  static pollNotFound(pollId?: string) {
    return new ChatException(
      ChatErrorCode.POLL_NOT_FOUND,
      'Poll not found',
      pollId ? { pollId } : undefined,
    );
  }

  static pollClosed() {
    return new ChatException(ChatErrorCode.POLL_CLOSED, 'Poll is closed');
  }

  static scheduledNotFound() {
    return new ChatException(ChatErrorCode.SCHEDULED_NOT_FOUND, 'Scheduled message not found');
  }

  static scheduledAlreadySent() {
    return new ChatException(
      ChatErrorCode.SCHEDULED_ALREADY_SENT,
      'Scheduled message has already been sent',
    );
  }

  static scheduledInvalidTime() {
    return new ChatException(
      ChatErrorCode.SCHEDULED_INVALID_TIME,
      'Scheduled time must be in the future',
    );
  }

  static validation(message: string, details?: Record<string, any>) {
    return new ChatException(ChatErrorCode.VALIDATION_ERROR, message, details);
  }

  static userNotFound(userId?: string) {
    return new ChatException(
      ChatErrorCode.USER_NOT_FOUND,
      'User not found',
      userId ? { userId } : undefined,
    );
  }

  static fileTooLarge(maxSize: number) {
    return new ChatException(
      ChatErrorCode.FILE_TOO_LARGE,
      `File exceeds maximum size of ${Math.round(maxSize / 1024 / 1024)}MB`,
      { maxFileSize: maxSize },
    );
  }

  static conflict(message: string) {
    return new ChatException(ChatErrorCode.CONFLICT, message);
  }

  static internal(message = 'An unexpected error occurred') {
    return new ChatException(ChatErrorCode.INTERNAL_ERROR, message);
  }
}

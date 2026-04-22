import { ChatException } from './chat.exception';
import { ChatErrorCode } from './chat-error-codes';

describe('ChatException', () => {
  describe('constructor', () => {
    it('maps known codes to the right HTTP status', () => {
      const err = new ChatException(ChatErrorCode.CHANNEL_NOT_FOUND, 'nope');
      expect(err.getStatus()).toBe(404);
      expect(err.code).toBe(ChatErrorCode.CHANNEL_NOT_FOUND);
    });

    it('falls back to 500 when the code is unknown', () => {
      const err = new ChatException('NOT_A_REAL_CODE' as ChatErrorCode, 'boom');
      expect(err.getStatus()).toBe(500);
    });

    it('serializes message, code and details in the response body', () => {
      const err = new ChatException(ChatErrorCode.VALIDATION_ERROR, 'bad input', {
        field: 'email',
      });
      expect(err.getResponse()).toEqual({
        code: ChatErrorCode.VALIDATION_ERROR,
        message: 'bad input',
        details: { field: 'email' },
      });
    });
  });

  describe('factory helpers', () => {
    it('channelNotFound carries the channel id as details', () => {
      const err = ChatException.channelNotFound('chan_123');
      expect(err.code).toBe(ChatErrorCode.CHANNEL_NOT_FOUND);
      expect(err.details).toEqual({ channelId: 'chan_123' });
      expect(err.getStatus()).toBe(404);
    });

    it('channelNotFound omits details when no id is given', () => {
      const err = ChatException.channelNotFound();
      expect(err.details).toBeUndefined();
    });

    it('memberLimit exposes the limit in details', () => {
      const err = ChatException.memberLimit(100);
      expect(err.getStatus()).toBe(413);
      expect(err.details).toEqual({ maxMembers: 100 });
    });

    it('fileTooLarge rounds the size to MB', () => {
      const err = ChatException.fileTooLarge(5 * 1024 * 1024);
      expect(err.getStatus()).toBe(400);
      expect(err.message).toContain('5MB');
      expect(err.details).toEqual({ maxFileSize: 5 * 1024 * 1024 });
    });

    it('notChannelMember maps to 403', () => {
      expect(ChatException.notChannelMember().getStatus()).toBe(403);
    });

    it('pollClosed maps to 410', () => {
      expect(ChatException.pollClosed().getStatus()).toBe(410);
    });

    it('conflict maps to 409 with a custom message', () => {
      const err = ChatException.conflict('already exists');
      expect(err.getStatus()).toBe(409);
      expect(err.message).toBe('already exists');
    });

    it('internal defaults the message', () => {
      const err = ChatException.internal();
      expect(err.getStatus()).toBe(500);
      expect(err.message).toBe('An unexpected error occurred');
    });

    it('validation carries arbitrary details', () => {
      const err = ChatException.validation('nope', { foo: 'bar' });
      expect(err.code).toBe(ChatErrorCode.VALIDATION_ERROR);
      expect(err.details).toEqual({ foo: 'bar' });
    });
  });
});

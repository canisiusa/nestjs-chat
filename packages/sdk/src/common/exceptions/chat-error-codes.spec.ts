import { ChatErrorCode, ERROR_HTTP_STATUS } from './chat-error-codes';

describe('ERROR_HTTP_STATUS mapping', () => {
  it('covers every ChatErrorCode value', () => {
    const missing = Object.values(ChatErrorCode).filter(
      (code) => ERROR_HTTP_STATUS[code] === undefined,
    );
    expect(missing).toEqual([]);
  });

  it('only uses valid HTTP status codes', () => {
    for (const status of Object.values(ERROR_HTTP_STATUS)) {
      expect(status).toBeGreaterThanOrEqual(400);
      expect(status).toBeLessThan(600);
    }
  });

  it('uses 4xx for client-facing errors and 5xx for internal failures', () => {
    expect(ERROR_HTTP_STATUS[ChatErrorCode.INTERNAL_ERROR]).toBe(500);
    expect(ERROR_HTTP_STATUS[ChatErrorCode.UPLOAD_FAILED]).toBe(500);
    expect(ERROR_HTTP_STATUS[ChatErrorCode.AUTH_FAILED]).toBe(401);
    expect(ERROR_HTTP_STATUS[ChatErrorCode.AUTH_FORBIDDEN]).toBe(403);
    expect(ERROR_HTTP_STATUS[ChatErrorCode.RATE_LIMITED]).toBe(429);
  });

  it('prefixes every error code with "CHAT_"', () => {
    for (const code of Object.values(ChatErrorCode)) {
      expect(code).toMatch(/^CHAT_/);
    }
  });
});

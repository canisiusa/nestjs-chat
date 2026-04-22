import { requestContext, getRequestContext, getRequestId } from './request-context';

describe('RequestContext', () => {
  it('returns undefined when called outside a store', () => {
    expect(getRequestContext()).toBeUndefined();
    expect(getRequestId()).toBeUndefined();
  });

  it('exposes the current store inside requestContext.run()', () => {
    const ctx = { requestId: 'req_123', userId: 'u_1', tenantId: 't_1' };
    requestContext.run(ctx, () => {
      expect(getRequestContext()).toEqual(ctx);
      expect(getRequestId()).toBe('req_123');
    });
  });

  it('isolates nested stores', () => {
    requestContext.run({ requestId: 'outer' }, () => {
      requestContext.run({ requestId: 'inner' }, () => {
        expect(getRequestId()).toBe('inner');
      });
      expect(getRequestId()).toBe('outer');
    });
  });
});

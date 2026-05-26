import { describe, expect, it, vi } from 'vitest';
import { authGuard } from './authGuard.js';
import { createMockNext, createMockRequest, createMockResponse } from '../test/controllerTestUtils.js';

describe('authGuard', () => {
  it('rejects requests without a bearer token', async () => {
    const req = createMockRequest({ headers: {} });
    const res = createMockResponse();
    const next = createMockNext();

    await authGuard(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      error: {
        code: 'UNAUTHORIZED',
        message: 'Access denied. Authorization header with Bearer token is required.'
      }
    });
    expect(next).not.toHaveBeenCalled();
  });

  it('rejects malformed tokens without calling next', async () => {
    const req = createMockRequest({ headers: { authorization: 'Bearer not-a-jwt' } });
    const res = createMockResponse();
    const next = vi.fn();

    await authGuard(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });
});

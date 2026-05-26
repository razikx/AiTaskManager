import { NextFunction, Response } from 'express';
import { Mock, vi } from 'vitest';
import { AuthenticatedRequest } from '../middleware/authGuard.js';

export function createMockResponse() {
  const res = {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis()
  } as unknown as Response & {
    status: Mock;
    json: Mock;
  };

  return res;
}

export function createMockRequest(overrides: Partial<AuthenticatedRequest> = {}) {
  return {
    params: {},
    query: {},
    body: {},
    headers: {
      authorization: 'Bearer test-token'
    },
    user: {
      id: '00000000-0000-4000-8000-000000000001',
      email: 'test@example.com'
    },
    ...overrides
  } as AuthenticatedRequest;
}

export function createMockNext() {
  return vi.fn() as unknown as NextFunction & Mock;
}

export function createSupabaseQueryMock(result: unknown = { data: null, error: null }) {
  const query = {
    select: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue(result),
    then: (resolve: (value: unknown) => unknown, reject: (reason?: unknown) => unknown) =>
      Promise.resolve(result).then(resolve, reject)
  };

  return query;
}

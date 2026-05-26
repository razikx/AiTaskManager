import { Response } from 'express';
import { ZodError } from 'zod';

export function sendValidationError(res: Response, error: ZodError) {
  return res.status(400).json({
    success: false,
    error: {
      code: 'INVALID_INPUT',
      message: 'Request validation failed.',
      details: error.issues.map((issue) => ({
        path: issue.path.join('.') || 'root',
        code: issue.code,
        message: issue.message
      }))
    }
  });
}

import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';

// Detect OpenAI SDK / Oxlo API errors by checking the error class and status
function isOxloError(err: unknown): boolean {
  if (!(err instanceof Error)) return false;
  const name = err.constructor?.name ?? '';
  if (name.includes('OpenAI') || name.includes('APIError') || name.includes('APIStatus')) return true;
  // OpenAI SDK sets a .status property on API errors
  const e = err as Error & { status?: number };
  if (typeof e.status === 'number' && e.status >= 400) return true;
  return false;
}

export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction): void {
  // Zod validation errors → 400
  if (err instanceof ZodError) {
    res.status(400).json({
      error: 'Validation error',
      details: err.flatten().fieldErrors,
    });
    return;
  }

  // Oxlo / OpenAI errors → 502
  if (isOxloError(err)) {
    const e = err as Error & { status?: number };
    res.status(502).json({
      error: 'AI service error',
      details: e.message,
      upstream_status: e.status,
    });
    return;
  }

  // Generic 404
  if (err instanceof Error && err.message === 'NOT_FOUND') {
    res.status(404).json({ error: 'Resource not found' });
    return;
  }

  // Generic 500
  const message = err instanceof Error ? err.message : 'Internal server error';
  console.error('[error]', err);
  res.status(500).json({ error: message });
}

import { errorMessage } from '../types/domain.js';

export class AppError extends Error {
  readonly code: number;
  readonly details: unknown;

  constructor(message: string, code = 500, details: unknown = null) {
    super(message);
    this.name = 'AppError';
    this.code = code;
    this.details = details;
  }
}

export function createErrorResponse(error: unknown, logError = true) {
  const normalizedError = error instanceof Error ? error : new Error(errorMessage(error));

  if (logError) {
    if (normalizedError instanceof AppError) {
      console.error(`[Error] ${normalizedError.code}: ${normalizedError.message}`, normalizedError.details || '');
    } else {
      console.error('[Error] Unexpected:', normalizedError.message, normalizedError.stack);
    }
  }

  const code = normalizedError instanceof AppError ? normalizedError.code : 500;
  const message = normalizedError instanceof AppError
    ? normalizedError.message
    : 'Internal Server Error';

  return new Response(JSON.stringify({ 
    error: message, 
    code: code 
  }), {
    status: code,
    headers: { 'Content-Type': 'application/json' }
  });
}

export function createSuccessResponse(data: unknown, headers: HeadersInit = {}) {
  const defaultHeaders = { 'Content-Type': 'application/json' };
  return new Response(JSON.stringify(data), {
    status: 200,
    headers: { ...defaultHeaders, ...headers }
  });
}

export function createUnauthorizedResponse(message = 'Unauthorized') {
  return new Response(JSON.stringify({ 
    error: message, 
    code: 401 
  }), {
    status: 401,
    headers: { 'Content-Type': 'application/json' }
  });
}

export function createBadRequestResponse(message = 'Bad Request') {
  return new Response(JSON.stringify({ 
    error: message, 
    code: 400 
  }), {
    status: 400,
    headers: { 'Content-Type': 'application/json' }
  });
}

export function createNotFoundResponse(message = 'Not Found') {
  return new Response(JSON.stringify({ 
    error: message, 
    code: 404 
  }), {
    status: 404,
    headers: { 'Content-Type': 'application/json' }
  });
}

import { ZodError } from 'zod';
import { ApiError } from '../utils/ApiError.js';
import { sendError } from '../utils/ApiResponse.js';
import { env } from '../config/env.js';

export function errorHandler(err, req, res, _next) {
  if (err instanceof ApiError) {
    return sendError(res, err.statusCode, err.code, err.message, err.details);
  }

  if (err instanceof ZodError) {
    return sendError(
      res,
      400,
      'VALIDATION_ERROR',
      'Validation failed',
      err.errors.map((e) => ({ path: e.path.join('.'), message: e.message }))
    );
  }

  if (err?.name === 'MulterError') {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return sendError(res, 413, 'FILE_TOO_LARGE', 'File exceeds the maximum allowed size of 10 MB');
    }
    return sendError(res, 400, 'UPLOAD_ERROR', err.message || 'File upload failed');
  }

  if (err?.name === 'ValidationError') {
    const details = Object.values(err.errors || {}).map((e) => ({
      path: e.path,
      message: e.message,
    }));
    return sendError(res, 400, 'MONGOOSE_VALIDATION_ERROR', 'Database validation failed', details);
  }

  if (err?.name === 'CastError') {
    return sendError(res, 400, 'INVALID_ID', `Invalid identifier for ${err.path}`);
  }

  if (err?.code === 11000) {
    const fields = Object.keys(err.keyPattern || {});
    return sendError(res, 409, 'DUPLICATE_KEY', `Duplicate value for: ${fields.join(', ')}`);
  }

  if (err?.name === 'JsonWebTokenError' || err?.name === 'TokenExpiredError') {
    return sendError(res, 401, 'UNAUTHORIZED', 'Invalid or expired token');
  }

  if (env.NODE_ENV !== 'test') {
    console.error('Unhandled error:', err);
  }

  return sendError(
    res,
    500,
    'INTERNAL_ERROR',
    env.NODE_ENV === 'production' ? 'Internal server error' : err.message || 'Internal server error'
  );
}

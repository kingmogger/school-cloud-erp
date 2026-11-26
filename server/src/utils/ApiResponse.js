export function sendSuccess(res, data = null, statusCode = 200, meta = undefined) {
  const payload = { success: true, data, error: null };
  if (meta !== undefined) {
    payload.meta = meta;
  }
  return res.status(statusCode).json(payload);
}

export function sendError(res, statusCode = 500, code = 'INTERNAL_ERROR', message = 'Internal server error', details = undefined) {
  const error = { code, message };
  if (details !== undefined && details !== null) {
    error.details = details;
  }
  return res.status(statusCode).json({ success: false, data: null, error });
}

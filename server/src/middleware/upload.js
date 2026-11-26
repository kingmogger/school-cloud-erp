import multer from 'multer';
import { ApiError } from '../utils/ApiError.js';

const ALLOWED_MIMES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'text/plain',
]);

export const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (!ALLOWED_MIMES.has(file.mimetype)) {
      return cb(new ApiError(400, `Unsupported file type: ${file.mimetype}`, 'INVALID_FILE_TYPE'));
    }
    return cb(null, true);
  },
});

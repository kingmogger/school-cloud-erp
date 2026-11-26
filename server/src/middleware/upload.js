import multer from 'multer';
import { ApiError } from '../utils/ApiError.js';

export const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB

export const ALLOWED_MIMES = new Set([
  'application/pdf',
  'image/jpeg',
  'image/png',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // DOCX
  'application/vnd.openxmlformats-officedocument.presentationml.presentation', // PPTX
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // XLSX
]);

export const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_FILE_SIZE_BYTES },
  fileFilter: (_req, file, cb) => {
    if (!ALLOWED_MIMES.has(file.mimetype)) {
      return cb(
        new ApiError(
          400,
          `Unsupported file type: ${file.mimetype}. Allowed types: PDF, JPG, PNG, DOCX, PPTX, XLSX.`,
          'INVALID_FILE_TYPE'
        )
      );
    }
    return cb(null, true);
  },
});

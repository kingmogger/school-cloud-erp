import path from 'node:path';
import multer from 'multer';
import { ApiError } from '../utils/ApiError.js';

export const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB

export const ALLOWED_MIMES = new Set([
  'application/pdf',
  'image/jpeg',
  'image/png',
  'text/plain',
  'text/csv',
  'application/msword', // DOC
  'application/vnd.ms-powerpoint', // PPT
  'application/vnd.ms-excel', // XLS
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // DOCX
  'application/vnd.openxmlformats-officedocument.presentationml.presentation', // PPTX
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // XLSX
]);

export const ALLOWED_EXTENSIONS = new Set([
  '.pdf',
  '.jpg',
  '.jpeg',
  '.png',
  '.txt',
  '.csv',
  '.doc',
  '.docx',
  '.ppt',
  '.pptx',
  '.xls',
  '.xlsx',
]);

export function isAllowedUploadFile(file) {
  if (!file) return false;
  if (file.mimetype && ALLOWED_MIMES.has(file.mimetype)) return true;
  const ext = path.extname(file.originalname || '').toLowerCase();
  if (ALLOWED_EXTENSIONS.has(ext) && (!file.mimetype || file.mimetype === 'application/octet-stream')) {
    return true;
  }
  return false;
}

export const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_FILE_SIZE_BYTES },
  fileFilter: (_req, file, cb) => {
    if (!isAllowedUploadFile(file)) {
      return cb(
        new ApiError(
          400,
          `Unsupported file type: ${file.mimetype || file.originalname}. Allowed types: PDF, JPG, PNG, DOC/DOCX, PPT/PPTX, XLS/XLSX, TXT.`,
          'INVALID_FILE_TYPE'
        )
      );
    }
    return cb(null, true);
  },
});

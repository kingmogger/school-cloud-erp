import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { tenantMiddleware } from '../middleware/tenant.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { sendSuccess } from '../utils/ApiResponse.js';
import { getSignedUrl, getLocalFileForDownload } from '../services/storage.service.js';

const router = Router();

router.use(requireAuth, tenantMiddleware);

router.get(
  '/files/:id/url',
  asyncHandler(async (req, res) => {
    const result = await getSignedUrl(req.params.id, {
      schoolId: req.user.schoolId,
      role: req.user.role,
    });
    return sendSuccess(res, result);
  })
);

router.get(
  '/files/:id/download',
  asyncHandler(async (req, res) => {
    const result = await getLocalFileForDownload(req.params.id, {
      schoolId: req.user.schoolId,
      role: req.user.role,
    });
    if (result.redirectUrl) {
      return res.redirect(result.redirectUrl);
    }
    res.setHeader('Content-Type', result.file.mimeType || 'application/octet-stream');
    res.setHeader('Content-Disposition', `inline; filename="${result.file.originalName || result.file.fileName}"`);
    return res.sendFile(result.fullPath);
  })
);

export default router;

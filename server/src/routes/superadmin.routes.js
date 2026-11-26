import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { requireRole } from '../middleware/rbac.js';
import { tenantMiddleware } from '../middleware/tenant.js';
import {
  getDashboard,
  listSchools,
  createSchool,
  getSchoolDetails,
  updateSchool,
  softDeleteSchool,
  suspendSchool,
  reactivateSchool,
  pauseSchoolService,
  resumeSchoolService,
  bulkPauseSchools,
  extendSubscription,
  changeSchoolPlan,
  resetSchoolAdminPassword,
  impersonateSchoolAdmin,
  listPlans,
  createPlan,
  updatePlan,
  listPlatformPayments,
  recordPlatformPayment,
  downloadPlatformInvoice,
  listOverdueSchools,
  listPlatformAuditLogs,
  getPlatformSettings,
  updatePlatformSettings,
  getStorageOverview,
  getSchoolStorageDetail,
  updateSchoolStorageLimit,
  recalculateSchoolStorage,
  deleteSchoolStorageFile,
} from '../controllers/superadmin.controller.js';

const router = Router();

router.use(requireAuth, tenantMiddleware, requireRole('super_admin'));

router.get('/dashboard', getDashboard);

router.get('/schools', listSchools);
router.post('/schools', createSchool);
router.get('/schools/overdue', listOverdueSchools);
router.get('/schools/:id', getSchoolDetails);
router.patch('/schools/:id', updateSchool);
router.delete('/schools/:id', softDeleteSchool);

router.post('/schools/bulk-pause', bulkPauseSchools);
router.post('/schools/:id/suspend', suspendSchool);
router.post('/schools/:id/reactivate', reactivateSchool);
router.post('/schools/:id/pause', pauseSchoolService);
router.post('/schools/:id/resume', resumeSchoolService);
router.post('/schools/:id/extend', extendSubscription);
router.post('/schools/:id/change-plan', changeSchoolPlan);
router.post('/schools/:id/reset-admin-password', resetSchoolAdminPassword);
router.post('/schools/:id/impersonate', impersonateSchoolAdmin);

router.get('/plans', listPlans);
router.post('/plans', createPlan);
router.patch('/plans/:id', updatePlan);

router.get('/payments', listPlatformPayments);
router.post('/payments', recordPlatformPayment);
router.get('/payments/:id/invoice', downloadPlatformInvoice);

router.get('/audit-logs', listPlatformAuditLogs);
router.get('/settings', getPlatformSettings);
router.patch('/settings', updatePlatformSettings);

router.get('/storage', getStorageOverview);
router.get('/storage/schools/:id', getSchoolStorageDetail);
router.patch('/storage/schools/:id/limit', updateSchoolStorageLimit);
router.post('/storage/schools/:id/recalculate', recalculateSchoolStorage);
router.delete('/storage/schools/:id/files/:fileId', deleteSchoolStorageFile);

export default router;

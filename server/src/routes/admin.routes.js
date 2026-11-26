import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { requireRole } from '../middleware/rbac.js';
import { tenantMiddleware, subscriptionGuard } from '../middleware/tenant.js';
import { validate } from '../middleware/validate.js';
import { upload } from '../middleware/upload.js';
import {
  createStudentSchema,
  updateStudentSchema,
  createFacultySchema,
  updateFacultySchema,
  classSchema,
  sectionSchema,
  subjectSchema,
  academicYearSchema,
  settingsSchema,
} from '../validators/admin.validator.js';
import {
  getDashboard,
  listStudents,
  createStudent,
  updateStudent,
  deleteStudent,
  listFaculty,
  createFaculty,
  updateFaculty,
  deleteFaculty,
  listClasses,
  createClass,
  deleteClass,
  listSections,
  createSection,
  updateSection,
  deleteSection,
  listSubjects,
  createSubject,
  updateSubject,
  deleteSubject,
  listAcademicYears,
  createAcademicYear,
  getSettings,
  updateSettings,
  listAuditLogs,
  getMySubscription,
  downloadMySubscriptionReceipt,
  payMySubscription,
} from '../controllers/admin.controller.js';

const router = Router();

router.use(requireAuth, tenantMiddleware, requireRole('school_admin'));

// Accessible even when subscription is suspended/expired so School Admin sees billing & contact info
router.get('/subscription', subscriptionGuard({ allowBlockedForAdmin: true }), getMySubscription);
router.post('/subscription/checkout', subscriptionGuard({ allowBlockedForAdmin: true }), payMySubscription);
router.get('/subscription/receipt/:paymentId', subscriptionGuard({ allowBlockedForAdmin: true }), downloadMySubscriptionReceipt);

// All other School Admin routes require an active/trial/grace subscription
router.use(subscriptionGuard());

router.get('/dashboard', getDashboard);

router.get('/students', listStudents);
router.post('/students', validate({ body: createStudentSchema }), createStudent);
router.patch('/students/:id', validate({ body: updateStudentSchema }), updateStudent);
router.delete('/students/:id', deleteStudent);

router.get('/faculty', listFaculty);
router.post('/faculty', validate({ body: createFacultySchema }), createFaculty);
router.patch('/faculty/:id', validate({ body: updateFacultySchema }), updateFaculty);
router.delete('/faculty/:id', deleteFaculty);

router.get('/classes', listClasses);
router.post('/classes', validate({ body: classSchema }), createClass);
router.delete('/classes/:id', deleteClass);

router.get('/sections', listSections);
router.post('/sections', validate({ body: sectionSchema }), createSection);
router.patch('/sections/:id', validate({ body: sectionSchema.partial() }), updateSection);
router.delete('/sections/:id', deleteSection);

router.get('/subjects', listSubjects);
router.post('/subjects', validate({ body: subjectSchema }), createSubject);
router.patch('/subjects/:id', validate({ body: subjectSchema.partial() }), updateSubject);
router.delete('/subjects/:id', deleteSubject);

router.get('/academic-years', listAcademicYears);
router.post('/academic-years', validate({ body: academicYearSchema }), createAcademicYear);

router.get('/settings', getSettings);
router.patch('/settings', upload.single('logo'), validate({ body: settingsSchema }), updateSettings);

router.get('/audit-logs', listAuditLogs);

export default router;

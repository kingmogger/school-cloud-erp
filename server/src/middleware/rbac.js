import { ApiError } from '../utils/ApiError.js';
import { Student } from '../models/Student.js';
import { Parent } from '../models/Parent.js';

export const requireRole = (...allowedRoles) => (req, _res, next) => {
  if (!req.user || !allowedRoles.includes(req.user.role)) {
    return next(new ApiError(403, 'Insufficient permissions for this resource', 'FORBIDDEN'));
  }
  return next();
};

export async function assertParentOwnsStudent(userId, studentId) {
  const parent = await Parent.findOne({ userId }).lean();
  if (!parent) {
    throw new ApiError(403, 'Parent profile not found', 'FORBIDDEN');
  }
  const owns = parent.children.some((id) => id.toString() === studentId.toString());
  if (!owns) {
    throw new ApiError(403, 'Access denied: student is not linked to your account', 'FORBIDDEN');
  }
  return parent;
}

export async function assertStudentSelf(userId, studentId) {
  const student = await Student.findOne({ userId }).lean();
  if (!student) {
    throw new ApiError(403, 'Student profile not found', 'FORBIDDEN');
  }
  if (studentId && student._id.toString() !== studentId.toString()) {
    throw new ApiError(403, 'Access denied: cannot access another student record', 'FORBIDDEN');
  }
  return student;
}

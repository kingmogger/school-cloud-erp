import { AuditLog } from '../models/AuditLog.js';

export async function recordAudit({ req, action, entity, entityId = '', before = null, after = null }) {
  try {
    if (!req?.user?.id) return;
    await AuditLog.create({
      schoolId: req.user.schoolId || undefined,
      actorId: req.user.id,
      actorRole: req.user.role,
      action,
      entity,
      entityId: entityId ? String(entityId) : '',
      before,
      after,
      ip: req.ip || '',
    });
  } catch (err) {
    console.error('Audit log error:', err.message);
  }
}

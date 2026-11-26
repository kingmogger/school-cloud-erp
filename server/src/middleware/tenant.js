import { School } from '../models/School.js';
import { PlatformSettings } from '../models/PlatformSettings.js';
import { ApiError } from '../utils/ApiError.js';
import { runWithTenant, runWithoutTenant } from '../utils/tenantContext.js';
import { computeEffectiveSchoolStatus } from '../services/subscription.service.js';

export function tenantMiddleware(req, _res, next) {
  if (!req.user) {
    return next();
  }
  if (req.user.role === 'super_admin') {
    return runWithoutTenant(() => next());
  }
  if (!req.user.schoolId) {
    return next(new ApiError(403, 'User is not associated with any school', 'NO_SCHOOL_SCOPE'));
  }
  return runWithTenant(req.user.schoolId, () => next());
}

export function subscriptionGuard({ allowBlockedForAdmin = false } = {}) {
  return async (req, res, next) => {
    try {
      if (!req.user || req.user.role === 'super_admin') {
        return next();
      }
      if (!req.user.schoolId) {
        return next(new ApiError(403, 'School scope missing', 'NO_SCHOOL_SCOPE'));
      }

      const school = await School.findById(req.user.schoolId).populate('planId').lean();
      const statusInfo = await computeEffectiveSchoolStatus(school);

      req.school = school;
      req.subscriptionStatus = statusInfo;

      res.setHeader('X-Subscription-Status', statusInfo.effectiveStatus);
      if (statusInfo.daysRemaining <= 7 && !statusInfo.isBlocked) {
        res.setHeader('X-Subscription-Days-Remaining', String(statusInfo.daysRemaining));
      }

      if (statusInfo.isBlocked) {
        if (allowBlockedForAdmin && req.user.role === 'school_admin') {
          return next();
        }
        const platformSettings = await PlatformSettings.findOne().lean();
        return next(
          new ApiError(402, statusInfo.reason, statusInfo.code, {
            schoolName: school?.name || 'School',
            schoolCode: school?.code || '',
            effectiveStatus: statusInfo.effectiveStatus,
            amountDue: school?.planId?.price || 0,
            supportEmail: platformSettings?.supportEmail || 'billing@schoolcloud.io',
            supportPhone: platformSettings?.supportPhone || '+1-800-555-0199',
            supportMessage: platformSettings?.supportMessage || statusInfo.reason,
            paymentInstructions: platformSettings?.paymentInstructions || '',
          })
        );
      }

      return next();
    } catch (err) {
      return next(err);
    }
  };
}

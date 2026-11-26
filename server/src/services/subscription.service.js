import { PlatformSettings } from '../models/PlatformSettings.js';

export async function computeEffectiveSchoolStatus(school) {
  if (!school) {
    return {
      effectiveStatus: 'suspended',
      isBlocked: true,
      code: 'SCHOOL_NOT_FOUND',
      reason: 'School record not found',
      daysRemaining: 0,
      graceDaysRemaining: 0,
    };
  }

  if (school.softDeletedAt) {
    return {
      effectiveStatus: 'suspended',
      isBlocked: true,
      code: 'SCHOOL_SUSPENDED',
      reason: 'This school account has been deactivated.',
      daysRemaining: 0,
      graceDaysRemaining: 0,
    };
  }

  if (school.servicePaused?.isPaused) {
    return {
      effectiveStatus: 'paused',
      isBlocked: true,
      code: 'SCHOOL_PAUSED',
      reason: school.servicePaused.customMessage || 'Service paused. Please contact your service provider.',
      pauseReason: school.servicePaused.reason || '',
      pausedAt: school.servicePaused.pausedAt || null,
      pausedBy: school.servicePaused.pausedByName || 'Platform Owner',
      daysRemaining: 0,
      graceDaysRemaining: 0,
    };
  }

  if (school.manualSuspension?.isSuspended || school.status === 'suspended') {
    return {
      effectiveStatus: 'suspended',
      isBlocked: true,
      code: 'SCHOOL_SUSPENDED',
      reason: school.manualSuspension?.reason || 'Account suspended by platform administrator.',
      daysRemaining: 0,
      graceDaysRemaining: 0,
    };
  }

  const now = new Date();
  const settings = await PlatformSettings.findOne().lean();
  const graceDays = school.gracePeriodDays ?? settings?.gracePeriodDays ?? 7;

  const activeUntil =
    school.status === 'trial' && school.trialEndsAt
      ? new Date(school.trialEndsAt)
      : school.endDate
      ? new Date(school.endDate)
      : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

  const msPerDay = 1000 * 60 * 60 * 24;
  const daysRemaining = Math.ceil((activeUntil.getTime() - now.getTime()) / msPerDay);

  if (now <= activeUntil) {
    return {
      effectiveStatus: school.status === 'trial' ? 'trial' : 'active',
      isBlocked: false,
      code: 'OK',
      reason: '',
      daysRemaining: Math.max(0, daysRemaining),
      graceDaysRemaining: graceDays,
    };
  }

  const graceEnd = new Date(activeUntil.getTime() + graceDays * msPerDay);
  if (now <= graceEnd && school.status !== 'expired') {
    const graceDaysRemaining = Math.max(0, Math.ceil((graceEnd.getTime() - now.getTime()) / msPerDay));
    return {
      effectiveStatus: 'grace',
      isBlocked: false,
      code: 'GRACE_PERIOD',
      reason: 'Subscription expired; currently operating in grace period.',
      daysRemaining: 0,
      graceDaysRemaining,
    };
  }

  return {
    effectiveStatus: 'expired',
    isBlocked: true,
    code: 'SUBSCRIPTION_EXPIRED',
    reason: 'Your school subscription and grace period have expired.',
    daysRemaining: 0,
    graceDaysRemaining: 0,
  };
}

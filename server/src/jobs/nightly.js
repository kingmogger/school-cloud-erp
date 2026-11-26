import cron from 'node-cron';
import { runWithoutTenant, runWithTenant } from '../utils/tenantContext.js';
import { School } from '../models/School.js';
import { PlatformSettings } from '../models/PlatformSettings.js';
import { User } from '../models/User.js';
import { evaluateAllStudentsRisk } from '../services/intelligence/risk.service.js';
import { FeeStructure } from '../models/FeeStructure.js';
import { FeePayment } from '../models/FeePayment.js';
import { Student } from '../models/Student.js';
import { Notification } from '../models/Notification.js';

export async function runDailySubscriptionCheck() {
  return runWithoutTenant(async () => {
    const now = new Date();
    const msPerDay = 1000 * 60 * 60 * 24;
    const settings = await PlatformSettings.findOne().lean();
    const reminderDays = settings?.reminderDays || [14, 7, 3, 1, 0];

    const schools = await School.find({ softDeletedAt: null });
    let expiredCount = 0;

    for (const school of schools) {
      if (school.manualSuspension?.isSuspended || school.status === 'suspended') continue;

      const activeUntil =
        school.status === 'trial' && school.trialEndsAt ? new Date(school.trialEndsAt) : new Date(school.endDate);
      const graceDays = school.gracePeriodDays ?? settings?.gracePeriodDays ?? 7;
      const graceEnd = new Date(activeUntil.getTime() + graceDays * msPerDay);
      const daysLeft = Math.ceil((activeUntil.getTime() - now.getTime()) / msPerDay);

      if (now > graceEnd) {
        school.status = school.autoSuspend ? 'suspended' : 'expired';
        school.subscriptionStatus = school.autoSuspend ? 'suspended' : 'expired';
        await school.save();
        expiredCount += 1;
      } else if (now > activeUntil) {
        if (school.subscriptionStatus !== 'grace') {
          school.subscriptionStatus = 'grace';
          await school.save();
        }
      }

      if (reminderDays.includes(daysLeft)) {
        await runWithTenant(school._id, async () => {
          const admins = await User.find({ role: 'school_admin', isActive: true }).lean();
          for (const admin of admins) {
            await Notification.create({
              schoolId: school._id,
              userId: admin._id,
              type: 'general',
              title: daysLeft <= 0 ? 'Subscription Expired' : `Subscription Expiring in ${daysLeft} Day(s)`,
              message:
                daysLeft <= 0
                  ? 'Your school subscription has expired. Please renew to avoid service interruption.'
                  : `Your school subscription expires in ${daysLeft} day(s). Visit Subscription to view billing details.`,
              link: '/admin/subscription',
            });
          }
        });
      }
    }

    return { checked: schools.length, expiredCount };
  });
}

export function initScheduledJobs() {
  // Run every night at midnight: '0 0 * * *'
  cron.schedule('0 0 * * *', async () => {
    console.log('[CRON] Running nightly SaaS subscription & Academic Intelligence jobs...');
    try {
      const subRes = await runDailySubscriptionCheck();
      console.log(`[CRON] Subscription check complete:`, subRes);
    } catch (err) {
      console.error('[CRON] Error in subscription check:', err.message);
    }

    try {
      const schools = await School.find({ softDeletedAt: null, status: { $in: ['active', 'trial'] } }).lean();
      for (const school of schools) {
        await runWithTenant(school._id, async () => {
          await evaluateAllStudentsRisk();

          const now = new Date();
          const nextWeek = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
          const upcomingStructures = await FeeStructure.find({
            dueDate: { $gte: now, $lte: nextWeek },
          }).lean();

          for (const fs of upcomingStructures) {
            const students = await Student.find({ classId: fs.classId }).populate('parentIds').lean();
            for (const stu of students) {
              const paid = await FeePayment.exists({ studentId: stu._id, feeStructureId: fs._id, status: 'paid' });
              if (!paid && stu.parentIds) {
                for (const p of stu.parentIds) {
                  if (p.userId) {
                    await Notification.create({
                      schoolId: school._id,
                      userId: p.userId,
                      type: 'fee',
                      title: `Fee Due Reminder: ${fs.name}`,
                      message: `Payment of $${fs.totalAmount} is due on ${new Date(fs.dueDate).toLocaleDateString()}`,
                      link: '/parent/fees',
                    });
                  }
                }
              }
            }
          }
        });
      }
    } catch (err) {
      console.error('[CRON] Error in nightly intelligence/fee reminders:', err.message);
    }
  });

  console.log('[CRON] Scheduled jobs initialized (nightly 00:00).');
}

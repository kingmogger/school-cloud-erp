import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ClipboardCheck, CheckCircle2, XCircle, AlertTriangle, ChevronLeft, ChevronRight, ChevronDown, ChevronUp } from 'lucide-react';
import { api } from '../../api/client';
import { StatCard, DataTable, Badge, Skeleton, Button, inputClass } from '../../components/ui';

const STATUS_DOT = {
  present: 'bg-emerald-500 text-white',
  absent: 'bg-rose-500 text-white',
  late: 'bg-amber-500 text-white',
  excused: 'bg-indigo-500 text-white',
};

const STATUS_BADGE = {
  present: 'emerald',
  absent: 'rose',
  late: 'amber',
  excused: 'indigo',
};

export function StudentAttendancePage() {
  const [monthDate, setMonthDate] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [expandedSubjectId, setExpandedSubjectId] = useState(null);
  const [subjectFilter, setSubjectFilter] = useState('');

  const { data, isLoading, isError } = useQuery({
    queryKey: ['student-attendance'],
    queryFn: async () => (await api.get('/student/attendance')).data.data,
    refetchOnWindowFocus: true,
    refetchInterval: 5000,
  });

  if (isLoading) return <Skeleton className="h-48 w-full" />;
  if (isError) {
    return (
      <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
        Unable to load attendance records.
      </div>
    );
  }

  const { summary, bySubject = [], records = [] } = data || {};
  const threshold = summary?.threshold || 75;
  const isBelowThreshold = (summary?.total || 0) > 0 && (summary?.percentage ?? 100) < threshold;

  // Build calendar grid for monthDate
  const year = monthDate.getFullYear();
  const month = monthDate.getMonth();
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const statusByDateKey = new Map();
  for (const r of records) {
    if (r.dateKey && !statusByDateKey.has(r.dateKey)) {
      statusByDateKey.set(r.dateKey, r.status);
    }
  }

  const cells = [];
  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) {
    const key = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    cells.push({ day: d, key, status: statusByDateKey.get(key) || null });
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">My Attendance</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Live attendance calendar, subject breakdown, and daily log (auto-refreshes every 30s)
        </p>
      </div>

      {isBelowThreshold && (
        <div
          role="alert"
          className="rounded-2xl border border-amber-300 dark:border-amber-900 bg-amber-50 dark:bg-amber-950/50 p-4 flex items-start gap-3 text-sm text-amber-800 dark:text-amber-200"
        >
          <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
          <div>
            <strong>Attendance Warning:</strong> Your overall attendance ({summary?.percentage}%) is below the
            school minimum threshold of {threshold}%.
          </div>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Overall Attendance"
          value={`${summary?.percentage ?? 100}%`}
          subtitle={`Threshold: ${threshold}%`}
          icon={ClipboardCheck}
        />
        <StatCard
          title="Today's Status"
          value={summary?.todayStatus ? summary.todayStatus.toUpperCase() : 'Not marked'}
          subtitle={`This month: ${summary?.monthPercentage ?? 100}%`}
          icon={CheckCircle2}
        />
        <StatCard
          title="Classes Present"
          value={summary?.present ?? 0}
          subtitle={`Out of ${summary?.total ?? 0} sessions`}
          icon={CheckCircle2}
        />
        <StatCard
          title="Absences & Late"
          value={summary?.absent ?? 0}
          subtitle={`${summary?.late ?? 0} late · ${summary?.excused ?? 0} leave`}
          icon={XCircle}
        />
      </div>

      {/* Calendar + Per-Subject Breakdown */}
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-slate-900 dark:text-white">
              {monthDate.toLocaleString('default', { month: 'long', year: 'numeric' })}
            </h3>
            <div className="flex gap-1">
              <Button size="sm" variant="secondary" onClick={() => setMonthDate(new Date(year, month - 1, 1))}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button size="sm" variant="secondary" onClick={() => setMonthDate(new Date(year, month + 1, 1))}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-7 gap-1 text-center text-xs font-medium text-slate-500">
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
              <div key={d} className="py-1">{d}</div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-1.5 text-center text-xs">
            {cells.map((cell, idx) =>
              cell ? (
                <div
                  key={cell.key}
                  title={cell.status ? `${cell.key}: ${cell.status}` : cell.key}
                  className={`h-9 flex items-center justify-center rounded-lg font-medium ${
                    cell.status
                      ? STATUS_DOT[cell.status]
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                  }`}
                >
                  {cell.day}
                </div>
              ) : (
                <div key={`empty-${idx}`} />
              )
            )}
          </div>

          <div className="flex flex-wrap gap-3 pt-2 text-xs text-slate-600 dark:text-slate-400">
            <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-emerald-500" /> Present</span>
            <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-rose-500" /> Absent</span>
            <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-amber-500" /> Late</span>
            <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-indigo-500" /> Leave</span>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-4">
          <h3 className="font-semibold text-slate-900 dark:text-white">Attendance by Subject</h3>
          {bySubject.length === 0 ? (
            <p className="text-sm text-slate-500">No subject attendance recorded yet.</p>
          ) : (
            <div className="space-y-3">
              {bySubject.map((sub) => {
                const isExpanded = expandedSubjectId === sub.subjectId;
                const attended = sub.attended ?? (sub.present + sub.late + (sub.excused || 0));
                return (
                  <div key={sub.subjectId} className="rounded-xl border border-slate-200/80 dark:border-slate-800 p-3 space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <span className="font-semibold text-sm text-slate-900 dark:text-white">
                          {sub.subjectName}
                          {sub.subjectCode ? ` (${sub.subjectCode})` : ''}
                        </span>
                        <div className="flex flex-wrap gap-3 text-xs text-slate-500 mt-0.5">
                          <span>Total: <strong>{sub.total}</strong></span>
                          <span className="text-emerald-600 dark:text-emerald-400">Attended: <strong>{attended}</strong></span>
                          <span className="text-rose-600 dark:text-rose-400">Absent: <strong>{sub.absent}</strong></span>
                          {sub.late > 0 && <span className="text-amber-600">Late: <strong>{sub.late}</strong></span>}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge color={sub.percentage < threshold ? 'rose' : 'emerald'}>
                          {sub.percentage}%
                        </Badge>
                        {sub.history?.length > 0 && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => setExpandedSubjectId(isExpanded ? null : sub.subjectId)}
                          >
                            {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                          </Button>
                        )}
                      </div>
                    </div>

                    <div className="h-2 w-full rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden">
                      <div
                        className={`h-full rounded-full ${sub.percentage < threshold ? 'bg-rose-500' : 'bg-emerald-500'}`}
                        style={{ width: `${Math.min(100, sub.percentage)}%` }}
                      />
                    </div>

                    {isExpanded && sub.history?.length > 0 && (
                      <div className="pt-2 border-t border-slate-100 dark:border-slate-800 space-y-1.5 max-h-48 overflow-y-auto">
                        {sub.history.map((h) => (
                          <div key={h._id} className="flex items-center justify-between text-xs py-1">
                            <span className="text-slate-600 dark:text-slate-300">
                              {h.dateKey}
                              {h.startTime ? ` · ${h.startTime}–${h.endTime}` : ''}
                              {h.room ? ` · Room ${h.room}` : ''}
                            </span>
                            <Badge color={STATUS_BADGE[h.status] || 'slate'}>{h.status}</Badge>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="font-semibold text-slate-900 dark:text-white">Attendance History</h3>
          {bySubject.length > 0 && (
            <select
              className={`${inputClass} max-w-xs`}
              value={subjectFilter}
              onChange={(e) => setSubjectFilter(e.target.value)}
            >
              <option value="">All Subjects</option>
              {bySubject.map((sub) => (
                <option key={sub.subjectId} value={sub.subjectId}>
                  {sub.subjectName}
                </option>
              ))}
            </select>
          )}
        </div>

        <DataTable
          emptyTitle="No attendance records yet"
          emptyDescription="Your daily and subject-wise attendance will appear here once marked."
          columns={[
            { key: 'dateKey', label: 'Date', render: (r) => r.dateKey || new Date(r.date).toLocaleDateString() },
            { key: 'subject', label: 'Subject', render: (r) => r.subjectId?.name || 'Daily Roll' },
            {
              key: 'time',
              label: 'Class Timing',
              render: (r) => (r.startTime ? `${r.startTime} – ${r.endTime}` : '—'),
            },
            { key: 'room', label: 'Room', render: (r) => (r.room ? `Room ${r.room}` : '—') },
            {
              key: 'status',
              label: 'Status',
              render: (r) => <Badge color={STATUS_BADGE[r.status] || 'slate'}>{r.status}</Badge>,
            },
            { key: 'remarks', label: 'Remarks', render: (r) => r.remarks || '—' },
          ]}
          data={
            subjectFilter
              ? records.filter((r) => String(r.subjectId?._id || 'daily') === String(subjectFilter))
              : records
          }
        />
      </div>
    </div>
  );
}

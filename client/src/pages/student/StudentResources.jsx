import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ExternalLink, Clock, MapPin, User, ChevronLeft, ChevronRight } from 'lucide-react';
import { api, openProtectedFile, getApiErrorMessage } from '../../api/client';
import { useToast } from '../../context/ToastContext';
import { DataTable, EmptyState, Skeleton, Button, Badge } from '../../components/ui';

export function StudentMaterialsPage() {
  const { addToast } = useToast();
  const { data: materials = [], isLoading } = useQuery({
    queryKey: ['student-materials'],
    queryFn: async () => (await api.get('/student/materials')).data.data,
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Study Materials</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">Course notes and resources uploaded by your teachers</p>
      </div>
      <DataTable
        loading={isLoading}
        columns={[
          { key: 'title', label: 'Title' },
          { key: 'subject', label: 'Subject', render: (r) => r.subjectId?.name },
          {
            key: 'faculty',
            label: 'Teacher',
            render: (r) => (
              <div>
                <p className="font-medium text-slate-900 dark:text-white">{r.facultyId?.userId?.name || '—'}</p>
                {r.facultyId?.userId?.phone && (
                  <a
                    href={`tel:${r.facultyId.userId.phone.replace(/[^+\d]/g, '')}`}
                    className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline"
                  >
                    {r.facultyId.userId.phone}
                  </a>
                )}
              </div>
            ),
          },
          {
            key: 'file',
            label: 'Resource',
            render: (r) =>
              r.fileUrl ? (
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => openProtectedFile(r.fileUrl).catch((e) => addToast(getApiErrorMessage(e), 'error'))}
                >
                  <ExternalLink className="h-3.5 w-3.5" /> Open File
                </Button>
              ) : (
                '—'
              ),
          },
        ]}
        data={materials}
      />
    </div>
  );
}

const ATTENDANCE_STATUS_BADGE = {
  present: 'emerald',
  absent: 'rose',
  late: 'amber',
  excused: 'indigo',
};

function getMondayKey(date = new Date()) {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const day = d.getUTCDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setUTCDate(d.getUTCDate() + diff);
  return d.toISOString().slice(0, 10);
}

function addDaysKey(dateKey, days) {
  const d = new Date(`${dateKey}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function StudentTimetablePage() {
  const [weekStart, setWeekStart] = useState(() => getMondayKey());
  const [viewMode, setViewMode] = useState('weekly'); // 'today' | 'weekly'
  const todayKey = new Date().toISOString().slice(0, 10);

  const { data, isLoading } = useQuery({
    queryKey: ['student-timetable', weekStart],
    queryFn: async () => (await api.get('/student/timetable', { params: { weekStart } })).data.data,
    refetchOnWindowFocus: true,
    refetchInterval: 10000,
  });

  if (isLoading) return <Skeleton className="h-48 w-full" />;

  const days = data?.days || [];
  const visibleDays = viewMode === 'today' ? days.filter((d) => d.dateKey === todayKey) : days;
  const hasAnySlots = visibleDays.some((d) => (d.slots?.length || 0) > 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
            {viewMode === 'today' ? "Today's Classes" : 'Weekly Timetable'}
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            {viewMode === 'today'
              ? `Classes scheduled for today (${todayKey})`
              : `Monday – Saturday schedule (${data?.weekStart || weekStart} to ${data?.weekEnd || addDaysKey(weekStart, 5)})`}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-900 p-0.5">
            <button
              type="button"
              onClick={() => {
                setViewMode('today');
                setWeekStart(getMondayKey());
              }}
              className={`px-3 py-1.5 text-xs font-medium rounded-md cursor-pointer transition ${
                viewMode === 'today'
                  ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              Today
            </button>
            <button
              type="button"
              onClick={() => setViewMode('weekly')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md cursor-pointer transition ${
                viewMode === 'weekly'
                  ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              Weekly
            </button>
          </div>

          {viewMode === 'weekly' && (
            <>
              <Button size="sm" variant="secondary" onClick={() => setWeekStart(addDaysKey(weekStart, -7))}>
                <ChevronLeft className="h-4 w-4" /> Prev
              </Button>
              <Button size="sm" variant="secondary" onClick={() => setWeekStart(getMondayKey())}>
                This Week
              </Button>
              <Button size="sm" variant="secondary" onClick={() => setWeekStart(addDaysKey(weekStart, 7))}>
                Next <ChevronRight className="h-4 w-4" />
              </Button>
            </>
          )}
        </div>
      </div>

      {!hasAnySlots ? (
        <EmptyState
          title={viewMode === 'today' ? 'No Classes Scheduled Today' : 'No Classes Scheduled This Week'}
          description={
            viewMode === 'today'
              ? 'You have no classes scheduled for today. Switch to Weekly view to see the rest of your schedule.'
              : 'Your class timetable for this week has no scheduled sessions yet. Check another week or wait for your faculty to schedule classes.'
          }
          action={
            viewMode === 'today' ? (
              <Button size="sm" variant="secondary" onClick={() => setViewMode('weekly')}>
                View Weekly Timetable
              </Button>
            ) : undefined
          }
        />
      ) : (
        <div className={viewMode === 'today' ? 'max-w-2xl' : 'grid gap-4 md:grid-cols-2 lg:grid-cols-3'}>
          {visibleDays.map((day) => {
            const isToday = day.dateKey === todayKey;
            return (
              <div
                key={day.dayOfWeek}
                className={`rounded-2xl border p-5 space-y-3 ${
                  isToday
                    ? 'border-indigo-400 dark:border-indigo-700 bg-indigo-50/40 dark:bg-indigo-950/20'
                    : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-slate-900 dark:text-white">{day.dayOfWeek}</h3>
                    {isToday && <Badge color="indigo">Today</Badge>}
                  </div>
                  <span className="text-xs text-slate-500">{day.dateKey}</span>
                </div>

                {(!day.slots || day.slots.length === 0) ? (
                  <p className="text-xs text-slate-400 py-2">No classes scheduled</p>
                ) : (
                  <div className="space-y-2.5">
                    {day.slots.map((s, i) => (
                      <div
                        key={s._id || i}
                        className="rounded-xl border border-slate-200/80 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 px-3.5 py-2.5 text-sm space-y-1.5"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span className="font-semibold text-slate-900 dark:text-white">
                              {s.scheduleType === 'event'
                                ? s.title
                                : `${s.subjectId?.name || 'Subject'}${s.subjectId?.code ? ` (${s.subjectId.code})` : ''}`}
                            </span>
                            {s.scheduleType === 'event' && <Badge color="amber">Event</Badge>}
                          </div>
                          {s.attendanceStatus ? (
                            <Badge color={ATTENDANCE_STATUS_BADGE[s.attendanceStatus] || 'slate'} className="capitalize">
                              {s.attendanceStatus}
                            </Badge>
                          ) : s.attendanceMarked ? (
                            <Badge color="slate">Marked</Badge>
                          ) : null}
                        </div>
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-600 dark:text-slate-400">
                          <span className="flex items-center gap-1">
                            <User className="h-3.5 w-3.5" /> {s.facultyName || s.facultyId?.userId?.name || 'Faculty'}
                          </span>
                          <span className="flex items-center gap-1">
                            <Clock className="h-3.5 w-3.5" /> {s.startTime} – {s.endTime}
                          </span>
                          <span className="flex items-center gap-1">
                            <MapPin className="h-3.5 w-3.5" /> Room {s.room || '—'}
                          </span>
                        </div>
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
  );
}

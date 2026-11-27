import { useQuery } from '@tanstack/react-query';
import { ExternalLink } from 'lucide-react';
import { api, openProtectedFile, getApiErrorMessage } from '../../api/client';
import { useToast } from '../../context/ToastContext';
import { DataTable, EmptyState, Skeleton, Button } from '../../components/ui';

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

export function StudentTimetablePage() {
  const { data: timetable = [], isLoading } = useQuery({
    queryKey: ['student-timetable'],
    queryFn: async () => (await api.get('/student/timetable')).data.data,
  });

  if (isLoading) return <Skeleton className="h-48 w-full" />;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Weekly Timetable</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">Your class schedule</p>
      </div>
      {timetable.length === 0 ? (
        <EmptyState title="No Timetable Published" description="Your class timetable has not been configured yet." />
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {timetable.map((day) => (
            <div key={day._id} className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5">
              <h3 className="font-semibold text-slate-900 dark:text-white mb-3">{day.dayOfWeek}</h3>
              <div className="space-y-2">
                {day.slots?.map((s, i) => (
                  <div key={i} className="flex items-center justify-between rounded-lg bg-slate-50 dark:bg-slate-950 px-3 py-2 text-sm">
                    <span className="font-medium text-slate-800 dark:text-slate-200">{s.subjectId?.name}</span>
                    <span className="text-xs text-slate-500">{s.startTime} – {s.endTime} · Room {s.room || '—'}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

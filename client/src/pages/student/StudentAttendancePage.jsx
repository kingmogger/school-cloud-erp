import { useQuery } from '@tanstack/react-query';
import { api } from '../../api/client';
import { StatCard, DataTable, Badge, Skeleton } from '../../components/ui';
import { ClipboardCheck, CheckCircle2, XCircle } from 'lucide-react';

export function StudentAttendancePage() {
  const { data, isLoading } = useQuery({
    queryKey: ['student-attendance'],
    queryFn: async () => (await api.get('/student/attendance')).data.data,
  });

  if (isLoading) return <Skeleton className="h-48 w-full" />;
  const { summary, records } = data || {};

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">My Attendance</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">Attendance percentage and daily log</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard title="Overall Attendance" value={`${summary?.percentage ?? 100}%`} subtitle={`Threshold: ${summary?.threshold || 75}%`} icon={ClipboardCheck} />
        <StatCard title="Classes Present" value={summary?.present ?? 0} subtitle={`Out of ${summary?.total ?? 0} sessions`} icon={CheckCircle2} />
        <StatCard title="Absences" value={summary?.absent ?? 0} subtitle={`${summary?.late ?? 0} late`} icon={XCircle} />
      </div>

      <DataTable
        columns={[
          { key: 'date', label: 'Date', render: (r) => new Date(r.date).toLocaleDateString() },
          { key: 'subject', label: 'Subject', render: (r) => r.subjectId?.name || 'Daily Roll' },
          {
            key: 'status',
            label: 'Status',
            render: (r) => (
              <Badge color={r.status === 'present' ? 'emerald' : r.status === 'absent' ? 'rose' : 'amber'}>
                {r.status}
              </Badge>
            ),
          },
          { key: 'remarks', label: 'Remarks', render: (r) => r.remarks || '—' },
        ]}
        data={records || []}
      />
    </div>
  );
}

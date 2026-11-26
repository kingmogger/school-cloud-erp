import { useQuery } from '@tanstack/react-query';
import { BookOpen, Users, ClipboardCheck } from 'lucide-react';
import { api } from '../../api/client';
import { StatCard, DataTable, Skeleton } from '../../components/ui';

export function FacultyDashboard() {
  const { data, isLoading } = useQuery({
    queryKey: ['faculty-analytics'],
    queryFn: async () => (await api.get('/faculty/analytics')).data.data,
  });

  if (isLoading) return <Skeleton className="h-40 w-full" />;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Faculty Dashboard</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">Your assigned classes, subjects, and student roster</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard title="Assigned Subjects" value={data?.subjects?.length || 0} icon={BookOpen} />
        <StatCard title="Classes Taught" value={data?.classesCount || 0} icon={ClipboardCheck} />
        <StatCard title="Total Students" value={data?.totalStudents || 0} icon={Users} />
      </div>

      <div className="space-y-3">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-white">My Assigned Subjects</h2>
        <DataTable
          columns={[
            { key: 'code', label: 'Code' },
            { key: 'name', label: 'Subject' },
            { key: 'class', label: 'Class', render: (r) => r.classId?.name || '—' },
            { key: 'maxMarks', label: 'Max Marks' },
          ]}
          data={data?.subjects || []}
        />
      </div>
    </div>
  );
}

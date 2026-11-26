import { useQuery } from '@tanstack/react-query';
import { Users, GraduationCap, BookOpen, ClipboardCheck, CreditCard } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { api } from '../../api/client';
import { StatCard, ChartWrapper, Skeleton } from '../../components/ui';

export function AdminDashboard() {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['admin-dashboard'],
    queryFn: async () => (await api.get('/admin/dashboard')).data.data,
  });

  if (isLoading) {
    return (
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[1, 2, 3, 4].map((i) => (
          <Skeleton key={i} className="h-28 w-full" />
        ))}
      </div>
    );
  }

  if (isError || !data) {
    return <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">Failed to load dashboard metrics.</div>;
  }

  const attendanceChart = [
    { name: 'Present', count: data.todayAttendance?.present || 0 },
    { name: 'Absent', count: data.todayAttendance?.absent || 0 },
    { name: 'Late', count: data.todayAttendance?.late || 0 },
  ];

  const feeChart = [
    { name: 'Collected', amount: data.fees?.collected || 0 },
    { name: 'Pending', amount: data.fees?.pending || 0 },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Admin Dashboard</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">School-wide enrollment, attendance, and financial overview</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard title="Active Students" value={data.totalStudents} subtitle="Enrolled this year" icon={GraduationCap} />
        <StatCard title="Active Faculty" value={data.totalFaculty} subtitle={`${data.totalSubjects} subjects taught`} icon={Users} />
        <StatCard title="Today's Attendance" value={data.todayAttendance?.total || 0} subtitle={`${data.todayAttendance?.present || 0} present`} icon={ClipboardCheck} />
        <StatCard title="Fees Collected" value={`$${(data.fees?.collected || 0).toLocaleString()}`} subtitle={`$${(data.fees?.pending || 0).toLocaleString()} pending`} icon={CreditCard} />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <ChartWrapper title="Today's Attendance Breakdown" subtitle="Live attendance across all sections">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={attendanceChart}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="name" />
              <YAxis allowDecimals={false} />
              <Tooltip />
              <Bar dataKey="count" fill="#4f46e5" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartWrapper>

        <ChartWrapper title="Fee Collection Summary" subtitle="Collected vs Pending">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={feeChart}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip />
              <Bar dataKey="amount" fill="#10b981" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartWrapper>
      </div>
    </div>
  );
}

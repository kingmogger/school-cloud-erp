import { useQuery } from '@tanstack/react-query';
import { Award, ClipboardCheck, TrendingUp, AlertTriangle } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { api } from '../../api/client';
import { StatCard, ChartWrapper, Badge, Skeleton } from '../../components/ui';

export function StudentDashboard() {
  const { data, isLoading } = useQuery({
    queryKey: ['student-profile'],
    queryFn: async () => (await api.get('/student/profile')).data.data,
  });

  if (isLoading) return <Skeleton className="h-48 w-full" />;

  const { student, attendance, grades, trends, strengthsWeaknesses } = data || {};

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Welcome, {student?.userId?.name}</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          {student?.classId?.name} — Section {student?.sectionId?.name} · Admission {student?.admissionNo}
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Attendance"
          value={`${attendance?.percentage ?? 100}%`}
          subtitle={attendance?.isShortage ? `Below ${attendance.threshold}% threshold` : 'Good standing'}
          icon={ClipboardCheck}
        />
        <StatCard title="Cumulative GPA" value={grades?.gpa ?? 0} subtitle={`Overall Grade: ${grades?.overallGrade || 'N/A'}`} icon={Award} />
        <StatCard title="Overall Average" value={`${grades?.percentage ?? 0}%`} subtitle={`${grades?.subjectsCount || 0} subjects`} icon={TrendingUp} />
        <StatCard
          title="Strengths"
          value={strengthsWeaknesses?.strengths?.length || 0}
          subtitle={`${strengthsWeaknesses?.weaknesses?.length || 0} subjects need focus`}
          icon={AlertTriangle}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <ChartWrapper title="Exam Performance Trend" subtitle="Percentage across exams">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={trends || []}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="examName" />
              <YAxis domain={[0, 100]} />
              <Tooltip />
              <Line type="monotone" dataKey="percentage" stroke="#4f46e5" strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        </ChartWrapper>

        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-4">
          <h3 className="font-semibold text-slate-900 dark:text-white">Subject Strengths & Focus Areas</h3>
          <div>
            <p className="text-xs font-medium uppercase text-slate-500 mb-2">Strengths (≥ 75%)</p>
            <div className="flex flex-wrap gap-2">
              {(strengthsWeaknesses?.strengths || []).length === 0 ? (
                <span className="text-xs text-slate-400">No data yet</span>
              ) : (
                strengthsWeaknesses.strengths.map((s) => (
                  <Badge key={s.name} color="emerald">{s.name}: {s.percentage}%</Badge>
                ))
              )}
            </div>
          </div>
          <div>
            <p className="text-xs font-medium uppercase text-slate-500 mb-2">Needs Attention (&lt; 60%)</p>
            <div className="flex flex-wrap gap-2">
              {(strengthsWeaknesses?.weaknesses || []).length === 0 ? (
                <span className="text-xs text-slate-400">None</span>
              ) : (
                strengthsWeaknesses.weaknesses.map((w) => (
                  <Badge key={w.name} color="rose">{w.name}: {w.percentage}%</Badge>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

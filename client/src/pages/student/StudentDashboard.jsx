import { useQuery } from '@tanstack/react-query';
import { Award, ClipboardCheck, TrendingUp, AlertTriangle, Phone } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { api } from '../../api/client';
import { StatCard, ChartWrapper, Badge, Skeleton } from '../../components/ui';

export function StudentDashboard() {
  const { data, isLoading } = useQuery({
    queryKey: ['student-profile'],
    queryFn: async () => (await api.get('/student/profile')).data.data,
    refetchOnWindowFocus: true,
    refetchInterval: 5000,
  });

  const { data: notifications = [] } = useQuery({
    queryKey: ['student-notifications'],
    queryFn: async () => (await api.get('/student/notifications')).data.data,
    refetchOnWindowFocus: true,
    refetchInterval: 5000,
  });

  if (isLoading) return <Skeleton className="h-48 w-full" />;

  const { student, attendance, grades, trends, strengthsWeaknesses, teachers = [] } = data || {};

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
          title="Today's Attendance"
          value={attendance?.todayStatus ? attendance.todayStatus.toUpperCase() : 'Not marked yet'}
          subtitle={`This month: ${attendance?.monthPercentage ?? 100}% · Overall: ${attendance?.percentage ?? 100}%`}
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

      {teachers.length > 0 && (
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-3">
          <h3 className="font-semibold text-slate-900 dark:text-white">My Teachers</h3>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {teachers.map((t) => (
              <div
                key={t._id}
                className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 p-3.5"
              >
                <div className="min-w-0">
                  <p className="font-semibold text-sm text-slate-900 dark:text-white truncate">{t.name}</p>
                  <p className="text-xs text-slate-500 truncate">
                    {t.subjects?.length > 0 ? t.subjects.join(', ') : t.department || 'Faculty'}
                  </p>
                </div>
                {t.phone ? (
                  <a
                    href={`tel:${t.phone.replace(/[^+\d]/g, '')}`}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 px-2.5 py-1.5 text-xs font-medium text-indigo-700 dark:text-indigo-300 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 shrink-0"
                    title={`Call ${t.name}`}
                  >
                    <Phone className="h-3.5 w-3.5" />
                    {t.phone}
                  </a>
                ) : (
                  <span className="text-xs text-slate-400 shrink-0">No phone</span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {notifications.length > 0 && (
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-3">
          <h3 className="font-semibold text-slate-900 dark:text-white">Recent Notifications</h3>
          <div className="space-y-2">
            {notifications.slice(0, 5).map((n) => (
              <div key={n._id} className="flex items-start justify-between gap-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 p-3 text-sm">
                <div>
                  <p className="font-medium text-slate-900 dark:text-white">{n.title}</p>
                  <p className="text-xs text-slate-500">{n.message}</p>
                </div>
                <span className="text-xs text-slate-400 shrink-0">{new Date(n.createdAt).toLocaleDateString()}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

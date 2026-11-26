import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Building2, Users, CreditCard, AlertTriangle, Calendar, Sliders, Database, ArrowRight } from 'lucide-react';
import { api } from '../../api/client';
import { StatCard, DataTable, Badge, Skeleton, Button } from '../../components/ui';

export function SuperAdminDashboard() {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['superadmin-dashboard'],
    queryFn: async () => (await api.get('/superadmin/dashboard')).data.data,
  });

  if (isLoading) return <Skeleton className="h-48 w-full" />;
  if (isError || !data) return <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">Failed to load platform metrics.</div>;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Platform Overview</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">Multi-tenant SaaS health, revenue, and tenant activity</p>
        </div>
        <Link to="/superadmin/control-panel">
          <Button className="bg-indigo-600 hover:bg-indigo-700 text-white">
            <Sliders className="h-4 w-4" /> Open Master Control Panel <ArrowRight className="h-4 w-4 ml-1" />
          </Button>
        </Link>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Total Schools"
          value={data.totalSchools}
          subtitle={`${data.counts?.active || 0} active · ${data.counts?.trial || 0} trial · ${data.counts?.suspended || 0} suspended`}
          icon={Building2}
        />
        <StatCard title="Platform Users" value={data.totalUsers} subtitle={`${data.totalStudents} active students`} icon={Users} />
        <StatCard title="Monthly Recurring Revenue" value={`$${(data.mrr || 0).toLocaleString()}`} subtitle="Active subscriptions" icon={CreditCard} />
        <StatCard title="Overdue Schools" value={data.overdueCount || 0} subtitle={`${data.upcomingRenewals?.length || 0} renewals in 30d`} icon={AlertTriangle} />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-3">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white flex items-center gap-2">
            <Calendar className="h-4 w-4 text-indigo-500" /> Upcoming Renewals (Next 30 Days)
          </h2>
          <DataTable
            emptyTitle="No renewals due in 30 days"
            columns={[
              { key: 'name', label: 'School' },
              { key: 'code', label: 'Code' },
              { key: 'plan', label: 'Plan', render: (r) => r.plan || 'Trial' },
              { key: 'endDate', label: 'Due Date', render: (r) => new Date(r.endDate).toLocaleDateString() },
            ]}
            data={data.upcomingRenewals || []}
          />
        </div>

        <div className="space-y-3">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Recent Platform Activity</h2>
          <DataTable
            columns={[
              { key: 'action', label: 'Action', render: (r) => <Badge color="indigo">{r.action}</Badge> },
              { key: 'school', label: 'School', render: (r) => r.targetSchoolId?.name || 'Platform' },
              { key: 'reason', label: 'Reason', render: (r) => r.reason || '—' },
              { key: 'date', label: 'When', render: (r) => new Date(r.createdAt).toLocaleString() },
            ]}
            data={data.recentLogs || []}
          />
        </div>
      </div>
    </div>
  );
}

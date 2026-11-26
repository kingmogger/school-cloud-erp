import { useQuery } from '@tanstack/react-query';
import { Download, ShieldAlert, CreditCard, Users, GraduationCap } from 'lucide-react';
import { api } from '../../api/client';
import { StatCard, DataTable, Badge, Button, Skeleton } from '../../components/ui';

const STATUS_COLOR = {
  active: 'emerald',
  trial: 'indigo',
  grace: 'amber',
  suspended: 'rose',
  expired: 'rose',
};

export function SubscriptionPage() {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['school-subscription'],
    queryFn: async () => (await api.get('/admin/subscription')).data.data,
  });

  const downloadReceipt = async (paymentId, invoiceNo) => {
    const res = await api.get(`/admin/subscription/receipt/${paymentId}`, { responseType: 'blob' });
    const url = window.URL.createObjectURL(new Blob([res.data]));
    const a = document.createElement('a');
    a.href = url;
    a.download = `Invoice_${invoiceNo}.pdf`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  if (isLoading) return <Skeleton className="h-48 w-full" />;
  if (isError) return <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">Unable to load subscription details.</div>;

  const { school, plan, statusInfo, usage, payments, support } = data;

  return (
    <div className="space-y-6">
      {statusInfo?.isBlocked && (
        <div role="alert" className="rounded-2xl border border-rose-300 dark:border-rose-900 bg-rose-50 dark:bg-rose-950/60 p-6 space-y-2">
          <div className="flex items-center gap-2 text-rose-700 dark:text-rose-300 font-bold text-lg">
            <ShieldAlert className="h-6 w-6" />
            <span>Subscription {statusInfo.effectiveStatus === 'suspended' ? 'Suspended' : 'Expired'}</span>
          </div>
          <p className="text-sm text-rose-800 dark:text-rose-200">{statusInfo.reason || support?.message}</p>
          <p className="text-sm text-rose-700 dark:text-rose-300">
            <strong>Payment Instructions:</strong> {support?.paymentInstructions}
          </p>
          <p className="text-xs text-rose-600 dark:text-rose-400">
            Contact Platform Owner: {support?.email} · {support?.phone}
          </p>
        </div>
      )}

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">School Subscription</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">{school?.name} ({school?.code})</p>
        </div>
        <Badge color={STATUS_COLOR[statusInfo?.effectiveStatus] || 'slate'} className="text-sm px-3 py-1">
          {statusInfo?.effectiveStatus?.toUpperCase()}
        </Badge>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard
          title="Current Plan"
          value={plan?.name || 'Free Trial'}
          subtitle={plan ? `$${plan.price} / ${plan.billingCycle}` : 'Trial period'}
          icon={CreditCard}
        />
        <StatCard
          title="Paid Until"
          value={school?.endDate ? new Date(school.endDate).toLocaleDateString() : '—'}
          subtitle={`${statusInfo?.daysRemaining ?? 0} day(s) remaining`}
          icon={ShieldAlert}
        />
        <StatCard
          title="Student & Faculty Usage"
          value={`${usage?.students || 0} / ${usage?.maxStudents || '∞'}`}
          subtitle={`Faculty: ${usage?.faculty || 0} / ${usage?.maxFaculty || '∞'}`}
          icon={GraduationCap}
        />
      </div>

      <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-2">
        <h3 className="font-semibold text-slate-900 dark:text-white">Billing & Support Contact</h3>
        <p className="text-sm text-slate-600 dark:text-slate-300">{support?.paymentInstructions}</p>
        <p className="text-xs text-slate-500">Email: {support?.email} · Phone: {support?.phone}</p>
      </div>

      <div className="space-y-3">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Payment History & Receipts</h2>
        <DataTable
          columns={[
            { key: 'invoiceNo', label: 'Invoice No', render: (r) => <span className="font-mono font-semibold">{r.invoiceNo}</span> },
            { key: 'plan', label: 'Plan', render: (r) => r.planId?.name || 'Subscription' },
            { key: 'amount', label: 'Amount', render: (r) => `$${r.amount}` },
            { key: 'paidAt', label: 'Paid Date', render: (r) => new Date(r.paidAt).toLocaleDateString() },
            {
              key: 'pdf',
              label: 'Receipt',
              render: (r) => (
                <Button size="sm" variant="secondary" onClick={() => downloadReceipt(r._id, r.invoiceNo)}>
                  <Download className="h-3.5 w-3.5" /> PDF
                </Button>
              ),
            },
          ]}
          data={payments || []}
        />
      </div>
    </div>
  );
}

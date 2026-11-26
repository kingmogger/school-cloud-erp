import { useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { api, getApiErrorMessage } from '../../api/client';
import { useToast } from '../../context/ToastContext';
import { DataTable, Badge, Button, FormField, Skeleton, inputClass } from '../../components/ui';

export function PlatformAuditPage() {
  const { data: res, isLoading } = useQuery({
    queryKey: ['superadmin-audit-logs'],
    queryFn: async () => (await api.get('/superadmin/audit-logs')).data,
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Platform Audit Log</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">Every super admin action across all tenant schools</p>
      </div>
      <DataTable
        loading={isLoading}
        columns={[
          { key: 'action', label: 'Action', render: (r) => <Badge color="indigo">{r.action}</Badge> },
          { key: 'actor', label: 'Actor', render: (r) => r.actorId?.email || '—' },
          { key: 'school', label: 'Target School', render: (r) => r.targetSchoolId?.name || 'Platform' },
          { key: 'reason', label: 'Reason', render: (r) => r.reason || '—' },
          { key: 'createdAt', label: 'Timestamp', render: (r) => new Date(r.createdAt).toLocaleString() },
        ]}
        data={res?.data || []}
      />
    </div>
  );
}

export function PlatformSettingsPage() {
  const { addToast } = useToast();
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ['superadmin-settings'],
    queryFn: async () => (await api.get('/superadmin/settings')).data.data,
  });

  const { register, handleSubmit, reset } = useForm();
  useEffect(() => {
    if (data) reset(data);
  }, [data, reset]);

  const mutation = useMutation({
    mutationFn: (vals) => api.patch('/superadmin/settings', vals),
    onSuccess: () => {
      addToast('Platform settings saved', 'success');
      qc.invalidateQueries({ queryKey: ['superadmin-settings'] });
    },
    onError: (e) => addToast(getApiErrorMessage(e), 'error'),
  });

  if (isLoading) return <Skeleton className="h-64 w-full" />;

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Platform Settings</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">Default trial, grace period, and suspended-school support details</p>
      </div>
      <form onSubmit={handleSubmit((v) => mutation.mutate(v))} className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField label="Default Trial Days"><input type="number" className={inputClass} {...register('defaultTrialDays', { valueAsNumber: true })} /></FormField>
          <FormField label="Default Grace Period Days"><input type="number" className={inputClass} {...register('gracePeriodDays', { valueAsNumber: true })} /></FormField>
          <FormField label="Support Email"><input type="email" className={inputClass} {...register('supportEmail')} /></FormField>
          <FormField label="Support Phone"><input className={inputClass} {...register('supportPhone')} /></FormField>
        </div>
        <FormField label="Suspended School Message"><input className={inputClass} {...register('supportMessage')} /></FormField>
        <FormField label="Payment Instructions"><input className={inputClass} {...register('paymentInstructions')} /></FormField>
        <Button type="submit" disabled={mutation.isPending}>Save Platform Settings</Button>
      </form>
    </div>
  );
}

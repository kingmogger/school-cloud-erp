import { useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { api, getApiErrorMessage } from '../../api/client';
import { useToast } from '../../context/ToastContext';
import { Button, FormField, Skeleton, inputClass } from '../../components/ui';

export function SettingsPage() {
  const { addToast } = useToast();
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ['admin-settings'],
    queryFn: async () => (await api.get('/admin/settings')).data.data,
  });

  const { register, handleSubmit, reset } = useForm();

  useEffect(() => {
    if (data) {
      reset({
        schoolName: data.schoolName,
        tagline: data.tagline,
        email: data.email,
        phone: data.phone,
        address: data.address,
        attendanceThreshold: data.attendanceThreshold,
        attendanceEditWindowHours: data.attendanceEditWindowHours,
      });
    }
  }, [data, reset]);

  const mutation = useMutation({
    mutationFn: (payload) => api.patch('/admin/settings', payload),
    onSuccess: () => {
      addToast('School settings updated', 'success');
      qc.invalidateQueries({ queryKey: ['admin-settings'] });
    },
    onError: (e) => addToast(getApiErrorMessage(e), 'error'),
  });

  if (isLoading) return <Skeleton className="h-64 w-full" />;

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">School Settings</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">Configure school profile, attendance thresholds, and edit windows</p>
      </div>

      <form onSubmit={handleSubmit((vals) => mutation.mutate(vals))} className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField label="School Name"><input className={inputClass} {...register('schoolName')} /></FormField>
          <FormField label="Tagline"><input className={inputClass} {...register('tagline')} /></FormField>
          <FormField label="Contact Email"><input type="email" className={inputClass} {...register('email')} /></FormField>
          <FormField label="Phone"><input className={inputClass} {...register('phone')} /></FormField>
        </div>
        <FormField label="Address"><input className={inputClass} {...register('address')} /></FormField>
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField label="Minimum Attendance Threshold (%)">
            <input type="number" className={inputClass} {...register('attendanceThreshold', { valueAsNumber: true })} />
          </FormField>
          <FormField label="Attendance Edit Window (Hours)">
            <input type="number" className={inputClass} {...register('attendanceEditWindowHours', { valueAsNumber: true })} />
          </FormField>
        </div>
        <Button type="submit" disabled={mutation.isPending}>
          {mutation.isPending ? 'Saving...' : 'Save Settings'}
        </Button>
      </form>
    </div>
  );
}

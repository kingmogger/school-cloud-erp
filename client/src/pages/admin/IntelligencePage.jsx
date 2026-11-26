import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { RefreshCw, CheckCircle } from 'lucide-react';
import { api, getApiErrorMessage } from '../../api/client';
import { useToast } from '../../context/ToastContext';
import { Button, DataTable, Badge } from '../../components/ui';

export function IntelligencePage() {
  const { addToast } = useToast();
  const qc = useQueryClient();

  const { data: alerts = [], isLoading } = useQuery({
    queryKey: ['risk-alerts'],
    queryFn: async () => (await api.get('/intelligence/risk-alerts')).data.data,
  });

  const evalMutation = useMutation({
    mutationFn: () => api.post('/intelligence/evaluate-all'),
    onSuccess: (res) => {
      addToast(`Evaluated ${res.data.data.evaluatedCount} active students`, 'success');
      qc.invalidateQueries({ queryKey: ['risk-alerts'] });
    },
    onError: (e) => addToast(getApiErrorMessage(e), 'error'),
  });

  const resolveMutation = useMutation({
    mutationFn: (id) => api.patch(`/intelligence/risk-alerts/${id}/resolve`),
    onSuccess: () => {
      addToast('Alert marked resolved', 'success');
      qc.invalidateQueries({ queryKey: ['risk-alerts'] });
    },
  });

  const levelColor = { high: 'rose', medium: 'amber', low: 'emerald' };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Academic Intelligence & Risk Alerts</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">Automated early-warning scoring from attendance, marks, and missed assignments</p>
        </div>
        <Button onClick={() => evalMutation.mutate()} disabled={evalMutation.isPending}>
          <RefreshCw className="h-4 w-4" /> {evalMutation.isPending ? 'Evaluating...' : 'Recalculate All'}
        </Button>
      </div>

      <DataTable
        loading={isLoading}
        columns={[
          { key: 'student', label: 'Student', render: (r) => r.studentId?.userId?.name || '—' },
          { key: 'class', label: 'Class', render: (r) => `${r.studentId?.classId?.name || ''} ${r.studentId?.sectionId?.name || ''}` },
          { key: 'level', label: 'Risk Level', render: (r) => <Badge color={levelColor[r.level]}>{r.level.toUpperCase()} ({r.score})</Badge> },
          { key: 'reasons', label: 'Reasons', render: (r) => <span className="text-xs whitespace-normal max-w-md block">{r.reasons?.join('; ') || 'On track'}</span> },
          {
            key: 'resolved',
            label: 'Action',
            render: (r) =>
              r.resolved ? (
                <Badge color="emerald">Resolved</Badge>
              ) : (
                <Button variant="secondary" size="sm" onClick={() => resolveMutation.mutate(r._id)}>
                  <CheckCircle className="h-3.5 w-3.5" /> Resolve
                </Button>
              ),
          },
        ]}
        data={alerts}
      />
    </div>
  );
}

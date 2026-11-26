import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus } from 'lucide-react';
import { api, getApiErrorMessage } from '../../api/client';
import { useToast } from '../../context/ToastContext';
import { Button, DataTable, FormField, Badge, inputClass } from '../../components/ui';

export function PlansPage() {
  const { addToast } = useToast();
  const qc = useQueryClient();
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [price, setPrice] = useState(99);
  const [billingCycle, setBillingCycle] = useState('monthly');
  const [maxStudents, setMaxStudents] = useState(300);
  const [maxFaculty, setMaxFaculty] = useState(30);

  const { data: plans = [], isLoading } = useQuery({
    queryKey: ['superadmin-plans'],
    queryFn: async () => (await api.get('/superadmin/plans')).data.data,
  });

  const createMutation = useMutation({
    mutationFn: () => api.post('/superadmin/plans', { name, code, price: Number(price), billingCycle, maxStudents: Number(maxStudents), maxFaculty: Number(maxFaculty) }),
    onSuccess: () => {
      addToast('Plan created', 'success');
      setName('');
      setCode('');
      qc.invalidateQueries({ queryKey: ['superadmin-plans'] });
    },
    onError: (e) => addToast(getApiErrorMessage(e), 'error'),
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Subscription Plans</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">Configure pricing tiers and student/faculty limits</p>
      </div>

      <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-4">
        <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
          <FormField label="Plan Name"><input className={inputClass} value={name} onChange={(e) => setName(e.target.value)} placeholder="Enterprise" /></FormField>
          <FormField label="Code"><input className={inputClass} value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="ENT-YEARLY" /></FormField>
          <FormField label="Price ($)"><input type="number" className={inputClass} value={price} onChange={(e) => setPrice(e.target.value)} /></FormField>
          <FormField label="Cycle">
            <select className={inputClass} value={billingCycle} onChange={(e) => setBillingCycle(e.target.value)}>
              <option value="monthly">Monthly</option>
              <option value="yearly">Yearly</option>
            </select>
          </FormField>
          <FormField label="Max Students"><input type="number" className={inputClass} value={maxStudents} onChange={(e) => setMaxStudents(e.target.value)} /></FormField>
          <FormField label="Max Faculty"><input type="number" className={inputClass} value={maxFaculty} onChange={(e) => setMaxFaculty(e.target.value)} /></FormField>
        </div>
        <Button onClick={() => createMutation.mutate()} disabled={!name || !code}>
          <Plus className="h-4 w-4" /> Create Plan
        </Button>
      </div>

      <DataTable
        loading={isLoading}
        columns={[
          { key: 'name', label: 'Plan' },
          { key: 'code', label: 'Code', render: (r) => <span className="font-mono">{r.code}</span> },
          { key: 'price', label: 'Price', render: (r) => `$${r.price} / ${r.billingCycle}` },
          { key: 'limits', label: 'Limits', render: (r) => `${r.maxStudents} students · ${r.maxFaculty} faculty` },
          { key: 'isActive', label: 'Status', render: (r) => <Badge color={r.isActive ? 'emerald' : 'slate'}>{r.isActive ? 'Active' : 'Inactive'}</Badge> },
        ]}
        data={plans}
      />
    </div>
  );
}

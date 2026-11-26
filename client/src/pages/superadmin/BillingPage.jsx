import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Download, Plus } from 'lucide-react';
import { api, getApiErrorMessage } from '../../api/client';
import { useToast } from '../../context/ToastContext';
import { Button, DataTable, FormField, Badge, inputClass } from '../../components/ui';

export function BillingPage() {
  const { addToast } = useToast();
  const qc = useQueryClient();
  const [schoolId, setSchoolId] = useState('');
  const [planId, setPlanId] = useState('');
  const [amount, setAmount] = useState(199);
  const [method, setMethod] = useState('bank_transfer');
  const [reference, setReference] = useState('');
  const [periodStart, setPeriodStart] = useState(new Date().toISOString().slice(0, 10));
  const [periodEnd, setPeriodEnd] = useState(new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10));

  const { data: schoolsRes } = useQuery({ queryKey: ['superadmin-schools-all'], queryFn: async () => (await api.get('/superadmin/schools?limit=100')).data });
  const { data: plans = [] } = useQuery({ queryKey: ['superadmin-plans'], queryFn: async () => (await api.get('/superadmin/plans')).data.data });
  const { data: payments = [], isLoading } = useQuery({ queryKey: ['superadmin-payments'], queryFn: async () => (await api.get('/superadmin/payments')).data.data });
  const { data: overdue = [] } = useQuery({ queryKey: ['superadmin-overdue'], queryFn: async () => (await api.get('/superadmin/schools/overdue')).data.data });

  const recordMutation = useMutation({
    mutationFn: () =>
      api.post('/superadmin/payments', {
        schoolId,
        planId: planId || undefined,
        amount: Number(amount),
        method,
        reference,
        periodStart,
        periodEnd,
      }),
    onSuccess: () => {
      addToast('Payment recorded & school subscription activated', 'success');
      setReference('');
      qc.invalidateQueries({ queryKey: ['superadmin-payments'] });
      qc.invalidateQueries({ queryKey: ['superadmin-overdue'] });
      qc.invalidateQueries({ queryKey: ['superadmin-schools'] });
    },
    onError: (e) => addToast(getApiErrorMessage(e), 'error'),
  });

  const downloadInvoice = async (id, invoiceNo) => {
    const res = await api.get(`/superadmin/payments/${id}/invoice`, { responseType: 'blob' });
    const url = window.URL.createObjectURL(new Blob([res.data]));
    const a = document.createElement('a');
    a.href = url;
    a.download = `Invoice_${invoiceNo}.pdf`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Platform Billing & Invoices</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">Record school payments manually, track overdue accounts, and generate PDF invoices</p>
      </div>

      <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-4">
        <h2 className="font-semibold text-slate-900 dark:text-white">Record Subscription Payment</h2>
        <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
          <FormField label="School">
            <select className={inputClass} value={schoolId} onChange={(e) => setSchoolId(e.target.value)}>
              <option value="">Select school</option>
              {(schoolsRes?.data || []).map((s) => <option key={s._id} value={s._id}>{s.name}</option>)}
            </select>
          </FormField>
          <FormField label="Plan">
            <select className={inputClass} value={planId} onChange={(e) => setPlanId(e.target.value)}>
              <option value="">Current Plan</option>
              {plans.map((p) => <option key={p._id} value={p._id}>{p.name} (${p.price})</option>)}
            </select>
          </FormField>
          <FormField label="Amount ($)"><input type="number" className={inputClass} value={amount} onChange={(e) => setAmount(e.target.value)} /></FormField>
          <FormField label="Method">
            <select className={inputClass} value={method} onChange={(e) => setMethod(e.target.value)}>
              <option value="bank_transfer">Bank Transfer</option>
              <option value="card">Card</option>
              <option value="manual">Manual</option>
              <option value="cheque">Cheque</option>
            </select>
          </FormField>
          <FormField label="Period Start"><input type="date" className={inputClass} value={periodStart} onChange={(e) => setPeriodStart(e.target.value)} /></FormField>
          <FormField label="Period End"><input type="date" className={inputClass} value={periodEnd} onChange={(e) => setPeriodEnd(e.target.value)} /></FormField>
        </div>
        <div className="flex gap-3 items-end">
          <div className="flex-1 max-w-sm"><FormField label="Reference / Txn ID"><input className={inputClass} value={reference} onChange={(e) => setReference(e.target.value)} placeholder="WIRE-90812" /></FormField></div>
          <Button onClick={() => recordMutation.mutate()} disabled={!schoolId || recordMutation.isPending}>
            <Plus className="h-4 w-4" /> Record Payment
          </Button>
        </div>
      </div>

      {overdue.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-lg font-semibold text-rose-600 dark:text-rose-400">Overdue Schools ({overdue.length})</h2>
          <DataTable
            columns={[
              { key: 'name', label: 'School' },
              { key: 'code', label: 'Code' },
              { key: 'plan', label: 'Plan', render: (r) => `${r.planId?.name || 'Trial'} ($${r.planId?.price || 0})` },
              { key: 'endDate', label: 'Expired On', render: (r) => new Date(r.endDate).toLocaleDateString() },
            ]}
            data={overdue}
          />
        </div>
      )}

      <div className="space-y-3">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Payment History</h2>
        <DataTable
          loading={isLoading}
          columns={[
            { key: 'invoiceNo', label: 'Invoice', render: (r) => <span className="font-mono font-semibold">{r.invoiceNo}</span> },
            { key: 'school', label: 'School', render: (r) => r.schoolId?.name || '—' },
            { key: 'amount', label: 'Amount', render: (r) => `$${r.amount}` },
            { key: 'method', label: 'Method' },
            { key: 'paidAt', label: 'Date', render: (r) => new Date(r.paidAt).toLocaleDateString() },
            { key: 'status', label: 'Status', render: (r) => <Badge color="emerald">{r.status}</Badge> },
            {
              key: 'pdf',
              label: 'Invoice',
              render: (r) => (
                <Button size="sm" variant="secondary" onClick={() => downloadInvoice(r._id, r.invoiceNo)}>
                  <Download className="h-3.5 w-3.5" /> PDF
                </Button>
              ),
            },
          ]}
          data={payments}
        />
      </div>
    </div>
  );
}

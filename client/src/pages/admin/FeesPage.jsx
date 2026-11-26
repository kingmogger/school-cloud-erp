import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Download, Plus } from 'lucide-react';
import { api, getApiErrorMessage } from '../../api/client';
import { useToast } from '../../context/ToastContext';
import { Button, DataTable, FormField, Badge, inputClass } from '../../components/ui';

export function FeesPage() {
  const { addToast } = useToast();
  const qc = useQueryClient();

  const [fsName, setFsName] = useState('');
  const [fsClassId, setFsClassId] = useState('');
  const [fsAmount, setFsAmount] = useState(1000);
  const [fsDueDate, setFsDueDate] = useState('2026-12-31');

  const [payStudentId, setPayStudentId] = useState('');
  const [payStructId, setPayStructId] = useState('');
  const [payAmount, setPayAmount] = useState(1000);
  const [payMethod, setPayMethod] = useState('card');

  const { data: classes = [] } = useQuery({ queryKey: ['admin-classes'], queryFn: async () => (await api.get('/admin/classes')).data.data });
  const { data: years = [] } = useQuery({ queryKey: ['admin-years'], queryFn: async () => (await api.get('/admin/academic-years')).data.data });
  const { data: studentsRes } = useQuery({ queryKey: ['admin-students-all'], queryFn: async () => (await api.get('/admin/students?limit=100')).data });
  const { data: structures = [] } = useQuery({ queryKey: ['fee-structures'], queryFn: async () => (await api.get('/fees/structures')).data.data });
  const { data: payments = [], isLoading } = useQuery({ queryKey: ['fee-payments'], queryFn: async () => (await api.get('/fees/payments')).data.data });

  const currentYearId = years.find((y) => y.isCurrent)?._id || years[0]?._id;

  const createStruct = useMutation({
    mutationFn: () =>
      api.post('/fees/structures', {
        academicYearId: currentYearId,
        classId: fsClassId,
        name: fsName,
        components: [{ name: fsName, amount: Number(fsAmount) }],
        dueDate: fsDueDate,
      }),
    onSuccess: () => {
      addToast('Fee structure created', 'success');
      setFsName('');
      qc.invalidateQueries({ queryKey: ['fee-structures'] });
    },
    onError: (e) => addToast(getApiErrorMessage(e), 'error'),
  });

  const recordPayment = useMutation({
    mutationFn: () =>
      api.post('/fees/payments', {
        studentId: payStudentId,
        feeStructureId: payStructId,
        amountPaid: Number(payAmount),
        paymentMethod: payMethod,
      }),
    onSuccess: () => {
      addToast('Payment recorded & receipt generated', 'success');
      qc.invalidateQueries({ queryKey: ['fee-payments'] });
      qc.invalidateQueries({ queryKey: ['admin-dashboard'] });
    },
    onError: (e) => addToast(getApiErrorMessage(e), 'error'),
  });

  const downloadReceipt = async (paymentId, receiptNo) => {
    const res = await api.get(`/fees/payments/${paymentId}/receipt`, { responseType: 'blob' });
    const url = window.URL.createObjectURL(new Blob([res.data]));
    const a = document.createElement('a');
    a.href = url;
    a.download = `Receipt_${receiptNo}.pdf`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Fees & Receipts</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">Manage class fee structures, record payments, and issue PDF receipts</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-3">
          <h2 className="font-semibold text-slate-900 dark:text-white">Create Fee Structure</h2>
          <FormField label="Class">
            <select className={inputClass} value={fsClassId} onChange={(e) => setFsClassId(e.target.value)}>
              <option value="">Select class</option>
              {classes.map((c) => <option key={c._id} value={c._id}>{c.name}</option>)}
            </select>
          </FormField>
          <div className="grid grid-cols-2 gap-3">
            <FormField label="Title"><input className={inputClass} value={fsName} onChange={(e) => setFsName(e.target.value)} placeholder="Term 1 Tuition" /></FormField>
            <FormField label="Amount ($)"><input type="number" className={inputClass} value={fsAmount} onChange={(e) => setFsAmount(e.target.value)} /></FormField>
          </div>
          <FormField label="Due Date"><input type="date" className={inputClass} value={fsDueDate} onChange={(e) => setFsDueDate(e.target.value)} /></FormField>
          <Button onClick={() => createStruct.mutate()} disabled={!fsClassId || !fsName || !currentYearId}>
            <Plus className="h-4 w-4" /> Create Structure
          </Button>
        </div>

        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-3">
          <h2 className="font-semibold text-slate-900 dark:text-white">Record Fee Payment</h2>
          <FormField label="Student">
            <select className={inputClass} value={payStudentId} onChange={(e) => setPayStudentId(e.target.value)}>
              <option value="">Select student</option>
              {(studentsRes?.data || []).map((s) => (
                <option key={s._id} value={s._id}>{s.userId?.name} ({s.admissionNo})</option>
              ))}
            </select>
          </FormField>
          <FormField label="Fee Structure">
            <select className={inputClass} value={payStructId} onChange={(e) => setPayStructId(e.target.value)}>
              <option value="">Select fee</option>
              {structures.map((st) => <option key={st._id} value={st._id}>{st.name} (${st.totalAmount})</option>)}
            </select>
          </FormField>
          <div className="grid grid-cols-2 gap-3">
            <FormField label="Amount ($)"><input type="number" className={inputClass} value={payAmount} onChange={(e) => setPayAmount(e.target.value)} /></FormField>
            <FormField label="Method">
              <select className={inputClass} value={payMethod} onChange={(e) => setPayMethod(e.target.value)}>
                <option value="card">Card</option>
                <option value="online">Online</option>
                <option value="cash">Cash</option>
                <option value="bank_transfer">Bank Transfer</option>
              </select>
            </FormField>
          </div>
          <Button onClick={() => recordPayment.mutate()} disabled={!payStudentId || !payStructId}>Record Payment</Button>
        </div>
      </div>

      <DataTable
        loading={isLoading}
        columns={[
          { key: 'receiptNo', label: 'Receipt No', render: (r) => <span className="font-mono font-semibold">{r.receiptNo}</span> },
          { key: 'student', label: 'Student', render: (r) => r.studentId?.userId?.name || '—' },
          { key: 'fee', label: 'Fee', render: (r) => r.feeStructureId?.name || '—' },
          { key: 'amountPaid', label: 'Amount', render: (r) => `$${r.amountPaid}` },
          { key: 'status', label: 'Status', render: (r) => <Badge color="emerald">{r.status}</Badge> },
          {
            key: 'pdf',
            label: 'Receipt',
            render: (r) => (
              <Button variant="secondary" size="sm" onClick={() => downloadReceipt(r._id, r.receiptNo)}>
                <Download className="h-3.5 w-3.5" /> PDF
              </Button>
            ),
          },
        ]}
        data={payments}
      />
    </div>
  );
}

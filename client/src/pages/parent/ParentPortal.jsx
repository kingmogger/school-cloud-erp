import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Download, Bell, Check, CreditCard, Lock, QrCode, Building2, ArrowRight } from 'lucide-react';
import { api, getApiErrorMessage } from '../../api/client';
import { useToast } from '../../context/ToastContext';
import { StatCard, DataTable, Badge, Button, Modal, FormField, Skeleton, EmptyState, inputClass } from '../../components/ui';

export function ParentPortal({ section = 'overview' }) {
  const { addToast } = useToast();
  const qc = useQueryClient();
  const [selectedChildId, setSelectedChildId] = useState('');
  const [payFeeTarget, setPayFeeTarget] = useState(null);
  const [paymentMethod, setPaymentMethod] = useState('card');
  const [cardData, setCardData] = useState({ name: 'Parent Account', number: '4242 •••• •••• 4242', expiry: '12/28', cvv: '123' });
  const [upiId, setUpiId] = useState('parent@okhdfcbank');

  const { data: children = [], isLoading: loadingChildren } = useQuery({
    queryKey: ['parent-children'],
    queryFn: async () => (await api.get('/parent/children')).data.data,
  });

  useEffect(() => {
    if (!selectedChildId && children.length > 0) {
      setSelectedChildId(children[0]._id);
    }
  }, [children, selectedChildId]);

  const { data: overview, isLoading: loadingOverview } = useQuery({
    queryKey: ['parent-overview', selectedChildId],
    enabled: Boolean(selectedChildId) && section === 'overview',
    queryFn: async () => (await api.get(`/parent/children/${selectedChildId}/overview`)).data.data,
  });

  const { data: attendanceData } = useQuery({
    queryKey: ['parent-attendance', selectedChildId],
    enabled: Boolean(selectedChildId) && section === 'attendance',
    queryFn: async () => (await api.get(`/parent/children/${selectedChildId}/attendance`)).data.data,
  });

  const { data: resultsData = [] } = useQuery({
    queryKey: ['parent-results', selectedChildId],
    enabled: Boolean(selectedChildId) && section === 'results',
    queryFn: async () => (await api.get(`/parent/children/${selectedChildId}/results`)).data.data,
  });

  const { data: feesData } = useQuery({
    queryKey: ['parent-fees', selectedChildId],
    enabled: Boolean(selectedChildId) && section === 'fees',
    queryFn: async () => (await api.get(`/parent/children/${selectedChildId}/fees`)).data.data,
  });

  const { data: remarksData = [] } = useQuery({
    queryKey: ['parent-remarks', selectedChildId],
    enabled: Boolean(selectedChildId) && section === 'remarks',
    queryFn: async () => (await api.get(`/parent/children/${selectedChildId}/remarks`)).data.data,
  });

  const { data: notifications = [] } = useQuery({
    queryKey: ['parent-notifications'],
    enabled: section === 'notifications',
    queryFn: async () => (await api.get('/parent/notifications')).data.data,
  });

  const markRead = useMutation({
    mutationFn: (id) => api.patch(`/parent/notifications/${id}/read`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['parent-notifications'] }),
  });

  const payFeeMutation = useMutation({
    mutationFn: () =>
      api.post(`/parent/children/${selectedChildId}/fees/pay`, {
        feeStructureId: payFeeTarget?._id,
        amountPaid: payFeeTarget?.totalAmount,
        paymentMethod,
        transactionReference: `GATEWAY-PAR-${Date.now()}`,
      }),
    onSuccess: () => {
      addToast('Fee paid successfully! Receipt generated.', 'success');
      setPayFeeTarget(null);
      qc.invalidateQueries({ queryKey: ['parent-fees', selectedChildId] });
    },
    onError: (err) => addToast(getApiErrorMessage(err), 'error'),
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

  if (loadingChildren) return <Skeleton className="h-40 w-full" />;
  if (children.length === 0) return <EmptyState title="No Linked Children" description="Contact school administration to link your child's profile." />;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Parent Portal</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">Read-only access to your linked children's academic progress</p>
        </div>
        {section !== 'notifications' && (
          <div className="sm:w-64">
            <label htmlFor="child-switcher" className="sr-only">Select Child</label>
            <select
              id="child-switcher"
              value={selectedChildId}
              onChange={(e) => setSelectedChildId(e.target.value)}
              className={inputClass}
            >
              {children.map((c) => (
                <option key={c._id} value={c._id}>
                  {c.userId?.name} ({c.classId?.name} - {c.sectionId?.name})
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {section === 'overview' && (
        loadingOverview ? <Skeleton className="h-40 w-full" /> : (
          <div className="space-y-6">
            <div className="grid gap-4 sm:grid-cols-3">
              <StatCard title="Attendance" value={`${overview?.attendance?.percentage ?? 100}%`} subtitle={overview?.attendance?.isShortage ? 'Below threshold' : 'On track'} />
              <StatCard title="Cumulative GPA" value={overview?.grades?.gpa ?? 0} subtitle={`Grade: ${overview?.grades?.overallGrade || 'N/A'}`} />
              <StatCard title="Recent Remarks" value={overview?.remarks?.length || 0} subtitle="Teacher feedback notes" />
            </div>
            <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5">
              <h3 className="font-semibold text-slate-900 dark:text-white mb-3">Latest Teacher Remarks</h3>
              {(overview?.remarks || []).length === 0 ? (
                <p className="text-sm text-slate-500">No remarks yet.</p>
              ) : (
                <ul className="space-y-2">
                  {overview.remarks.map((r) => (
                    <li key={r._id} className="rounded-lg bg-slate-50 dark:bg-slate-950 p-3 text-sm">
                      <Badge color="indigo" className="mr-2">{r.category}</Badge>
                      <span className="text-slate-700 dark:text-slate-200">{r.comment}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )
      )}

      {section === 'attendance' && (
        <DataTable
          columns={[
            { key: 'date', label: 'Date', render: (r) => new Date(r.date).toLocaleDateString() },
            { key: 'subject', label: 'Subject', render: (r) => r.subjectId?.name || 'Daily' },
            { key: 'status', label: 'Status', render: (r) => <Badge color={r.status === 'present' ? 'emerald' : 'rose'}>{r.status}</Badge> },
          ]}
          data={attendanceData?.records || []}
        />
      )}

      {section === 'results' && (
        resultsData.length === 0 ? <EmptyState title="No Results Yet" /> : (
          <div className="space-y-4">
            {resultsData.map((item) => (
              <div key={item.exam._id} className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-3">
                <h3 className="font-semibold text-slate-900 dark:text-white">{item.exam.name} — {item.percentage}% ({item.overallGrade})</h3>
                <DataTable
                  columns={[
                    { key: 'subjectName', label: 'Subject' },
                    { key: 'marksObtained', label: 'Obtained' },
                    { key: 'maxMarks', label: 'Max' },
                    { key: 'grade', label: 'Grade' },
                  ]}
                  data={item.marksList}
                />
              </div>
            ))}
          </div>
        )
      )}

      {section === 'fees' && (
        <div className="space-y-6">
          {/* Pending Fees Section */}
          <div className="space-y-3">
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">Fee Status & Outstanding Dues</h2>
            <div className="grid gap-4 md:grid-cols-2">
              {(feesData?.feeStatus || []).map((item) => (
                <div
                  key={item.structure._id}
                  className={`rounded-2xl border p-5 flex flex-col justify-between shadow-xs transition-all ${
                    item.isPaid
                      ? 'border-emerald-200 dark:border-emerald-900/60 bg-emerald-50/30 dark:bg-emerald-950/20'
                      : 'border-amber-300 dark:border-amber-900/60 bg-amber-50/40 dark:bg-amber-950/20'
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between">
                      <h3 className="font-bold text-slate-900 dark:text-white">{item.structure.name}</h3>
                      <Badge color={item.isPaid ? 'emerald' : 'amber'}>
                        {item.isPaid ? 'Paid' : 'Pending Payment'}
                      </Badge>
                    </div>
                    <div className="mt-2 flex items-baseline gap-2">
                      <span className="text-2xl font-extrabold text-slate-900 dark:text-white">
                        ${item.structure.totalAmount}
                      </span>
                      <span className="text-xs text-slate-500">
                        Due: {item.structure.dueDate ? new Date(item.structure.dueDate).toLocaleDateString() : '—'}
                      </span>
                    </div>

                    {item.structure.components && (
                      <div className="mt-3 space-y-1 text-xs text-slate-600 dark:text-slate-400 border-t border-slate-200/60 dark:border-slate-800 pt-2">
                        {item.structure.components.map((c, i) => (
                          <div key={i} className="flex justify-between">
                            <span>{c.name}</span>
                            <span className="font-semibold">${c.amount}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="mt-4 pt-3 border-t border-slate-200/60 dark:border-slate-800">
                    {item.isPaid ? (
                      <div className="flex items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-400 font-semibold">
                        <Check className="h-4 w-4" /> Fully Settled
                      </div>
                    ) : (
                      <Button
                        className="w-full bg-indigo-600 hover:bg-indigo-700 text-white"
                        onClick={() => setPayFeeTarget(item.structure)}
                      >
                        <CreditCard className="h-4 w-4" /> Pay Fee Online (${item.structure.totalAmount})
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {(!feesData?.feeStatus || feesData.feeStatus.length === 0) && (
              <p className="text-xs text-slate-500 italic">No fee structures assigned to this class yet.</p>
            )}
          </div>

          {/* Paid Receipts History */}
          <div className="space-y-3">
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">Payment History & Receipts</h2>
            <DataTable
              columns={[
                { key: 'receiptNo', label: 'Receipt No', render: (r) => <span className="font-mono font-semibold text-indigo-600 dark:text-indigo-400">{r.receiptNo}</span> },
                { key: 'amountPaid', label: 'Amount', render: (r) => `$${r.amountPaid}` },
                { key: 'method', label: 'Payment Method', render: (r) => <Badge color="slate">{r.paymentMethod || 'Online'}</Badge> },
                { key: 'paidAt', label: 'Paid On', render: (r) => new Date(r.paidAt).toLocaleDateString() },
                { key: 'status', label: 'Status', render: (r) => <Badge color="emerald">{r.status}</Badge> },
                {
                  key: 'pdf',
                  label: 'Official PDF',
                  render: (r) => (
                    <Button size="sm" variant="secondary" onClick={() => downloadReceipt(r._id, r.receiptNo)}>
                      <Download className="h-3.5 w-3.5" /> PDF
                    </Button>
                  ),
                },
              ]}
              data={feesData?.payments || []}
            />
          </div>
        </div>
      )}

      {section === 'remarks' && (
        <DataTable
          columns={[
            { key: 'category', label: 'Category', render: (r) => <Badge color="indigo">{r.category}</Badge> },
            { key: 'comment', label: 'Feedback' },
            { key: 'faculty', label: 'Teacher', render: (r) => r.facultyId?.userId?.name },
            { key: 'date', label: 'Date', render: (r) => new Date(r.createdAt).toLocaleDateString() },
          ]}
          data={remarksData}
        />
      )}

      {section === 'notifications' && (
        <div className="space-y-3">
          {notifications.length === 0 ? (
            <EmptyState icon={Bell} title="No Notifications" description="You're all caught up!" />
          ) : (
            notifications.map((n) => (
              <div key={n._id} className="flex items-start justify-between gap-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
                <div>
                  <div className="flex items-center gap-2">
                    <Badge color={n.type === 'risk' ? 'rose' : 'indigo'}>{n.type}</Badge>
                    <h4 className="font-semibold text-slate-900 dark:text-white">{n.title}</h4>
                  </div>
                  <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">{n.message}</p>
                </div>
                {!n.readAt && (
                  <Button size="sm" variant="secondary" onClick={() => markRead.mutate(n._id)}>
                    <Check className="h-3.5 w-3.5" /> Mark Read
                  </Button>
                )}
              </div>
            ))
          )}
        </div>
      )}

      {/* MODAL: Parent Online Fee Payment Gateway */}
      <Modal open={Boolean(payFeeTarget)} onClose={() => setPayFeeTarget(null)} title={`Pay Fee Online: ${payFeeTarget?.name}`} maxWidth="max-w-md">
        <div className="space-y-4">
          <div className="rounded-xl border border-indigo-100 dark:border-indigo-900/60 bg-indigo-50/50 dark:bg-indigo-950/40 p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold uppercase text-indigo-600 dark:text-indigo-400">Total Payable</p>
              <h4 className="text-2xl font-extrabold text-slate-900 dark:text-white">${payFeeTarget?.totalAmount}</h4>
            </div>
            <Badge color="indigo">Term Fee</Badge>
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2">Payment Method</label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setPaymentMethod('card')}
                className={`flex items-center justify-center gap-2 p-2.5 rounded-lg border text-xs font-semibold ${
                  paymentMethod === 'card'
                    ? 'border-indigo-600 bg-indigo-50 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300'
                    : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200'
                }`}
              >
                <CreditCard className="h-4 w-4" /> Credit/Debit Card
              </button>
              <button
                type="button"
                onClick={() => setPaymentMethod('upi')}
                className={`flex items-center justify-center gap-2 p-2.5 rounded-lg border text-xs font-semibold ${
                  paymentMethod === 'upi'
                    ? 'border-indigo-600 bg-indigo-50 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300'
                    : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200'
                }`}
              >
                <QrCode className="h-4 w-4" /> UPI / QR
              </button>
            </div>
          </div>

          {paymentMethod === 'card' ? (
            <div className="space-y-3 rounded-xl border border-slate-200 dark:border-slate-800 p-3 bg-slate-50 dark:bg-slate-900 text-xs">
              <FormField label="Cardholder Name">
                <input className={inputClass} value={cardData.name} onChange={(e) => setCardData({ ...cardData, name: e.target.value })} />
              </FormField>
              <FormField label="Card Number">
                <input className={`${inputClass} font-mono`} value={cardData.number} onChange={(e) => setCardData({ ...cardData, number: e.target.value })} />
              </FormField>
              <div className="grid grid-cols-2 gap-2">
                <FormField label="Expiry"><input className={`${inputClass} font-mono`} value={cardData.expiry} onChange={(e) => setCardData({ ...cardData, expiry: e.target.value })} /></FormField>
                <FormField label="CVV"><input type="password" maxLength={4} className={`${inputClass} font-mono`} value={cardData.cvv} onChange={(e) => setCardData({ ...cardData, cvv: e.target.value })} /></FormField>
              </div>
            </div>
          ) : (
            <div className="space-y-2 rounded-xl border border-slate-200 dark:border-slate-800 p-3 bg-slate-50 dark:bg-slate-900 text-xs">
              <FormField label="UPI Virtual Address">
                <input className={inputClass} value={upiId} onChange={(e) => setUpiId(e.target.value)} placeholder="parent@upi" />
              </FormField>
              <p className="text-slate-500">Supports GPay, PhonePe, Paytm, Amazon Pay</p>
            </div>
          )}

          <div className="pt-2 border-t border-slate-200 dark:border-slate-800 flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setPayFeeTarget(null)}>Cancel</Button>
            <Button
              className="bg-emerald-600 hover:bg-emerald-700 text-white"
              onClick={() => payFeeMutation.mutate()}
              disabled={payFeeMutation.isPending}
            >
              {payFeeMutation.isPending ? 'Processing...' : `Pay $${payFeeTarget?.totalAmount} Now`}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

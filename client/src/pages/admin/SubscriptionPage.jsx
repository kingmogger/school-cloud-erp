import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Download,
  ShieldAlert,
  CreditCard,
  GraduationCap,
  Sparkles,
  CheckCircle,
  Building2,
  Lock,
  QrCode,
  ArrowRight,
  RefreshCw,
  HardDrive,
  AlertTriangle,
} from 'lucide-react';
import { api, getApiErrorMessage } from '../../api/client';
import { useToast } from '../../context/ToastContext';
import { StatCard, DataTable, Badge, Button, Modal, FormField, Skeleton, inputClass } from '../../components/ui';
import { formatBytes, getStorageBarColor, getStorageBadgeColor } from '../../utils/formatBytes';

const STATUS_COLOR = {
  active: 'emerald',
  trial: 'indigo',
  grace: 'amber',
  suspended: 'rose',
  expired: 'rose',
};

export function SubscriptionPage() {
  const { addToast } = useToast();
  const qc = useQueryClient();

  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState('card');
  const [billingCycle, setBillingCycle] = useState('monthly');
  const [selectedPlanId, setSelectedPlanId] = useState('');
  const [cardData, setCardData] = useState({
    name: 'Dr. Elena Vance',
    number: '4242 •••• •••• 4242',
    expiry: '12/28',
    cvv: '982',
  });
  const [upiId, setUpiId] = useState('schooladmin@okhdfcbank');

  const { data, isLoading, isError } = useQuery({
    queryKey: ['school-subscription'],
    queryFn: async () => (await api.get('/admin/subscription')).data.data,
  });

  const { data: plans = [] } = useQuery({
    queryKey: ['superadmin-plans-public'],
    queryFn: async () => {
      try {
        return (await api.get('/superadmin/plans')).data.data;
      } catch {
        return [];
      }
    },
  });

  const payMutation = useMutation({
    mutationFn: (payload) => api.post('/admin/subscription/checkout', payload),
    onSuccess: () => {
      addToast('Payment successful! Subscription renewed and school access active.', 'success');
      setCheckoutOpen(false);
      qc.invalidateQueries({ queryKey: ['school-subscription'] });
      qc.invalidateQueries({ queryKey: ['auth-me'] });
    },
    onError: (e) => addToast(getApiErrorMessage(e), 'error'),
  });

  const downloadReceipt = async (paymentId, invoiceNo) => {
    try {
      const res = await api.get(`/admin/subscription/receipt/${paymentId}`, { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const a = document.createElement('a');
      a.href = url;
      a.download = `Invoice_${invoiceNo}.pdf`;
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (e) {
      addToast('Failed to download invoice PDF', 'error');
    }
  };

  if (isLoading) return <Skeleton className="h-48 w-full" />;
  if (isError || !data) {
    return (
      <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
        Unable to load subscription details.
      </div>
    );
  }

  const { school, plan, statusInfo, usage, storage, payments, support } = data;
  const storagePercent = storage?.percentUsed ?? 0;
  const isStorageFull = storagePercent >= 100;
  const isStorageWarning = storagePercent >= 80 && storagePercent < 100;
  const activePlanPrice = plan?.price || 99;
  const finalPrice = billingCycle === 'yearly' ? Math.round(activePlanPrice * 10) : activePlanPrice;

  const handleStartCheckout = () => {
    if (!selectedPlanId && plan?._id) {
      setSelectedPlanId(plan._id);
    }
    setCheckoutOpen(true);
  };

  const handleProcessPayment = () => {
    payMutation.mutate({
      planId: selectedPlanId || plan?._id,
      paymentMethod,
      billingCycle,
      transactionReference: `GATEWAY-${Date.now()}`,
    });
  };

  return (
    <div className="space-y-6">
      {/* Blocked or Suspended Banner */}
      {statusInfo?.isBlocked && (
        <div role="alert" className="rounded-2xl border border-rose-300 dark:border-rose-900 bg-rose-50 dark:bg-rose-950/60 p-6 space-y-3 shadow-xs">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2 text-rose-700 dark:text-rose-300 font-bold text-lg">
              <ShieldAlert className="h-6 w-6" />
              <span>Subscription {statusInfo.effectiveStatus === 'suspended' ? 'Suspended' : 'Expired'}</span>
            </div>
            <Button className="bg-rose-600 hover:bg-rose-700 text-white" onClick={handleStartCheckout}>
              <CreditCard className="h-4 w-4" /> Pay & Reactivate School Now
            </Button>
          </div>
          <p className="text-sm text-rose-800 dark:text-rose-200">
            {statusInfo.reason || 'Your subscription is currently inactive. Complete payment below to immediately restore all faculty, student, and parent access.'}
          </p>
        </div>
      )}

      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">School Subscription</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            {school?.name} (Tenant Code: <span className="font-mono font-semibold">{school?.code}</span>)
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Badge color={STATUS_COLOR[statusInfo?.effectiveStatus] || 'slate'} className="text-sm px-3 py-1">
            {statusInfo?.effectiveStatus?.toUpperCase()}
          </Badge>
          <Button onClick={handleStartCheckout} className="bg-indigo-600 hover:bg-indigo-700 text-white">
            <CreditCard className="h-4 w-4" /> Renew / Pay Online
          </Button>
        </div>
      </div>

      {/* Metrics Cards */}
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

      {/* Read-only Storage Meter */}
      <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <HardDrive className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
            <h3 className="font-semibold text-slate-900 dark:text-white">Storage Usage</h3>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <span className="font-medium text-slate-700 dark:text-slate-200">
              {formatBytes(storage?.storageUsedBytes || 0)} / {formatBytes(storage?.storageLimitBytes || 0)}
            </span>
            <Badge color={getStorageBadgeColor(storagePercent)}>{storagePercent.toFixed(1)}%</Badge>
          </div>
        </div>
        <div className="h-3 w-full rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${getStorageBarColor(storagePercent)}`}
            style={{ width: `${Math.min(100, storagePercent)}%` }}
          />
        </div>
        <div className="flex justify-between text-xs text-slate-500">
          <span>{storage?.fileCount || 0} file(s) stored</span>
          <span>
            Last synced:{' '}
            {storage?.lastStorageSyncAt ? new Date(storage.lastStorageSyncAt).toLocaleString() : 'Up to date'}
          </span>
        </div>

        {isStorageFull && (
          <div
            role="alert"
            className="rounded-xl border border-rose-300 dark:border-rose-900 bg-rose-50 dark:bg-rose-950/60 p-3.5 text-sm text-rose-800 dark:text-rose-200 flex items-start gap-2.5"
          >
            <ShieldAlert className="h-5 w-5 text-rose-600 shrink-0 mt-0.5" />
            <div>
              <strong>Storage limit reached (100%).</strong> New file uploads are blocked until space is freed or
              your storage limit is upgraded. Contact the platform owner at {support?.email}.
            </div>
          </div>
        )}

        {isStorageWarning && (
          <div
            role="alert"
            className="rounded-xl border border-amber-300 dark:border-amber-900 bg-amber-50 dark:bg-amber-950/60 p-3.5 text-sm text-amber-800 dark:text-amber-200 flex items-start gap-2.5"
          >
            <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <strong>Storage nearly full ({storagePercent.toFixed(1)}%).</strong> Consider removing unused files
              or contacting the platform owner ({support?.email}) to increase your storage quota.
            </div>
          </div>
        )}
      </div>

      {/* Support Contact Box */}
      <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-2 shadow-xs">
        <h3 className="font-semibold text-slate-900 dark:text-white">Billing & Support Information</h3>
        <p className="text-sm text-slate-600 dark:text-slate-300">
          Payments are processed securely with instant reactivation and official invoice generation.
        </p>
        <p className="text-xs text-slate-500">
          Platform Support: {support?.email || 'billing@studyx.io'} · {support?.phone || '+1-800-555-0199'}
        </p>
      </div>

      {/* Invoices and Payments Table */}
      <div className="space-y-3">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Payment History & Tax Invoices</h2>
        <DataTable
          columns={[
            {
              key: 'invoiceNo',
              label: 'Invoice No',
              render: (r) => <span className="font-mono font-semibold text-indigo-600 dark:text-indigo-400">{r.invoiceNo}</span>,
            },
            { key: 'plan', label: 'Plan', render: (r) => r.planId?.name || 'Subscription' },
            { key: 'amount', label: 'Amount', render: (r) => `$${r.amount}` },
            { key: 'method', label: 'Method', render: (r) => <Badge color="slate">{r.method || 'Online'}</Badge> },
            { key: 'paidAt', label: 'Paid Date', render: (r) => new Date(r.paidAt).toLocaleDateString() },
            {
              key: 'pdf',
              label: 'Official PDF',
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

      {/* MODAL: Payment Gateway Checkout */}
      <Modal open={checkoutOpen} onClose={() => setCheckoutOpen(false)} title="Secure Payment Gateway Checkout" maxWidth="max-w-xl">
        <div className="space-y-5">
          {/* Plan & Pricing Summary Card */}
          <div className="rounded-xl border border-indigo-100 dark:border-indigo-900/60 bg-gradient-to-r from-indigo-50/60 to-purple-50/60 dark:from-indigo-950/40 dark:to-purple-950/40 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
                  {school?.name}
                </p>
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                  {plan?.name || 'Standard Tier'} Subscription Renewal
                </h3>
              </div>
              <div className="text-right">
                <span className="text-2xl font-extrabold text-slate-900 dark:text-white">${finalPrice}</span>
                <p className="text-xs text-slate-500">/{billingCycle}</p>
              </div>
            </div>

            {/* Billing Cycle Selector */}
            <div className="flex gap-2 pt-1">
              <button
                type="button"
                onClick={() => setBillingCycle('monthly')}
                className={`flex-1 rounded-lg py-1.5 text-xs font-semibold transition-all ${
                  billingCycle === 'monthly'
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700'
                }`}
              >
                Monthly (${activePlanPrice}/mo)
              </button>
              <button
                type="button"
                onClick={() => setBillingCycle('yearly')}
                className={`flex-1 rounded-lg py-1.5 text-xs font-semibold transition-all ${
                  billingCycle === 'yearly'
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700'
                }`}
              >
                Annual (2 Months Free - ${(activePlanPrice * 10)})
              </button>
            </div>
          </div>

          {/* Payment Method Tabs */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2">
              Select Payment Method
            </label>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setPaymentMethod('card')}
                className={`flex flex-col items-center justify-center p-3 rounded-xl border text-xs font-medium transition-all ${
                  paymentMethod === 'card'
                    ? 'border-indigo-600 bg-indigo-50/60 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 ring-2 ring-indigo-500/20'
                    : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-50'
                }`}
              >
                <CreditCard className="h-5 w-5 mb-1" />
                Credit/Debit Card
              </button>

              <button
                type="button"
                onClick={() => setPaymentMethod('upi')}
                className={`flex flex-col items-center justify-center p-3 rounded-xl border text-xs font-medium transition-all ${
                  paymentMethod === 'upi'
                    ? 'border-indigo-600 bg-indigo-50/60 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 ring-2 ring-indigo-500/20'
                    : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-50'
                }`}
              >
                <QrCode className="h-5 w-5 mb-1" />
                UPI / Net Banking
              </button>

              <button
                type="button"
                onClick={() => setPaymentMethod('wire')}
                className={`flex flex-col items-center justify-center p-3 rounded-xl border text-xs font-medium transition-all ${
                  paymentMethod === 'wire'
                    ? 'border-indigo-600 bg-indigo-50/60 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 ring-2 ring-indigo-500/20'
                    : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-50'
                }`}
              >
                <Building2 className="h-5 w-5 mb-1" />
                Bank Wire
              </button>
            </div>
          </div>

          {/* Form based on selected payment method */}
          {paymentMethod === 'card' && (
            <div className="space-y-3 rounded-xl border border-slate-200 dark:border-slate-800 p-4 bg-slate-50/50 dark:bg-slate-900/50">
              <FormField label="Cardholder Name">
                <input
                  className={inputClass}
                  value={cardData.name}
                  onChange={(e) => setCardData({ ...cardData, name: e.target.value })}
                  placeholder="Dr. Elena Vance"
                />
              </FormField>

              <FormField label="Card Number">
                <div className="relative">
                  <input
                    className={`${inputClass} font-mono`}
                    value={cardData.number}
                    onChange={(e) => setCardData({ ...cardData, number: e.target.value })}
                    placeholder="4242 4242 4242 4242"
                  />
                  <CreditCard className="absolute right-3 top-2.5 h-4 w-4 text-slate-400" />
                </div>
              </FormField>

              <div className="grid grid-cols-2 gap-3">
                <FormField label="Expiry Date">
                  <input
                    className={`${inputClass} font-mono`}
                    value={cardData.expiry}
                    onChange={(e) => setCardData({ ...cardData, expiry: e.target.value })}
                    placeholder="MM/YY"
                  />
                </FormField>
                <FormField label="CVV">
                  <input
                    type="password"
                    maxLength={4}
                    className={`${inputClass} font-mono`}
                    value={cardData.cvv}
                    onChange={(e) => setCardData({ ...cardData, cvv: e.target.value })}
                    placeholder="•••"
                  />
                </FormField>
              </div>
            </div>
          )}

          {paymentMethod === 'upi' && (
            <div className="space-y-3 rounded-xl border border-slate-200 dark:border-slate-800 p-4 bg-slate-50/50 dark:bg-slate-900/50">
              <FormField label="Virtual Payment Address (UPI ID)">
                <input
                  className={inputClass}
                  value={upiId}
                  onChange={(e) => setUpiId(e.target.value)}
                  placeholder="admin@okhdfcbank"
                />
              </FormField>
              <div className="flex items-center gap-2 text-xs text-slate-500">
                <CheckCircle className="h-4 w-4 text-emerald-500" />
                <span>Instant verification supported (GPay, PhonePe, Paytm, BHIM)</span>
              </div>
            </div>
          )}

          {paymentMethod === 'wire' && (
            <div className="space-y-2 rounded-xl border border-slate-200 dark:border-slate-800 p-4 bg-slate-50/50 dark:bg-slate-900/50 text-xs text-slate-600 dark:text-slate-300">
              <p><strong>Bank:</strong> StudyX Platform Financial Services</p>
              <p><strong>Account Name:</strong> StudyX Multi-Tenant Operations</p>
              <p><strong>IBAN / Account Number:</strong> US89 3704 0044 0532 0130 00</p>
              <p><strong>Reference:</strong> RENEW-{school?.code}</p>
            </div>
          )}

          {/* Security badge and Submit button */}
          <div className="pt-2 border-t border-slate-200 dark:border-slate-800 space-y-3">
            <div className="flex items-center justify-between text-xs text-slate-500">
              <span className="flex items-center gap-1">
                <Lock className="h-3.5 w-3.5 text-emerald-500" /> 256-Bit SSL Encrypted Gateway
              </span>
              <span>Instant School Activation</span>
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="secondary" onClick={() => setCheckoutOpen(false)}>
                Cancel
              </Button>
              <Button
                onClick={handleProcessPayment}
                disabled={payMutation.isPending}
                className="bg-emerald-600 hover:bg-emerald-700 text-white"
              >
                {payMutation.isPending ? (
                  <>
                    <RefreshCw className="h-4 w-4 animate-spin" /> Processing Payment...
                  </>
                ) : (
                  <>
                    Authorize & Pay ${finalPrice} <ArrowRight className="h-4 w-4" />
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      </Modal>
    </div>
  );
}

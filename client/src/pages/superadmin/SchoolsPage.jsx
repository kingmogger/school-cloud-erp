import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Search, Ban, CheckCircle, CalendarPlus, KeyRound, UserCheck, Eye, Trash2, Building2 } from 'lucide-react';
import { api, getApiErrorMessage } from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { Button, DataTable, Modal, FormField, Badge, inputClass } from '../../components/ui';

const STATUS_COLOR = {
  active: 'emerald',
  trial: 'indigo',
  grace: 'amber',
  suspended: 'rose',
  expired: 'rose',
};

export function SchoolsPage() {
  const { addToast } = useToast();
  const { startImpersonation } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [createdCreds, setCreatedCreds] = useState(null);
  const [suspendTarget, setSuspendTarget] = useState(null);
  const [suspendReason, setSuspendReason] = useState('');
  const [detailSchoolId, setDetailSchoolId] = useState(null);

  const [form, setForm] = useState({
    name: '',
    code: '',
    logoUrl: '',
    email: '',
    phone: '',
    planId: '',
    adminName: '',
    adminEmail: '',
    adminPassword: '',
  });

  const { data: schoolsRes, isLoading } = useQuery({
    queryKey: ['superadmin-schools', search, statusFilter],
    queryFn: async () => (await api.get('/superadmin/schools', { params: { search, status: statusFilter || undefined } })).data,
  });

  const { data: plans = [] } = useQuery({
    queryKey: ['superadmin-plans'],
    queryFn: async () => (await api.get('/superadmin/plans')).data.data,
  });

  const { data: detailData } = useQuery({
    queryKey: ['superadmin-school-detail', detailSchoolId],
    enabled: Boolean(detailSchoolId),
    queryFn: async () => (await api.get(`/superadmin/schools/${detailSchoolId}`)).data.data,
  });

  const createMutation = useMutation({
    mutationFn: () => api.post('/superadmin/schools', form),
    onSuccess: (res) => {
      addToast('School onboarded successfully', 'success');
      setCreatedCreds({
        ...res.data.data.adminCredentials,
        schoolId: res.data.data.school?._id,
        schoolName: res.data.data.school?.name,
        schoolCode: res.data.data.school?.code,
      });
      setCreateOpen(false);
      qc.invalidateQueries({ queryKey: ['superadmin-schools'] });
      qc.invalidateQueries({ queryKey: ['superadmin-dashboard'] });
    },
    onError: (e) => addToast(getApiErrorMessage(e), 'error'),
  });

  const suspendMutation = useMutation({
    mutationFn: () => api.post(`/superadmin/schools/${suspendTarget._id}/suspend`, { reason: suspendReason }),
    onSuccess: () => {
      addToast(`Suspended ${suspendTarget.name}`, 'info');
      setSuspendTarget(null);
      setSuspendReason('');
      qc.invalidateQueries({ queryKey: ['superadmin-schools'] });
      qc.invalidateQueries({ queryKey: ['superadmin-dashboard'] });
    },
    onError: (e) => addToast(getApiErrorMessage(e), 'error'),
  });

  const reactivateMutation = useMutation({
    mutationFn: (id) => api.post(`/superadmin/schools/${id}/reactivate`),
    onSuccess: () => {
      addToast('School reactivated', 'success');
      qc.invalidateQueries({ queryKey: ['superadmin-schools'] });
      qc.invalidateQueries({ queryKey: ['superadmin-dashboard'] });
    },
  });

  const extendMutation = useMutation({
    mutationFn: (id) => api.post(`/superadmin/schools/${id}/extend`, { days: 30 }),
    onSuccess: () => {
      addToast('Extended subscription by 30 days', 'success');
      qc.invalidateQueries({ queryKey: ['superadmin-schools'] });
    },
  });

  const resetPassMutation = useMutation({
    mutationFn: (id) => api.post(`/superadmin/schools/${id}/reset-admin-password`),
    onSuccess: (res) => {
      const creds = res.data.data;
      addToast(`Password reset for ${creds.email}: ${creds.temporaryPassword}`, 'info', 8000);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => api.delete(`/superadmin/schools/${id}`, { data: { reason: 'Archived by Super Admin' } }),
    onSuccess: () => {
      addToast('School soft-deleted', 'info');
      qc.invalidateQueries({ queryKey: ['superadmin-schools'] });
    },
  });

  const handleImpersonate = async (schoolId) => {
    try {
      const res = await api.post(`/superadmin/schools/${schoolId}/impersonate`, { reason: 'Support inspection' });
      await startImpersonation(res.data.data);
      addToast('Impersonation session started', 'info');
      navigate('/admin');
    } catch (e) {
      addToast(getApiErrorMessage(e), 'error');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Schools Management</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">Onboard schools, control subscriptions, and manage tenant access</p>
        </div>
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="h-4 w-4" /> Create School
        </Button>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <input className={`${inputClass} pl-9`} placeholder="Search school name, code, or email..." value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <select className={`${inputClass} sm:w-48`} value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          <option value="">All Statuses</option>
          <option value="active">Active</option>
          <option value="trial">Trial</option>
          <option value="suspended">Suspended</option>
          <option value="expired">Expired</option>
        </select>
      </div>

      <DataTable
        loading={isLoading}
        columns={[
          {
            key: 'name',
            label: 'School',
            render: (r) => (
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 overflow-hidden shrink-0">
                  {r.logoUrl ? (
                    <img
                      src={r.logoUrl}
                      alt=""
                      className="h-full w-full object-contain p-0.5"
                      onError={(e) => {
                        e.currentTarget.style.display = 'none';
                      }}
                    />
                  ) : (
                    <Building2 className="h-4 w-4 text-slate-500" />
                  )}
                </div>
                <div>
                  <p className="font-semibold text-slate-900 dark:text-white">{r.name}</p>
                  <p className="text-xs font-mono text-indigo-600 dark:text-indigo-400">{r.code}</p>
                </div>
              </div>
            ),
          },
          { key: 'plan', label: 'Plan', render: (r) => r.planId?.name || 'Trial' },
          { key: 'status', label: 'Status', render: (r) => <Badge color={STATUS_COLOR[r.status] || 'slate'}>{r.status.toUpperCase()}</Badge> },
          { key: 'endDate', label: 'Paid Until', render: (r) => (r.endDate ? new Date(r.endDate).toLocaleDateString() : '—') },
          {
            key: 'actions',
            label: 'Controls',
            render: (r) => (
              <div className="flex flex-wrap gap-1.5">
                <Button size="sm" variant="ghost" title="View Details" onClick={() => setDetailSchoolId(r._id)}>
                  <Eye className="h-3.5 w-3.5" />
                </Button>
                {r.status === 'suspended' ? (
                  <Button size="sm" variant="secondary" onClick={() => reactivateMutation.mutate(r._id)}>
                    <CheckCircle className="h-3.5 w-3.5 text-emerald-600" /> Reactivate
                  </Button>
                ) : (
                  <Button size="sm" variant="danger" onClick={() => setSuspendTarget(r)}>
                    <Ban className="h-3.5 w-3.5" /> Suspend
                  </Button>
                )}
                <Button size="sm" variant="secondary" title="Extend 30 Days" onClick={() => extendMutation.mutate(r._id)}>
                  <CalendarPlus className="h-3.5 w-3.5" /> +30d
                </Button>
                <Button size="sm" variant="secondary" title="Impersonate Admin" onClick={() => handleImpersonate(r._id)}>
                  <UserCheck className="h-3.5 w-3.5" /> Login As
                </Button>
                <Button size="sm" variant="ghost" title="Reset Admin Password" onClick={() => resetPassMutation.mutate(r._id)}>
                  <KeyRound className="h-3.5 w-3.5" />
                </Button>
                <Button size="sm" variant="ghost" title="Soft Delete" onClick={() => deleteMutation.mutate(r._id)}>
                  <Trash2 className="h-3.5 w-3.5 text-rose-500" />
                </Button>
              </div>
            ),
          },
        ]}
        data={schoolsRes?.data || []}
      />

      {/* Create School Modal */}
      <Modal open={createOpen} onClose={() => setCreateOpen(false)} title="Onboard New School" maxWidth="max-w-xl">
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <FormField label="School Name" required><input className={inputClass} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></FormField>
            <FormField label="School Code (Slug)" required><input className={inputClass} placeholder="RIVERDALE" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })} /></FormField>
            <FormField label="School Email" required><input type="email" className={inputClass} value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></FormField>
            <FormField label="School Logo URL"><input className={inputClass} placeholder="https://example.com/logo.png" value={form.logoUrl} onChange={(e) => setForm({ ...form, logoUrl: e.target.value })} /></FormField>
            <FormField label="Subscription Plan">
              <select className={inputClass} value={form.planId} onChange={(e) => setForm({ ...form, planId: e.target.value })}>
                <option value="">14-Day Free Trial</option>
                {plans.map((p) => <option key={p._id} value={p._id}>{p.name} (${p.price}/{p.billingCycle})</option>)}
              </select>
            </FormField>
          </div>
          <div className="border-t border-slate-200 dark:border-slate-800 pt-3">
            <p className="text-xs font-semibold uppercase text-slate-500 mb-2">Initial School Admin Account</p>
            <div className="grid gap-3 sm:grid-cols-2">
              <FormField label="Admin Name" required><input className={inputClass} value={form.adminName} onChange={(e) => setForm({ ...form, adminName: e.target.value })} /></FormField>
              <FormField label="Admin Email" required><input type="email" className={inputClass} value={form.adminEmail} onChange={(e) => setForm({ ...form, adminEmail: e.target.value })} /></FormField>
            </div>
            <div className="mt-3">
              <FormField label="Initial Password (Optional — auto-generated if blank)">
                <input type="text" className={inputClass} value={form.adminPassword} onChange={(e) => setForm({ ...form, adminPassword: e.target.value })} />
              </FormField>
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button onClick={() => createMutation.mutate()} disabled={!form.name || !form.code || !form.email || !form.adminName || !form.adminEmail}>
              Create School
            </Button>
          </div>
        </div>
      </Modal>

      {/* Credentials Modal */}
      <Modal open={Boolean(createdCreds)} onClose={() => setCreatedCreds(null)} title="School Onboarded & Credentials Ready">
        <div className="space-y-4 text-sm">
          <div className="rounded-xl border border-emerald-200 dark:border-emerald-900/60 bg-emerald-50 dark:bg-emerald-950/40 p-3 text-xs text-emerald-800 dark:text-emerald-200">
            <p className="font-bold">School successfully saved to database!</p>
            <p className="mt-0.5">The School Admin can log in immediately with these credentials.</p>
          </div>
          <div className="rounded-xl bg-slate-100 dark:bg-slate-800 p-4 font-mono text-xs space-y-1.5 border border-slate-200 dark:border-slate-700">
            {createdCreds?.schoolName && <p><strong>School:</strong> {createdCreds.schoolName} ({createdCreds.schoolCode})</p>}
            <p><strong>Admin Name:</strong> {createdCreds?.name}</p>
            <p><strong>Email (Login ID):</strong> <span className="text-indigo-600 dark:text-indigo-400 font-bold">{createdCreds?.email}</span></p>
            <p><strong>Password:</strong> <span className="text-emerald-600 dark:text-emerald-400 font-bold">{createdCreds?.temporaryPassword}</span></p>
            {createdCreds?.schoolCode && <p><strong>School Code:</strong> <span className="font-bold">{createdCreds.schoolCode}</span></p>}
          </div>
          <div className="flex flex-col sm:flex-row justify-between gap-2 pt-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                const text = `School: ${createdCreds?.schoolName || ''}\nEmail: ${createdCreds?.email}\nPassword: ${createdCreds?.temporaryPassword}\nSchool Code: ${createdCreds?.schoolCode || ''}`;
                navigator.clipboard.writeText(text);
                addToast('Credentials copied to clipboard!', 'success');
              }}
            >
              Copy Credentials
            </Button>
            <div className="flex gap-2">
              {createdCreds?.schoolId && (
                <Button
                  size="sm"
                  className="bg-indigo-600 hover:bg-indigo-700 text-white"
                  onClick={() => {
                    const sid = createdCreds.schoolId;
                    setCreatedCreds(null);
                    handleImpersonate(sid);
                  }}
                >
                  <UserCheck className="h-4 w-4" /> Open Admin Portal Now
                </Button>
              )}
              <Button size="sm" variant="secondary" onClick={() => setCreatedCreds(null)}>Close</Button>
            </div>
          </div>
        </div>
      </Modal>

      {/* Suspend Confirmation Modal */}
      <Modal open={Boolean(suspendTarget)} onClose={() => setSuspendTarget(null)} title={`Suspend ${suspendTarget?.name}`}>
        <div className="space-y-4">
          <p className="text-sm text-slate-600 dark:text-slate-300">
            Suspending this school immediately blocks all faculty, student, and parent access without deleting any data.
          </p>
          <FormField label="Suspension Reason" required>
            <input className={inputClass} value={suspendReason} onChange={(e) => setSuspendReason(e.target.value)} placeholder="e.g., Overdue subscription payment" />
          </FormField>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setSuspendTarget(null)}>Cancel</Button>
            <Button variant="danger" disabled={!suspendReason.trim() || suspendMutation.isPending} onClick={() => suspendMutation.mutate()}>
              Confirm Suspend
            </Button>
          </div>
        </div>
      </Modal>

      {/* Detail Modal */}
      <Modal open={Boolean(detailSchoolId)} onClose={() => setDetailSchoolId(null)} title="School Usage & Details">
        {detailData && (
          <div className="space-y-3 text-sm">
            <p><strong>Name:</strong> {detailData.school?.name} ({detailData.school?.code})</p>
            <p><strong>Effective Status:</strong> <Badge color={STATUS_COLOR[detailData.statusInfo?.effectiveStatus]}>{detailData.statusInfo?.effectiveStatus?.toUpperCase()}</Badge></p>
            <p><strong>Active Students:</strong> {detailData.usage?.studentsCount} / {detailData.school?.planId?.maxStudents || '∞'}</p>
            <p><strong>Active Faculty:</strong> {detailData.usage?.facultyCount} / {detailData.school?.planId?.maxFaculty || '∞'}</p>
            <p><strong>Total Users:</strong> {detailData.usage?.usersCount}</p>
          </div>
        )}
      </Modal>
    </div>
  );
}

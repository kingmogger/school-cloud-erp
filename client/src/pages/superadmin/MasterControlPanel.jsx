import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Sliders,
  Database,
  Building2,
  Users,
  ShieldAlert,
  Search,
  Plus,
  Ban,
  CheckCircle,
  CalendarPlus,
  KeyRound,
  UserCheck,
  Edit3,
  ExternalLink,
  RefreshCw,
  Sparkles,
  DollarSign,
  AlertTriangle,
  Image as ImageIcon,
  Check,
  Package,
} from 'lucide-react';
import { api, getApiErrorMessage } from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { Button, Modal, FormField, Badge, inputClass } from '../../components/ui';

const PRESET_LOGOS = [
  {
    name: 'Emerald Shield',
    url: 'https://images.unsplash.com/photo-1546410531-bb4caa6b424d?w=128&auto=format&fit=crop&q=80',
  },
  {
    name: 'Gold Crest',
    url: 'https://images.unsplash.com/photo-1599305445671-ac291c95aaa9?w=128&auto=format&fit=crop&q=80',
  },
  {
    name: 'Modern Blue Tech',
    url: 'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=128&auto=format&fit=crop&q=80',
  },
  {
    name: 'Ivy Academy',
    url: 'https://images.unsplash.com/photo-1523050854058-8df90110c9f1?w=128&auto=format&fit=crop&q=80',
  },
];

const STATUS_COLOR = {
  active: 'emerald',
  trial: 'indigo',
  grace: 'amber',
  suspended: 'rose',
  expired: 'rose',
};

export function MasterControlPanel() {
  const { addToast } = useToast();
  const { startImpersonation } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  // Modals state
  const [createOpen, setCreateOpen] = useState(false);
  const [editSchool, setEditSchool] = useState(null);
  const [suspendTarget, setSuspendTarget] = useState(null);
  const [suspendReason, setSuspendReason] = useState('');
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [changePlanTarget, setChangePlanTarget] = useState(null);
  const [newPlanId, setNewPlanId] = useState('');
  const [createdCreds, setCreatedCreds] = useState(null);
  const [isSeeding, setIsSeeding] = useState(false);

  // New school form
  const [createForm, setCreateForm] = useState({
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

  // Queries
  const { data: dashboardData, isLoading: dashLoading } = useQuery({
    queryKey: ['superadmin-dashboard'],
    queryFn: async () => (await api.get('/superadmin/dashboard')).data.data,
  });

  const { data: schoolsRes, isLoading: schoolsLoading } = useQuery({
    queryKey: ['superadmin-schools', search, statusFilter],
    queryFn: async () => (await api.get('/superadmin/schools', { params: { search, status: statusFilter || undefined, limit: 100 } })).data,
  });

  const { data: plans = [] } = useQuery({
    queryKey: ['superadmin-plans'],
    queryFn: async () => (await api.get('/superadmin/plans')).data.data,
  });

  const { data: dbStats } = useQuery({
    queryKey: ['database-stats'],
    queryFn: async () => (await api.get('/database/stats')).data.data,
  });

  const schools = schoolsRes?.data || [];

  // Mutations
  const createMutation = useMutation({
    mutationFn: () => api.post('/superadmin/schools', createForm),
    onSuccess: (res) => {
      addToast(`School "${createForm.name}" created with custom branding!`, 'success');
      setCreatedCreds({
        ...res.data.data.adminCredentials,
        schoolId: res.data.data.school?._id,
        schoolName: res.data.data.school?.name,
        schoolCode: res.data.data.school?.code,
      });
      setCreateOpen(false);
      setCreateForm({
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
      qc.invalidateQueries({ queryKey: ['superadmin-schools'] });
      qc.invalidateQueries({ queryKey: ['superadmin-dashboard'] });
      qc.invalidateQueries({ queryKey: ['database-stats'] });
    },
    onError: (e) => addToast(getApiErrorMessage(e), 'error'),
  });

  const updateMutation = useMutation({
    mutationFn: (vals) => api.patch(`/superadmin/schools/${editSchool?._id}`, vals),
    onSuccess: () => {
      addToast('School branding and settings updated successfully', 'success');
      setEditSchool(null);
      qc.invalidateQueries({ queryKey: ['superadmin-schools'] });
      qc.invalidateQueries({ queryKey: ['superadmin-dashboard'] });
    },
    onError: (e) => addToast(getApiErrorMessage(e), 'error'),
  });

  const suspendMutation = useMutation({
    mutationFn: () => api.post(`/superadmin/schools/${suspendTarget?._id}/suspend`, { reason: suspendReason }),
    onSuccess: () => {
      addToast(`Access revoked for ${suspendTarget?.name || 'School'}`, 'info');
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
      addToast('School access granted & reactivated (+30 days auto-extended)', 'success');
      qc.invalidateQueries({ queryKey: ['superadmin-schools'] });
      qc.invalidateQueries({ queryKey: ['superadmin-dashboard'] });
    },
    onError: (e) => addToast(getApiErrorMessage(e), 'error'),
  });

  const deleteSchoolMutation = useMutation({
    mutationFn: (id) => api.delete(`/superadmin/schools/${id}?permanent=true`),
    onSuccess: () => {
      addToast('School and all associated records permanently purged from database', 'success');
      setDeleteTarget(null);
      qc.invalidateQueries({ queryKey: ['superadmin-schools'] });
      qc.invalidateQueries({ queryKey: ['superadmin-dashboard'] });
      qc.invalidateQueries({ queryKey: ['database-stats'] });
    },
    onError: (e) => addToast(getApiErrorMessage(e), 'error'),
  });

  const extendMutation = useMutation({
    mutationFn: ({ id, days }) => api.post(`/superadmin/schools/${id}/extend`, { days }),
    onSuccess: (_, vars) => {
      addToast(`Extended subscription by ${vars.days} days`, 'success');
      qc.invalidateQueries({ queryKey: ['superadmin-schools'] });
    },
    onError: (e) => addToast(getApiErrorMessage(e), 'error'),
  });

  const changePlanMutation = useMutation({
    mutationFn: () => api.post(`/superadmin/schools/${changePlanTarget?._id}/change-plan`, { planId: newPlanId }),
    onSuccess: () => {
      addToast('Subscription plan updated', 'success');
      setChangePlanTarget(null);
      qc.invalidateQueries({ queryKey: ['superadmin-schools'] });
    },
    onError: (e) => addToast(getApiErrorMessage(e), 'error'),
  });

  const resetPassMutation = useMutation({
    mutationFn: (id) => api.post(`/superadmin/schools/${id}/reset-admin-password`),
    onSuccess: (res) => {
      const creds = res.data.data;
      addToast(`New password for ${creds.email}: ${creds.temporaryPassword}`, 'info', 10000);
    },
    onError: (e) => addToast(getApiErrorMessage(e), 'error'),
  });

  const handleImpersonate = async (schoolId) => {
    try {
      const res = await api.post(`/superadmin/schools/${schoolId}/impersonate`, { reason: 'Master Control Panel inspection' });
      await startImpersonation(res.data.data);
      addToast('Logged in as School Admin. You are now seeing their customized branding view.', 'info');
      navigate('/admin');
    } catch (err) {
      addToast(getApiErrorMessage(err), 'error');
    }
  };

  const handleSeed = async () => {
    if (!window.confirm('Re-seed initial demo dataset? This refreshes demo schools, classes, students, and marks.')) return;
    try {
      setIsSeeding(true);
      await api.post('/database/seed/run');
      addToast('Demo database successfully re-seeded!', 'success');
      qc.invalidateQueries();
    } catch (err) {
      addToast(getApiErrorMessage(err), 'error');
    } finally {
      setIsSeeding(false);
    }
  };

  return (
    <div className="space-y-8">
      {/* Platform Mission Control Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between border-b border-slate-200 dark:border-slate-800 pb-6">
        <div>
          <div className="flex items-center gap-2.5">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-600 text-white shadow-sm">
              <Sliders className="h-4 w-4" />
            </span>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
              Platform Master Control Panel
            </h1>
          </div>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            White-Label School Customizer, School Access Kill-Switch, Subscription Plans & Direct Database Control.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <Button variant="secondary" onClick={() => navigate('/superadmin/database')}>
            <Database className="h-4 w-4" /> Database Explorer
          </Button>
          <Button variant="secondary" onClick={handleSeed} disabled={isSeeding}>
            <RefreshCw className={`h-4 w-4 ${isSeeding ? 'animate-spin' : ''}`} />
            {isSeeding ? 'Seeding...' : 'Re-Seed Demo'}
          </Button>
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="h-4 w-4" /> Onboard School
          </Button>
        </div>
      </div>

      {/* Top Health & Diagnostic Metrics */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Total Schools</p>
            <Building2 className="h-5 w-5 text-indigo-500" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-slate-900 dark:text-white">{dashboardData?.totalSchools ?? '...'}</span>
            <div className="flex items-center gap-1.5 text-xs font-medium">
              <span className="text-emerald-600 dark:text-emerald-400 font-semibold">{dashboardData?.counts?.active ?? 0} active</span>
              <span className="text-slate-400">•</span>
              <span className="text-rose-600 dark:text-rose-400 font-semibold">{dashboardData?.counts?.suspended ?? 0} suspended</span>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Platform Students</p>
            <Users className="h-5 w-5 text-emerald-500" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-slate-900 dark:text-white">{dashboardData?.totalStudents ?? '...'}</span>
            <span className="text-xs text-slate-500">Across all tenants</span>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Estimated MRR</p>
            <DollarSign className="h-5 w-5 text-amber-500" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-slate-900 dark:text-white">${dashboardData?.mrr ?? 0}</span>
            <span className="text-xs text-slate-500">Subscription revenue</span>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Database Engine</p>
            <Database className="h-5 w-5 text-cyan-500" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-extrabold text-slate-900 dark:text-white">
              {Array.isArray(dbStats?.collections) ? `${dbStats.collections.length} Collections` : 'Active'}
            </span>
            <span className="inline-flex items-center rounded-md bg-emerald-500/10 px-2 py-0.5 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
              Firestore
            </span>
          </div>
        </div>
      </div>

      {/* School White-Label & Access Kill-Switch Management */}
      <div className="space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">
              School White-Label & Access Control Center
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Customize branding (name & logo) per school and give/revoke platform access with one click.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="relative min-w-[220px]">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
              <input
                className={`${inputClass} pl-9 text-xs py-2`}
                placeholder="Search name, code, email..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <select
              className={`${inputClass} text-xs py-2 w-auto`}
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="">All Statuses</option>
              <option value="active">Active</option>
              <option value="suspended">Suspended</option>
              <option value="trial">Trial</option>
              <option value="expired">Expired</option>
            </select>
          </div>
        </div>

        {/* School Cards Grid */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {schools.map((s) => {
            const isSuspended = s.status === 'suspended';
            return (
              <div
                key={s._id}
                className={`relative flex flex-col justify-between rounded-2xl border p-5 transition-all shadow-xs ${
                  isSuspended
                    ? 'border-rose-300 dark:border-rose-900/60 bg-rose-50/30 dark:bg-rose-950/20'
                    : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-slate-300 dark:hover:border-slate-700'
                }`}
              >
                <div>
                  {/* Card Header with Logo Preview & Status */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 overflow-hidden shrink-0 shadow-xs">
                        {s.logoUrl ? (
                          <img
                            src={s.logoUrl}
                            alt={s.name}
                            className="h-full w-full object-contain p-1"
                            onError={(e) => {
                              e.currentTarget.style.display = 'none';
                              if (e.currentTarget.nextElementSibling) {
                                e.currentTarget.nextElementSibling.style.display = 'block';
                              }
                            }}
                          />
                        ) : null}
                        <Building2 className={`h-6 w-6 text-slate-500 ${s.logoUrl ? 'hidden' : 'block'}`} />
                      </div>
                      <div className="min-w-0">
                        <h3 className="truncate text-base font-bold text-slate-900 dark:text-white leading-snug">
                          {s.name}
                        </h3>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="font-mono text-xs font-semibold text-slate-500 dark:text-slate-400">
                            {s.code}
                          </span>
                          <span className="text-slate-300 dark:text-slate-700">•</span>
                          <span className="text-xs text-slate-500 truncate max-w-[140px]">{s.email}</span>
                        </div>
                      </div>
                    </div>
                    <Badge color={STATUS_COLOR[s.status] || 'slate'}>
                      {s.status}
                    </Badge>
                  </div>

                  {/* Plan & Expiry Details */}
                  <div className="mt-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 p-3 text-xs space-y-1.5 border border-slate-100 dark:border-slate-800">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-500 dark:text-slate-400">Plan:</span>
                      <span className="font-semibold text-slate-800 dark:text-slate-200">
                        {s.planId?.name || (s.status === 'trial' ? 'Free Trial' : 'Custom')}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-500 dark:text-slate-400">Valid Until:</span>
                      <span className="font-medium text-slate-700 dark:text-slate-300">
                        {s.endDate ? new Date(s.endDate).toLocaleDateString() : 'N/A'}
                      </span>
                    </div>
                    {isSuspended && s.manualSuspension?.reason && (
                      <div className="mt-1 pt-1 border-t border-rose-200 dark:border-rose-900/60 text-rose-700 dark:text-rose-300">
                        <span className="font-semibold">Reason: </span>
                        {s.manualSuspension.reason}
                      </div>
                    )}
                  </div>
                </div>

                {/* Card Action Center */}
                <div className="mt-5 space-y-2 pt-4 border-t border-slate-100 dark:border-slate-800/80">
                  {/* Primary Access Kill Switch */}
                  <div className="grid grid-cols-2 gap-2">
                    {isSuspended ? (
                      <Button
                        size="sm"
                        variant="primary"
                        className="w-full bg-emerald-600 hover:bg-emerald-700 text-white"
                        onClick={() => reactivateMutation.mutate(s._id)}
                      >
                        <CheckCircle className="h-3.5 w-3.5" /> Grant Access
                      </Button>
                    ) : (
                      <Button
                        size="sm"
                        variant="danger"
                        className="w-full"
                        onClick={() => setSuspendTarget(s)}
                      >
                        <Ban className="h-3.5 w-3.5" /> Suspend Access
                      </Button>
                    )}

                    <Button
                      size="sm"
                      variant="secondary"
                      className="w-full"
                      onClick={() => setEditSchool(s)}
                    >
                      <Edit3 className="h-3.5 w-3.5" /> Edit Branding
                    </Button>
                  </div>

                  {/* Secondary Management Controls */}
                  <div className="flex items-center justify-between gap-1 text-xs">
                    <button
                      type="button"
                      onClick={() => handleImpersonate(s._id)}
                      className="flex items-center gap-1 px-2 py-1 rounded-md text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/50 font-medium cursor-pointer"
                      title="Login directly as this school's admin to inspect white-label appearance"
                    >
                      <UserCheck className="h-3.5 w-3.5" /> Login As Admin
                    </button>

                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => extendMutation.mutate({ id: s._id, days: 30 })}
                        className="flex items-center gap-1 px-2 py-1 rounded-md text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                        title="Extend subscription by 30 days"
                      >
                        <CalendarPlus className="h-3.5 w-3.5" /> +30d
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setChangePlanTarget(s);
                          setNewPlanId(s.planId?._id || '');
                        }}
                        className="flex items-center gap-1 px-2 py-1 rounded-md text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                        title="Change Subscription Plan"
                      >
                        <Package className="h-3.5 w-3.5" /> Plan
                      </button>

                      <button
                        type="button"
                        onClick={() => resetPassMutation.mutate(s._id)}
                        className="p-1 rounded-md text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                        title="Reset Admin Password"
                      >
                        <KeyRound className="h-3.5 w-3.5" />
                      </button>

                      <button
                        type="button"
                        onClick={() => setDeleteTarget(s)}
                        className="p-1 rounded-md text-rose-500 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/50 cursor-pointer"
                        title="Permanently Delete School from Database"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {schools.length === 0 && !schoolsLoading && (
          <div className="rounded-2xl border border-dashed border-slate-200 dark:border-slate-800 p-8 text-center">
            <Building2 className="mx-auto h-8 w-8 text-slate-400" />
            <p className="mt-2 text-sm font-semibold text-slate-700 dark:text-slate-300">No schools found</p>
            <p className="text-xs text-slate-500">Try adjusting your search or filters.</p>
          </div>
        )}
      </div>

      {/* Database Explorer Quick Launcher Widget */}
      <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-xs space-y-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <Database className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
              <h2 className="text-base font-bold text-slate-900 dark:text-white">
                Live Database Explorer & Collections
              </h2>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Direct access to all 26 Firestore collections, records, and schema stats.
            </p>
          </div>

          <Button size="sm" onClick={() => navigate('/superadmin/database')}>
            Open Full Database Dashboard <ExternalLink className="h-3.5 w-3.5" />
          </Button>
        </div>

        {Array.isArray(dbStats?.collections) && (
          <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-2 pt-2">
            {dbStats.collections.slice(0, 16).map((col) => (
              <Link
                key={col.name}
                to="/superadmin/database"
                className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/40 p-2.5 hover:border-indigo-400 dark:hover:border-indigo-600 transition-colors"
              >
                <p className="text-xs font-semibold text-slate-600 dark:text-slate-300 truncate capitalize">{col.name}</p>
                <p className="text-lg font-bold text-indigo-600 dark:text-indigo-400 mt-1">{col.count ?? 0}</p>
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* MODAL: Onboard School with White-Label Branding */}
      <Modal open={createOpen} onClose={() => setCreateOpen(false)} title="Onboard New School (White-Label Setup)">
        <div className="space-y-4 max-h-[75vh] overflow-y-auto px-1">
          <div className="grid gap-3 sm:grid-cols-2">
            <FormField label="School Name *">
              <input
                className={inputClass}
                value={createForm.name}
                onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })}
                placeholder="e.g. Oakridge Academy"
              />
            </FormField>
            <FormField label="School Code (Tenant Key) *">
              <input
                className={inputClass}
                value={createForm.code}
                onChange={(e) => setCreateForm({ ...createForm, code: e.target.value.toUpperCase() })}
                placeholder="e.g. OAKRIDGE"
              />
            </FormField>
          </div>

          {/* White-Label Custom Logo URL & Preview */}
          <div className="rounded-xl border border-indigo-100 dark:border-indigo-900/50 bg-indigo-50/40 dark:bg-indigo-950/20 p-4 space-y-3">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
              <label className="text-xs font-bold uppercase tracking-wider text-indigo-900 dark:text-indigo-300">
                School Logo & Custom Branding
              </label>
            </div>

            <FormField label="Logo Image URL">
              <input
                className={inputClass}
                value={createForm.logoUrl}
                onChange={(e) => setCreateForm({ ...createForm, logoUrl: e.target.value })}
                placeholder="https://example.com/logo.png"
              />
            </FormField>

            {/* Quick Sample Presets */}
            <div>
              <p className="text-xs font-medium text-slate-500 mb-1.5">Or choose a pre-set sample school logo:</p>
              <div className="flex flex-wrap gap-2">
                {PRESET_LOGOS.map((p) => (
                  <button
                    key={p.name}
                    type="button"
                    onClick={() => setCreateForm({ ...createForm, logoUrl: p.url })}
                    className={`flex items-center gap-2 rounded-lg border px-2.5 py-1 text-xs font-medium transition-all ${
                      createForm.logoUrl === p.url
                        ? 'border-indigo-600 bg-indigo-600 text-white'
                        : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700'
                    }`}
                  >
                    <img src={p.url} alt="" className="h-4 w-4 rounded-xs object-cover" />
                    <span>{p.name}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Live Logo Preview Box */}
            {createForm.logoUrl && (
              <div className="flex items-center gap-3 pt-2">
                <span className="text-xs font-medium text-slate-500">Live Preview:</span>
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-1">
                  <img
                    src={createForm.logoUrl}
                    alt="Preview"
                    className="h-full w-full object-contain"
                    onError={(e) => (e.currentTarget.style.display = 'none')}
                  />
                </div>
                <span className="text-xs text-slate-600 dark:text-slate-300 font-semibold truncate">
                  {createForm.name || 'Your School'}
                </span>
              </div>
            )}
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <FormField label="School Official Email *">
              <input
                type="email"
                className={inputClass}
                value={createForm.email}
                onChange={(e) => setCreateForm({ ...createForm, email: e.target.value })}
                placeholder="contact@oakridge.edu"
              />
            </FormField>
            <FormField label="Phone">
              <input
                className={inputClass}
                value={createForm.phone}
                onChange={(e) => setCreateForm({ ...createForm, phone: e.target.value })}
                placeholder="+1 555-0199"
              />
            </FormField>
          </div>

          <FormField label="Subscription Plan">
            <select
              className={inputClass}
              value={createForm.planId}
              onChange={(e) => setCreateForm({ ...createForm, planId: e.target.value })}
            >
              <option value="">14-Day Free Trial (No plan)</option>
              {plans.map((p) => (
                <option key={p._id} value={p._id}>
                  {p.name} (${p.price}/{p.billingCycle})
                </option>
              ))}
            </select>
          </FormField>

          <div className="border-t border-slate-200 dark:border-slate-800 pt-3 space-y-3">
            <p className="text-xs font-bold uppercase tracking-wider text-slate-500">School Admin Account</p>
            <div className="grid gap-3 sm:grid-cols-2">
              <FormField label="Admin Name *">
                <input
                  className={inputClass}
                  value={createForm.adminName}
                  onChange={(e) => setCreateForm({ ...createForm, adminName: e.target.value })}
                  placeholder="Principal Smith"
                />
              </FormField>
              <FormField label="Admin Email *">
                <input
                  type="email"
                  className={inputClass}
                  value={createForm.adminEmail}
                  onChange={(e) => setCreateForm({ ...createForm, adminEmail: e.target.value })}
                  placeholder="admin@oakridge.edu"
                />
              </FormField>
            </div>
            <FormField label="Admin Password (leave blank to auto-generate)">
              <input
                type="password"
                className={inputClass}
                value={createForm.adminPassword}
                onChange={(e) => setCreateForm({ ...createForm, adminPassword: e.target.value })}
                placeholder="SecurePassword@123"
              />
            </FormField>
          </div>

          <div className="flex justify-end gap-2 pt-3">
            <Button variant="secondary" onClick={() => setCreateOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => createMutation.mutate()}
              disabled={
                !createForm.name ||
                !createForm.code ||
                !createForm.email ||
                !createForm.adminName ||
                !createForm.adminEmail ||
                createMutation.isPending
              }
            >
              <Check className="h-4 w-4" /> Create & Assign School
            </Button>
          </div>
        </div>
      </Modal>

      {/* MODAL: Edit School White-Label Branding */}
      <Modal open={Boolean(editSchool)} onClose={() => setEditSchool(null)} title="Customize School White-Label & Branding">
        {editSchool && (
          <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <FormField label="School Display Name">
                <input
                  className={inputClass}
                  value={editSchool.name}
                  onChange={(e) => setEditSchool({ ...editSchool, name: e.target.value })}
                />
              </FormField>
              <FormField label="School Code">
                <input
                  className={inputClass}
                  value={editSchool.code}
                  onChange={(e) => setEditSchool({ ...editSchool, code: e.target.value.toUpperCase() })}
                />
              </FormField>
            </div>

            {/* Custom Logo URL & Presets */}
            <div className="rounded-xl border border-indigo-100 dark:border-indigo-900/50 bg-indigo-50/40 dark:bg-indigo-950/20 p-4 space-y-3">
              <FormField label="School Logo URL (White-Label Icon)">
                <input
                  className={inputClass}
                  value={editSchool.logoUrl || ''}
                  onChange={(e) => setEditSchool({ ...editSchool, logoUrl: e.target.value })}
                  placeholder="https://example.com/logo.png"
                />
              </FormField>

              <div>
                <p className="text-xs font-medium text-slate-500 mb-1.5">Preset Logos:</p>
                <div className="flex flex-wrap gap-2">
                  {PRESET_LOGOS.map((p) => (
                    <button
                      key={p.name}
                      type="button"
                      onClick={() => setEditSchool({ ...editSchool, logoUrl: p.url })}
                      className="flex items-center gap-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-2 py-1 text-xs hover:bg-slate-100 dark:hover:bg-slate-700"
                    >
                      <img src={p.url} alt="" className="h-4 w-4 rounded-xs object-cover" />
                      <span>{p.name}</span>
                    </button>
                  ))}
                </div>
              </div>

              {editSchool.logoUrl && (
                <div className="flex items-center gap-3 pt-2">
                  <span className="text-xs font-medium text-slate-500">Live Preview:</span>
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-1">
                    <img
                      src={editSchool.logoUrl}
                      alt="Preview"
                      className="h-full w-full object-contain"
                      onError={(e) => (e.currentTarget.style.display = 'none')}
                    />
                  </div>
                  <span className="text-xs font-bold text-slate-800 dark:text-slate-100">
                    {editSchool.name}
                  </span>
                </div>
              )}
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <FormField label="Official Email">
                <input
                  className={inputClass}
                  value={editSchool.email || ''}
                  onChange={(e) => setEditSchool({ ...editSchool, email: e.target.value })}
                />
              </FormField>
              <FormField label="Contact Phone">
                <input
                  className={inputClass}
                  value={editSchool.phone || ''}
                  onChange={(e) => setEditSchool({ ...editSchool, phone: e.target.value })}
                />
              </FormField>
            </div>

            <div className="flex justify-end gap-2 pt-3">
              <Button variant="secondary" onClick={() => setEditSchool(null)}>
                Cancel
              </Button>
              <Button
                onClick={() =>
                  updateMutation.mutate({
                    name: editSchool.name,
                    code: editSchool.code,
                    logoUrl: editSchool.logoUrl || '',
                    email: editSchool.email,
                    phone: editSchool.phone,
                  })
                }
              >
                Save Branding
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* MODAL: Suspend Access (Kill-Switch) */}
      <Modal open={Boolean(suspendTarget)} onClose={() => setSuspendTarget(null)} title={`Suspend Access: ${suspendTarget?.name}`}>
        <div className="space-y-4">
          <div className="rounded-xl border border-rose-200 dark:border-rose-900/60 bg-rose-50 dark:bg-rose-950/40 p-4 text-xs text-rose-800 dark:text-rose-200">
            <p className="font-semibold">Access Kill-Switch Warning:</p>
            <p className="mt-1">
              Suspending this school immediately revokes access for all its faculty, students, and parents. School Admin will see a suspended account message.
            </p>
          </div>

          <FormField label="Suspension Reason (Required)">
            <textarea
              className={inputClass}
              rows={3}
              value={suspendReason}
              onChange={(e) => setSuspendReason(e.target.value)}
              placeholder="e.g. Non-payment of subscription, contract review..."
            />
          </FormField>

          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setSuspendTarget(null)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              disabled={!suspendReason.trim() || suspendMutation.isPending}
              onClick={() => suspendMutation.mutate()}
            >
              Confirm Kill-Switch Suspension
            </Button>
          </div>
        </div>
      </Modal>

      {/* MODAL: Change Subscription Plan */}
      <Modal open={Boolean(changePlanTarget)} onClose={() => setChangePlanTarget(null)} title={`Change Plan: ${changePlanTarget?.name}`}>
        <div className="space-y-4">
          <FormField label="Select Subscription Plan">
            <select
              className={inputClass}
              value={newPlanId}
              onChange={(e) => setNewPlanId(e.target.value)}
            >
              <option value="">Select Plan</option>
              {plans.map((p) => (
                <option key={p._id} value={p._id}>
                  {p.name} - ${p.price}/{p.billingCycle} (Max {p.maxStudents} students)
                </option>
              ))}
            </select>
          </FormField>

          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setChangePlanTarget(null)}>
              Cancel
            </Button>
            <Button
              disabled={!newPlanId || changePlanMutation.isPending}
              onClick={() => changePlanMutation.mutate()}
            >
              Update Subscription Plan
            </Button>
          </div>
        </div>
      </Modal>

      {/* Permanent Delete School Modal */}
      <Modal open={!!deleteTarget} onClose={() => setDeleteTarget(null)} title="Permanently Purge School from Database" maxWidth="max-w-md">
        <div className="space-y-4">
          <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-700 dark:text-rose-300 text-xs">
            ⚠️ <strong>Danger:</strong> This will completely remove <strong>{deleteTarget?.name}</strong> ({deleteTarget?.code}) and all its associated users, classes, students, and records from the database. This action is immediate and cannot be undone.
          </div>
          <p className="text-sm text-slate-600 dark:text-slate-300">
            Confirm permanent deletion of <strong>{deleteTarget?.name}</strong>?
          </p>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" onClick={() => setDeleteTarget(null)}>Cancel</Button>
            <Button
              variant="danger"
              disabled={deleteSchoolMutation.isPending}
              onClick={() => deleteSchoolMutation.mutate(deleteTarget?._id)}
            >
              {deleteSchoolMutation.isPending ? 'Purging...' : 'Permanently Delete'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* MODAL: Newly Created Credentials */}
      <Modal open={Boolean(createdCreds)} onClose={() => setCreatedCreds(null)} title="School Onboarded & Credentials Ready">
        <div className="space-y-4">
          <div className="rounded-xl border border-emerald-200 dark:border-emerald-900/60 bg-emerald-50 dark:bg-emerald-950/40 p-4 text-xs text-emerald-800 dark:text-emerald-200">
            <p className="font-bold text-sm">School successfully saved to database!</p>
            <p className="mt-1">
              The School Admin account is active and can log in immediately with the credentials below.
            </p>
          </div>

          <div className="rounded-xl bg-slate-100 dark:bg-slate-800 p-4 font-mono text-xs space-y-2 border border-slate-200 dark:border-slate-700">
            {createdCreds?.schoolName && (
              <p><strong>School:</strong> {createdCreds.schoolName} ({createdCreds.schoolCode})</p>
            )}
            <p><strong>Admin Name:</strong> {createdCreds?.name}</p>
            <p><strong>Email (Login ID):</strong> <span className="text-indigo-600 dark:text-indigo-400 font-bold">{createdCreds?.email}</span></p>
            <p><strong>Password:</strong> <span className="text-emerald-600 dark:text-emerald-400 font-bold">{createdCreds?.temporaryPassword}</span></p>
            {createdCreds?.schoolCode && (
              <p><strong>School Code:</strong> <span className="font-bold">{createdCreds.schoolCode}</span></p>
            )}
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
              <Button size="sm" variant="secondary" onClick={() => setCreatedCreds(null)}>
                Close
              </Button>
            </div>
          </div>
        </div>
      </Modal>
    </div>
  );
}

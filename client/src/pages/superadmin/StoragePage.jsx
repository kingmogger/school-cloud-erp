import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  HardDrive,
  Database,
  AlertTriangle,
  Files,
  Search,
  RefreshCw,
  SlidersHorizontal,
  Eye,
  ArrowUpDown,
} from 'lucide-react';
import { api, getApiErrorMessage } from '../../api/client';
import { useToast } from '../../context/ToastContext';
import { StatCard, DataTable, Button, Modal, FormField, Badge, inputClass } from '../../components/ui';
import { formatBytes, getStorageBarColor, getStorageBadgeColor } from '../../utils/formatBytes';

const PRESET_LIMITS = [
  { label: '500 MB', bytes: 500 * 1024 * 1024 },
  { label: '1 GB', bytes: 1 * 1024 * 1024 * 1024 },
  { label: '2 GB', bytes: 2 * 1024 * 1024 * 1024 },
  { label: '5 GB', bytes: 5 * 1024 * 1024 * 1024 },
  { label: '10 GB', bytes: 10 * 1024 * 1024 * 1024 },
];

export function StoragePage() {
  const navigate = useNavigate();
  const { addToast } = useToast();
  const qc = useQueryClient();

  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');
  const [sortBy, setSortBy] = useState('used');
  const [sortDir, setSortDir] = useState('desc');
  const [page, setPage] = useState(1);

  const [limitModalSchool, setLimitModalSchool] = useState(null);
  const [selectedPresetBytes, setSelectedPresetBytes] = useState(1073741824);
  const [customGb, setCustomGb] = useState('');

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['superadmin-storage', search, filter, sortBy, sortDir, page],
    queryFn: async () => {
      const res = await api.get('/superadmin/storage', {
        params: { search, filter, sortBy, sortDir, page, limit: 10 },
      });
      return { ...res.data.data, meta: res.data.meta };
    },
  });

  const recalculateMutation = useMutation({
    mutationFn: (schoolId) => api.post(`/superadmin/storage/schools/${schoolId}/recalculate`),
    onSuccess: (res) => {
      const d = res.data.data;
      addToast(`Recalculated ${d.schoolName}: ${d.storageUsedFormatted} (${d.fileCount} files)`, 'success');
      qc.invalidateQueries({ queryKey: ['superadmin-storage'] });
    },
    onError: (e) => addToast(getApiErrorMessage(e), 'error'),
  });

  const updateLimitMutation = useMutation({
    mutationFn: ({ schoolId, storageLimitBytes }) =>
      api.patch(`/superadmin/storage/schools/${schoolId}/limit`, { storageLimitBytes }),
    onSuccess: () => {
      addToast('School storage limit updated', 'success');
      setLimitModalSchool(null);
      setCustomGb('');
      qc.invalidateQueries({ queryKey: ['superadmin-storage'] });
    },
    onError: (e) => addToast(getApiErrorMessage(e), 'error'),
  });

  const openLimitModal = (school) => {
    setLimitModalSchool(school);
    setSelectedPresetBytes(school.storageLimitBytes);
    setCustomGb((school.storageLimitBytes / (1024 * 1024 * 1024)).toFixed(2));
  };

  const handleSaveLimit = (e) => {
    e.preventDefault();
    if (!limitModalSchool) return;
    const parsedGb = Number(customGb);
    const bytesToSave =
      customGb !== '' && Number.isFinite(parsedGb) && parsedGb > 0
        ? Math.round(parsedGb * 1024 * 1024 * 1024)
        : selectedPresetBytes;
    updateLimitMutation.mutate({ schoolId: limitModalSchool._id, storageLimitBytes: bytesToSave });
  };

  const summary = data?.summary;
  const schools = data?.schools || [];
  const meta = data?.meta;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Storage Management</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Monitor per-school Firebase Storage usage, quotas, and reconciliation
          </p>
        </div>
        <Button variant="secondary" onClick={() => refetch()}>
          <RefreshCw className="h-4 w-4" /> Refresh
        </Button>
      </div>

      {isError && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 dark:bg-rose-950/50 dark:border-rose-900 p-4 text-sm text-rose-700 dark:text-rose-300">
          Failed to load platform storage metrics. Please try again.
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Total Storage Used"
          value={summary?.totalUsedFormatted || '0 B'}
          subtitle={`Across ${summary?.totalSchools || 0} schools`}
          icon={HardDrive}
        />
        <StatCard
          title="Total Allocated"
          value={summary?.totalAllocatedFormatted || '0 B'}
          subtitle="Combined school quotas"
          icon={Database}
        />
        <StatCard
          title="Schools Above 80%"
          value={summary?.schoolsAbove80 ?? 0}
          subtitle="Near or over storage limit"
          icon={AlertTriangle}
        />
        <StatCard
          title="Total Files"
          value={summary?.totalFiles ?? 0}
          subtitle="Tracked across platform"
          icon={Files}
        />
      </div>

      <div className="flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="h-4 w-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            className={`${inputClass} pl-9`}
            placeholder="Search school name or code..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden text-xs font-medium">
            {[
              { id: 'all', label: 'All' },
              { id: 'near_limit', label: 'Near limit (>80%)' },
              { id: 'over_limit', label: 'Over limit' },
            ].map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => {
                  setFilter(f.id);
                  setPage(1);
                }}
                className={`px-3 py-1.5 cursor-pointer transition-colors ${
                  filter === f.id
                    ? 'bg-indigo-600 text-white'
                    : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>

          <select
            aria-label="Sort by"
            className={`${inputClass} w-auto`}
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
          >
            <option value="used">Sort: Storage Used</option>
            <option value="percent">Sort: Usage %</option>
            <option value="limit">Sort: Limit</option>
            <option value="files">Sort: File Count</option>
            <option value="name">Sort: School Name</option>
          </select>

          <Button
            size="sm"
            variant="secondary"
            onClick={() => setSortDir((d) => (d === 'desc' ? 'asc' : 'desc'))}
          >
            <ArrowUpDown className="h-3.5 w-3.5" /> {sortDir.toUpperCase()}
          </Button>
        </div>
      </div>

      <DataTable
        loading={isLoading}
        emptyTitle="No matching schools"
        emptyDescription="Try clearing your search or filter criteria."
        columns={[
          {
            key: 'name',
            label: 'School',
            render: (r) => (
              <div>
                <div className="font-semibold text-slate-900 dark:text-white">{r.name}</div>
                <div className="text-xs font-mono text-slate-500">{r.code}</div>
              </div>
            ),
          },
          { key: 'planName', label: 'Plan', render: (r) => <Badge color="indigo">{r.planName}</Badge> },
          {
            key: 'used',
            label: 'Used / Limit',
            render: (r) => (
              <div className="min-w-[170px] space-y-1">
                <div className="flex justify-between text-xs">
                  <span className="font-medium text-slate-800 dark:text-slate-200">{r.storageUsedFormatted}</span>
                  <span className="text-slate-500">{r.storageLimitFormatted}</span>
                </div>
                <div className="h-2 w-full rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${getStorageBarColor(r.percentUsed)}`}
                    style={{ width: `${Math.min(100, r.percentUsed)}%` }}
                  />
                </div>
              </div>
            ),
          },
          {
            key: 'percentUsed',
            label: 'Usage %',
            render: (r) => <Badge color={getStorageBadgeColor(r.percentUsed)}>{r.percentUsed.toFixed(1)}%</Badge>,
          },
          { key: 'fileCount', label: 'Files' },
          {
            key: 'lastStorageSyncAt',
            label: 'Last Synced',
            render: (r) =>
              r.lastStorageSyncAt ? new Date(r.lastStorageSyncAt).toLocaleString() : 'Never',
          },
          {
            key: 'actions',
            label: 'Actions',
            render: (r) => (
              <div className="flex items-center gap-1.5">
                <Button size="sm" variant="secondary" onClick={() => navigate(`/superadmin/storage/${r._id}`)}>
                  <Eye className="h-3.5 w-3.5" /> Details
                </Button>
                <Button size="sm" variant="secondary" onClick={() => openLimitModal(r)}>
                  <SlidersHorizontal className="h-3.5 w-3.5" /> Limit
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={recalculateMutation.isPending}
                  onClick={() => recalculateMutation.mutate(r._id)}
                  title="Recalculate usage from storage bucket"
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                </Button>
              </div>
            ),
          },
        ]}
        data={schools}
      />

      {meta && meta.totalPages > 1 && (
        <div className="flex items-center justify-between text-sm text-slate-600 dark:text-slate-400">
          <span>
            Page {meta.page} of {meta.totalPages} ({meta.total} schools)
          </span>
          <div className="flex gap-2">
            <Button size="sm" variant="secondary" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
              Previous
            </Button>
            <Button
              size="sm"
              variant="secondary"
              disabled={page >= meta.totalPages}
              onClick={() => setPage((p) => p + 1)}
            >
              Next
            </Button>
          </div>
        </div>
      )}

      <Modal
        open={Boolean(limitModalSchool)}
        onClose={() => setLimitModalSchool(null)}
        title={`Change Storage Limit — ${limitModalSchool?.name || ''}`}
      >
        <form onSubmit={handleSaveLimit} className="space-y-4">
          <div className="rounded-xl bg-slate-50 dark:bg-slate-800/60 p-3 text-xs text-slate-600 dark:text-slate-300">
            Current usage: <strong>{limitModalSchool?.storageUsedFormatted}</strong> of{' '}
            <strong>{limitModalSchool?.storageLimitFormatted}</strong>
          </div>

          <div className="space-y-2">
            <p className="text-sm font-medium text-slate-700 dark:text-slate-200">Quick Presets</p>
            <div className="flex flex-wrap gap-2">
              {PRESET_LIMITS.map((p) => (
                <button
                  key={p.label}
                  type="button"
                  onClick={() => {
                    setSelectedPresetBytes(p.bytes);
                    setCustomGb((p.bytes / (1024 * 1024 * 1024)).toString());
                  }}
                  className={`rounded-lg border px-3 py-1.5 text-xs font-medium cursor-pointer ${
                    Number(customGb) * 1024 * 1024 * 1024 === p.bytes
                      ? 'border-indigo-600 bg-indigo-50 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300'
                      : 'border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300'
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          <FormField label="Custom Limit (GB)" required>
            <input
              type="number"
              step="0.1"
              min="0.1"
              className={inputClass}
              value={customGb}
              onChange={(e) => setCustomGb(e.target.value)}
              placeholder="e.g. 2.5"
            />
          </FormField>

          <p className="text-xs text-slate-500">
            Preview: {customGb && Number(customGb) > 0 ? formatBytes(Number(customGb) * 1024 * 1024 * 1024) : '—'}
          </p>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="secondary" onClick={() => setLimitModalSchool(null)}>
              Cancel
            </Button>
            <Button type="submit" disabled={updateLimitMutation.isPending}>
              Save Limit
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

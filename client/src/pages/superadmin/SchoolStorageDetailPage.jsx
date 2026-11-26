import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, RefreshCw, Trash2, HardDrive, Files } from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  LineChart,
  Line,
} from 'recharts';
import { api, getApiErrorMessage } from '../../api/client';
import { useToast } from '../../context/ToastContext';
import { Button, Badge, DataTable, Modal, FormField, Skeleton, inputClass } from '../../components/ui';
import { formatBytes, getStorageBarColor, getStorageBadgeColor } from '../../utils/formatBytes';

export function SchoolStorageDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { addToast } = useToast();
  const qc = useQueryClient();

  const [days, setDays] = useState(30);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleteReason, setDeleteReason] = useState('');

  const { data, isLoading, isError } = useQuery({
    queryKey: ['superadmin-storage-detail', id, days],
    queryFn: async () => (await api.get(`/superadmin/storage/schools/${id}`, { params: { days } })).data.data,
  });

  const recalcMutation = useMutation({
    mutationFn: () => api.post(`/superadmin/storage/schools/${id}/recalculate`),
    onSuccess: (res) => {
      const d = res.data.data;
      addToast(`Recalculated: ${d.storageUsedFormatted} (${d.fileCount} files)`, 'success');
      qc.invalidateQueries({ queryKey: ['superadmin-storage-detail', id] });
      qc.invalidateQueries({ queryKey: ['superadmin-storage'] });
    },
    onError: (e) => addToast(getApiErrorMessage(e), 'error'),
  });

  const deleteFileMutation = useMutation({
    mutationFn: ({ fileId, reason }) =>
      api.delete(`/superadmin/storage/schools/${id}/files/${fileId}`, { data: { reason } }),
    onSuccess: () => {
      addToast('File deleted and audit logged', 'success');
      setDeleteTarget(null);
      setDeleteReason('');
      qc.invalidateQueries({ queryKey: ['superadmin-storage-detail', id] });
      qc.invalidateQueries({ queryKey: ['superadmin-storage'] });
    },
    onError: (e) => addToast(getApiErrorMessage(e), 'error'),
  });

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-36 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (isError || !data?.school) {
    return (
      <div className="space-y-4">
        <Button variant="secondary" onClick={() => navigate('/superadmin/storage')}>
          <ArrowLeft className="h-4 w-4" /> Back to Storage
        </Button>
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
          Unable to load school storage details.
        </div>
      </div>
    );
  }

  const { school, largestFiles, trend } = data;
  const categoryData = Object.entries(school.storageUsageByCategory || {}).map(([cat, bytes]) => ({
    category: cat,
    mb: Math.round((Number(bytes || 0) / (1024 * 1024)) * 100) / 100,
    bytes: Number(bytes || 0),
  }));

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Button variant="secondary" size="sm" onClick={() => navigate('/superadmin/storage')}>
            <ArrowLeft className="h-4 w-4" /> Back
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">{school.name}</h1>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              {school.code} · Plan: {school.planName}
            </p>
          </div>
        </div>
        <Button variant="secondary" onClick={() => recalcMutation.mutate()} disabled={recalcMutation.isPending}>
          <RefreshCw className="h-4 w-4" /> Recalculate Usage
        </Button>
      </div>

      {/* Large Progress Meter */}
      <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <HardDrive className="h-5 w-5 text-indigo-600" />
            <span className="font-semibold text-slate-900 dark:text-white">
              {school.storageUsedFormatted} used of {school.storageLimitFormatted}
            </span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-slate-500 flex items-center gap-1">
              <Files className="h-3.5 w-3.5" /> {school.fileCount} files
            </span>
            <Badge color={getStorageBadgeColor(school.percentUsed)}>{school.percentUsed.toFixed(1)}%</Badge>
          </div>
        </div>
        <div className="h-3.5 w-full rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${getStorageBarColor(school.percentUsed)}`}
            style={{ width: `${Math.min(100, school.percentUsed)}%` }}
          />
        </div>
        <p className="text-xs text-slate-500">
          Last synced: {school.lastStorageSyncAt ? new Date(school.lastStorageSyncAt).toLocaleString() : 'Never'}
        </p>
      </div>

      {/* Charts */}
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-4">
          <h3 className="font-semibold text-slate-900 dark:text-white">Usage Breakdown by Category (MB)</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={categoryData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.2} />
                <XAxis dataKey="category" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip formatter={(val, _n, item) => [formatBytes(item.payload.bytes), 'Used']} />
                <Bar dataKey="mb" fill="#4f46e5" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-slate-900 dark:text-white">Usage Trend (MB)</h3>
            <div className="flex rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden text-xs">
              {[30, 90].map((d) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => setDays(d)}
                  className={`px-2.5 py-1 cursor-pointer ${
                    days === d ? 'bg-indigo-600 text-white' : 'text-slate-600 dark:text-slate-300'
                  }`}
                >
                  {d}d
                </button>
              ))}
            </div>
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={trend}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.2} />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip formatter={(val, _n, item) => [formatBytes(item.payload.usedBytes), 'Used']} />
                <Line type="monotone" dataKey="usedMb" stroke="#10b981" strokeWidth={2} dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Largest Files */}
      <div className="space-y-3">
        <h3 className="text-lg font-semibold text-slate-900 dark:text-white">Largest Files</h3>
        <DataTable
          emptyTitle="No files uploaded yet"
          emptyDescription="Files uploaded by this school will appear here."
          columns={[
            { key: 'originalName', label: 'File Name' },
            { key: 'category', label: 'Category', render: (r) => <Badge color="slate">{r.category}</Badge> },
            { key: 'sizeFormatted', label: 'Size' },
            { key: 'uploaderName', label: 'Uploader' },
            {
              key: 'createdAt',
              label: 'Uploaded',
              render: (r) => (r.createdAt ? new Date(r.createdAt).toLocaleDateString() : '—'),
            },
            {
              key: 'actions',
              label: 'Action',
              render: (r) => (
                <Button
                  size="sm"
                  variant="danger"
                  onClick={() => {
                    setDeleteTarget(r);
                    setDeleteReason('');
                  }}
                >
                  <Trash2 className="h-3.5 w-3.5" /> Delete
                </Button>
              ),
            },
          ]}
          data={largestFiles || []}
        />
      </div>

      <Modal
        open={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        title="Delete School File"
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!deleteTarget || !deleteReason.trim()) return;
            deleteFileMutation.mutate({ fileId: deleteTarget._id, reason: deleteReason.trim() });
          }}
          className="space-y-4"
        >
          <p className="text-sm text-slate-600 dark:text-slate-300">
            Are you sure you want to permanently delete{' '}
            <strong>{deleteTarget?.originalName}</strong> ({deleteTarget?.sizeFormatted})? This action is
            audit-logged.
          </p>
          <FormField label="Reason for deletion" required>
            <input
              className={inputClass}
              value={deleteReason}
              onChange={(e) => setDeleteReason(e.target.value)}
              placeholder="e.g. Duplicate large upload / policy violation"
              required
            />
          </FormField>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setDeleteTarget(null)}>
              Cancel
            </Button>
            <Button type="submit" variant="danger" disabled={!deleteReason.trim() || deleteFileMutation.isPending}>
              Confirm Delete
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

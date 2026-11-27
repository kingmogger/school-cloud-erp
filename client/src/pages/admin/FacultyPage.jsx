import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { Plus, Search, Trash2, Eye, EyeOff, Copy } from 'lucide-react';
import { api, getApiErrorMessage } from '../../api/client';
import { useToast } from '../../context/ToastContext';
import { Button, DataTable, Modal, FormField, Badge, inputClass } from '../../components/ui';

export function FacultyPage() {
  const { addToast } = useToast();
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [showPassword, setShowPassword] = useState(false);
  const [createdCredentials, setCreatedCredentials] = useState(null);

  const { data: facultyRes, isLoading } = useQuery({
    queryKey: ['admin-faculty', search],
    queryFn: async () => (await api.get('/admin/faculty', { params: { search } })).data,
  });

  const { register, handleSubmit, reset } = useForm();

  const createMutation = useMutation({
    mutationFn: (payload) => {
      const body = { ...payload };
      if (!body.password || !body.password.trim()) {
        delete body.password;
      }
      return api.post('/admin/faculty', body);
    },
    onSuccess: (res) => {
      const creds = res.data?.data?.credentials;
      if (creds) {
        setCreatedCredentials({
          name: res.data?.data?.userId?.name || 'Faculty Member',
          employeeId: res.data?.data?.employeeId || '',
          email: creds.email,
          password: creds.password,
        });
      }
      addToast('Faculty member added & credentials saved', 'success');
      qc.invalidateQueries({ queryKey: ['admin-faculty'] });
      qc.invalidateQueries({ queryKey: ['admin-dashboard'] });
      reset();
      setModalOpen(false);
    },
    onError: (err) => addToast(getApiErrorMessage(err), 'error'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => api.delete(`/admin/faculty/${id}`),
    onSuccess: () => {
      addToast('Faculty member removed', 'info');
      setDeleteTarget(null);
      qc.invalidateQueries({ queryKey: ['admin-faculty'] });
      qc.invalidateQueries({ queryKey: ['admin-dashboard'] });
    },
    onError: (err) => addToast(getApiErrorMessage(err), 'error'),
  });

  const columns = [
    { key: 'employeeId', label: 'Employee ID', render: (r) => <span className="font-mono font-semibold text-indigo-600 dark:text-indigo-400">{r.employeeId}</span> },
    {
      key: 'name',
      label: 'Faculty',
      render: (r) => (
        <div>
          <p className="font-medium text-slate-900 dark:text-white">{r.userId?.name}</p>
          <p className="text-xs text-slate-500">{r.userId?.email}</p>
          {r.userId?.phone && <p className="text-xs text-indigo-600 dark:text-indigo-400">{r.userId.phone}</p>}
        </div>
      ),
    },
    { key: 'department', label: 'Department' },
    { key: 'qualification', label: 'Qualification', render: (r) => r.qualification || '—' },
    { key: 'status', label: 'Status', render: (r) => <Badge color={r.status === 'active' ? 'emerald' : 'slate'}>{r.status}</Badge> },
    {
      key: 'actions',
      label: '',
      render: (r) => (
        <Button variant="ghost" size="sm" onClick={() => setDeleteTarget(r)} aria-label={`Delete ${r.userId?.name}`}>
          <Trash2 className="h-4 w-4 text-rose-500" />
        </Button>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Faculty</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">Manage teachers, departments, and credentials</p>
        </div>
        <Button onClick={() => setModalOpen(true)}>
          <Plus className="h-4 w-4" /> Add Faculty
        </Button>
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search faculty by name, department, or ID..."
          className={`${inputClass} pl-9`}
        />
      </div>

      <DataTable columns={columns} data={facultyRes?.data || []} loading={isLoading} />

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Add Faculty Member">
        <form onSubmit={handleSubmit((vals) => createMutation.mutate(vals))} className="space-y-4">
          <FormField label="Full Name" required>
            <input className={inputClass} {...register('name', { required: true })} />
          </FormField>
          <FormField label="Email (Gmail / School Email)" required>
            <input type="email" className={inputClass} placeholder="teacher@gmail.com" {...register('email', { required: true })} />
          </FormField>
          <FormField label="Phone Number">
            <input type="tel" className={inputClass} placeholder="+91 98765 43210" {...register('phone')} />
          </FormField>
          <FormField label="Login Password (min 6 chars, default Password@123)">
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                className={`${inputClass} pr-10`}
                placeholder="Leave blank for Password@123"
                {...register('password', {
                  validate: (v) => !v || v.trim().length === 0 || v.trim().length >= 6 || 'Minimum 6 characters required',
                })}
              />
              <button
                type="button"
                onClick={() => setShowPassword((prev) => !prev)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
                title={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </FormField>
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField label="Department">
              <input className={inputClass} defaultValue="Science" {...register('department')} />
            </FormField>
            <FormField label="Qualification">
              <input className={inputClass} placeholder="M.Sc., B.Ed." {...register('qualification')} />
            </FormField>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="secondary" onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button type="submit" disabled={createMutation.isPending}>Save Faculty</Button>
          </div>
        </form>
      </Modal>

      <Modal
        open={!!createdCredentials}
        onClose={() => setCreatedCredentials(null)}
        title="Faculty Login Credentials"
        maxWidth="max-w-md"
      >
        <div className="space-y-4">
          <p className="text-sm text-slate-600 dark:text-slate-300">
            Faculty account created and saved. Share these login credentials:
          </p>
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 p-4 space-y-2 font-mono text-xs">
            <div className="flex justify-between">
              <span className="text-slate-500 font-sans">Employee ID:</span>
              <span className="font-semibold text-slate-800 dark:text-slate-200">{createdCredentials?.employeeId}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500 font-sans">Name:</span>
              <span className="font-semibold text-slate-800 dark:text-slate-200">{createdCredentials?.name}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500 font-sans">Email:</span>
              <span className="font-semibold text-slate-800 dark:text-slate-200 select-all">{createdCredentials?.email}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500 font-sans">Password:</span>
              <span className="font-bold text-indigo-600 dark:text-indigo-400 select-all">{createdCredentials?.password}</span>
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                if (createdCredentials) {
                  navigator.clipboard?.writeText(`Faculty Login:\nEmail: ${createdCredentials.email}\nPassword: ${createdCredentials.password}`);
                  addToast('Credentials copied', 'info');
                }
              }}
            >
              <Copy className="h-4 w-4" /> Copy Credentials
            </Button>
            <Button type="button" onClick={() => setCreatedCredentials(null)}>Done</Button>
          </div>
        </div>
      </Modal>

      <Modal open={Boolean(deleteTarget)} onClose={() => setDeleteTarget(null)} title="Delete Faculty Member">
        <div className="space-y-4">
          <p className="text-sm text-slate-600 dark:text-slate-300">
            Are you sure you want to remove <strong>{deleteTarget?.userId?.name}</strong> ({deleteTarget?.employeeId})?
            They will be unassigned from subjects/sections and their login access will be removed.
          </p>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setDeleteTarget(null)}>Cancel</Button>
            <Button variant="danger" disabled={deleteMutation.isPending} onClick={() => deleteMutation.mutate(deleteTarget._id)}>
              {deleteMutation.isPending ? 'Removing...' : 'Confirm Delete'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { Plus, Search, Trash2 } from 'lucide-react';
import { api, getApiErrorMessage } from '../../api/client';
import { useToast } from '../../context/ToastContext';
import { Button, DataTable, Modal, FormField, Badge, inputClass } from '../../components/ui';

export function FacultyPage() {
  const { addToast } = useToast();
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);

  const { data: facultyRes, isLoading } = useQuery({
    queryKey: ['admin-faculty', search],
    queryFn: async () => (await api.get('/admin/faculty', { params: { search } })).data,
  });

  const { register, handleSubmit, reset } = useForm();

  const createMutation = useMutation({
    mutationFn: (payload) => api.post('/admin/faculty', payload),
    onSuccess: () => {
      addToast('Faculty member added', 'success');
      qc.invalidateQueries({ queryKey: ['admin-faculty'] });
      reset();
      setModalOpen(false);
    },
    onError: (err) => addToast(getApiErrorMessage(err), 'error'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => api.delete(`/admin/faculty/${id}`),
    onSuccess: () => {
      addToast('Faculty member removed', 'info');
      qc.invalidateQueries({ queryKey: ['admin-faculty'] });
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
        <Button variant="ghost" size="sm" onClick={() => deleteMutation.mutate(r._id)}>
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
          <FormField label="Email" required>
            <input type="email" className={inputClass} {...register('email', { required: true })} />
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
    </div>
  );
}

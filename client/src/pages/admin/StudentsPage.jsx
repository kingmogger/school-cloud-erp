import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { Plus, Search, Trash2 } from 'lucide-react';
import { api, getApiErrorMessage } from '../../api/client';
import { useToast } from '../../context/ToastContext';
import { Button, DataTable, Modal, FormField, Badge, inputClass } from '../../components/ui';

export function StudentsPage() {
  const { addToast } = useToast();
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [classFilter, setClassFilter] = useState('');
  const [modalOpen, setModalOpen] = useState(false);

  const { data: studentsRes, isLoading } = useQuery({
    queryKey: ['admin-students', search, classFilter],
    queryFn: async () => (await api.get('/admin/students', { params: { search, classId: classFilter || undefined } })).data,
  });

  const { data: classes = [] } = useQuery({
    queryKey: ['admin-classes'],
    queryFn: async () => (await api.get('/admin/classes')).data.data,
  });

  const { data: sections = [] } = useQuery({
    queryKey: ['admin-sections'],
    queryFn: async () => (await api.get('/admin/sections')).data.data,
  });

  const { register, handleSubmit, watch, reset, formState: { errors } } = useForm();
  const selectedClassId = watch('classId');
  const filteredSections = sections.filter((s) => (s.classId?._id || s.classId) === selectedClassId);

  const createMutation = useMutation({
    mutationFn: (payload) => api.post('/admin/students', payload),
    onSuccess: () => {
      addToast('Student registered with auto admission number & parent link', 'success');
      qc.invalidateQueries({ queryKey: ['admin-students'] });
      qc.invalidateQueries({ queryKey: ['admin-dashboard'] });
      reset();
      setModalOpen(false);
    },
    onError: (err) => addToast(getApiErrorMessage(err), 'error'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => api.delete(`/admin/students/${id}`),
    onSuccess: () => {
      addToast('Student removed', 'info');
      qc.invalidateQueries({ queryKey: ['admin-students'] });
    },
    onError: (err) => addToast(getApiErrorMessage(err), 'error'),
  });

  const columns = [
    { key: 'admissionNo', label: 'Admission No', render: (r) => <span className="font-mono font-semibold text-indigo-600 dark:text-indigo-400">{r.admissionNo}</span> },
    {
      key: 'name',
      label: 'Student',
      render: (r) => (
        <div>
          <p className="font-medium text-slate-900 dark:text-white">{r.userId?.name}</p>
          <p className="text-xs text-slate-500">{r.userId?.email}</p>
        </div>
      ),
    },
    { key: 'class', label: 'Class / Section', render: (r) => `${r.classId?.name || '-'} — ${r.sectionId?.name || '-'}` },
    { key: 'parent', label: 'Linked Parent', render: (r) => r.parentIds?.[0]?.userId?.name || r.guardianName || '—' },
    { key: 'status', label: 'Status', render: (r) => <Badge color={r.status === 'active' ? 'emerald' : 'slate'}>{r.status}</Badge> },
    {
      key: 'actions',
      label: '',
      render: (r) => (
        <Button variant="ghost" size="sm" onClick={() => deleteMutation.mutate(r._id)} aria-label={`Delete ${r.userId?.name}`}>
          <Trash2 className="h-4 w-4 text-rose-500" />
        </Button>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Students</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">Register students with automatic admission numbers and linked parent accounts</p>
        </div>
        <Button onClick={() => setModalOpen(true)}>
          <Plus className="h-4 w-4" /> Register Student
        </Button>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, email, or admission number..."
            className={`${inputClass} pl-9`}
          />
        </div>
        <select value={classFilter} onChange={(e) => setClassFilter(e.target.value)} className={`${inputClass} sm:w-52`}>
          <option value="">All Classes</option>
          {classes.map((c) => (
            <option key={c._id} value={c._id}>{c.name}</option>
          ))}
        </select>
      </div>

      <DataTable columns={columns} data={studentsRes?.data || []} loading={isLoading} />

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Register New Student" maxWidth="max-w-xl">
        <form onSubmit={handleSubmit((vals) => createMutation.mutate(vals))} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField label="Full Name" required error={errors.name?.message}>
              <input className={inputClass} {...register('name', { required: 'Required' })} />
            </FormField>
            <FormField label="Student Email" required error={errors.email?.message}>
              <input type="email" className={inputClass} {...register('email', { required: 'Required' })} />
            </FormField>
            <FormField label="Class" required>
              <select className={inputClass} {...register('classId', { required: 'Required' })}>
                <option value="">Select class</option>
                {classes.map((c) => (
                  <option key={c._id} value={c._id}>{c.name}</option>
                ))}
              </select>
            </FormField>
            <FormField label="Section" required>
              <select className={inputClass} {...register('sectionId', { required: 'Required' })}>
                <option value="">Select section</option>
                {filteredSections.map((s) => (
                  <option key={s._id} value={s._id}>{s.name}</option>
                ))}
              </select>
            </FormField>
            <FormField label="Roll No">
              <input className={inputClass} placeholder="e.g. 10A-05" {...register('rollNo')} />
            </FormField>
            <FormField label="Gender">
              <select className={inputClass} {...register('gender')}>
                <option value="male">Male</option>
                <option value="female">Female</option>
                <option value="other">Other</option>
              </select>
            </FormField>
          </div>

          <div className="border-t border-slate-200 dark:border-slate-800 pt-4">
            <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-500">Auto-Linked Parent Account</p>
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField label="Parent Name">
                <input className={inputClass} {...register('parentName')} />
              </FormField>
              <FormField label="Parent Email">
                <input type="email" className={inputClass} placeholder="parent@example.com" {...register('parentEmail')} />
              </FormField>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="secondary" onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button type="submit" disabled={createMutation.isPending}>
              {createMutation.isPending ? 'Saving...' : 'Create Student'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

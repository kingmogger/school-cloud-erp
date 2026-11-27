import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { Plus, Search, Trash2, RefreshCw, Eye, EyeOff, Copy } from 'lucide-react';
import { api, getApiErrorMessage } from '../../api/client';
import { useToast } from '../../context/ToastContext';
import { Button, DataTable, Modal, FormField, Badge, inputClass } from '../../components/ui';

function generateTempPassword() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
  let rand = '';
  for (let i = 0; i < 6; i++) {
    rand += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return `Temp@${rand}`;
}

export function StudentsPage() {
  const { addToast } = useToast();
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [classFilter, setClassFilter] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [createdCredentials, setCreatedCredentials] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);

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

  const { register, handleSubmit, watch, reset, setValue, formState: { errors } } = useForm();
  const selectedClassId = watch('classId');
  const filteredSections = sections.filter((s) => (s.classId?._id || s.classId) === selectedClassId);

  const handleOpenModal = () => {
    reset({
      name: '',
      email: '',
      classId: '',
      sectionId: '',
      rollNo: '',
      gender: 'male',
      parentName: '',
      parentEmail: '',
      password: generateTempPassword(),
    });
    setShowPassword(false);
    setModalOpen(true);
  };

  const createMutation = useMutation({
    mutationFn: (payload) => api.post('/admin/students', payload),
    onSuccess: (res) => {
      const creds = res.data?.data?.credentials;
      if (creds) {
        setCreatedCredentials({
          name: res.data?.data?.userId?.name || res.data?.data?.name || 'Student',
          admissionNo: res.data?.data?.admissionNo || '',
          email: creds.email,
          password: creds.password || creds.temporaryPassword,
        });
      }
      addToast('Student registered with Firebase login credentials', 'success');
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
      setDeleteTarget(null);
      qc.invalidateQueries({ queryKey: ['admin-students'] });
      qc.invalidateQueries({ queryKey: ['admin-dashboard'] });
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
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Students</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">Register students with automatic admission numbers</p>
        </div>
        <Button onClick={handleOpenModal}>
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
            <FormField label="Date of Birth">
              <input type="date" className={inputClass} {...register('dateOfBirth')} />
            </FormField>
            <FormField label="Blood Group">
              <input className={inputClass} placeholder="e.g. O+" {...register('bloodGroup')} />
            </FormField>
            <FormField label="Student Phone">
              <input type="tel" className={inputClass} placeholder="+91 98765 43210" {...register('phone')} />
            </FormField>
            <FormField label="Address">
              <input className={inputClass} placeholder="City, Street" {...register('address')} />
            </FormField>
            <FormField label="Father Name">
              <input className={inputClass} placeholder="Father's full name" {...register('fatherName')} />
            </FormField>
            <FormField label="Father Phone No">
              <input type="tel" className={inputClass} placeholder="+91 98765 43210" {...register('fatherPhone')} />
            </FormField>
            <FormField label="Mother Name">
              <input className={inputClass} placeholder="Mother's full name" {...register('motherName')} />
            </FormField>
          </div>

          <div className="border-t border-slate-200 dark:border-slate-800 pt-4">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Student Account & Login Credentials</p>
              <button
                type="button"
                onClick={() => {
                  const newPass = generateTempPassword();
                  setValue('password', newPass, { shouldValidate: true, shouldDirty: true });
                  addToast('New temporary password generated', 'info');
                }}
                className="inline-flex items-center gap-1.5 text-xs font-medium text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 cursor-pointer"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                Generate New
              </button>
            </div>

            <FormField label="Temporary Password" error={errors.password?.message}>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    className={`${inputClass} pr-20 font-mono`}
                    placeholder="e.g. Temp@Ab12"
                    {...register('password', {
                      minLength: { value: 6, message: 'Password must be at least 6 characters' },
                    })}
                  />
                  <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => setShowPassword((prev) => !prev)}
                      className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded cursor-pointer"
                      title={showPassword ? 'Hide password' : 'Show password'}
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const pass = watch('password');
                        if (pass) {
                          navigator.clipboard?.writeText(pass);
                          addToast('Temporary password copied to clipboard', 'info');
                        }
                      }}
                      className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded cursor-pointer"
                      title="Copy password"
                    >
                      <Copy className="h-4 w-4" />
                    </button>
                  </div>
                </div>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => {
                    const newPass = generateTempPassword();
                    setValue('password', newPass, { shouldValidate: true, shouldDirty: true });
                    addToast('Temporary password generated', 'info');
                  }}
                  className="shrink-0"
                >
                  <RefreshCw className="h-4 w-4" />
                  Generate
                </Button>
              </div>
              <p className="mt-1 text-xs text-slate-500">
                This temporary password will be assigned to the student's Firebase account for their initial login.
              </p>
            </FormField>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="secondary" onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button type="submit" disabled={createMutation.isPending}>
              {createMutation.isPending ? 'Saving...' : 'Create Student'}
            </Button>
          </div>
        </form>
      </Modal>

      <Modal
        open={!!createdCredentials}
        onClose={() => setCreatedCredentials(null)}
        title="Student Login Credentials"
        maxWidth="max-w-md"
      >
        <div className="space-y-4">
          <p className="text-sm text-slate-600 dark:text-slate-300">
            Student account created with Firebase Authentication. Share these login credentials with the student:
          </p>

          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 p-4 space-y-2.5 font-mono text-sm">
            {createdCredentials?.admissionNo && (
              <div className="flex justify-between items-center text-xs">
                <span className="text-slate-500 font-sans">Admission No:</span>
                <span className="font-semibold text-slate-800 dark:text-slate-200">{createdCredentials.admissionNo}</span>
              </div>
            )}
            <div className="flex justify-between items-center text-xs">
              <span className="text-slate-500 font-sans">Student:</span>
              <span className="font-semibold text-slate-800 dark:text-slate-200">{createdCredentials?.name}</span>
            </div>
            <div className="flex justify-between items-center text-xs">
              <span className="text-slate-500 font-sans">Email:</span>
              <span className="font-semibold text-slate-800 dark:text-slate-200 select-all">{createdCredentials?.email}</span>
            </div>
            <div className="flex justify-between items-center text-xs">
              <span className="text-slate-500 font-sans">Temporary Password:</span>
              <span className="font-bold text-indigo-600 dark:text-indigo-400 select-all">{createdCredentials?.password}</span>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                if (createdCredentials) {
                  navigator.clipboard?.writeText(
                    `Student Login Credentials:\nEmail: ${createdCredentials.email}\nPassword: ${createdCredentials.password}`
                  );
                  addToast('Credentials copied to clipboard', 'info');
                }
              }}
            >
              Copy Credentials
            </Button>
            <Button type="button" onClick={() => setCreatedCredentials(null)}>
              Done
            </Button>
          </div>
        </div>
      </Modal>

      <Modal open={Boolean(deleteTarget)} onClose={() => setDeleteTarget(null)} title="Delete Student">
        <div className="space-y-4">
          <p className="text-sm text-slate-600 dark:text-slate-300">
            Are you sure you want to remove <strong>{deleteTarget?.userId?.name}</strong> ({deleteTarget?.admissionNo})?
            Their login access and uploaded submissions will be removed.
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

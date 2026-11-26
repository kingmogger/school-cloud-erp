import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api, getApiErrorMessage } from '../../api/client';
import { useToast } from '../../context/ToastContext';
import { Button, DataTable, FormField, inputClass } from '../../components/ui';

export function AcademicsPage() {
  const { addToast } = useToast();
  const qc = useQueryClient();

  const [className, setClassName] = useState('');
  const [numericLevel, setNumericLevel] = useState(8);
  const [secName, setSecName] = useState('');
  const [secClassId, setSecClassId] = useState('');
  const [secTeacherId, setSecTeacherId] = useState('');

  const [subName, setSubName] = useState('');
  const [subCode, setSubCode] = useState('');
  const [subClassId, setSubClassId] = useState('');
  const [subFacultyId, setSubFacultyId] = useState('');

  const { data: classes = [] } = useQuery({ queryKey: ['admin-classes'], queryFn: async () => (await api.get('/admin/classes')).data.data });
  const { data: sections = [] } = useQuery({ queryKey: ['admin-sections'], queryFn: async () => (await api.get('/admin/sections')).data.data });
  const { data: subjectsRes } = useQuery({ queryKey: ['admin-subjects'], queryFn: async () => (await api.get('/admin/subjects')).data });
  const { data: facultyRes } = useQuery({ queryKey: ['admin-faculty-all'], queryFn: async () => (await api.get('/admin/faculty?limit=100')).data });
  const facultyList = facultyRes?.data || [];

  const createClass = useMutation({
    mutationFn: () => api.post('/admin/classes', { name: className, numericLevel: Number(numericLevel) }),
    onSuccess: () => {
      addToast('Class created', 'success');
      setClassName('');
      qc.invalidateQueries({ queryKey: ['admin-classes'] });
    },
    onError: (e) => addToast(getApiErrorMessage(e), 'error'),
  });

  const createSection = useMutation({
    mutationFn: () => api.post('/admin/sections', { name: secName, classId: secClassId, classTeacherId: secTeacherId || null }),
    onSuccess: () => {
      addToast('Section created', 'success');
      setSecName('');
      qc.invalidateQueries({ queryKey: ['admin-sections'] });
    },
    onError: (e) => addToast(getApiErrorMessage(e), 'error'),
  });

  const createSubject = useMutation({
    mutationFn: () => api.post('/admin/subjects', { name: subName, code: subCode, classId: subClassId, facultyId: subFacultyId || null }),
    onSuccess: () => {
      addToast('Subject created & assigned', 'success');
      setSubName('');
      setSubCode('');
      qc.invalidateQueries({ queryKey: ['admin-subjects'] });
    },
    onError: (e) => addToast(getApiErrorMessage(e), 'error'),
  });

  const setupStandard = useMutation({
    mutationFn: () => api.post('/admin/academics/setup-standard'),
    onSuccess: (res) => {
      const d = res.data.data;
      addToast(`Provisioned ${d.classesCreated} classes, ${d.sectionsCreated} sections, ${d.subjectsCreated} subjects`, 'success');
      qc.invalidateQueries({ queryKey: ['admin-classes'] });
      qc.invalidateQueries({ queryKey: ['admin-sections'] });
      qc.invalidateQueries({ queryKey: ['admin-subjects'] });
    },
    onError: (e) => addToast(getApiErrorMessage(e), 'error'),
  });

  const assignSubjectTeacher = useMutation({
    mutationFn: ({ subjectId, facultyId }) => api.patch(`/admin/subjects/${subjectId}`, { facultyId: facultyId || null }),
    onSuccess: () => {
      addToast('Teacher assigned to subject', 'success');
      qc.invalidateQueries({ queryKey: ['admin-subjects'] });
    },
    onError: (e) => addToast(getApiErrorMessage(e), 'error'),
  });

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Classes, Sections & Subjects</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">Configure academic structure and assign faculty</p>
        </div>
        <Button variant="secondary" onClick={() => setupStandard.mutate()} disabled={setupStandard.isPending}>
          {setupStandard.isPending ? 'Setting up...' : 'Setup Classes 1–10 & 6 Subjects'}
        </Button>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-3">
          <h2 className="font-semibold text-slate-900 dark:text-white">Add Class</h2>
          <FormField label="Class Name"><input className={inputClass} value={className} onChange={(e) => setClassName(e.target.value)} placeholder="Grade 8" /></FormField>
          <FormField label="Numeric Level (1-12)"><input type="number" className={inputClass} value={numericLevel} onChange={(e) => setNumericLevel(e.target.value)} /></FormField>
          <Button onClick={() => createClass.mutate()} disabled={!className}>Add Class</Button>
        </div>

        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-3">
          <h2 className="font-semibold text-slate-900 dark:text-white">Add Section & Class Teacher</h2>
          <FormField label="Class">
            <select className={inputClass} value={secClassId} onChange={(e) => setSecClassId(e.target.value)}>
              <option value="">Select class</option>
              {classes.map((c) => <option key={c._id} value={c._id}>{c.name}</option>)}
            </select>
          </FormField>
          <FormField label="Section Name"><input className={inputClass} value={secName} onChange={(e) => setSecName(e.target.value)} placeholder="A" /></FormField>
          <FormField label="Class Teacher">
            <select className={inputClass} value={secTeacherId} onChange={(e) => setSecTeacherId(e.target.value)}>
              <option value="">Unassigned</option>
              {facultyList.map((f) => <option key={f._id} value={f._id}>{f.userId?.name}</option>)}
            </select>
          </FormField>
          <Button onClick={() => createSection.mutate()} disabled={!secName || !secClassId}>Add Section</Button>
        </div>

        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-3">
          <h2 className="font-semibold text-slate-900 dark:text-white">Add Subject & Assign Faculty</h2>
          <FormField label="Class">
            <select className={inputClass} value={subClassId} onChange={(e) => setSubClassId(e.target.value)}>
              <option value="">Select class</option>
              {classes.map((c) => <option key={c._id} value={c._id}>{c.name}</option>)}
            </select>
          </FormField>
          <div className="grid grid-cols-2 gap-2">
            <FormField label="Subject"><input className={inputClass} value={subName} onChange={(e) => setSubName(e.target.value)} placeholder="Biology" /></FormField>
            <FormField label="Code"><input className={inputClass} value={subCode} onChange={(e) => setSubCode(e.target.value)} placeholder="BIO10" /></FormField>
          </div>
          <FormField label="Faculty">
            <select className={inputClass} value={subFacultyId} onChange={(e) => setSubFacultyId(e.target.value)}>
              <option value="">Unassigned</option>
              {facultyList.map((f) => <option key={f._id} value={f._id}>{f.userId?.name}</option>)}
            </select>
          </FormField>
          <Button onClick={() => createSubject.mutate()} disabled={!subName || !subCode || !subClassId}>Add Subject</Button>
        </div>
      </div>

      <div className="space-y-3">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Sections</h2>
        <DataTable
          columns={[
            { key: 'class', label: 'Class', render: (r) => r.classId?.name },
            { key: 'name', label: 'Section' },
            { key: 'teacher', label: 'Class Teacher', render: (r) => r.classTeacherId?.userId?.name || 'Unassigned' },
            { key: 'capacity', label: 'Capacity' },
          ]}
          data={sections}
        />
      </div>

      <div className="space-y-3">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Subjects</h2>
        <DataTable
          columns={[
            { key: 'code', label: 'Code' },
            { key: 'name', label: 'Subject' },
            { key: 'class', label: 'Class', render: (r) => r.classId?.name },
            {
              key: 'faculty',
              label: 'Assigned Teacher',
              render: (r) => (
                <select
                  aria-label={`Assign teacher for ${r.name}`}
                  className={`${inputClass} py-1 text-xs`}
                  value={r.facultyId?._id || r.facultyId || ''}
                  onChange={(e) => assignSubjectTeacher.mutate({ subjectId: r._id, facultyId: e.target.value })}
                >
                  <option value="">Unassigned</option>
                  {facultyList.map((f) => (
                    <option key={f._id} value={f._id}>
                      {f.userId?.name} ({f.userId?.email})
                    </option>
                  ))}
                </select>
              ),
            },
            { key: 'maxMarks', label: 'Max Marks' },
          ]}
          data={subjectsRes?.data || []}
        />
      </div>
    </div>
  );
}

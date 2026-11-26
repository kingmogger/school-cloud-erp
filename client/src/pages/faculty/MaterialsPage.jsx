import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Upload, Trash2 } from 'lucide-react';
import { api, getApiErrorMessage } from '../../api/client';
import { useToast } from '../../context/ToastContext';
import { Button, DataTable, FormField, inputClass } from '../../components/ui';

export function MaterialsPage() {
  const { addToast } = useToast();
  const qc = useQueryClient();
  const [title, setTitle] = useState('');
  const [classId, setClassId] = useState('');
  const [subjectId, setSubjectId] = useState('');
  const [file, setFile] = useState(null);

  const { data: roster } = useQuery({ queryKey: ['faculty-roster'], queryFn: async () => (await api.get('/faculty/roster')).data.data });
  const { data: materials = [], isLoading } = useQuery({ queryKey: ['faculty-materials'], queryFn: async () => (await api.get('/faculty/materials')).data.data });

  const uploadMutation = useMutation({
    mutationFn: () => {
      const fd = new FormData();
      fd.append('title', title);
      fd.append('classId', classId);
      fd.append('subjectId', subjectId);
      fd.append('file', file);
      return api.post('/faculty/materials', fd);
    },
    onSuccess: () => {
      addToast('Study material uploaded', 'success');
      setTitle('');
      setFile(null);
      qc.invalidateQueries({ queryKey: ['faculty-materials'] });
    },
    onError: (e) => addToast(getApiErrorMessage(e), 'error'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => api.delete(`/faculty/materials/${id}`),
    onSuccess: () => {
      addToast('Material deleted', 'info');
      qc.invalidateQueries({ queryKey: ['faculty-materials'] });
    },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Study Materials</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">Upload lecture notes, PDFs, and reference slides</p>
      </div>

      <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-4">
        <div className="grid gap-4 sm:grid-cols-3">
          <FormField label="Title"><input className={inputClass} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Chapter 3 Notes" /></FormField>
          <FormField label="Class">
            <select className={inputClass} value={classId} onChange={(e) => setClassId(e.target.value)}>
              <option value="">Select</option>
              {(roster?.classes || []).map((c) => <option key={c._id} value={c._id}>{c.name}</option>)}
            </select>
          </FormField>
          <FormField label="Subject">
            <select className={inputClass} value={subjectId} onChange={(e) => setSubjectId(e.target.value)}>
              <option value="">Select</option>
              {(roster?.subjects || []).map((s) => <option key={s._id} value={s._id}>{s.name}</option>)}
            </select>
          </FormField>
        </div>
        <FormField label="File (PDF, Image, Doc)">
          <input type="file" onChange={(e) => setFile(e.target.files?.[0] || null)} className="text-sm text-slate-600 dark:text-slate-300" />
        </FormField>
        <Button onClick={() => uploadMutation.mutate()} disabled={!title || !classId || !subjectId || !file || uploadMutation.isPending}>
          <Upload className="h-4 w-4" /> Upload Material
        </Button>
      </div>

      <DataTable
        loading={isLoading}
        columns={[
          { key: 'title', label: 'Title' },
          { key: 'class', label: 'Class', render: (r) => r.classId?.name },
          { key: 'subject', label: 'Subject', render: (r) => r.subjectId?.name },
          { key: 'actions', label: '', render: (r) => <Button variant="ghost" size="sm" onClick={() => deleteMutation.mutate(r._id)}><Trash2 className="h-4 w-4 text-rose-500" /></Button> },
        ]}
        data={materials}
      />
    </div>
  );
}

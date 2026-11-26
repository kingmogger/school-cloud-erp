import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api, getApiErrorMessage } from '../../api/client';
import { useToast } from '../../context/ToastContext';
import { Button, DataTable, FormField, Badge, inputClass } from '../../components/ui';

export function RemarksPage() {
  const { addToast } = useToast();
  const qc = useQueryClient();
  const [studentId, setStudentId] = useState('');
  const [category, setCategory] = useState('academic');
  const [comment, setComment] = useState('');

  const { data: roster } = useQuery({ queryKey: ['faculty-roster'], queryFn: async () => (await api.get('/faculty/roster')).data.data });
  const { data: remarks = [], isLoading } = useQuery({ queryKey: ['faculty-remarks'], queryFn: async () => (await api.get('/faculty/remarks')).data.data });

  const createMutation = useMutation({
    mutationFn: () => api.post('/faculty/remarks', { studentId, category, comment }),
    onSuccess: () => {
      addToast('Remark added (visible to student)', 'success');
      setComment('');
      qc.invalidateQueries({ queryKey: ['faculty-remarks'] });
    },
    onError: (e) => addToast(getApiErrorMessage(e), 'error'),
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Student Remarks</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">Share academic and behavioral feedback with students</p>
      </div>

      <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField label="Student">
            <select className={inputClass} value={studentId} onChange={(e) => setStudentId(e.target.value)}>
              <option value="">Select student</option>
              {(roster?.students || []).map((s) => <option key={s._id} value={s._id}>{s.userId?.name} ({s.admissionNo})</option>)}
            </select>
          </FormField>
          <FormField label="Category">
            <select className={inputClass} value={category} onChange={(e) => setCategory(e.target.value)}>
              <option value="academic">Academic</option>
              <option value="behavioral">Behavioral</option>
              <option value="achievement">Achievement</option>
              <option value="general">General</option>
            </select>
          </FormField>
        </div>
        <FormField label="Comment"><input className={inputClass} value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Shows strong analytical progress..." /></FormField>
        <Button onClick={() => createMutation.mutate()} disabled={!studentId || !comment}>Add Remark</Button>
      </div>

      <DataTable
        loading={isLoading}
        columns={[
          { key: 'student', label: 'Student', render: (r) => r.studentId?.userId?.name },
          { key: 'category', label: 'Category', render: (r) => <Badge color="indigo">{r.category}</Badge> },
          { key: 'comment', label: 'Comment' },
          { key: 'date', label: 'Date', render: (r) => new Date(r.createdAt).toLocaleDateString() },
        ]}
        data={remarks}
      />
    </div>
  );
}

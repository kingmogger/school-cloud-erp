import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, ExternalLink } from 'lucide-react';
import { api, getApiErrorMessage, openProtectedFile } from '../../api/client';
import { useToast } from '../../context/ToastContext';
import { Button, DataTable, Modal, FormField, Badge, inputClass } from '../../components/ui';

export function AssignmentsPage() {
  const { addToast } = useToast();
  const qc = useQueryClient();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [classId, setClassId] = useState('');
  const [sectionId, setSectionId] = useState('');
  const [subjectId, setSubjectId] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [attachment, setAttachment] = useState(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [selectedAssignmentId, setSelectedAssignmentId] = useState(null);
  const [gradePoints, setGradePoints] = useState({});

  const { data: roster } = useQuery({ queryKey: ['faculty-roster'], queryFn: async () => (await api.get('/faculty/roster')).data.data });
  const { data: assignments = [], isLoading } = useQuery({ queryKey: ['faculty-assignments'], queryFn: async () => (await api.get('/faculty/assignments')).data.data });
  const { data: submissions = [] } = useQuery({
    queryKey: ['assignment-submissions', selectedAssignmentId],
    enabled: Boolean(selectedAssignmentId),
    queryFn: async () => (await api.get(`/faculty/assignments/${selectedAssignmentId}/submissions`)).data.data,
  });

  const classes = roster?.classes || [];
  const sections = (roster?.sections || []).filter((s) => !classId || (s.classId?._id || s.classId) === classId);
  const subjects = (roster?.subjects || []).filter((s) => !classId || (s.classId?._id || s.classId) === classId);

  const createMutation = useMutation({
    mutationFn: () => {
      const fd = new FormData();
      fd.append('title', title);
      fd.append('description', description);
      fd.append('classId', classId);
      fd.append('sectionId', sectionId);
      fd.append('subjectId', subjectId);
      fd.append('dueDate', dueDate);
      if (attachment) fd.append('attachment', attachment);
      setUploadProgress(0);
      return api.post('/faculty/assignments', fd, {
        onUploadProgress: (evt) => {
          if (evt.total) setUploadProgress(Math.round((evt.loaded / evt.total) * 100));
        },
      });
    },
    onSuccess: () => {
      addToast('Assignment published', 'success');
      setTitle('');
      setDescription('');
      setAttachment(null);
      setUploadProgress(0);
      qc.invalidateQueries({ queryKey: ['faculty-assignments'] });
    },
    onError: (e) => {
      setUploadProgress(0);
      addToast(getApiErrorMessage(e), 'error');
    },
  });

  const gradeMutation = useMutation({
    mutationFn: ({ id, points }) => api.patch(`/faculty/submissions/${id}/grade`, { points: Number(points), feedback: 'Reviewed' }),
    onSuccess: () => {
      addToast('Submission graded', 'success');
      qc.invalidateQueries({ queryKey: ['assignment-submissions', selectedAssignmentId] });
    },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Assignments & Grading</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">Create homework and review student submissions</p>
      </div>

      <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-4">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <FormField label="Title"><input className={inputClass} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Algebra Problem Set" /></FormField>
          <FormField label="Class">
            <select className={inputClass} value={classId} onChange={(e) => setClassId(e.target.value)}>
              <option value="">Select</option>
              {classes.map((c) => <option key={c._id} value={c._id}>{c.name}</option>)}
            </select>
          </FormField>
          <FormField label="Section">
            <select className={inputClass} value={sectionId} onChange={(e) => setSectionId(e.target.value)}>
              <option value="">Select</option>
              {sections.map((s) => <option key={s._id} value={s._id}>{s.name}</option>)}
            </select>
          </FormField>
          <FormField label="Subject">
            <select className={inputClass} value={subjectId} onChange={(e) => setSubjectId(e.target.value)}>
              <option value="">Select</option>
              {subjects.map((s) => <option key={s._id} value={s._id}>{s.name}</option>)}
            </select>
          </FormField>
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="sm:col-span-2"><FormField label="Description"><input className={inputClass} value={description} onChange={(e) => setDescription(e.target.value)} /></FormField></div>
          <FormField label="Due Date"><input type="date" className={inputClass} value={dueDate} onChange={(e) => setDueDate(e.target.value)} /></FormField>
        </div>
        <FormField label="Attachment (Optional PDF, Image, Doc)">
          <input
            type="file"
            accept=".pdf,.jpg,.jpeg,.png,.docx,.pptx,.xlsx"
            onChange={(e) => setAttachment(e.target.files?.[0] || null)}
            className="text-sm text-slate-600 dark:text-slate-300"
          />
        </FormField>
        {createMutation.isPending && attachment && (
          <div className="h-2 w-full rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden">
            <div className="h-full bg-indigo-600 transition-all" style={{ width: `${uploadProgress}%` }} />
          </div>
        )}
        <Button onClick={() => createMutation.mutate()} disabled={!title || !classId || !sectionId || !subjectId || !dueDate || createMutation.isPending}>
          <Plus className="h-4 w-4" /> Publish Assignment
        </Button>
      </div>

      <DataTable
        loading={isLoading}
        columns={[
          { key: 'title', label: 'Title' },
          { key: 'subject', label: 'Subject', render: (r) => r.subjectId?.name },
          { key: 'class', label: 'Class', render: (r) => `${r.classId?.name} - ${r.sectionId?.name}` },
          { key: 'dueDate', label: 'Due Date', render: (r) => new Date(r.dueDate).toLocaleDateString() },
          {
            key: 'submissions',
            label: 'Submissions',
            render: (r) => (
              <Button variant="secondary" size="sm" onClick={() => setSelectedAssignmentId(r._id)}>
                Review Submissions
              </Button>
            ),
          },
        ]}
        data={assignments}
      />

      <Modal open={Boolean(selectedAssignmentId)} onClose={() => setSelectedAssignmentId(null)} title="Student Submissions">
        {submissions.length === 0 ? (
          <p className="text-sm text-slate-500">No submissions yet.</p>
        ) : (
          <div className="space-y-3">
            {submissions.map((sub) => (
              <div key={sub._id} className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 dark:border-slate-800 p-3">
                <div>
                  <p className="font-medium text-slate-900 dark:text-white">{sub.studentId?.userId?.name}</p>
                  <Badge color={sub.status === 'graded' ? 'emerald' : 'amber'}>{sub.status}</Badge>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    placeholder="Points"
                    className={`${inputClass} w-24`}
                    defaultValue={sub.points ?? ''}
                    onChange={(e) => setGradePoints((p) => ({ ...p, [sub._id]: e.target.value }))}
                  />
                  <Button size="sm" onClick={() => gradeMutation.mutate({ id: sub._id, points: gradePoints[sub._id] ?? sub.points ?? 0 })}>
                    Grade
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Modal>
    </div>
  );
}

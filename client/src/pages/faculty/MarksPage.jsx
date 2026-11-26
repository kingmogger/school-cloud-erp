import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api, getApiErrorMessage } from '../../api/client';
import { useToast } from '../../context/ToastContext';
import { Button, FormField, EmptyState, inputClass } from '../../components/ui';

export function MarksPage() {
  const { addToast } = useToast();
  const qc = useQueryClient();
  const [examId, setExamId] = useState('');
  const [subjectId, setSubjectId] = useState('');
  const [newExamName, setNewExamName] = useState('');
  const [newExamClassId, setNewExamClassId] = useState('');
  const [scores, setScores] = useState({});

  const { data: roster } = useQuery({ queryKey: ['faculty-roster'], queryFn: async () => (await api.get('/faculty/roster')).data.data });
  const { data: exams = [] } = useQuery({ queryKey: ['faculty-exams'], queryFn: async () => (await api.get('/faculty/exams')).data.data });

  const classes = roster?.classes || [];
  const subjects = roster?.subjects || [];
  const selectedSubject = subjects.find((s) => s._id === subjectId);
  const students = (roster?.students || []).filter(
    (st) => !selectedSubject || (st.classId?._id || st.classId) === (selectedSubject.classId?._id || selectedSubject.classId)
  );

  const createExam = useMutation({
    mutationFn: () => {
      const cls = classes.find((c) => c._id === newExamClassId);
      return api.post('/faculty/exams', {
        name: newExamName,
        classId: newExamClassId,
        academicYearId: cls?.academicYearId,
        term: 'Term 1',
      });
    },
    onSuccess: () => {
      addToast('Exam created', 'success');
      setNewExamName('');
      qc.invalidateQueries({ queryKey: ['faculty-exams'] });
    },
    onError: (e) => addToast(getApiErrorMessage(e), 'error'),
  });

  const saveMarks = useMutation({
    mutationFn: () =>
      api.post('/faculty/marks/bulk', {
        examId,
        subjectId,
        marks: students.map((s) => ({
          studentId: s._id,
          marksObtained: Number(scores[s._id] ?? 0),
          maxMarks: selectedSubject?.maxMarks || 100,
        })),
      }),
    onSuccess: (res) => addToast(`Saved marks for ${res.data.data.savedCount} students`, 'success'),
    onError: (e) => addToast(getApiErrorMessage(e), 'error'),
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Marks Entry</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">Create exams and enter student marks validated against max marks</p>
      </div>

      <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 flex flex-col sm:flex-row gap-3 items-end">
        <div className="flex-1"><FormField label="New Exam Name"><input className={inputClass} value={newExamName} onChange={(e) => setNewExamName(e.target.value)} placeholder="Unit Test 1" /></FormField></div>
        <div className="sm:w-48">
          <FormField label="Class">
            <select className={inputClass} value={newExamClassId} onChange={(e) => setNewExamClassId(e.target.value)}>
              <option value="">Select class</option>
              {classes.map((c) => <option key={c._id} value={c._id}>{c.name}</option>)}
            </select>
          </FormField>
        </div>
        <Button onClick={() => createExam.mutate()} disabled={!newExamName || !newExamClassId}>Create Exam</Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
        <FormField label="Select Exam">
          <select className={inputClass} value={examId} onChange={(e) => setExamId(e.target.value)}>
            <option value="">Select exam</option>
            {exams.map((ex) => <option key={ex._id} value={ex._id}>{ex.name} ({ex.term})</option>)}
          </select>
        </FormField>
        <FormField label="Select Subject">
          <select className={inputClass} value={subjectId} onChange={(e) => setSubjectId(e.target.value)}>
            <option value="">Select subject</option>
            {subjects.map((sub) => <option key={sub._id} value={sub._id}>{sub.name} ({sub.code}) — Max {sub.maxMarks}</option>)}
          </select>
        </FormField>
      </div>

      {!examId || !subjectId ? (
        <EmptyState title="Select Exam & Subject" description="Choose an exam and subject above to enter marks." />
      ) : (
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-4">
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {students.map((stu) => (
              <div key={stu._id} className="flex items-center justify-between gap-4 py-3">
                <div>
                  <p className="font-medium text-slate-900 dark:text-white">{stu.userId?.name}</p>
                  <p className="text-xs text-slate-500">{stu.admissionNo}</p>
                </div>
                <div className="w-32">
                  <input
                    type="number"
                    min={0}
                    max={selectedSubject?.maxMarks || 100}
                    placeholder={`0 - ${selectedSubject?.maxMarks || 100}`}
                    className={inputClass}
                    value={scores[stu._id] ?? ''}
                    onChange={(e) => setScores((p) => ({ ...p, [stu._id]: e.target.value }))}
                  />
                </div>
              </div>
            ))}
          </div>
          <Button onClick={() => saveMarks.mutate()} disabled={saveMarks.isPending || students.length === 0}>
            {saveMarks.isPending ? 'Saving...' : 'Save All Marks'}
          </Button>
        </div>
      )}
    </div>
  );
}

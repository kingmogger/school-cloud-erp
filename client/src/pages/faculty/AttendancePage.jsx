import { useState, useEffect } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { api, getApiErrorMessage } from '../../api/client';
import { useToast } from '../../context/ToastContext';
import { Button, FormField, EmptyState, inputClass } from '../../components/ui';

export function AttendancePage() {
  const { addToast } = useToast();
  const [classId, setClassId] = useState('');
  const [sectionId, setSectionId] = useState('');
  const [subjectId, setSubjectId] = useState('');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [statuses, setStatuses] = useState({});

  const { data: roster } = useQuery({
    queryKey: ['faculty-roster'],
    queryFn: async () => (await api.get('/faculty/roster')).data.data,
  });

  const classes = roster?.classes || [];
  const sections = (roster?.sections || []).filter((s) => !classId || (s.classId?._id || s.classId) === classId);
  const subjects = (roster?.subjects || []).filter((s) => !classId || (s.classId?._id || s.classId) === classId);
  const students = (roster?.students || []).filter(
    (st) => (!classId || (st.classId?._id || st.classId) === classId) && (!sectionId || (st.sectionId?._id || st.sectionId) === sectionId)
  );

  useEffect(() => {
    const initial = {};
    students.forEach((s) => {
      initial[s._id] = 'present';
    });
    setStatuses(initial);
  }, [classId, sectionId, students.length]);

  const mutation = useMutation({
    mutationFn: () =>
      api.post('/faculty/attendance/bulk', {
        classId,
        sectionId,
        subjectId: subjectId || null,
        date,
        records: students.map((s) => ({ studentId: s._id, status: statuses[s._id] || 'present' })),
      }),
    onSuccess: (res) => addToast(`Marked attendance for ${res.data.data.markedCount} students`, 'success'),
    onError: (e) => addToast(getApiErrorMessage(e), 'error'),
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Bulk Attendance</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">Mark daily or subject-wise attendance (editable within configured window)</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
        <FormField label="Class">
          <select className={inputClass} value={classId} onChange={(e) => { setClassId(e.target.value); setSectionId(''); }}>
            <option value="">Select class</option>
            {classes.map((c) => <option key={c._id} value={c._id}>{c.name}</option>)}
          </select>
        </FormField>
        <FormField label="Section">
          <select className={inputClass} value={sectionId} onChange={(e) => setSectionId(e.target.value)}>
            <option value="">Select section</option>
            {sections.map((s) => <option key={s._id} value={s._id}>{s.name}</option>)}
          </select>
        </FormField>
        <FormField label="Subject (Optional)">
          <select className={inputClass} value={subjectId} onChange={(e) => setSubjectId(e.target.value)}>
            <option value="">Daily / All</option>
            {subjects.map((s) => <option key={s._id} value={s._id}>{s.name}</option>)}
          </select>
        </FormField>
        <FormField label="Date">
          <input type="date" className={inputClass} value={date} onChange={(e) => setDate(e.target.value)} />
        </FormField>
      </div>

      {!classId || !sectionId ? (
        <EmptyState title="Select a Class & Section" description="Choose a class and section above to load the student roster." />
      ) : (
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-4">
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {students.map((stu) => (
              <div key={stu._id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 py-3">
                <div>
                  <p className="font-medium text-slate-900 dark:text-white">{stu.userId?.name}</p>
                  <p className="text-xs text-slate-500">{stu.admissionNo} · Roll {stu.rollNo || '—'}</p>
                </div>
                <div className="flex gap-2">
                  {['present', 'absent', 'late', 'excused'].map((st) => (
                    <button
                      key={st}
                      type="button"
                      onClick={() => setStatuses((prev) => ({ ...prev, [stu._id]: st }))}
                      className={`rounded-lg px-3 py-1.5 text-xs font-medium capitalize cursor-pointer border ${
                        statuses[stu._id] === st
                          ? 'bg-indigo-600 text-white border-indigo-600'
                          : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'
                      }`}
                    >
                      {st}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
          <Button onClick={() => mutation.mutate()} disabled={mutation.isPending || students.length === 0}>
            {mutation.isPending ? 'Saving...' : 'Submit Attendance'}
          </Button>
        </div>
      )}
    </div>
  );
}

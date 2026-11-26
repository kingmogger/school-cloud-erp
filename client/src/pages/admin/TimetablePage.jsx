import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Trash2 } from 'lucide-react';
import { api, getApiErrorMessage } from '../../api/client';
import { useToast } from '../../context/ToastContext';
import { Button, FormField, inputClass } from '../../components/ui';

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export function TimetablePage() {
  const { addToast } = useToast();
  const qc = useQueryClient();
  const [classId, setClassId] = useState('');
  const [sectionId, setSectionId] = useState('');
  const [dayOfWeek, setDayOfWeek] = useState('Monday');
  const [slots, setSlots] = useState([{ subjectId: '', facultyId: '', startTime: '09:00', endTime: '09:45', room: '101' }]);

  const { data: classes = [] } = useQuery({ queryKey: ['admin-classes'], queryFn: async () => (await api.get('/admin/classes')).data.data });
  const { data: sections = [] } = useQuery({ queryKey: ['admin-sections'], queryFn: async () => (await api.get('/admin/sections')).data.data });
  const { data: subjectsRes } = useQuery({ queryKey: ['admin-subjects'], queryFn: async () => (await api.get('/admin/subjects?limit=100')).data });
  const { data: years = [] } = useQuery({ queryKey: ['admin-years'], queryFn: async () => (await api.get('/admin/academic-years')).data.data });
  const { data: timetable = [] } = useQuery({
    queryKey: ['timetable', classId, sectionId],
    queryFn: async () => (await api.get('/timetable', { params: { classId: classId || undefined, sectionId: sectionId || undefined } })).data.data,
  });

  const filteredSections = sections.filter((s) => !classId || (s.classId?._id || s.classId) === classId);
  const subjects = (subjectsRes?.data || []).filter((s) => !classId || (s.classId?._id || s.classId) === classId);
  const currentYearId = years.find((y) => y.isCurrent)?._id || years[0]?._id;

  const saveMutation = useMutation({
    mutationFn: () =>
      api.put('/timetable', {
        academicYearId: currentYearId,
        classId,
        sectionId,
        dayOfWeek,
        slots: slots.filter((s) => s.subjectId),
      }),
    onSuccess: () => {
      addToast('Timetable saved', 'success');
      qc.invalidateQueries({ queryKey: ['timetable'] });
    },
    onError: (e) => addToast(getApiErrorMessage(e), 'error'),
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Timetable Management</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">Configure weekly class schedules</p>
      </div>

      <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-4">
        <div className="grid gap-4 sm:grid-cols-3">
          <FormField label="Class">
            <select className={inputClass} value={classId} onChange={(e) => { setClassId(e.target.value); setSectionId(''); }}>
              <option value="">Select class</option>
              {classes.map((c) => <option key={c._id} value={c._id}>{c.name}</option>)}
            </select>
          </FormField>
          <FormField label="Section">
            <select className={inputClass} value={sectionId} onChange={(e) => setSectionId(e.target.value)}>
              <option value="">Select section</option>
              {filteredSections.map((s) => <option key={s._id} value={s._id}>{s.name}</option>)}
            </select>
          </FormField>
          <FormField label="Day of Week">
            <select className={inputClass} value={dayOfWeek} onChange={(e) => setDayOfWeek(e.target.value)}>
              {DAYS.map((d) => <option key={d} value={d}>{d}</option>)}
            </select>
          </FormField>
        </div>

        <div className="space-y-2">
          {slots.map((slot, idx) => (
            <div key={idx} className="grid gap-2 sm:grid-cols-5 items-center">
              <select
                className={inputClass}
                value={slot.subjectId}
                onChange={(e) => {
                  const next = [...slots];
                  next[idx].subjectId = e.target.value;
                  setSlots(next);
                }}
              >
                <option value="">Subject</option>
                {subjects.map((sub) => <option key={sub._id} value={sub._id}>{sub.name}</option>)}
              </select>
              <input type="time" className={inputClass} value={slot.startTime} onChange={(e) => { const n = [...slots]; n[idx].startTime = e.target.value; setSlots(n); }} />
              <input type="time" className={inputClass} value={slot.endTime} onChange={(e) => { const n = [...slots]; n[idx].endTime = e.target.value; setSlots(n); }} />
              <input placeholder="Room" className={inputClass} value={slot.room} onChange={(e) => { const n = [...slots]; n[idx].room = e.target.value; setSlots(n); }} />
              <Button variant="ghost" size="sm" onClick={() => setSlots(slots.filter((_, i) => i !== idx))}>
                <Trash2 className="h-4 w-4 text-rose-500" />
              </Button>
            </div>
          ))}
        </div>

        <div className="flex gap-2">
          <Button variant="secondary" onClick={() => setSlots([...slots, { subjectId: '', startTime: '10:00', endTime: '10:45', room: '101' }])}>
            <Plus className="h-4 w-4" /> Add Slot
          </Button>
          <Button onClick={() => saveMutation.mutate()} disabled={!classId || !sectionId || !currentYearId || saveMutation.isPending}>
            Save {dayOfWeek} Schedule
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {timetable.map((tt) => (
          <div key={tt._id} className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
            <h3 className="font-semibold text-slate-900 dark:text-white mb-2">
              {tt.dayOfWeek} — {tt.classId?.name} ({tt.sectionId?.name})
            </h3>
            <ul className="space-y-1.5 text-sm">
              {tt.slots?.map((s, i) => (
                <li key={i} className="flex justify-between text-slate-600 dark:text-slate-300">
                  <span>{s.startTime} - {s.endTime} · <strong>{s.subjectId?.name}</strong></span>
                  <span className="text-xs text-slate-400">Room {s.room || '—'}</span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}

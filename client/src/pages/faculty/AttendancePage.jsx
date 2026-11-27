import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Calendar, Clock, MapPin } from 'lucide-react';
import { api, getApiErrorMessage } from '../../api/client';
import { useToast } from '../../context/ToastContext';
import { Button, FormField, EmptyState, Badge, Skeleton, inputClass } from '../../components/ui';

export function AttendancePage() {
  const { addToast } = useToast();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();

  const [selectedScheduleId, setSelectedScheduleId] = useState(() => searchParams.get('scheduleId') || '');
  const [statuses, setStatuses] = useState({});

  const { data: schedules = [], isLoading: loadingSchedules } = useQuery({
    queryKey: ['faculty-schedules'],
    queryFn: async () => (await api.get('/faculty/schedules')).data.data,
  });

  const { data: roster } = useQuery({
    queryKey: ['faculty-roster'],
    queryFn: async () => (await api.get('/faculty/roster')).data.data,
  });

  const selectedSchedule = schedules.find((s) => String(s._id) === String(selectedScheduleId)) || null;

  useEffect(() => {
    const paramId = searchParams.get('scheduleId');
    if (paramId && paramId !== selectedScheduleId) {
      setSelectedScheduleId(paramId);
    }
  }, [searchParams]);

  const { data: existingRecords = [], isFetching: loadingExisting } = useQuery({
    queryKey: ['faculty-attendance', selectedScheduleId],
    enabled: Boolean(selectedScheduleId),
    queryFn: async () =>
      (await api.get('/faculty/attendance', { params: { scheduledClassId: selectedScheduleId } })).data.data,
  });

  const classId = selectedSchedule ? String(selectedSchedule.classId?._id || selectedSchedule.classId) : '';
  const sectionId = selectedSchedule ? String(selectedSchedule.sectionId?._id || selectedSchedule.sectionId) : '';

  const students = (roster?.students || []).filter(
    (st) =>
      classId &&
      sectionId &&
      String(st.classId?._id || st.classId) === classId &&
      String(st.sectionId?._id || st.sectionId) === sectionId
  );

  useEffect(() => {
    const initial = {};
    const existingMap = new Map(
      existingRecords.map((rec) => [String(rec.studentId?._id || rec.studentId), rec.status])
    );
    students.forEach((s) => {
      initial[s._id] = existingMap.get(String(s._id)) || 'present';
    });
    setStatuses(initial);
  }, [selectedScheduleId, students.length, existingRecords]);

  const mutation = useMutation({
    mutationFn: () =>
      api.post('/faculty/attendance/bulk', {
        scheduledClassId: selectedScheduleId,
        records: students.map((s) => ({ studentId: s._id, status: statuses[s._id] || 'present' })),
      }),
    onSuccess: (res) => {
      addToast(`Saved attendance for ${res.data.data.markedCount} students (${res.data.data.dateKey})`, 'success');
      qc.invalidateQueries({ queryKey: ['faculty-attendance', selectedScheduleId] });
      qc.invalidateQueries({ queryKey: ['faculty-schedules'] });
      qc.invalidateQueries({ queryKey: ['student-attendance'] });
      qc.invalidateQueries({ queryKey: ['student-timetable'] });
      qc.invalidateQueries({ queryKey: ['student-profile'] });
      qc.invalidateQueries({ queryKey: ['student-notifications'] });
    },
    onError: (e) => addToast(getApiErrorMessage(e), 'error'),
  });

  const hasSavedRecords = existingRecords.length > 0;

  if (loadingSchedules) return <Skeleton className="h-48 w-full" />;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Mark Attendance</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Select one of your scheduled classes to mark or update attendance
          </p>
        </div>
        {selectedSchedule && (
          <Badge color={hasSavedRecords ? 'emerald' : 'slate'}>
            {loadingExisting ? 'Loading...' : hasSavedRecords ? 'Saved for this class (editing)' : 'Not marked yet'}
          </Badge>
        )}
      </div>

      {schedules.length === 0 ? (
        <EmptyState
          title="No Scheduled Classes Found"
          description="You can only mark attendance for your scheduled classes. Schedule a class first."
          action={
            <Button onClick={() => navigate('/faculty/schedule')}>
              Go to Class Schedule
            </Button>
          }
        />
      ) : (
        <>
          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 space-y-3">
            <FormField label="Scheduled Class">
              <select
                className={inputClass}
                value={selectedScheduleId}
                onChange={(e) => {
                  const nextId = e.target.value;
                  setSelectedScheduleId(nextId);
                  setSearchParams(nextId ? { scheduleId: nextId } : {});
                }}
              >
                <option value="">Select a scheduled class</option>
                {schedules.map((sc) => (
                  <option key={sc._id} value={sc._id}>
                    {sc.dateKey} ({sc.startTime}–{sc.endTime}) · {sc.scheduleType === 'event' ? `[Event] ${sc.title}` : sc.subjectId?.name || 'Subject'} · {sc.classId?.name || ''} {sc.sectionId?.name ? `Sec ${sc.sectionId.name}` : ''} · Room {sc.room} {sc.attendanceMarked ? '✓ Marked' : ''}
                  </option>
                ))}
              </select>
            </FormField>

            {selectedSchedule && (
              <div className="flex flex-wrap items-center gap-4 text-xs text-slate-600 dark:text-slate-300 pt-1">
                <span className="font-semibold text-slate-900 dark:text-white">
                  {selectedSchedule.subjectId?.name} ({selectedSchedule.classId?.name} · Sec {selectedSchedule.sectionId?.name})
                </span>
                <span className="flex items-center gap-1">
                  <Calendar className="h-3.5 w-3.5" /> {selectedSchedule.dayOfWeek}, {selectedSchedule.dateKey}
                </span>
                <span className="flex items-center gap-1">
                  <Clock className="h-3.5 w-3.5" /> {selectedSchedule.startTime} – {selectedSchedule.endTime}
                </span>
                <span className="flex items-center gap-1">
                  <MapPin className="h-3.5 w-3.5" /> Room {selectedSchedule.room}
                </span>
              </div>
            )}
          </div>

          {!selectedSchedule ? (
            <EmptyState
              title="Select a Scheduled Class"
              description="Choose one of your scheduled classes above to load the student roster."
            />
          ) : students.length === 0 ? (
            <EmptyState
              title="No Active Students in Section"
              description="There are no active students enrolled in this class and section."
            />
          ) : (
            <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-4">
              <div className="divide-y divide-slate-100 dark:divide-slate-800">
                {students.map((stu) => (
                  <div key={stu._id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 py-3">
                    <div>
                      <p className="font-medium text-slate-900 dark:text-white">{stu.userId?.name}</p>
                      <p className="text-xs text-slate-500">
                        {stu.admissionNo} · Roll {stu.rollNo || '—'}
                      </p>
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
                {mutation.isPending ? 'Saving...' : hasSavedRecords ? 'Update Attendance' : 'Submit Attendance'}
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

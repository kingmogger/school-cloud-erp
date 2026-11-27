import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Calendar, Clock, MapPin, Plus, Trash2, ClipboardCheck, ChevronLeft, ChevronRight } from 'lucide-react';
import { api, getApiErrorMessage } from '../../api/client';
import { useToast } from '../../context/ToastContext';
import { Button, FormField, Badge, EmptyState, Skeleton, inputClass } from '../../components/ui';

const WEEK_DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

function getMondayKey(date = new Date()) {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const day = d.getUTCDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setUTCDate(d.getUTCDate() + diff);
  return d.toISOString().slice(0, 10);
}

function addDaysKey(dateKey, days) {
  const d = new Date(`${dateKey}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function SchedulePage() {
  const { addToast } = useToast();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const todayKey = new Date().toISOString().slice(0, 10);
  const [weekStart, setWeekStart] = useState(() => getMondayKey());
  const [scheduleType, setScheduleType] = useState('class'); // 'class' | 'event'
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [subjectId, setSubjectId] = useState('');
  const [sectionId, setSectionId] = useState('');
  const [date, setDate] = useState(todayKey);
  const [startTime, setStartTime] = useState('09:00');
  const [endTime, setEndTime] = useState('10:00');
  const [room, setRoom] = useState('');

  const { data: roster } = useQuery({
    queryKey: ['faculty-roster'],
    queryFn: async () => (await api.get('/faculty/roster')).data.data,
  });

  const { data: allSchedules = [], isLoading } = useQuery({
    queryKey: ['faculty-schedules'],
    queryFn: async () => (await api.get('/faculty/schedules')).data.data,
  });

  const subjects = roster?.subjects || [];
  const selectedSubject = subjects.find((s) => String(s._id) === String(subjectId));
  const selectedClassId = selectedSubject?.classId?._id || selectedSubject?.classId || '';
  const sections = (roster?.sections || []).filter(
    (sec) => !selectedClassId || String(sec.classId?._id || sec.classId) === String(selectedClassId)
  );

  const createMutation = useMutation({
    mutationFn: () =>
      api.post('/faculty/schedules', {
        scheduleType,
        title: scheduleType === 'event' ? title : '',
        description: scheduleType === 'event' ? description : '',
        subjectId: subjectId || null,
        sectionId,
        date,
        startTime,
        endTime,
        room,
      }),
    onSuccess: () => {
      addToast(scheduleType === 'event' ? 'Custom event scheduled successfully' : 'Class scheduled successfully', 'success');
      setRoom('');
      setTitle('');
      setDescription('');
      qc.invalidateQueries({ queryKey: ['faculty-schedules'] });
      qc.invalidateQueries({ queryKey: ['student-timetable'] });
    },
    onError: (e) => addToast(getApiErrorMessage(e), 'error'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => api.delete(`/faculty/schedules/${id}`),
    onSuccess: () => {
      addToast('Scheduled class deleted', 'success');
      qc.invalidateQueries({ queryKey: ['faculty-schedules'] });
      qc.invalidateQueries({ queryKey: ['faculty-attendance'] });
      qc.invalidateQueries({ queryKey: ['student-timetable'] });
      qc.invalidateQueries({ queryKey: ['student-attendance'] });
    },
    onError: (e) => addToast(getApiErrorMessage(e), 'error'),
  });

  const handleDeleteSchedule = (sc) => {
    const msg = sc.attendanceMarked
      ? 'This class already has attendance recorded. Deleting it will also remove its attendance records. Continue?'
      : 'Delete this scheduled class?';
    if (window.confirm(msg)) {
      deleteMutation.mutate(sc._id);
    }
  };

  const upcomingClasses = allSchedules.filter((s) => s.dateKey >= todayKey);
  const weekEnd = addDaysKey(weekStart, 5);
  const weekClasses = allSchedules.filter((s) => s.dateKey >= weekStart && s.dateKey <= weekEnd);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Class Schedule</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Schedule your classes and manage your weekly teaching timetable
        </p>
      </div>

      {/* Schedule Form */}
      <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-semibold text-slate-900 dark:text-white">
            {scheduleType === 'event' ? 'Schedule a Custom Event / Activity' : 'Schedule a New Class'}
          </h2>
          <div className="inline-flex rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-950 p-0.5">
            <button
              type="button"
              onClick={() => setScheduleType('class')}
              className={`px-3 py-1 text-xs font-medium rounded-md cursor-pointer transition ${
                scheduleType === 'class'
                  ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400'
              }`}
            >
              Regular Class
            </button>
            <button
              type="button"
              onClick={() => setScheduleType('event')}
              className={`px-3 py-1 text-xs font-medium rounded-md cursor-pointer transition ${
                scheduleType === 'event'
                  ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400'
              }`}
            >
              Custom Event
            </button>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {scheduleType === 'event' && (
            <FormField label="Event Title">
              <input
                type="text"
                placeholder="e.g. Guest Lecture, Science Fair, Workshop"
                className={inputClass}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </FormField>
          )}

          <FormField label={scheduleType === 'event' ? 'Subject (Optional)' : 'Subject'}>
            <select
              className={inputClass}
              value={subjectId}
              onChange={(e) => {
                setSubjectId(e.target.value);
                setSectionId('');
              }}
            >
              <option value="">{scheduleType === 'event' ? 'None / General Event' : 'Select subject'}</option>
              {subjects.map((sub) => (
                <option key={sub._id} value={sub._id}>
                  {sub.name} {sub.classId?.name ? `(${sub.classId.name})` : ''}
                </option>
              ))}
            </select>
          </FormField>

          <FormField label="Section">
            <select className={inputClass} value={sectionId} onChange={(e) => setSectionId(e.target.value)}>
              <option value="">Select section</option>
              {sections.map((sec) => (
                <option key={sec._id} value={sec._id}>
                  {sec.classId?.name ? `${sec.classId.name} - ` : ''}{sec.name}
                </option>
              ))}
            </select>
          </FormField>

          <FormField label="Date">
            <input type="date" className={inputClass} value={date} onChange={(e) => setDate(e.target.value)} />
          </FormField>

          <FormField label="Start Time">
            <input type="time" className={inputClass} value={startTime} onChange={(e) => setStartTime(e.target.value)} />
          </FormField>

          <FormField label="End Time">
            <input type="time" className={inputClass} value={endTime} onChange={(e) => setEndTime(e.target.value)} />
          </FormField>

          <FormField label="Classroom / Venue">
            <input
              type="text"
              placeholder="e.g. Room 101 or Auditorium"
              className={inputClass}
              value={room}
              onChange={(e) => setRoom(e.target.value)}
            />
          </FormField>

          {scheduleType === 'event' && (
            <FormField label="Notes (Optional)">
              <input
                type="text"
                placeholder="Brief details for students"
                className={inputClass}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </FormField>
          )}
        </div>

        <div className="flex justify-end">
          <Button
            onClick={() => createMutation.mutate()}
            disabled={
              (scheduleType === 'class' ? !subjectId : !title.trim()) ||
              !sectionId ||
              !date ||
              !startTime ||
              !endTime ||
              !room.trim() ||
              createMutation.isPending
            }
          >
            <Plus className="h-4 w-4" />
            {createMutation.isPending ? 'Scheduling...' : scheduleType === 'event' ? 'Schedule Event' : 'Schedule Class'}
          </Button>
        </div>
      </div>

      {/* Upcoming Scheduled Classes */}
      <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-slate-900 dark:text-white">
            Upcoming Scheduled Classes ({upcomingClasses.length})
          </h2>
        </div>

        {isLoading ? (
          <Skeleton className="h-32 w-full" />
        ) : upcomingClasses.length === 0 ? (
          <EmptyState
            title="No Upcoming Classes"
            description="Schedule a class above so students see it on their timetable and you can mark attendance."
          />
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {upcomingClasses.map((sc) => (
              <div key={sc._id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 py-3">
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold text-slate-900 dark:text-white">
                      {sc.scheduleType === 'event' ? sc.title : sc.subjectId?.name || 'Subject'}
                    </span>
                    {sc.scheduleType === 'event' && <Badge color="amber">Event</Badge>}
                    {sc.scheduleType === 'event' && sc.subjectId?.name && (
                      <span className="text-xs text-slate-500">({sc.subjectId.name})</span>
                    )}
                    <Badge color="indigo">
                      {sc.classId?.name || ''} {sc.sectionId?.name ? `· Sec ${sc.sectionId.name}` : ''}
                    </Badge>
                    <Badge color={sc.attendanceMarked ? 'emerald' : 'amber'}>
                      {sc.attendanceMarked ? 'Attendance Marked' : 'Pending Attendance'}
                    </Badge>
                  </div>
                  <div className="flex flex-wrap items-center gap-4 text-xs text-slate-500 dark:text-slate-400">
                    <span className="flex items-center gap-1">
                      <Calendar className="h-3.5 w-3.5" /> {sc.dayOfWeek}, {sc.dateKey}
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock className="h-3.5 w-3.5" /> {sc.startTime} – {sc.endTime}
                    </span>
                    <span className="flex items-center gap-1">
                      <MapPin className="h-3.5 w-3.5" /> Room {sc.room}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant={sc.attendanceMarked ? 'secondary' : 'primary'}
                    onClick={() => navigate(`/faculty/attendance?scheduleId=${sc._id}`)}
                  >
                    <ClipboardCheck className="h-3.5 w-3.5" />
                    {sc.attendanceMarked ? 'View / Edit Attendance' : 'Mark Attendance'}
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => handleDeleteSchedule(sc)}
                    disabled={deleteMutation.isPending}
                    title="Delete scheduled class"
                    className="text-rose-600 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/40"
                  >
                    <Trash2 className="h-4 w-4" /> Delete
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Weekly View (Mon - Sat) */}
      <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="font-semibold text-slate-900 dark:text-white">Weekly Timetable (Monday – Saturday)</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {weekStart} to {weekEnd}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="secondary" onClick={() => setWeekStart(addDaysKey(weekStart, -7))}>
              <ChevronLeft className="h-4 w-4" /> Prev
            </Button>
            <Button size="sm" variant="secondary" onClick={() => setWeekStart(getMondayKey())}>
              This Week
            </Button>
            <Button size="sm" variant="secondary" onClick={() => setWeekStart(addDaysKey(weekStart, 7))}>
              Next <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {WEEK_DAYS.map((dayName, idx) => {
            const dayKey = addDaysKey(weekStart, idx);
            const dayItems = weekClasses.filter((c) => c.dateKey === dayKey);
            return (
              <div
                key={dayName}
                className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/60 p-4 space-y-3"
              >
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-slate-900 dark:text-white">{dayName}</span>
                  <span className="text-xs text-slate-500">{dayKey}</span>
                </div>
                {dayItems.length === 0 ? (
                  <p className="text-xs text-slate-400">No classes scheduled</p>
                ) : (
                  <div className="space-y-2">
                    {dayItems.map((item) => (
                      <div
                        key={item._id}
                        className="rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-3 text-xs space-y-1"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-semibold text-slate-900 dark:text-white">
                            {item.scheduleType === 'event' ? item.title : item.subjectId?.name}
                          </span>
                          <div className="flex items-center gap-1.5">
                            <Badge color={item.attendanceMarked ? 'emerald' : 'slate'}>
                              {item.attendanceMarked ? 'Marked' : 'Scheduled'}
                            </Badge>
                            <button
                              type="button"
                              onClick={() => handleDeleteSchedule(item)}
                              disabled={deleteMutation.isPending}
                              title="Delete scheduled class"
                              className="p-1 rounded text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 cursor-pointer"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </div>
                        <p className="text-slate-600 dark:text-slate-300">
                          {item.classId?.name} · Sec {item.sectionId?.name}
                        </p>
                        <p className="text-slate-500">
                          {item.startTime} – {item.endTime} · Room {item.room}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

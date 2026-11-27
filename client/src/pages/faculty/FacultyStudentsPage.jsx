import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Users, Search, User, Phone, GraduationCap } from 'lucide-react';
import { api } from '../../api/client';
import { Badge, Modal, EmptyState, Skeleton, inputClass } from '../../components/ui';

function DetailRow({ label, value, href }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 py-2 border-b border-slate-100 dark:border-slate-800 last:border-0 text-sm">
      <span className="text-slate-500 dark:text-slate-400">{label}</span>
      {href && value ? (
        <a href={href} className="font-medium text-indigo-600 dark:text-indigo-400 hover:underline">
          {value}
        </a>
      ) : (
        <span className="font-medium text-slate-900 dark:text-white">{value || '—'}</span>
      )}
    </div>
  );
}

export function FacultyStudentsPage() {
  const [classId, setClassId] = useState('');
  const [sectionId, setSectionId] = useState('');
  const [search, setSearch] = useState('');
  const [selectedStudent, setSelectedStudent] = useState(null);

  const { data: roster, isLoading, isError } = useQuery({
    queryKey: ['faculty-roster'],
    queryFn: async () => (await api.get('/faculty/roster')).data.data,
  });

  const classes = roster?.classes || [];
  const sections = (roster?.sections || []).filter(
    (s) => !classId || String(s.classId?._id || s.classId) === String(classId)
  );
  const allStudents = roster?.students || [];

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return allStudents.filter((st) => {
      const cId = String(st.classId?._id || st.classId || '');
      const sId = String(st.sectionId?._id || st.sectionId || '');
      if (classId && cId !== String(classId)) return false;
      if (sectionId && sId !== String(sectionId)) return false;
      if (q) {
        const name = (st.userId?.name || '').toLowerCase();
        const adm = (st.admissionNo || '').toLowerCase();
        const roll = (st.rollNo || '').toLowerCase();
        if (!name.includes(q) && !adm.includes(q) && !roll.includes(q)) return false;
      }
      return true;
    });
  }, [allStudents, classId, sectionId, search]);

  // Group by Grade (Class) and Section
  const grouped = useMemo(() => {
    const map = new Map();
    for (const st of filtered) {
      const gradeName = st.classId?.name || 'Unassigned Grade';
      const gradeLevel = st.classId?.numericLevel ?? 999;
      const secName = st.sectionId?.name || '—';
      const key = `${gradeLevel}::${gradeName}::${secName}`;
      if (!map.has(key)) {
        map.set(key, { key, gradeName, gradeLevel, secName, students: [] });
      }
      map.get(key).students.push(st);
    }
    return Array.from(map.values()).sort((a, b) =>
      a.gradeLevel !== b.gradeLevel ? a.gradeLevel - b.gradeLevel : a.secName.localeCompare(b.secName)
    );
  }, [filtered]);

  if (isLoading) return <Skeleton className="h-48 w-full" />;
  if (isError) {
    return (
      <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
        Unable to load student directory.
      </div>
    );
  }

  const fatherPhone = selectedStudent ? selectedStudent.fatherPhone || selectedStudent.guardianPhone || '' : '';

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Students Directory</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Browse students by grade and section — click any student to view full details
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-3 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
        <div className="relative">
          <Search className="h-4 w-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            className={`${inputClass} pl-9`}
            placeholder="Search student name or admission no..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <select
          className={inputClass}
          value={classId}
          onChange={(e) => {
            setClassId(e.target.value);
            setSectionId('');
          }}
        >
          <option value="">All Grades / Classes</option>
          {classes.map((c) => (
            <option key={c._id} value={c._id}>
              {c.name}
            </option>
          ))}
        </select>
        <select className={inputClass} value={sectionId} onChange={(e) => setSectionId(e.target.value)}>
          <option value="">All Sections</option>
          {sections.map((s) => (
            <option key={s._id} value={s._id}>
              Section {s.name}
            </option>
          ))}
        </select>
      </div>

      {grouped.length === 0 ? (
        <EmptyState
          icon={Users}
          title="No Students Found"
          description="Try clearing your grade, section, or search filters."
        />
      ) : (
        <div className="space-y-5">
          {grouped.map((group) => (
            <div
              key={group.key}
              className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-3"
            >
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
                <div className="flex items-center gap-2">
                  <GraduationCap className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
                  <h2 className="font-semibold text-slate-900 dark:text-white">
                    {group.gradeName} — Section {group.secName}
                  </h2>
                </div>
                <Badge color="indigo">{group.students.length} student(s)</Badge>
              </div>

              <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
                {group.students.map((st) => (
                  <button
                    key={st._id}
                    type="button"
                    onClick={() => setSelectedStudent(st)}
                    className="flex items-center gap-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 p-3 text-left hover:border-indigo-400 dark:hover:border-indigo-600 transition-colors cursor-pointer"
                  >
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 font-semibold text-sm">
                      {(st.userId?.name || 'S').charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-sm text-slate-900 dark:text-white truncate">
                        {st.userId?.name || 'Student'}
                      </p>
                      <p className="text-xs text-slate-500 truncate">
                        {st.admissionNo}
                        {st.rollNo ? ` · Roll ${st.rollNo}` : ''}
                      </p>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal
        open={Boolean(selectedStudent)}
        onClose={() => setSelectedStudent(null)}
        title={selectedStudent?.userId?.name || 'Student Information'}
        maxWidth="max-w-lg"
      >
        {selectedStudent && (
          <div className="space-y-4">
            <div className="flex items-center gap-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 p-3.5">
              <div className="flex h-11 w-11 items-center justify-center rounded-full bg-indigo-600 text-white font-bold">
                <User className="h-5 w-5" />
              </div>
              <div>
                <p className="font-semibold text-slate-900 dark:text-white">
                  {selectedStudent.userId?.name}
                </p>
                <p className="text-xs text-slate-500">
                  {selectedStudent.classId?.name || '—'} — Section {selectedStudent.sectionId?.name || '—'} ·{' '}
                  {selectedStudent.admissionNo}
                </p>
              </div>
            </div>

            <div className="space-y-0.5">
              <DetailRow label="Grade / Class" value={selectedStudent.classId?.name} />
              <DetailRow label="Section" value={selectedStudent.sectionId?.name} />
              <DetailRow label="Roll Number" value={selectedStudent.rollNo} />
              <DetailRow label="Email" value={selectedStudent.userId?.email} />
              <DetailRow
                label="Student Phone"
                value={selectedStudent.userId?.phone}
                href={
                  selectedStudent.userId?.phone
                    ? `tel:${selectedStudent.userId.phone.replace(/[^+\d]/g, '')}`
                    : null
                }
              />
              <DetailRow
                label="Date of Birth"
                value={
                  selectedStudent.dateOfBirth
                    ? new Date(selectedStudent.dateOfBirth).toLocaleDateString()
                    : '—'
                }
              />
              <DetailRow
                label="Gender"
                value={
                  selectedStudent.gender
                    ? selectedStudent.gender.charAt(0).toUpperCase() + selectedStudent.gender.slice(1)
                    : '—'
                }
              />
              <DetailRow label="Blood Group" value={selectedStudent.bloodGroup} />
              <DetailRow label="Address" value={selectedStudent.address} />
              <DetailRow
                label="Father Name"
                value={selectedStudent.fatherName || selectedStudent.guardianName}
              />
              <DetailRow
                label="Father Phone No"
                value={fatherPhone}
                href={fatherPhone ? `tel:${fatherPhone.replace(/[^+\d]/g, '')}` : null}
              />
              <DetailRow label="Mother Name" value={selectedStudent.motherName} />
            </div>

            {fatherPhone && (
              <a
                href={`tel:${fatherPhone.replace(/[^+\d]/g, '')}`}
                className="flex items-center justify-center gap-2 w-full rounded-xl bg-indigo-600 hover:bg-indigo-700 px-4 py-2.5 text-sm font-semibold text-white transition-colors"
              >
                <Phone className="h-4 w-4" />
                Call Father ({fatherPhone})
              </a>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}

import { useQuery } from '@tanstack/react-query';
import { User, GraduationCap, Calendar, Phone, Mail, MapPin, Droplets, Users } from 'lucide-react';
import { api } from '../../api/client';
import { Badge, Skeleton } from '../../components/ui';

function InfoRow({ label, value, href }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 py-2.5 border-b border-slate-100 dark:border-slate-800 last:border-0 text-sm">
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

export function StudentProfilePage() {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['student-profile'],
    queryFn: async () => (await api.get('/student/profile')).data.data,
  });

  if (isLoading) return <Skeleton className="h-64 w-full" />;
  if (isError || !data?.student) {
    return (
      <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
        Unable to load student profile.
      </div>
    );
  }

  const { student, attendance } = data;
  const fatherPhone = student.fatherPhone || student.guardianPhone || '';
  const dob = student.dateOfBirth ? new Date(student.dateOfBirth).toLocaleDateString() : '—';

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6">
        <div className="flex items-center gap-4">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-indigo-600 text-white text-xl font-bold">
            {(student.userId?.name || 'S').charAt(0).toUpperCase()}
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">{student.userId?.name}</h1>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              {student.classId?.name || '—'} — Section {student.sectionId?.name || '—'} · Admission{' '}
              <span className="font-mono font-semibold text-indigo-600 dark:text-indigo-400">
                {student.admissionNo}
              </span>
            </p>
          </div>
        </div>
        <Badge color={student.status === 'active' ? 'emerald' : 'slate'} className="self-start sm:self-center">
          {(student.status || 'active').toUpperCase()}
        </Badge>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-2">
          <div className="flex items-center gap-2 pb-2 border-b border-slate-200 dark:border-slate-800">
            <User className="h-4 w-4 text-indigo-600" />
            <h2 className="font-semibold text-slate-900 dark:text-white">Personal & Contact Details</h2>
          </div>
          <InfoRow label="Full Name" value={student.userId?.name} />
          <InfoRow label="Email" value={student.userId?.email} href={student.userId?.email ? `mailto:${student.userId.email}` : null} />
          <InfoRow label="Student Phone" value={student.userId?.phone} href={student.userId?.phone ? `tel:${student.userId.phone.replace(/[^+\d]/g, '')}` : null} />
          <InfoRow label="Date of Birth" value={dob} />
          <InfoRow label="Gender" value={student.gender ? student.gender.charAt(0).toUpperCase() + student.gender.slice(1) : '—'} />
          <InfoRow label="Blood Group" value={student.bloodGroup} />
          <InfoRow label="Address" value={student.address} />
        </div>

        <div className="space-y-6">
          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-2">
            <div className="flex items-center gap-2 pb-2 border-b border-slate-200 dark:border-slate-800">
              <GraduationCap className="h-4 w-4 text-indigo-600" />
              <h2 className="font-semibold text-slate-900 dark:text-white">Academic Details</h2>
            </div>
            <InfoRow label="Admission Number" value={student.admissionNo} />
            <InfoRow label="Roll Number" value={student.rollNo} />
            <InfoRow label="Class" value={student.classId?.name} />
            <InfoRow label="Section" value={student.sectionId?.name} />
            <InfoRow label="Academic Year" value={student.academicYearId?.name} />
            <InfoRow label="Overall Attendance" value={`${attendance?.percentage ?? 100}%`} />
          </div>

          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-2">
            <div className="flex items-center gap-2 pb-2 border-b border-slate-200 dark:border-slate-800">
              <Users className="h-4 w-4 text-indigo-600" />
              <h2 className="font-semibold text-slate-900 dark:text-white">Family & Guardian Details</h2>
            </div>
            <InfoRow label="Father Name" value={student.fatherName || student.guardianName} />
            <InfoRow
              label="Father Phone No"
              value={fatherPhone}
              href={fatherPhone ? `tel:${fatherPhone.replace(/[^+\d]/g, '')}` : null}
            />
            <InfoRow label="Mother Name" value={student.motherName} />
            {student.guardianName && student.guardianName !== student.fatherName && (
              <InfoRow label="Guardian Name" value={student.guardianName} />
            )}
            {student.guardianPhone && student.guardianPhone !== fatherPhone && (
              <InfoRow
                label="Guardian Phone"
                value={student.guardianPhone}
                href={`tel:${student.guardianPhone.replace(/[^+\d]/g, '')}`}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

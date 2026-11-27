import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { BookOpen, Phone, Mail, User, ExternalLink, ChevronRight } from 'lucide-react';
import { api, openProtectedFile, getApiErrorMessage } from '../../api/client';
import { useToast } from '../../context/ToastContext';
import { Modal, Badge, Button, EmptyState, Skeleton } from '../../components/ui';

const ICON_COLORS = [
  'bg-indigo-600 text-white',
  'bg-teal-600 text-white',
  'bg-sky-600 text-white',
  'bg-rose-600 text-white',
  'bg-violet-600 text-white',
  'bg-amber-600 text-white',
];

export function StudentLearningPage() {
  const { addToast } = useToast();
  const [selectedSubject, setSelectedSubject] = useState(null);

  const { data: subjects = [], isLoading, isError } = useQuery({
    queryKey: ['student-learning'],
    queryFn: async () => (await api.get('/student/learning')).data.data,
  });

  if (isLoading) return <Skeleton className="h-48 w-full" />;
  if (isError) {
    return (
      <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
        Unable to load learning subjects.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Learning</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Your class subjects and teachers — tap a subject to view teacher contact details
        </p>
      </div>

      {subjects.length === 0 ? (
        <EmptyState
          icon={BookOpen}
          title="No Subjects Assigned"
          description="Subjects for your class have not been configured yet."
        />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {subjects.map((sub, idx) => (
            <button
              key={sub._id}
              type="button"
              onClick={() => setSelectedSubject(sub)}
              className="group flex items-start gap-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 text-left shadow-xs hover:border-indigo-400 dark:hover:border-indigo-600 transition-all cursor-pointer"
            >
              <div
                className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ${
                  ICON_COLORS[idx % ICON_COLORS.length]
                }`}
              >
                <BookOpen className="h-6 w-6" />
              </div>

              <div className="min-w-0 flex-1 space-y-1.5">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="font-semibold text-slate-900 dark:text-white truncate">{sub.name}</h3>
                  <ChevronRight className="h-4 w-4 text-slate-400 group-hover:text-indigo-500 shrink-0" />
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                  <span className="font-mono font-medium">{sub.code}</span>
                  {' | '}
                  {sub.teacher?.name || 'Unassigned'}
                </p>
                <div className="flex items-center gap-2 pt-0.5">
                  <Badge color="slate">Theory</Badge>
                  {sub.materials?.length > 0 && (
                    <Badge color="indigo">{sub.materials.length} material(s)</Badge>
                  )}
                </div>
              </div>
            </button>
          ))}
        </div>
      )}

      <Modal
        open={Boolean(selectedSubject)}
        onClose={() => setSelectedSubject(null)}
        title={selectedSubject ? `${selectedSubject.name} (${selectedSubject.code})` : ''}
      >
        {selectedSubject && (
          <div className="space-y-5">
            <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 p-4 space-y-3">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Subject Teacher
              </p>
              {selectedSubject.teacher ? (
                <div className="space-y-2.5">
                  <div className="flex items-center gap-2.5">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300">
                      <User className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="font-semibold text-slate-900 dark:text-white">
                        {selectedSubject.teacher.name}
                      </p>
                      <p className="text-xs text-slate-500">
                        {selectedSubject.teacher.designation}
                        {selectedSubject.teacher.department ? ` · ${selectedSubject.teacher.department}` : ''}
                      </p>
                    </div>
                  </div>

                  {selectedSubject.teacher.phone ? (
                    <a
                      href={`tel:${selectedSubject.teacher.phone.replace(/[^+\d]/g, '')}`}
                      className="flex items-center justify-center gap-2 w-full rounded-xl bg-indigo-600 hover:bg-indigo-700 px-4 py-2.5 text-sm font-semibold text-white transition-colors"
                    >
                      <Phone className="h-4 w-4" />
                      Call {selectedSubject.teacher.phone}
                    </a>
                  ) : (
                    <p className="text-xs text-slate-500">Phone number not added yet.</p>
                  )}

                  {selectedSubject.teacher.email && (
                    <div className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300">
                      <Mail className="h-3.5 w-3.5 text-slate-400" />
                      <span>{selectedSubject.teacher.email}</span>
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-sm text-slate-500">No teacher assigned to this subject yet.</p>
              )}
            </div>

            {selectedSubject.materials?.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Study Materials
                </p>
                <div className="space-y-2">
                  {selectedSubject.materials.map((m) => (
                    <div
                      key={m._id}
                      className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 dark:border-slate-800 p-3 text-sm"
                    >
                      <span className="font-medium text-slate-800 dark:text-slate-200 truncate">
                        {m.title}
                      </span>
                      {m.fileUrl && (
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() =>
                            openProtectedFile(m.fileUrl).catch((e) => addToast(getApiErrorMessage(e), 'error'))
                          }
                        >
                          <ExternalLink className="h-3.5 w-3.5" /> Open
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}

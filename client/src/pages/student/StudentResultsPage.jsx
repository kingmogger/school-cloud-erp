import { useQuery } from '@tanstack/react-query';
import { Download, Calendar, Award, Clock } from 'lucide-react';
import { api } from '../../api/client';
import { Button, DataTable, Badge, EmptyState, Skeleton } from '../../components/ui';

export function StudentResultsPage() {
  const { data: rawData = [], isLoading } = useQuery({
    queryKey: ['student-results'],
    queryFn: async () => (await api.get('/student/results')).data.data,
  });

  const publishedResults = Array.isArray(rawData) ? rawData : (rawData?.publishedResults || []);
  const scheduledExams = Array.isArray(rawData) ? [] : (rawData?.scheduledExams || []);

  const downloadPdf = async (examId, examName) => {
    const res = await api.get(`/student/report-card/${examId}`, { responseType: 'blob' });
    const url = window.URL.createObjectURL(new Blob([res.data]));
    const a = document.createElement('a');
    a.href = url;
    a.download = `ReportCard_${examName.replace(/\s+/g, '_')}.pdf`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  if (isLoading) return <Skeleton className="h-48 w-full" />;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Examinations & Results</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          View scheduled exams, subject-wise marks, and download official PDF report cards
        </p>
      </div>

      {/* 1. Upcoming & Scheduled Exams */}
      {scheduledExams.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Clock className="h-5 w-5 text-amber-500" />
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">Scheduled Exams</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {scheduledExams.map((ex) => (
              <div
                key={ex._id || ex.id}
                className="rounded-2xl border border-amber-200 dark:border-amber-900/40 bg-amber-50/30 dark:bg-amber-950/20 p-5 space-y-3"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold uppercase tracking-wider text-amber-600 dark:text-amber-400">
                    {ex.term || 'Scheduled'}
                  </span>
                  <Badge variant="warning">Awaiting Grading</Badge>
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">{ex.name}</h3>
                  {ex.startDate && (
                    <p className="mt-1 text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1">
                      <Calendar className="h-3.5 w-3.5" /> Date: {new Date(ex.startDate).toLocaleDateString()}
                    </p>
                  )}
                </div>
                <div className="text-xs text-slate-500">
                  Created by faculty. Results and report card will be published once grading is completed.
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 2. Published Exam Results */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Award className="h-5 w-5 text-indigo-500" />
          <h2 className="text-lg font-bold text-slate-900 dark:text-white">Published Results & Report Cards</h2>
        </div>

        {publishedResults.length === 0 ? (
          <EmptyState
            title="No Graded Results Yet"
            description="Your exam marks and downloadable PDF report cards will appear here once graded by your teachers."
          />
        ) : (
          publishedResults.map((item) => (
            <div
              key={item.exam._id}
              className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-4 shadow-xs"
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h2 className="text-lg font-semibold text-slate-900 dark:text-white">{item.exam.name}</h2>
                  <p className="text-xs text-slate-500">
                    Percentage: <strong>{item.percentage}%</strong> · GPA: <strong>{item.gpa}</strong> · Grade: <strong>{item.overallGrade}</strong>
                  </p>
                </div>
                <Button variant="secondary" size="sm" onClick={() => downloadPdf(item.exam._id, item.exam.name)}>
                  <Download className="h-4 w-4" /> Download Report Card (PDF)
                </Button>
              </div>

              <DataTable
                columns={[
                  { key: 'subjectName', label: 'Subject' },
                  { key: 'marksObtained', label: 'Obtained' },
                  { key: 'maxMarks', label: 'Max Marks' },
                  { key: 'grade', label: 'Grade', render: (r) => <Badge color="indigo">{r.grade}</Badge> },
                  {
                    key: 'isPass',
                    label: 'Status',
                    render: (r) => <Badge color={r.isPass ? 'emerald' : 'rose'}>{r.isPass ? 'PASS' : 'FAIL'}</Badge>,
                  },
                ]}
                data={item.marksList}
              />
            </div>
          ))
        )}
      </div>
    </div>
  );
}

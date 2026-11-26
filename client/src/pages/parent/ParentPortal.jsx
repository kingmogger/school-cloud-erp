import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Download, Bell, Check } from 'lucide-react';
import { api } from '../../api/client';
import { StatCard, DataTable, Badge, Button, Skeleton, EmptyState, inputClass } from '../../components/ui';

export function ParentPortal({ section = 'overview' }) {
  const qc = useQueryClient();
  const [selectedChildId, setSelectedChildId] = useState('');

  const { data: children = [], isLoading: loadingChildren } = useQuery({
    queryKey: ['parent-children'],
    queryFn: async () => (await api.get('/parent/children')).data.data,
  });

  useEffect(() => {
    if (!selectedChildId && children.length > 0) {
      setSelectedChildId(children[0]._id);
    }
  }, [children, selectedChildId]);

  const { data: overview, isLoading: loadingOverview } = useQuery({
    queryKey: ['parent-overview', selectedChildId],
    enabled: Boolean(selectedChildId) && section === 'overview',
    queryFn: async () => (await api.get(`/parent/children/${selectedChildId}/overview`)).data.data,
  });

  const { data: attendanceData } = useQuery({
    queryKey: ['parent-attendance', selectedChildId],
    enabled: Boolean(selectedChildId) && section === 'attendance',
    queryFn: async () => (await api.get(`/parent/children/${selectedChildId}/attendance`)).data.data,
  });

  const { data: resultsData = [] } = useQuery({
    queryKey: ['parent-results', selectedChildId],
    enabled: Boolean(selectedChildId) && section === 'results',
    queryFn: async () => (await api.get(`/parent/children/${selectedChildId}/results`)).data.data,
  });

  const { data: feesData } = useQuery({
    queryKey: ['parent-fees', selectedChildId],
    enabled: Boolean(selectedChildId) && section === 'fees',
    queryFn: async () => (await api.get(`/parent/children/${selectedChildId}/fees`)).data.data,
  });

  const { data: remarksData = [] } = useQuery({
    queryKey: ['parent-remarks', selectedChildId],
    enabled: Boolean(selectedChildId) && section === 'remarks',
    queryFn: async () => (await api.get(`/parent/children/${selectedChildId}/remarks`)).data.data,
  });

  const { data: notifications = [] } = useQuery({
    queryKey: ['parent-notifications'],
    enabled: section === 'notifications',
    queryFn: async () => (await api.get('/parent/notifications')).data.data,
  });

  const markRead = useMutation({
    mutationFn: (id) => api.patch(`/parent/notifications/${id}/read`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['parent-notifications'] }),
  });

  const downloadReceipt = async (paymentId, receiptNo) => {
    const res = await api.get(`/fees/payments/${paymentId}/receipt`, { responseType: 'blob' });
    const url = window.URL.createObjectURL(new Blob([res.data]));
    const a = document.createElement('a');
    a.href = url;
    a.download = `Receipt_${receiptNo}.pdf`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  if (loadingChildren) return <Skeleton className="h-40 w-full" />;
  if (children.length === 0) return <EmptyState title="No Linked Children" description="Contact school administration to link your child's profile." />;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Parent Portal</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">Read-only access to your linked children's academic progress</p>
        </div>
        {section !== 'notifications' && (
          <div className="sm:w-64">
            <label htmlFor="child-switcher" className="sr-only">Select Child</label>
            <select
              id="child-switcher"
              value={selectedChildId}
              onChange={(e) => setSelectedChildId(e.target.value)}
              className={inputClass}
            >
              {children.map((c) => (
                <option key={c._id} value={c._id}>
                  {c.userId?.name} ({c.classId?.name} - {c.sectionId?.name})
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {section === 'overview' && (
        loadingOverview ? <Skeleton className="h-40 w-full" /> : (
          <div className="space-y-6">
            <div className="grid gap-4 sm:grid-cols-3">
              <StatCard title="Attendance" value={`${overview?.attendance?.percentage ?? 100}%`} subtitle={overview?.attendance?.isShortage ? 'Below threshold' : 'On track'} />
              <StatCard title="Cumulative GPA" value={overview?.grades?.gpa ?? 0} subtitle={`Grade: ${overview?.grades?.overallGrade || 'N/A'}`} />
              <StatCard title="Recent Remarks" value={overview?.remarks?.length || 0} subtitle="Teacher feedback notes" />
            </div>
            <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5">
              <h3 className="font-semibold text-slate-900 dark:text-white mb-3">Latest Teacher Remarks</h3>
              {(overview?.remarks || []).length === 0 ? (
                <p className="text-sm text-slate-500">No remarks yet.</p>
              ) : (
                <ul className="space-y-2">
                  {overview.remarks.map((r) => (
                    <li key={r._id} className="rounded-lg bg-slate-50 dark:bg-slate-950 p-3 text-sm">
                      <Badge color="indigo" className="mr-2">{r.category}</Badge>
                      <span className="text-slate-700 dark:text-slate-200">{r.comment}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )
      )}

      {section === 'attendance' && (
        <DataTable
          columns={[
            { key: 'date', label: 'Date', render: (r) => new Date(r.date).toLocaleDateString() },
            { key: 'subject', label: 'Subject', render: (r) => r.subjectId?.name || 'Daily' },
            { key: 'status', label: 'Status', render: (r) => <Badge color={r.status === 'present' ? 'emerald' : 'rose'}>{r.status}</Badge> },
          ]}
          data={attendanceData?.records || []}
        />
      )}

      {section === 'results' && (
        resultsData.length === 0 ? <EmptyState title="No Results Yet" /> : (
          <div className="space-y-4">
            {resultsData.map((item) => (
              <div key={item.exam._id} className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-3">
                <h3 className="font-semibold text-slate-900 dark:text-white">{item.exam.name} — {item.percentage}% ({item.overallGrade})</h3>
                <DataTable
                  columns={[
                    { key: 'subjectName', label: 'Subject' },
                    { key: 'marksObtained', label: 'Obtained' },
                    { key: 'maxMarks', label: 'Max' },
                    { key: 'grade', label: 'Grade' },
                  ]}
                  data={item.marksList}
                />
              </div>
            ))}
          </div>
        )
      )}

      {section === 'fees' && (
        <DataTable
          columns={[
            { key: 'receiptNo', label: 'Receipt No' },
            { key: 'amountPaid', label: 'Amount', render: (r) => `$${r.amountPaid}` },
            { key: 'paidAt', label: 'Paid On', render: (r) => new Date(r.paidAt).toLocaleDateString() },
            { key: 'status', label: 'Status', render: (r) => <Badge color="emerald">{r.status}</Badge> },
            {
              key: 'pdf',
              label: 'Receipt',
              render: (r) => (
                <Button size="sm" variant="secondary" onClick={() => downloadReceipt(r._id, r.receiptNo)}>
                  <Download className="h-3.5 w-3.5" /> PDF
                </Button>
              ),
            },
          ]}
          data={feesData?.payments || []}
        />
      )}

      {section === 'remarks' && (
        <DataTable
          columns={[
            { key: 'category', label: 'Category', render: (r) => <Badge color="indigo">{r.category}</Badge> },
            { key: 'comment', label: 'Feedback' },
            { key: 'faculty', label: 'Teacher', render: (r) => r.facultyId?.userId?.name },
            { key: 'date', label: 'Date', render: (r) => new Date(r.createdAt).toLocaleDateString() },
          ]}
          data={remarksData}
        />
      )}

      {section === 'notifications' && (
        <div className="space-y-3">
          {notifications.length === 0 ? (
            <EmptyState icon={Bell} title="No Notifications" description="You're all caught up!" />
          ) : (
            notifications.map((n) => (
              <div key={n._id} className="flex items-start justify-between gap-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
                <div>
                  <div className="flex items-center gap-2">
                    <Badge color={n.type === 'risk' ? 'rose' : 'indigo'}>{n.type}</Badge>
                    <h4 className="font-semibold text-slate-900 dark:text-white">{n.title}</h4>
                  </div>
                  <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">{n.message}</p>
                </div>
                {!n.readAt && (
                  <Button size="sm" variant="secondary" onClick={() => markRead.mutate(n._id)}>
                    <Check className="h-3.5 w-3.5" /> Mark Read
                  </Button>
                )}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}

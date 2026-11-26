import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Upload, ExternalLink } from 'lucide-react';
import { api, getApiErrorMessage, openProtectedFile } from '../../api/client';
import { useToast } from '../../context/ToastContext';
import { Button, DataTable, Badge, Modal } from '../../components/ui';

export function StudentAssignmentsPage() {
  const { addToast } = useToast();
  const qc = useQueryClient();
  const [selectedId, setSelectedId] = useState(null);
  const [file, setFile] = useState(null);
  const [uploadProgress, setUploadProgress] = useState(0);

  const { data: assignments = [], isLoading } = useQuery({
    queryKey: ['student-assignments'],
    queryFn: async () => (await api.get('/student/assignments')).data.data,
  });

  const submitMutation = useMutation({
    mutationFn: () => {
      const fd = new FormData();
      fd.append('file', file);
      setUploadProgress(0);
      return api.post(`/student/assignments/${selectedId}/submit`, fd, {
        onUploadProgress: (evt) => {
          if (evt.total) setUploadProgress(Math.round((evt.loaded / evt.total) * 100));
        },
      });
    },
    onSuccess: () => {
      addToast('Assignment submitted!', 'success');
      setSelectedId(null);
      setFile(null);
      setUploadProgress(0);
      qc.invalidateQueries({ queryKey: ['student-assignments'] });
    },
    onError: (e) => {
      setUploadProgress(0);
      addToast(getApiErrorMessage(e), 'error');
    },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Assignments</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">Upload submissions and view grades & feedback</p>
      </div>

      <DataTable
        loading={isLoading}
        columns={[
          { key: 'title', label: 'Assignment' },
          { key: 'subject', label: 'Subject', render: (r) => r.subjectId?.name },
          { key: 'dueDate', label: 'Due Date', render: (r) => new Date(r.dueDate).toLocaleDateString() },
          {
            key: 'status',
            label: 'Status',
            render: (r) =>
              r.submission ? (
                <Badge color={r.submission.status === 'graded' ? 'emerald' : 'indigo'}>
                  {r.submission.status} {r.submission.points !== null ? `(${r.submission.points} pts)` : ''}
                </Badge>
              ) : (
                <Badge color="amber">Pending</Badge>
              ),
          },
          {
            key: 'action',
            label: '',
            render: (r) => (
              <Button size="sm" variant="secondary" onClick={() => setSelectedId(r._id)}>
                <Upload className="h-3.5 w-3.5" /> {r.submission ? 'Resubmit' : 'Submit'}
              </Button>
            ),
          },
        ]}
        data={assignments}
      />

      <Modal open={Boolean(selectedId)} onClose={() => setSelectedId(null)} title="Submit Assignment">
        <div className="space-y-4">
          <input
            type="file"
            accept=".pdf,.jpg,.jpeg,.png,.docx,.pptx,.xlsx"
            onChange={(e) => setFile(e.target.files?.[0] || null)}
            className="text-sm"
          />
          {submitMutation.isPending && (
            <div className="space-y-1">
              <div className="h-2 w-full rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden">
                <div className="h-full bg-indigo-600 transition-all" style={{ width: `${uploadProgress}%` }} />
              </div>
              <p className="text-xs text-slate-500">Uploading... {uploadProgress}%</p>
            </div>
          )}
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setSelectedId(null)}>Cancel</Button>
            <Button onClick={() => submitMutation.mutate()} disabled={!file || submitMutation.isPending}>
              {submitMutation.isPending ? 'Uploading...' : 'Upload Submission'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

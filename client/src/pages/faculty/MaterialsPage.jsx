import { useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Upload, Trash2, ExternalLink, FileText, X } from 'lucide-react';
import { api, getApiErrorMessage, openProtectedFile } from '../../api/client';
import { useToast } from '../../context/ToastContext';
import { Button, DataTable, FormField, Modal, inputClass } from '../../components/ui';

const MAX_SIZE_BYTES = 10 * 1024 * 1024;

export function MaterialsPage() {
  const { addToast } = useToast();
  const qc = useQueryClient();
  const fileInputRef = useRef(null);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [classId, setClassId] = useState('');
  const [subjectId, setSubjectId] = useState('');
  const [file, setFile] = useState(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [deleteTarget, setDeleteTarget] = useState(null);

  const { data: roster } = useQuery({
    queryKey: ['faculty-roster'],
    queryFn: async () => (await api.get('/faculty/roster')).data.data,
  });
  const { data: materials = [], isLoading } = useQuery({
    queryKey: ['faculty-materials'],
    queryFn: async () => (await api.get('/faculty/materials')).data.data,
  });

  const subjects = (roster?.subjects || []).filter(
    (s) => !classId || String(s.classId?._id || s.classId) === String(classId)
  );

  const handleFileChange = (e) => {
    const picked = e.target.files?.[0] || null;
    if (picked && picked.size > MAX_SIZE_BYTES) {
      addToast('File exceeds 10 MB maximum size', 'error');
      e.target.value = '';
      setFile(null);
      return;
    }
    setFile(picked);
  };

  const clearFile = () => {
    setFile(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const uploadMutation = useMutation({
    mutationFn: () => {
      const fd = new FormData();
      fd.append('title', title.trim());
      fd.append('description', description.trim());
      fd.append('classId', classId);
      fd.append('subjectId', subjectId);
      fd.append('file', file);
      setUploadProgress(0);
      return api.post('/faculty/materials', fd, {
        onUploadProgress: (evt) => {
          if (evt.total) setUploadProgress(Math.round((evt.loaded / evt.total) * 100));
        },
      });
    },
    onSuccess: () => {
      addToast('Study material uploaded', 'success');
      setTitle('');
      setDescription('');
      clearFile();
      setUploadProgress(0);
      qc.invalidateQueries({ queryKey: ['faculty-materials'] });
      qc.invalidateQueries({ queryKey: ['student-materials'] });
    },
    onError: (e) => {
      setUploadProgress(0);
      addToast(getApiErrorMessage(e), 'error');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => api.delete(`/faculty/materials/${id}`),
    onSuccess: () => {
      addToast('Material deleted', 'info');
      setDeleteTarget(null);
      qc.invalidateQueries({ queryKey: ['faculty-materials'] });
      qc.invalidateQueries({ queryKey: ['student-materials'] });
    },
    onError: (e) => addToast(getApiErrorMessage(e), 'error'),
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Study Materials</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Upload lecture notes, PDFs, and reference slides (max 10 MB)
        </p>
      </div>

      <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-4">
        <div className="grid gap-4 sm:grid-cols-3">
          <FormField label="Title">
            <input
              className={inputClass}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Chapter 3 Notes"
            />
          </FormField>
          <FormField label="Class">
            <select
              className={inputClass}
              value={classId}
              onChange={(e) => {
                setClassId(e.target.value);
                setSubjectId('');
              }}
            >
              <option value="">Select class</option>
              {(roster?.classes || []).map((c) => (
                <option key={c._id} value={c._id}>{c.name}</option>
              ))}
            </select>
          </FormField>
          <FormField label="Subject">
            <select className={inputClass} value={subjectId} onChange={(e) => setSubjectId(e.target.value)}>
              <option value="">Select subject</option>
              {subjects.map((s) => (
                <option key={s._id} value={s._id}>{s.name}</option>
              ))}
            </select>
          </FormField>
        </div>

        <FormField label="Description (Optional)">
          <input
            className={inputClass}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Brief topic summary for students"
          />
        </FormField>

        <FormField label="File (PDF, JPG, PNG, DOC/DOCX, PPT/PPTX, XLS/XLSX, TXT)">
          <div className="flex flex-wrap items-center gap-3 rounded-xl border border-dashed border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950/60 p-4">
            <input
              ref={fileInputRef}
              id="material-file-input"
              type="file"
              accept=".pdf,.jpg,.jpeg,.png,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.txt,.csv"
              onChange={handleFileChange}
              className="hidden"
            />
            <label
              htmlFor="material-file-input"
              className="inline-flex items-center gap-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3.5 py-2 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
            >
              <Upload className="h-4 w-4" /> Choose File
            </label>
            {file ? (
              <div className="flex items-center gap-2 text-xs text-slate-700 dark:text-slate-200">
                <FileText className="h-4 w-4 text-indigo-500" />
                <span className="font-medium">{file.name}</span>
                <span className="text-slate-400">({(file.size / 1024).toFixed(1)} KB)</span>
                <button
                  type="button"
                  onClick={clearFile}
                  className="p-0.5 rounded hover:bg-slate-200 dark:hover:bg-slate-800 cursor-pointer"
                  aria-label="Remove selected file"
                >
                  <X className="h-3.5 w-3.5 text-slate-500" />
                </button>
              </div>
            ) : (
              <span className="text-xs text-slate-500">No file selected</span>
            )}
          </div>
        </FormField>

        {uploadMutation.isPending && (
          <div className="space-y-1">
            <div className="h-2 w-full rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden">
              <div className="h-full bg-indigo-600 transition-all" style={{ width: `${uploadProgress}%` }} />
            </div>
            <p className="text-xs text-slate-500">Uploading... {uploadProgress}%</p>
          </div>
        )}

        <Button
          onClick={() => uploadMutation.mutate()}
          disabled={!title.trim() || !classId || !subjectId || !file || uploadMutation.isPending}
        >
          <Upload className="h-4 w-4" /> {uploadMutation.isPending ? 'Uploading...' : 'Upload Material'}
        </Button>
      </div>

      <DataTable
        loading={isLoading}
        columns={[
          { key: 'title', label: 'Title' },
          { key: 'class', label: 'Class', render: (r) => r.classId?.name },
          { key: 'subject', label: 'Subject', render: (r) => r.subjectId?.name },
          {
            key: 'file',
            label: 'File',
            render: (r) =>
              r.fileUrl ? (
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => openProtectedFile(r.fileUrl).catch((e) => addToast(getApiErrorMessage(e), 'error'))}
                >
                  <ExternalLink className="h-3.5 w-3.5" /> Open
                </Button>
              ) : (
                '—'
              ),
          },
          {
            key: 'actions',
            label: '',
            render: (r) => (
              <Button variant="ghost" size="sm" onClick={() => setDeleteTarget(r)} aria-label={`Delete ${r.title}`}>
                <Trash2 className="h-4 w-4 text-rose-500" />
              </Button>
            ),
          },
        ]}
        data={materials}
      />

      <Modal open={Boolean(deleteTarget)} onClose={() => setDeleteTarget(null)} title="Delete Study Material">
        <div className="space-y-4">
          <p className="text-sm text-slate-600 dark:text-slate-300">
            Are you sure you want to delete <strong>{deleteTarget?.title}</strong>? This will also remove the file from storage.
          </p>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setDeleteTarget(null)}>Cancel</Button>
            <Button variant="danger" disabled={deleteMutation.isPending} onClick={() => deleteMutation.mutate(deleteTarget._id)}>
              Confirm Delete
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

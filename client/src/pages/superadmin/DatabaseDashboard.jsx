import { useState, useEffect } from 'react';
import {
  Database,
  RefreshCw,
  Search,
  ExternalLink,
  Trash2,
  Eye,
  CheckCircle2,
  Server,
  Layers,
  FileCode,
  Copy,
  Check,
  AlertCircle,
  Plus,
} from 'lucide-react';
import { api } from '../../api/client';
import { useToast } from '../../context/ToastContext';
import { Badge, Button, inputClass } from '../../components/ui';

export function DatabaseDashboard() {
  const { addToast } = useToast();
  const [stats, setStats] = useState(null);
  const [loadingStats, setLoadingStats] = useState(true);
  const [selectedCol, setSelectedCol] = useState('users');
  const [documents, setDocuments] = useState([]);
  const [loadingDocs, setLoadingDocs] = useState(false);
  const [search, setSearch] = useState('');
  const [selectedDoc, setSelectedDoc] = useState(null);
  const [copied, setCopied] = useState(false);
  const [seeding, setSeeding] = useState(false);

  const fetchStats = async () => {
    try {
      setLoadingStats(true);
      const res = await api.get('/database/stats');
      setStats(res.data.data);
    } catch (err) {
      addToast(err.response?.data?.message || 'Failed to load database stats', 'error');
    } finally {
      setLoadingStats(false);
    }
  };

  const fetchDocuments = async (colName, searchKeyword = search) => {
    if (!colName) return;
    try {
      setLoadingDocs(true);
      const res = await api.get(`/database/${colName}`, {
        params: { limit: 100, search: searchKeyword },
      });
      setDocuments(res.data.data?.items || []);
    } catch (err) {
      addToast(err.response?.data?.message || 'Failed to fetch collection data', 'error');
      setDocuments([]);
    } finally {
      setLoadingDocs(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, []);

  useEffect(() => {
    if (selectedCol) {
      fetchDocuments(selectedCol, search);
    }
  }, [selectedCol]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    fetchDocuments(selectedCol, search);
  };

  const handleDelete = async (docId) => {
    if (!window.confirm(`Delete document "${docId}" from ${selectedCol}?`)) return;
    try {
      await api.delete(`/database/${selectedCol}/${docId}`);
      addToast(`Document deleted successfully`, 'success');
      fetchDocuments(selectedCol, search);
      fetchStats();
      if (selectedDoc?._id === docId) setSelectedDoc(null);
    } catch (err) {
      addToast(err.response?.data?.message || 'Failed to delete document', 'error');
    }
  };

  const handleSeed = async () => {
    try {
      setSeeding(true);
      await api.post('/database/seed/run');
      addToast('Database successfully seeded with demo accounts & schools!', 'success');
      fetchStats();
      fetchDocuments(selectedCol, search);
    } catch (err) {
      addToast(err.response?.data?.message || 'Failed to seed database', 'error');
    } finally {
      setSeeding(false);
    }
  };

  const handleCopyJson = () => {
    if (!selectedDoc) return;
    navigator.clipboard.writeText(JSON.stringify(selectedDoc, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400">
              <Database className="h-6 w-6" />
            </div>
            <h1 className="text-xl font-bold text-slate-900 dark:text-white">StudyX Database Dashboard</h1>
            <Badge variant={stats?.isCloud ? 'success' : 'warning'}>
              {stats?.isCloud ? '🔥 Google Cloud Firestore' : '⚡ Local Firestore Engine'}
            </Badge>
          </div>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Real-time NoSQL document browser and database manager.
            {stats?.projectId && <span className="ml-2 font-mono text-xs text-indigo-600 dark:text-indigo-400">Project: {stats.projectId}</span>}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={fetchStats}
            disabled={loadingStats}
            className="flex items-center gap-1.5"
          >
            <RefreshCw className={`h-4 w-4 ${loadingStats ? 'animate-spin' : ''}`} />
            Refresh
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={handleSeed}
            disabled={seeding}
            className="flex items-center gap-1.5 text-indigo-600 dark:text-indigo-400 border-indigo-200 dark:border-indigo-800 hover:bg-indigo-50 dark:hover:bg-indigo-950/40"
          >
            <Layers className="h-4 w-4" />
            {seeding ? 'Seeding...' : 'Seed Demo Data'}
          </Button>

          <a
            href="https://console.firebase.google.com"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg bg-amber-600 text-white hover:bg-amber-700 shadow-xs transition"
          >
            <ExternalLink className="h-3.5 w-3.5" />
            Firebase Console
          </a>
        </div>
      </div>

      {/* Stats Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
          <div className="text-xs font-medium text-slate-500 dark:text-slate-400">Total Collections</div>
          <div className="mt-1 text-2xl font-bold text-slate-900 dark:text-white">
            {stats?.collections?.length || 0}
          </div>
        </div>
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
          <div className="text-xs font-medium text-slate-500 dark:text-slate-400">Total Documents</div>
          <div className="mt-1 text-2xl font-bold text-indigo-600 dark:text-indigo-400">
            {stats?.totalDocuments || 0}
          </div>
        </div>
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
          <div className="text-xs font-medium text-slate-500 dark:text-slate-400">Storage Engine</div>
          <div className="mt-1 text-sm font-semibold truncate text-slate-800 dark:text-slate-200" title={stats?.storagePath}>
            {stats?.isCloud ? 'Google Cloud Firestore' : 'JSON Persistent Store'}
          </div>
        </div>
      </div>

      {/* Main Database Explorer Workspace */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Left: Collections Sidebar */}
        <div className="lg:col-span-1 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-xs">
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3 px-2">Collections</h2>
          <div className="space-y-1 max-h-[600px] overflow-y-auto pr-1">
            {stats?.collections?.map((col) => (
              <button
                key={col.name}
                type="button"
                onClick={() => {
                  setSelectedCol(col.name);
                  setSelectedDoc(null);
                }}
                className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-sm font-medium transition cursor-pointer ${
                  selectedCol === col.name
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800/60'
                }`}
              >
                <span className="truncate">{col.name}</span>
                <span
                  className={`text-xs px-2 py-0.5 rounded-full font-mono ${
                    selectedCol === col.name
                      ? 'bg-white/20 text-white'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400'
                  }`}
                >
                  {col.count}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Right: Document List & Inspector */}
        <div className="lg:col-span-3 space-y-4">
          {/* Collection Header & Search */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-xs">
            <div className="flex items-center gap-2">
              <span className="text-base font-bold text-slate-900 dark:text-white capitalize">
                {selectedCol}
              </span>
              <span className="text-xs text-slate-400 font-mono">({documents.length} loaded)</span>
            </div>

            <form onSubmit={handleSearchSubmit} className="flex items-center gap-2 w-full sm:w-auto">
              <div className="relative flex-1 sm:w-64">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search fields or values..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className={`${inputClass} pl-9 text-xs py-1.5`}
                />
              </div>
              <Button type="submit" size="sm" variant="outline">
                Search
              </Button>
            </form>
          </div>

          {/* Documents Table */}
          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs overflow-hidden">
            {loadingDocs ? (
              <div className="py-16 text-center text-sm text-slate-500">Loading documents from Firestore...</div>
            ) : documents.length === 0 ? (
              <div className="py-16 text-center text-sm text-slate-400">
                No documents found in collection <span className="font-mono text-indigo-500">{selectedCol}</span>.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm text-slate-600 dark:text-slate-300">
                  <thead className="bg-slate-50 dark:bg-slate-800/50 text-xs uppercase font-semibold text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800">
                    <tr>
                      <th className="py-3 px-4">Document ID</th>
                      <th className="py-3 px-4">Primary Fields</th>
                      <th className="py-3 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-mono text-xs">
                    {documents.map((doc) => {
                      const docId = doc._id || doc.id;
                      const summaryKeys = Object.keys(doc)
                        .filter((k) => !['_id', 'id', 'passwordHash', 'refreshTokenHash', '__v'].includes(k))
                        .slice(0, 3);

                      return (
                        <tr
                          key={docId}
                          className={`hover:bg-slate-50 dark:hover:bg-slate-800/40 transition cursor-pointer ${
                            selectedDoc?._id === docId ? 'bg-indigo-50/50 dark:bg-indigo-950/20' : ''
                          }`}
                          onClick={() => setSelectedDoc(doc)}
                        >
                          <td className="py-3 px-4 font-semibold text-indigo-600 dark:text-indigo-400">
                            {docId}
                          </td>
                          <td className="py-3 px-4">
                            <div className="flex flex-wrap gap-1.5">
                              {summaryKeys.map((k) => (
                                <span
                                  key={k}
                                  className="inline-flex items-center px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300"
                                >
                                  <strong className="mr-1 text-slate-400">{k}:</strong>
                                  {typeof doc[k] === 'object' ? JSON.stringify(doc[k]).slice(0, 20) : String(doc[k]).slice(0, 25)}
                                </span>
                              ))}
                            </div>
                          </td>
                          <td className="py-3 px-4 text-right">
                            <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                              <button
                                type="button"
                                onClick={() => setSelectedDoc(doc)}
                                title="Inspect JSON"
                                className="p-1.5 rounded-lg text-slate-500 hover:text-indigo-600 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                              >
                                <Eye className="h-4 w-4" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDelete(docId)}
                                title="Delete Document"
                                className="p-1.5 rounded-lg text-slate-500 hover:text-rose-600 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* JSON Inspector Modal / Card */}
          {selectedDoc && (
            <div className="rounded-2xl border border-indigo-200 dark:border-indigo-900/50 bg-white dark:bg-slate-900 p-5 shadow-sm space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <FileCode className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
                  <span className="text-sm font-bold text-slate-900 dark:text-white">
                    Document JSON: <span className="font-mono text-xs text-indigo-500">{selectedDoc._id || selectedDoc.id}</span>
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" onClick={handleCopyJson} className="flex items-center gap-1 text-xs">
                    {copied ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
                    {copied ? 'Copied!' : 'Copy JSON'}
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => setSelectedDoc(null)} className="text-xs">
                    Close
                  </Button>
                </div>
              </div>

              <pre className="p-4 rounded-xl bg-slate-950 text-slate-200 text-xs font-mono overflow-x-auto max-h-96 border border-slate-800">
                {JSON.stringify(selectedDoc, null, 2)}
              </pre>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

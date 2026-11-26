import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Download } from 'lucide-react';
import { api } from '../../api/client';
import { Button, DataTable, FormField, inputClass } from '../../components/ui';

export function ReportsPage() {
  const [type, setType] = useState('attendance');

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ['admin-report', type],
    queryFn: async () => (await api.get(`/reports/${type}`)).data.data,
  });

  const exportCsv = async () => {
    const res = await api.get(`/reports/${type}?format=csv`, { responseType: 'blob' });
    const url = window.URL.createObjectURL(new Blob([res.data]));
    const a = document.createElement('a');
    a.href = url;
    a.download = `${type}_report.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const columns =
    rows.length > 0
      ? Object.keys(rows[0]).map((k) => ({ key: k, label: k.replace(/([A-Z])/g, ' $1') }))
      : [{ key: 'empty', label: 'Report Data' }];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Reports & Exports</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">Filter and export attendance, exam results, and fee collection data</p>
        </div>
        <Button onClick={exportCsv}>
          <Download className="h-4 w-4" /> Export CSV
        </Button>
      </div>

      <div className="max-w-xs">
        <FormField label="Report Type">
          <select className={inputClass} value={type} onChange={(e) => setType(e.target.value)}>
            <option value="attendance">Attendance Report</option>
            <option value="results">Academic Results Report</option>
            <option value="fees">Fee Collection Report</option>
          </select>
        </FormField>
      </div>

      <DataTable columns={columns} data={rows} loading={isLoading} />
    </div>
  );
}

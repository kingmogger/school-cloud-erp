import { useAuth } from '../context/AuthContext';
import { StatCard } from '../components/ui';
import { Users, ClipboardCheck, Award, BrainCircuit } from 'lucide-react';

export function RoleDashboardHome({ title, subtitle }) {
  const { user } = useAuth();
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">{title}</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          {subtitle} — Signed in as <span className="font-medium text-slate-700 dark:text-slate-200">{user?.name}</span>
        </p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard title="Portal Status" value="Active" subtitle="Connected to live API" icon={Users} />
        <StatCard title="Attendance" value="—" subtitle="Module ready in Phase 2–4" icon={ClipboardCheck} />
        <StatCard title="Academics" value="—" subtitle="Module ready in Phase 2–4" icon={Award} />
        <StatCard title="Intelligence" value="—" subtitle="Module ready in Phase 6" icon={BrainCircuit} />
      </div>
    </div>
  );
}

import { useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import {
  Shield,
  Sliders,
  Building2,
  Database,
  Layers,
  CreditCard,
  FileText,
  Settings,
  LogOut,
  ExternalLink,
  Activity,
  Server,
  Terminal,
  Lock,
  ChevronRight,
  Menu,
  X,
  Sparkles,
  HardDrive,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';

const NAV_ITEMS = [
  { to: '/master-control', label: 'Master Command Center', icon: Sliders, end: true },
  { to: '/master-control/schools', label: 'School Tenants & White-Label', icon: Building2 },
  { to: '/master-control/storage', label: 'Storage Management', icon: HardDrive },
  { to: '/master-control/database', label: 'Database Commander', icon: Database },
  { to: '/master-control/plans', label: 'Subscription Plans', icon: Layers },
  { to: '/master-control/billing', label: 'Billing & Invoices', icon: CreditCard },
  { to: '/master-control/audit-logs', label: 'Security Audit Trail', icon: FileText },
  { to: '/master-control/settings', label: 'Platform Settings', icon: Settings },
];

export function MasterCommandShell() {
  const { user, logout } = useAuth();
  const { addToast } = useToast();
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleLogout = async () => {
    try {
      await logout();
      addToast('Root Administrator session terminated', 'info');
      navigate('/master-control/login');
    } catch {
      navigate('/master-control/login');
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-cyan-500/30 selection:text-cyan-200">
      {/* Top Root Navigation Bar */}
      <header className="sticky top-0 z-40 border-b border-slate-800/80 bg-slate-950/90 backdrop-blur-md px-4 sm:px-6 py-3.5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="md:hidden p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
          >
            {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>

          <div className="flex items-center gap-2.5">
            <div className="h-9 w-9 rounded-xl bg-gradient-to-tr from-cyan-600 via-indigo-600 to-violet-600 p-0.5 shadow-lg shadow-cyan-500/20 flex items-center justify-center">
              <div className="h-full w-full rounded-[10px] bg-slate-950 flex items-center justify-center">
                <Shield className="h-5 w-5 text-cyan-400" />
              </div>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-extrabold tracking-tight text-white text-base">StudyX Platform OS</span>
                <span className="text-[10px] font-mono uppercase px-1.5 py-0.5 rounded-md bg-cyan-500/10 text-cyan-400 border border-cyan-500/30 font-semibold tracking-wider">
                  ROOT CONSOLE
                </span>
              </div>
              <p className="text-[11px] text-slate-400 hidden sm:block">Central Control Panel & Tenant Orchestrator</p>
            </div>
          </div>
        </div>

        {/* System Pulse & External Navigation */}
        <div className="flex items-center gap-3">
          <div className="hidden lg:flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-900/80 border border-slate-800 text-xs">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
            <span className="text-slate-300 font-mono text-[11px]">STUDYX CLOUD: OPERATIONAL</span>
          </div>

          <a
            href="/"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-800/80 hover:bg-slate-700/80 text-slate-200 border border-slate-700/60 transition"
            title="Open Live School ERP in new tab"
          >
            <span>Open School ERP</span>
            <ExternalLink className="h-3.5 w-3.5 text-cyan-400" />
          </a>

          <div className="h-6 w-px bg-slate-800 hidden sm:block" />

          {/* Admin Identity & Logout */}
          <div className="flex items-center gap-2">
            <div className="hidden sm:block text-right">
              <p className="text-xs font-semibold text-white leading-tight">{user?.name || 'Super Admin'}</p>
              <p className="text-[10px] font-mono text-cyan-400 leading-tight">root@studyx.io</p>
            </div>
            <button
              type="button"
              onClick={handleLogout}
              className="p-2 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-slate-800/80 transition cursor-pointer"
              title="Terminate Root Session"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <div className="flex-1 flex overflow-hidden">
        {/* Dedicated Sidebar */}
        <aside
          className={`fixed inset-y-0 left-0 top-[61px] z-30 w-64 bg-slate-950/95 border-r border-slate-800/80 p-4 transition-transform md:translate-x-0 md:static ${
            mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
          }`}
        >
          <div className="flex flex-col h-full justify-between">
            <div className="space-y-1">
              <div className="px-3 py-2 text-[10px] font-mono uppercase tracking-wider text-slate-500 font-bold">
                Platform Navigation
              </div>

              {NAV_ITEMS.map((item) => {
                const Icon = item.icon;
                return (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    end={item.end}
                    onClick={() => setMobileMenuOpen(false)}
                    className={({ isActive }) =>
                      `flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-medium transition-all ${
                        isActive
                          ? 'bg-gradient-to-r from-cyan-500/20 to-indigo-500/10 text-cyan-300 border border-cyan-500/30 shadow-xs shadow-cyan-500/10'
                          : 'text-slate-400 hover:text-white hover:bg-slate-900 border border-transparent'
                      }`
                    }
                  >
                    <div className="flex items-center gap-2.5">
                      <Icon className="h-4 w-4" />
                      <span>{item.label}</span>
                    </div>
                    <ChevronRight className="h-3 w-3 opacity-40" />
                  </NavLink>
                );
              })}
            </div>

            {/* Sidebar Footer: System Diagnostics Badge */}
            <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-3 space-y-2">
              <div className="flex items-center justify-between text-[11px] text-slate-400">
                <span className="flex items-center gap-1.5 font-mono">
                  <Terminal className="h-3.5 w-3.5 text-cyan-400" /> API Gateway
                </span>
                <span className="text-emerald-400 font-semibold font-mono">:5001</span>
              </div>
              <div className="flex items-center justify-between text-[11px] text-slate-400">
                <span className="flex items-center gap-1.5 font-mono">
                  <Lock className="h-3.5 w-3.5 text-indigo-400" /> Mode
                </span>
                <span className="text-indigo-300 font-semibold font-mono">Multi-Tenant</span>
              </div>
              <div className="pt-1 border-t border-slate-800/80 text-[10px] text-slate-500 text-center">
                StudyX Global Core v2.4.0
              </div>
            </div>
          </div>
        </aside>

        {/* Content Outlet */}
        <main className="flex-1 overflow-y-auto bg-slate-900/60 p-4 sm:p-6 lg:p-8">
          <div className="max-w-7xl mx-auto">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}

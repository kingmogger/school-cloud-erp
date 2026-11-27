import { useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import {
  GraduationCap,
  LogOut,
  Menu,
  Moon,
  Sun,
  X,
  LayoutDashboard,
  Users,
  BookOpen,
  Calendar,
  CreditCard,
  FileBarChart,
  Settings,
  ClipboardCheck,
  Award,
  FileText,
  FolderOpen,
  MessageSquare,
  Bell,
  BrainCircuit,
  Building2,
  Package,
  Receipt,
  ShieldAlert,
  AlertTriangle,
  Database,
  Sliders,
  HardDrive,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { Badge, Button } from '../ui';

const NAV_BY_ROLE = {
  super_admin: [
    { to: '/superadmin', label: 'Platform Overview', icon: LayoutDashboard, end: true },
    { to: '/superadmin/schools', label: 'Schools', icon: Building2 },
    { to: '/superadmin/plans', label: 'Subscription Plans', icon: Package },
    { to: '/superadmin/billing', label: 'Billing & Invoices', icon: Receipt },
    { to: '/superadmin/storage', label: 'Storage', icon: HardDrive },
    { to: '/superadmin/database', label: 'Firebase Database', icon: Database },
    { to: '/superadmin/audit-logs', label: 'Platform Audit Log', icon: ShieldAlert },
    { to: '/superadmin/settings', label: 'Platform Settings', icon: Settings },
  ],
  school_admin: [
    { to: '/admin', label: 'Dashboard', icon: LayoutDashboard, end: true },
    { to: '/admin/students', label: 'Students', icon: Users },
    { to: '/admin/faculty', label: 'Faculty', icon: Users },
    { to: '/admin/academics', label: 'Classes & Subjects', icon: BookOpen },
    { to: '/admin/timetable', label: 'Timetable', icon: Calendar },
    { to: '/admin/fees', label: 'Fees & Receipts', icon: CreditCard },
    { to: '/admin/reports', label: 'Reports', icon: FileBarChart },
    { to: '/admin/intelligence', label: 'Academic Intelligence', icon: BrainCircuit },
    { to: '/admin/subscription', label: 'Subscription', icon: Receipt },
    { to: '/admin/settings', label: 'School Settings', icon: Settings },
  ],
  faculty: [
    { to: '/faculty', label: 'Dashboard', icon: LayoutDashboard, end: true },
    { to: '/faculty/schedule', label: 'Class Schedule', icon: Calendar },
    { to: '/faculty/students', label: 'Students', icon: Users },
    { to: '/faculty/attendance', label: 'Attendance', icon: ClipboardCheck },
    { to: '/faculty/marks', label: 'Marks Entry', icon: Award },
    { to: '/faculty/assignments', label: 'Assignments', icon: FileText },
    { to: '/faculty/materials', label: 'Study Materials', icon: FolderOpen },
    { to: '/faculty/remarks', label: 'Student Remarks', icon: MessageSquare },
    { to: '/faculty/analytics', label: 'Performance & Alerts', icon: BrainCircuit },
  ],
  student: [
    { to: '/student', label: 'Dashboard', icon: LayoutDashboard, end: true },
    { to: '/student/learning', label: 'Learning', icon: BookOpen },
    { to: '/student/attendance', label: 'Attendance', icon: ClipboardCheck },
    { to: '/student/results', label: 'Exam Results', icon: Award },
    { to: '/student/assignments', label: 'Assignments', icon: FileText },
    { to: '/student/materials', label: 'Study Materials', icon: FolderOpen },
    { to: '/student/timetable', label: 'Timetable', icon: Calendar },
    { to: '/student/profile', label: 'Profile & Report Card', icon: Users },
  ],
};

export function AppShell() {
  const { user, school, logout, exitImpersonation } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const isBlockedAdmin = user?.role === 'school_admin' && school?.subscription?.isBlocked;
  const navItems = isBlockedAdmin
    ? [{ to: '/admin/subscription', label: 'Subscription', icon: Receipt }]
    : NAV_BY_ROLE[user?.role] || [];

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const handleExitImpersonation = async () => {
    await exitImpersonation();
    navigate('/superadmin/schools');
  };

  const sub = school?.subscription;
  const showGraceBanner = user?.role === 'school_admin' && sub?.effectiveStatus === 'grace';
  const showCountdownBanner =
    user?.role === 'school_admin' &&
    !sub?.isBlocked &&
    sub?.effectiveStatus !== 'grace' &&
    typeof sub?.daysRemaining === 'number' &&
    sub.daysRemaining <= 7;

  const SidebarContent = () => (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-3 border-b border-slate-200 dark:border-slate-800 px-5 py-4">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-600/10 dark:bg-indigo-900/40 border border-indigo-200 dark:border-indigo-800/60 text-indigo-600 dark:text-indigo-400 overflow-hidden shrink-0 shadow-xs">
          {school?.logoUrl ? (
            <img
              src={school.logoUrl}
              alt={school.name || 'School Logo'}
              className="h-full w-full object-contain p-1 rounded-lg"
              onError={(e) => {
                e.currentTarget.style.display = 'none';
                if (e.currentTarget.nextElementSibling) {
                  e.currentTarget.nextElementSibling.style.display = 'block';
                }
              }}
            />
          ) : null}
          <GraduationCap className={`h-5 w-5 ${school?.logoUrl ? 'hidden' : 'block'}`} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-bold text-slate-900 dark:text-white leading-tight">
            {school?.name || (user?.role === 'super_admin' ? 'StudyX Platform' : 'StudyX')}
          </p>
          <div className="flex items-center gap-1.5 mt-0.5">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 shrink-0"></span>
            <p className="text-xs text-slate-500 dark:text-slate-400 capitalize truncate">
              {user?.role?.replace('_', ' ')}
            </p>
          </div>
        </div>
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4" aria-label="Primary Navigation">
        {navItems.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              onClick={() => setSidebarOpen(false)}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-indigo-50 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300'
                    : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800/60'
                }`
              }
            >
              <Icon className="h-4 w-4 shrink-0" />
              <span>{item.label}</span>
            </NavLink>
          );
        })}
      </nav>

      <div className="border-t border-slate-200 dark:border-slate-800 p-4">
        <div className="mb-3 flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-indigo-100 dark:bg-indigo-900 text-sm font-bold text-indigo-700 dark:text-indigo-200">
            {user?.name?.charAt(0)?.toUpperCase() || 'U'}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-slate-900 dark:text-white">{user?.name}</p>
            <p className="truncate text-xs text-slate-500 dark:text-slate-400">{user?.email}</p>
          </div>
        </div>
        <button
          type="button"
          onClick={handleLogout}
          className="flex w-full items-center justify-center gap-2 rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-2 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
        >
          <LogOut className="h-4 w-4" />
          Sign Out
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen flex bg-slate-50 dark:bg-slate-950">
      <aside className="hidden lg:flex lg:w-64 lg:flex-col lg:fixed lg:inset-y-0 border-r border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
        <SidebarContent />
      </aside>

      {sidebarOpen && (
        <div className="fixed inset-0 z-40 flex lg:hidden">
          <div className="fixed inset-0 bg-slate-950/60" onClick={() => setSidebarOpen(false)} />
          <aside className="relative z-50 flex w-72 max-w-xs flex-col bg-white dark:bg-slate-900 shadow-xl">
            <button
              type="button"
              onClick={() => setSidebarOpen(false)}
              aria-label="Close navigation menu"
              className="absolute right-3 top-4 rounded-lg p-1 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              <X className="h-5 w-5" />
            </button>
            <SidebarContent />
          </aside>
        </div>
      )}

      <div className="flex flex-1 flex-col lg:pl-64 min-w-0">
        {user?.impersonatedBy && (
          <div className="flex items-center justify-between bg-amber-500 px-4 py-2 text-xs font-semibold text-slate-950">
            <span>You are viewing as {school?.name || 'School'} Admin ({user.email})</span>
            <Button size="sm" variant="secondary" onClick={handleExitImpersonation}>
              Exit Impersonation
            </Button>
          </div>
        )}

        {showGraceBanner && (
          <div className="flex items-center gap-2 bg-rose-600 px-4 py-2.5 text-xs font-semibold text-white">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            <span>
              Subscription Grace Period: {sub.graceDaysRemaining} grace day(s) remaining before access is suspended. Please renew immediately.
            </span>
          </div>
        )}

        {showCountdownBanner && (
          <div className="flex items-center gap-2 bg-amber-100 dark:bg-amber-950/60 px-4 py-2 text-xs font-medium text-amber-900 dark:text-amber-200 border-b border-amber-200 dark:border-amber-900">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            <span>Your school subscription expires in {sub.daysRemaining} day(s). Visit Subscription to renew.</span>
          </div>
        )}

        <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-slate-200 dark:border-slate-800 bg-white/90 dark:bg-slate-900/90 px-4 sm:px-6 backdrop-blur-md">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setSidebarOpen(true)}
              aria-label="Open navigation menu"
              className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800 lg:hidden"
            >
              <Menu className="h-5 w-5" />
            </button>
            <Badge color="indigo" className="capitalize">
              {user?.role?.replace('_', ' ')}
            </Badge>
            {school?.code && <Badge color="slate">{school.code}</Badge>}
            {school?.name && user?.role !== 'super_admin' && (
              <div className="hidden sm:flex items-center gap-2 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/60 px-2.5 py-1 text-xs font-semibold text-slate-700 dark:text-slate-200">
                {school.logoUrl && (
                  <img src={school.logoUrl} alt="" className="h-4 w-4 object-contain rounded-xs" />
                )}
                <span className="truncate max-w-[200px]">{school.name}</span>
              </div>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={toggleTheme}
              aria-label="Toggle color theme"
              className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800 cursor-pointer"
            >
              {theme === 'dark' ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
            </button>
          </div>
        </header>

        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

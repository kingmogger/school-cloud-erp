import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider } from './context/ThemeContext';
import { ToastProvider } from './context/ToastContext';
import { AuthProvider } from './context/AuthContext';
import { AppShell } from './components/layout/AppShell';
import { MasterCommandShell } from './components/layout/MasterCommandShell';
import { ProtectedRoute, RoleRedirect } from './components/layout/ProtectedRoute';
import { LoginPage } from './pages/auth/LoginPage';
import { MasterControlLogin } from './pages/superadmin/MasterControlLogin';

import { SuperAdminDashboard } from './pages/superadmin/SuperAdminDashboard';
import { MasterControlPanel } from './pages/superadmin/MasterControlPanel';
import { SchoolsPage } from './pages/superadmin/SchoolsPage';
import { PlansPage } from './pages/superadmin/PlansPage';
import { BillingPage } from './pages/superadmin/BillingPage';
import { PlatformAuditPage, PlatformSettingsPage } from './pages/superadmin/PlatformAuditAndSettings';
import { DatabaseDashboard } from './pages/superadmin/DatabaseDashboard';
import { StoragePage } from './pages/superadmin/StoragePage';
import { SchoolStorageDetailPage } from './pages/superadmin/SchoolStorageDetailPage';

import { AdminDashboard } from './pages/admin/AdminDashboard';
import { StudentsPage } from './pages/admin/StudentsPage';
import { FacultyPage } from './pages/admin/FacultyPage';
import { AcademicsPage } from './pages/admin/AcademicsPage';
import { SettingsPage } from './pages/admin/SettingsPage';
import { TimetablePage } from './pages/admin/TimetablePage';
import { FeesPage } from './pages/admin/FeesPage';
import { ReportsPage } from './pages/admin/ReportsPage';
import { IntelligencePage } from './pages/admin/IntelligencePage';
import { SubscriptionPage } from './pages/admin/SubscriptionPage';

import { FacultyDashboard } from './pages/faculty/FacultyDashboard';
import { SchedulePage } from './pages/faculty/SchedulePage';
import { AttendancePage } from './pages/faculty/AttendancePage';
import { MarksPage } from './pages/faculty/MarksPage';
import { AssignmentsPage } from './pages/faculty/AssignmentsPage';
import { MaterialsPage } from './pages/faculty/MaterialsPage';
import { RemarksPage } from './pages/faculty/RemarksPage';

import { StudentDashboard } from './pages/student/StudentDashboard';
import { StudentAttendancePage } from './pages/student/StudentAttendancePage';
import { StudentResultsPage } from './pages/student/StudentResultsPage';
import { StudentAssignmentsPage } from './pages/student/StudentAssignmentsPage';
import { StudentMaterialsPage, StudentTimetablePage } from './pages/student/StudentResources';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <ToastProvider>
          <AuthProvider>
            <BrowserRouter>
              <Routes>
                <Route path="/login" element={<LoginPage />} />
                <Route path="/master-control/login" element={<MasterControlLogin />} />
                <Route path="/superadmin/login" element={<Navigate to="/master-control/login" replace />} />
                <Route path="/" element={<RoleRedirect />} />

                {/* Standalone Super Admin / Master Control Website */}
                <Route
                  path="/master-control"
                  element={
                    <ProtectedRoute allowedRoles={['super_admin']}>
                      <MasterCommandShell />
                    </ProtectedRoute>
                  }
                >
                  <Route index element={<MasterControlPanel />} />
                  <Route path="control-panel" element={<MasterControlPanel />} />
                  <Route path="dashboard" element={<SuperAdminDashboard />} />
                  <Route path="schools" element={<SchoolsPage />} />
                  <Route path="database" element={<DatabaseDashboard />} />
                  <Route path="plans" element={<PlansPage />} />
                  <Route path="billing" element={<BillingPage />} />
                  <Route path="storage" element={<StoragePage />} />
                  <Route path="storage/:id" element={<SchoolStorageDetailPage />} />
                  <Route path="audit-logs" element={<PlatformAuditPage />} />
                  <Route path="settings" element={<PlatformSettingsPage />} />
                </Route>

                {/* Backward compatibility for /superadmin alias -> MasterCommandShell */}
                <Route
                  path="/superadmin"
                  element={
                    <ProtectedRoute allowedRoles={['super_admin']}>
                      <MasterCommandShell />
                    </ProtectedRoute>
                  }
                >
                  <Route index element={<MasterControlPanel />} />
                  <Route path="control-panel" element={<MasterControlPanel />} />
                  <Route path="dashboard" element={<SuperAdminDashboard />} />
                  <Route path="schools" element={<SchoolsPage />} />
                  <Route path="plans" element={<PlansPage />} />
                  <Route path="billing" element={<BillingPage />} />
                  <Route path="storage" element={<StoragePage />} />
                  <Route path="storage/:id" element={<SchoolStorageDetailPage />} />
                  <Route path="audit-logs" element={<PlatformAuditPage />} />
                  <Route path="database" element={<DatabaseDashboard />} />
                  <Route path="settings" element={<PlatformSettingsPage />} />
                </Route>

                <Route
                  path="/admin"
                  element={
                    <ProtectedRoute allowedRoles={['school_admin']}>
                      <AppShell />
                    </ProtectedRoute>
                  }
                >
                  <Route index element={<AdminDashboard />} />
                  <Route path="students" element={<StudentsPage />} />
                  <Route path="faculty" element={<FacultyPage />} />
                  <Route path="academics" element={<AcademicsPage />} />
                  <Route path="timetable" element={<TimetablePage />} />
                  <Route path="fees" element={<FeesPage />} />
                  <Route path="reports" element={<ReportsPage />} />
                  <Route path="intelligence" element={<IntelligencePage />} />
                  <Route path="subscription" element={<SubscriptionPage />} />
                  <Route path="settings" element={<SettingsPage />} />
                </Route>

                <Route
                  path="/faculty"
                  element={
                    <ProtectedRoute allowedRoles={['faculty']}>
                      <AppShell />
                    </ProtectedRoute>
                  }
                >
                  <Route index element={<FacultyDashboard />} />
                  <Route path="schedule" element={<SchedulePage />} />
                  <Route path="attendance" element={<AttendancePage />} />
                  <Route path="marks" element={<MarksPage />} />
                  <Route path="assignments" element={<AssignmentsPage />} />
                  <Route path="materials" element={<MaterialsPage />} />
                  <Route path="remarks" element={<RemarksPage />} />
                  <Route path="analytics" element={<IntelligencePage />} />
                </Route>

                <Route
                  path="/student"
                  element={
                    <ProtectedRoute allowedRoles={['student']}>
                      <AppShell />
                    </ProtectedRoute>
                  }
                >
                  <Route index element={<StudentDashboard />} />
                  <Route path="attendance" element={<StudentAttendancePage />} />
                  <Route path="results" element={<StudentResultsPage />} />
                  <Route path="assignments" element={<StudentAssignmentsPage />} />
                  <Route path="materials" element={<StudentMaterialsPage />} />
                  <Route path="timetable" element={<StudentTimetablePage />} />
                  <Route path="profile" element={<StudentDashboard />} />
                </Route>

                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </BrowserRouter>
          </AuthProvider>
        </ToastProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

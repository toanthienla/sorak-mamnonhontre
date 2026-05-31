import { Routes, Route, Navigate } from 'react-router-dom';
import { AuthLayout } from './layouts/AuthLayout';
import { AppLayout } from './layouts/AppLayout';
import { RoleGuard } from './guards/RoleGuard';
import { LoginPage } from '../features/auth/LoginPage';
import { ForgotPasswordPage } from '../features/auth/ForgotPasswordPage';
import { DashboardPage } from '../features/dashboard/DashboardPage';
import { AccountsPage } from '../features/accounts/AccountsPage';
import { TeachersPage } from '../features/teachers/TeachersPage';
import { ClassesPage } from '../features/classes/ClassesPage';
import { StudentsPage } from '../features/students/StudentsPage';
import { ParentPage } from '../features/parent/ParentPage';
import { useAuthStore } from '@/shared/stores/auth.store';

const Forbidden = () => (
  <div className="min-h-screen flex items-center justify-center">
    <div className="text-center">
      <h1 className="text-3xl font-bold text-destructive">403</h1>
      <p className="text-muted-foreground">Bạn không có quyền truy cập</p>
    </div>
  </div>
);

function ParentGuard({ children }) {
  const role = useAuthStore((s) => s.user?.role);
  if (role === 'PH') return <Navigate to="/portal" replace />;
  return children;
}

// /portal: PH → ParentPage, authenticated non-PH → /, unauthenticated → /login
function PortalRoute() {
  const { user } = useAuthStore();
  if (!user) return <Navigate to="/login" replace />;
  if (user.role !== 'PH') return <Navigate to="/" replace />;
  return <ParentPage />;
}

export function AppRouter() {
  return (
    <Routes>
      <Route element={<AuthLayout />}>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
      </Route>

      <Route path="/forbidden" element={<Forbidden />} />

      {/* Parent portal — standalone, no AppLayout */}
      <Route path="/portal" element={<PortalRoute />} />

      <Route
        element={
          <RoleGuard>
            <ParentGuard>
              <AppLayout />
            </ParentGuard>
          </RoleGuard>
        }
      >
        <Route index element={<DashboardPage />} />
        <Route path="/accounts" element={
          <RoleGuard roles={['BGH']}><AccountsPage /></RoleGuard>
        } />
        <Route path="/teachers" element={
          <RoleGuard roles={['BGH']}><TeachersPage /></RoleGuard>
        } />
        <Route path="/classes" element={<ClassesPage />} />
        <Route path="/students" element={<StudentsPage />} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

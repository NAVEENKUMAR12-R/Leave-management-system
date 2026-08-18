import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './AuthContext';
import Login from './components/Login';
import Sidebar from './components/Sidebar';
import LeaveCalendar from './components/LeaveCalendar';
import TeamInbox from './components/TeamInbox';
import AdminPolicyPanel from './components/AdminPolicyPanel';
import LeaveHistory from './components/LeaveHistory';
import EmployeeDirectory from './components/EmployeeDirectory';
import './index.css';

const PAGE_CONFIG: Record<string, { title: string; subtitle: string; icon: string }> = {
  '/': { title: 'Time Off & Leave', subtitle: 'Manage your leaves and view your calendar', icon: '📅' },
  '/history': { title: 'Leave Records & History', subtitle: 'View and filter all past leave requests', icon: '📜' },
  '/inbox': { title: 'Inbox & Approvals', subtitle: 'Review and process team leave requests', icon: '📥' },
  '/admin/employees': { title: 'Employee Directory & Onboarding', subtitle: 'Onboard new personnel, assign managers, and manage workforce roles', icon: '👥' },
  '/admin/policies': { title: 'Policy Configuration', subtitle: 'Configure leave management policies', icon: '⚙️' },
};

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

function PageTitle() {
  const location = useLocation();
  const { user } = useAuth();
  const config = PAGE_CONFIG[location.pathname] || PAGE_CONFIG['/'];
  const now = new Date();

  return (
    <div className="top-bar">
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: '1.1rem' }}>{config.icon}</span>
          <h1 className="top-bar-title">{config.title}</h1>
        </div>
        <div className="top-bar-greeting">{config.subtitle}</div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 2 }}>
        <span className="top-bar-greeting">{getGreeting()}, {user?.name?.split(' ')[0] || 'User'}</span>
        <span className="top-bar-date">
          {now.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
        </span>
      </div>
    </div>
  );
}

function ProtectedRoute({ children, roles }: { children: React.ReactNode; roles?: string[] }) {
  const { user, hasRole } = useAuth();
  if (!user) return <Navigate to="/login" />;
  if (roles && !roles.some(r => hasRole(r))) return <Navigate to="/" />;
  return <>{children}</>;
}

function AppRoutes() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: 'var(--bg-app)' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{
            width: 48, height: 48, borderRadius: 'var(--radius-lg)',
            background: 'var(--wd-blue-gradient)', display: 'flex', alignItems: 'center',
            justifyContent: 'center', color: 'white', fontWeight: 900, fontSize: '1.2rem',
            margin: '0 auto 16px', boxShadow: '0 4px 12px rgba(0, 100, 210, 0.3)',
            animation: 'pulse 1.5s ease-in-out infinite'
          }}>L</div>
          <div style={{ color: 'var(--text-secondary)', fontSize: 'var(--font-size-sm)', fontWeight: 500 }}>Loading...</div>
          <style>{`@keyframes pulse { 0%, 100% { transform: scale(1); } 50% { transform: scale(1.1); } }`}</style>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="*" element={<Navigate to="/login" />} />
      </Routes>
    );
  }

  return (
    <div className="app-layout">
      <Sidebar />
      <div className="main-content">
        <PageTitle />
        <Routes>
          <Route path="/" element={
            <div className="page-content">
              <LeaveCalendar />
            </div>
          } />
          <Route path="/history" element={
            <div className="page-content">
              <LeaveHistory />
            </div>
          } />
          <Route path="/inbox" element={
            <ProtectedRoute roles={['ROLE_MANAGER', 'ROLE_HR', 'ROLE_HR_ADMIN']}>
              <div className="page-content">
                <TeamInbox />
              </div>
            </ProtectedRoute>
          } />
          <Route path="/admin/employees" element={
            <ProtectedRoute roles={['ROLE_HR_ADMIN', 'ROLE_HR']}>
              <div className="page-content">
                <EmployeeDirectory />
              </div>
            </ProtectedRoute>
          } />
          <Route path="/admin/policies" element={
            <ProtectedRoute roles={['ROLE_HR_ADMIN']}>
              <div className="page-content">
                <AdminPolicyPanel />
              </div>
            </ProtectedRoute>
          } />
          <Route path="/login" element={<Navigate to="/" />} />
          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  );
}

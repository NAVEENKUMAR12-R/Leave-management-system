import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './AuthContext';
import Login from './components/Login';
import Sidebar from './components/Sidebar';
import LeaveCalendar from './components/LeaveCalendar';
import TeamInbox from './components/TeamInbox';
import AdminPolicyPanel from './components/AdminPolicyPanel';
import LeaveHistory from './components/LeaveHistory';
import './index.css';

function PageTitle({ title }: { title: string }) {
  return (
    <div className="top-bar">
      <h1 className="top-bar-title">{title}</h1>
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
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh' }}>
        <div style={{ textAlign: 'center', color: 'var(--text-secondary)' }}>
          <div style={{ fontSize: '2rem', marginBottom: 8 }}>⏳</div>
          <div>Loading...</div>
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
        <Routes>
          <Route path="/" element={
            <>
              <PageTitle title="Time Off & Leave" />
              <div className="page-content">
                <LeaveCalendar />
              </div>
            </>
          } />
          <Route path="/history" element={
            <>
              <PageTitle title="Leave Records & History" />
              <div className="page-content">
                <LeaveHistory />
              </div>
            </>
          } />
          <Route path="/inbox" element={
            <ProtectedRoute roles={['ROLE_MANAGER', 'ROLE_HR', 'ROLE_HR_ADMIN']}>
              <PageTitle title="Inbox & Approvals" />
              <div className="page-content">
                <TeamInbox />
              </div>
            </ProtectedRoute>
          } />
          <Route path="/admin/policies" element={
            <ProtectedRoute roles={['ROLE_HR_ADMIN']}>
              <PageTitle title="Policy Configuration" />
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

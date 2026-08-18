import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../AuthContext';

export default function Sidebar() {
  const { user, logout, hasRole } = useAuth();
  const location = useLocation();

  if (!user) return null;

  const isActive = (path: string) => location.pathname === path;

  const isManager = hasRole('ROLE_MANAGER');
  const isHR = hasRole('ROLE_HR') || hasRole('ROLE_HR_ADMIN');
  const isAdmin = hasRole('ROLE_HR_ADMIN');

  const initials = user.name
    ? user.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
    : 'U';

  const roleLabel = isAdmin ? 'HR Admin' : isHR ? 'HR' : isManager ? 'Manager' : 'Employee';

  return (
    <aside className="sidebar">
      <div className="sidebar-brand">
        <div className="sidebar-brand-icon">L</div>
        <div>
          <div className="sidebar-brand-text">Leave Hub</div>
          <div className="sidebar-brand-sub">Leave Management</div>
        </div>
      </div>

      <nav className="sidebar-nav">
        <div className="sidebar-section-title">Personal</div>

        <Link to="/" className={`sidebar-link ${isActive('/') ? 'active' : ''}`}>
          <span className="link-icon">📅</span>
          Time Off & Leave
        </Link>

        <Link to="/history" className={`sidebar-link ${isActive('/history') ? 'active' : ''}`}>
          <span className="link-icon">📜</span>
          Leave Records & History
        </Link>

        {(isManager || isHR) && (
          <>
            <div className="sidebar-section-title" style={{ marginTop: 16 }}>Team</div>
            <Link to="/inbox" className={`sidebar-link ${isActive('/inbox') ? 'active' : ''}`}>
              <span className="link-icon">📥</span>
              Inbox & Approvals
            </Link>
          </>
        )}

        {isAdmin && (
          <>
            <div className="sidebar-section-title" style={{ marginTop: 16 }}>Administration</div>
            <Link to="/admin/policies" className={`sidebar-link ${isActive('/admin/policies') ? 'active' : ''}`}>
              <span className="link-icon">⚙️</span>
              Policy Configuration
            </Link>
          </>
        )}
      </nav>

      <div className="sidebar-user">
        <div className="sidebar-avatar">{initials}</div>
        <div className="sidebar-user-info">
          <div className="sidebar-user-name">{user.name}</div>
          <div className="sidebar-user-role">{roleLabel}</div>
        </div>
        <button className="sidebar-logout-btn" onClick={logout} title="Sign out">⏻</button>
      </div>
    </aside>
  );
}

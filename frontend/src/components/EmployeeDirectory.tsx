import { useState, useEffect, useMemo } from 'react';
import api from '../api';
import type { UserSummary } from '../types';
import OnboardEmployeeModal from './OnboardEmployeeModal';

export default function EmployeeDirectory() {
  const [employees, setEmployees] = useState<UserSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [showOnboardModal, setShowOnboardModal] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedRole, setSelectedRole] = useState('ALL');
  const [selectedDept, setSelectedDept] = useState('ALL');
  const [successToast, setSuccessToast] = useState('');

  useEffect(() => {
    fetchEmployees();
  }, []);

  const fetchEmployees = async () => {
    setLoading(true);
    try {
      const res = await api.get('/admin/employees');
      setEmployees(res.data || []);
    } catch (err) {
      console.error('Failed to load employee directory', err);
    } finally {
      setLoading(false);
    }
  };

  const getInitials = (name: string) => {
    if (!name) return 'U';
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  const departments = useMemo(() => {
    const depts = new Set<string>();
    employees.forEach(e => {
      if (e.department) depts.add(e.department);
    });
    return Array.from(depts);
  }, [employees]);

  const filteredEmployees = useMemo(() => {
    return employees.filter(e => {
      if (searchTerm) {
        const q = searchTerm.toLowerCase();
        const matchName = e.name?.toLowerCase().includes(q);
        const matchEmail = e.email?.toLowerCase().includes(q);
        const matchDesignation = e.designation?.toLowerCase().includes(q);
        if (!matchName && !matchEmail && !matchDesignation) return false;
      }
      if (selectedRole !== 'ALL') {
        const hasRole = e.roles?.some(r => r.toUpperCase().includes(selectedRole.toUpperCase()));
        if (!hasRole) return false;
      }
      if (selectedDept !== 'ALL') {
        if (e.department !== selectedDept) return false;
      }
      return true;
    });
  }, [employees, searchTerm, selectedRole, selectedDept]);

  const handleOnboardSuccess = (newEmp: UserSummary) => {
    setShowOnboardModal(false);
    setSuccessToast(`Successfully onboarded ${newEmp.name} (${newEmp.email})! Initial leave balances provisioned.`);
    fetchEmployees();
    setTimeout(() => setSuccessToast(''), 5000);
  };

  const getRoleBadge = (role: string) => {
    const r = role.replace('ROLE_', '').toUpperCase();
    switch (r) {
      case 'HR_ADMIN':
        return <span key={role} className="status-badge" style={{ background: '#fef2f2', color: '#b91c1c', border: '1px solid #fca5a5' }}>HR Admin</span>;
      case 'HR':
        return <span key={role} className="status-badge" style={{ background: '#f5f3ff', color: '#6d28d9', border: '1px solid #c4b5fd' }}>HR</span>;
      case 'MANAGER':
        return <span key={role} className="status-badge" style={{ background: '#eff6ff', color: '#1d4ed8', border: '1px solid #bfdbfe' }}>Manager</span>;
      case 'EMPLOYEE':
      default:
        return <span key={role} className="status-badge" style={{ background: '#f0fdf4', color: '#15803d', border: '1px solid #bbf7d0' }}>Employee</span>;
    }
  };

  return (
    <div className="content-container">
      {/* Toast Notification */}
      {successToast && (
        <div className="alert alert-success animate-in" style={{ marginBottom: 16 }}>
          <span>✓</span>
          <div>{successToast}</div>
        </div>
      )}

      {/* Header & Quick Action */}
      <div className="card animate-in" style={{ marginBottom: 20 }}>
        <div className="card-header" style={{ padding: '20px 24px' }}>
          <div>
            <div className="card-title" style={{ fontSize: '1.25rem', display: 'flex', alignItems: 'center', gap: 10 }}>
              👥 Employee Directory & Onboarding
              <span style={{
                fontSize: '11px', fontWeight: 700, padding: '2px 8px',
                borderRadius: 'var(--radius-full)', background: 'var(--wd-blue-50)', color: 'var(--wd-blue)'
              }}>
                {employees.length} Total Workers
              </span>
            </div>
            <div className="card-subtitle">Manage workforce organization hierarchy, role assignments, and onboard new team members</div>
          </div>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => setShowOnboardModal(true)}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
          >
            <span>➕</span> Onboard New Employee
          </button>
        </div>

        {/* Filter Bar */}
        <div style={{
          padding: '14px 24px',
          background: 'var(--bg-subtle)',
          borderTop: '1px solid var(--border-light)',
          display: 'flex',
          gap: 14,
          flexWrap: 'wrap',
          alignItems: 'center'
        }}>
          <div style={{ flex: 1, minWidth: 200 }}>
            <input
              type="text"
              className="form-input"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              placeholder="Search by employee name, email, designation…"
              style={{ fontSize: 'var(--font-size-xs)' }}
            />
          </div>

          <div style={{ minWidth: 160 }}>
            <select
              className="form-select"
              value={selectedRole}
              onChange={e => setSelectedRole(e.target.value)}
              style={{ fontSize: 'var(--font-size-xs)' }}
            >
              <option value="ALL">All Roles</option>
              <option value="EMPLOYEE">Employee</option>
              <option value="MANAGER">Manager</option>
              <option value="HR">HR Specialist</option>
              <option value="HR_ADMIN">HR Admin</option>
            </select>
          </div>

          <div style={{ minWidth: 160 }}>
            <select
              className="form-select"
              value={selectedDept}
              onChange={e => setSelectedDept(e.target.value)}
              style={{ fontSize: 'var(--font-size-xs)' }}
            >
              <option value="ALL">All Departments</option>
              {departments.map(d => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Table */}
        <div className="card-body-compact">
          {loading ? (
            <div className="empty-state">
              <div className="empty-state-icon">⏳</div>
              <div className="empty-state-text">Loading employee directory…</div>
            </div>
          ) : filteredEmployees.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-icon">🔍</div>
              <div className="empty-state-text">No employees match your search criteria.</div>
            </div>
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>Employee</th>
                  <th>Department & Designation</th>
                  <th>Roles & Privileges</th>
                  <th>Reporting Manager</th>
                  <th>Employment Type</th>
                  <th>Hire Date</th>
                </tr>
              </thead>
              <tbody>
                {filteredEmployees.map(emp => (
                  <tr key={emp.id}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <div style={{
                          width: 36, height: 36, borderRadius: '50%',
                          background: 'linear-gradient(135deg, #0055b3, #0284c7)',
                          color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontWeight: 700, fontSize: 'var(--font-size-xs)', flexShrink: 0
                        }}>
                          {getInitials(emp.name)}
                        </div>
                        <div>
                          <div style={{ fontWeight: 700, fontSize: 'var(--font-size-sm)', color: 'var(--text-primary)' }}>
                            {emp.name}
                          </div>
                          <div style={{ fontSize: 'var(--font-size-2xs)', color: 'var(--text-tertiary)' }}>
                            {emp.email}
                          </div>
                        </div>
                      </div>
                    </td>

                    <td>
                      <div style={{ fontWeight: 600, fontSize: 'var(--font-size-xs)', color: 'var(--text-primary)' }}>
                        {emp.department || 'General'}
                      </div>
                      <div style={{ fontSize: 'var(--font-size-2xs)', color: 'var(--text-secondary)' }}>
                        {emp.designation || 'Team Member'}
                      </div>
                    </td>

                    <td>
                      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                        {emp.roles?.map(r => getRoleBadge(r))}
                      </div>
                    </td>

                    <td>
                      {emp.managerName ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span style={{ fontSize: 'var(--font-size-xs)' }}>👤</span>
                          <span style={{ fontWeight: 600, fontSize: 'var(--font-size-xs)', color: 'var(--text-primary)' }}>
                            {emp.managerName}
                          </span>
                        </div>
                      ) : (
                        <span style={{ color: 'var(--text-tertiary)', fontSize: 'var(--font-size-2xs)', fontStyle: 'italic' }}>
                          Self / Top-level
                        </span>
                      )}
                    </td>

                    <td>
                      <span style={{
                        fontSize: '11px', fontWeight: 600, padding: '3px 8px',
                        borderRadius: 'var(--radius-sm)', background: 'var(--bg-subtle)',
                        border: '1px solid var(--border-light)', color: 'var(--text-secondary)'
                      }}>
                        {emp.employeeType?.replace('_', ' ') || 'FULL TIME'}
                      </span>
                    </td>

                    <td style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-secondary)', fontWeight: 500 }}>
                      {emp.hireDate || '2026-01-01'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {showOnboardModal && (
        <OnboardEmployeeModal
          onClose={() => setShowOnboardModal(false)}
          onSuccess={handleOnboardSuccess}
        />
      )}
    </div>
  );
}

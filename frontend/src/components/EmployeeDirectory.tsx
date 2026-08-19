import { useState, useEffect, useMemo } from 'react';
import api from '../api';
import type { UserSummary } from '../types';
import OnboardEmployeeModal from './OnboardEmployeeModal';
import EmployeeDetailModal from './EmployeeDetailModal';

export default function EmployeeDirectory() {
  const [employees, setEmployees] = useState<UserSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [showOnboardModal, setShowOnboardModal] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState<UserSummary | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedRole, setSelectedRole] = useState('ALL');
  const [selectedDept, setSelectedDept] = useState('ALL');
  const [selectedRegion, setSelectedRegion] = useState('ALL');
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
      // Fallback to /leaves/employees if needed
      try {
        const fb = await api.get('/leaves/employees');
        setEmployees(fb.data || []);
      } catch (e) {
        console.error('Fallback employee fetch failed', e);
      }
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

  const regions = useMemo(() => {
    const regs = new Set<string>();
    employees.forEach(e => {
      if (e.region) regs.add(e.region);
    });
    return Array.from(regs);
  }, [employees]);

  const filteredEmployees = useMemo(() => {
    return employees.filter(e => {
      if (searchTerm) {
        const q = searchTerm.toLowerCase();
        const matchName = e.name?.toLowerCase().includes(q);
        const matchEmail = e.email?.toLowerCase().includes(q);
        const matchDesignation = e.designation?.toLowerCase().includes(q);
        const matchDept = e.department?.toLowerCase().includes(q);
        const matchRegion = e.region?.toLowerCase().includes(q);
        if (!matchName && !matchEmail && !matchDesignation && !matchDept && !matchRegion) return false;
      }
      if (selectedRole !== 'ALL') {
        const hasRole = e.roles?.some(r => r.toUpperCase().includes(selectedRole.toUpperCase()));
        if (!hasRole) return false;
      }
      if (selectedDept !== 'ALL') {
        if (e.department !== selectedDept) return false;
      }
      if (selectedRegion !== 'ALL') {
        if ((e.region || 'Global').toLowerCase() !== selectedRegion.toLowerCase()) return false;
      }
      return true;
    });
  }, [employees, searchTerm, selectedRole, selectedDept, selectedRegion]);

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

      {/* Header & Main Table Card */}
      <div className="card animate-in animate-in-1">
        <div className="card-header" style={{ padding: '20px 24px' }}>
          <div>
            <div className="card-title" style={{ fontSize: '1.25rem', display: 'flex', alignItems: 'center', gap: 10 }}>
              👥 Employee Directory & Leave Balances
              <span style={{
                fontSize: '11px', fontWeight: 700, padding: '2px 8px',
                borderRadius: 'var(--radius-full)', background: 'var(--wd-blue-50)', color: 'var(--wd-blue)'
              }}>
                {filteredEmployees.length} Displayed
              </span>
            </div>
            <div className="card-subtitle">
              View user details, role assignments, total Paid Time Off (PTO), and Non-Paid Off (LOP) metrics
            </div>
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={fetchEmployees}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
            >
              🔄 Refresh
            </button>
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => setShowOnboardModal(true)}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
            >
              <span>➕</span> Onboard Employee
            </button>
          </div>
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
              placeholder="Search by employee name, email, designation, department…"
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

          <div style={{ minWidth: 150 }}>
            <select
              className="form-select"
              value={selectedRegion}
              onChange={e => setSelectedRegion(e.target.value)}
              style={{ fontSize: 'var(--font-size-xs)' }}
            >
              <option value="ALL">All Regions</option>
              {regions.map(r => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
          </div>

          <div style={{ minWidth: 150 }}>
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
              <div className="empty-state-text">Loading employee directory & leave statistics…</div>
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
                  <th>Department & Role</th>
                  <th>Reporting Manager</th>
                  <th>Paid Time Off (PTO)</th>
                  <th>Non-Paid Off (LOP)</th>
                  <th>Employment</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredEmployees.map(emp => {
                  const ptoAvailable = emp.totalPtoAvailable ?? 0;
                  const ptoAllocated = emp.totalPtoAllocated ?? 0;
                  const ptoUsed = emp.totalPtoUsed ?? 0;
                  const unpaidDays = emp.totalUnpaidDays ?? 0;

                  return (
                    <tr key={emp.id}>
                      {/* Employee Info */}
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                          <div style={{
                            width: 38, height: 38, borderRadius: '50%',
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

                      {/* Department & Role */}
                      <td>
                        <div style={{ fontWeight: 600, fontSize: 'var(--font-size-xs)', color: 'var(--text-primary)' }}>
                          {emp.department || 'General'}
                        </div>
                        <div style={{ fontSize: 'var(--font-size-2xs)', color: 'var(--text-secondary)', marginBottom: 4 }}>
                          {emp.designation || 'Team Member'}
                        </div>
                        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                          {emp.roles?.map(r => getRoleBadge(r))}
                        </div>
                      </td>

                      {/* Reporting Manager */}
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
                            Self / Executive
                          </span>
                        )}
                      </td>

                      {/* Total Paid Time Off (PTO) */}
                      <td>
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
                            <span style={{
                              fontWeight: 700, fontSize: 'var(--font-size-xs)',
                              padding: '2px 8px', borderRadius: 'var(--radius-full)',
                              background: 'var(--wd-green-light)', color: 'var(--wd-green)',
                              border: '1px solid rgba(16, 185, 129, 0.2)'
                            }}>
                              ⚡ {ptoAvailable} / {ptoAllocated} Days
                            </span>
                            <span style={{ fontSize: '11px', color: 'var(--text-tertiary)' }}>
                              ({ptoUsed} used)
                            </span>
                          </div>
                          
                          {/* Mini Category Badges */}
                          {emp.leaveBalances && emp.leaveBalances.length > 0 && (
                            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 2 }}>
                              {emp.leaveBalances.map(b => (
                                <span key={b.leaveType} style={{
                                  fontSize: '10px', padding: '1px 6px', borderRadius: 'var(--radius-xs)',
                                  background: 'var(--bg-subtle)', border: '1px solid var(--border-light)',
                                  color: 'var(--text-secondary)'
                                }}>
                                  {b.leaveType.slice(0, 1).toUpperCase() + b.leaveType.slice(1).toLowerCase()}: {b.availableLeaves ?? (b.totalLeaves - b.usedLeaves)}/{b.totalLeaves}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      </td>

                      {/* Non-Paid Off (Unpaid / LOP) */}
                      <td>
                        {unpaidDays > 0 ? (
                          <span style={{
                            display: 'inline-flex', alignItems: 'center', gap: 4,
                            fontWeight: 700, fontSize: 'var(--font-size-xs)',
                            padding: '3px 10px', borderRadius: 'var(--radius-full)',
                            background: '#fef2f2', color: '#dc2626',
                            border: '1px solid #fca5a5'
                          }}>
                            ⚠️ {unpaidDays} {unpaidDays === 1 ? 'day' : 'days'} LOP
                          </span>
                        ) : (
                          <span style={{
                            display: 'inline-flex', alignItems: 'center', gap: 4,
                            fontSize: 'var(--font-size-xs)', fontWeight: 500,
                            padding: '3px 8px', borderRadius: 'var(--radius-full)',
                            background: 'var(--bg-subtle)', color: 'var(--text-tertiary)',
                            border: '1px solid var(--border-light)'
                          }}>
                            0 days LOP
                          </span>
                        )}
                      </td>

                      {/* Employment Type, Region & Hire Date */}
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 2 }}>
                          <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-primary)' }}>
                            {emp.employeeType?.replace('_', ' ') || 'FULL TIME'}
                          </span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 2 }}>
                          <span style={{
                            fontSize: '10px', fontWeight: 700, padding: '1px 6px',
                            borderRadius: 'var(--radius-xs)', background: 'var(--wd-blue-50)',
                            color: 'var(--wd-blue)', border: '1px solid rgba(8, 117, 225, 0.2)'
                          }}>
                            🌐 {emp.region || 'Global'}
                          </span>
                        </div>
                        <div style={{ fontSize: 'var(--font-size-2xs)', color: 'var(--text-tertiary)' }}>
                          Hired: {emp.hireDate || '2026-01-01'}
                        </div>
                      </td>

                      {/* Actions */}
                      <td>
                        <button
                          type="button"
                          className="btn btn-secondary btn-sm"
                          onClick={() => setSelectedEmployee(emp)}
                          style={{ fontSize: '11px', padding: '4px 10px', display: 'inline-flex', alignItems: 'center', gap: 4 }}
                          title="View detailed leave breakdown and profile"
                        >
                          <span>👁️</span> Details
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Employee Detail Modal */}
      {selectedEmployee && (
        <EmployeeDetailModal
          employee={selectedEmployee}
          onClose={() => setSelectedEmployee(null)}
        />
      )}

      {/* Onboard New Employee Modal */}
      {showOnboardModal && (
        <OnboardEmployeeModal
          onClose={() => setShowOnboardModal(false)}
          onSuccess={handleOnboardSuccess}
        />
      )}
    </div>
  );
}

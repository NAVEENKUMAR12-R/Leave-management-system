import { useState, useEffect, useMemo } from 'react';
import api from '../api';
import type { UserSummary, LeavePolicyInfo } from '../types';

interface Props {
  onClose: () => void;
  onSuccess: (newEmployee: UserSummary) => void;
}

const DEPARTMENTS = [
  'Engineering',
  'Product & Design',
  'Human Resources',
  'Finance & Accounting',
  'Operations',
  'Sales & Marketing',
  'Customer Success',
  'Legal & Compliance',
  'Executive Leadership'
];

const EMPLOYEE_TYPES = [
  { value: 'FULL_TIME', label: 'Full-Time (Regular)' },
  { value: 'PART_TIME', label: 'Part-Time' },
  { value: 'CONTRACTOR', label: 'Contractor' },
  { value: 'INTERN', label: 'Intern' },
];

const REGIONS = [
  'North America',
  'APAC',
  'EMEA',
  'India',
  'Latin America',
  'Global'
];

export default function OnboardEmployeeModal({ onClose, onSuccess }: Props) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('Password@123');
  const [department, setDepartment] = useState('Engineering');
  const [designation, setDesignation] = useState('');
  const [employeeType, setEmployeeType] = useState('FULL_TIME');
  const [region, setRegion] = useState('North America');
  const [hireDate, setHireDate] = useState(new Date().toISOString().split('T')[0]);
  const [managerId, setManagerId] = useState<string>('');

  // Roles state: Employee is checked by default
  const [roles, setRoles] = useState<string[]>(['ROLE_EMPLOYEE']);

  const [managers, setManagers] = useState<UserSummary[]>([]);
  const [policies, setPolicies] = useState<LeavePolicyInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchInitialData();
  }, []);

  const fetchInitialData = async () => {
    try {
      const [mgrRes, polRes] = await Promise.all([
        api.get('/admin/employees/managers'),
        api.get('/admin/policies')
      ]);
      setManagers(mgrRes.data || []);
      setPolicies((polRes.data || []).filter((p: LeavePolicyInfo) => p.isActive !== false && p.policyStatus !== 'ARCHIVED'));
    } catch (err) {
      console.error('Failed to load managers or policies', err);
    }
  };

  const handleToggleRole = (role: string) => {
    if (role === 'ROLE_EMPLOYEE') return; // Cannot uncheck base role
    if (roles.includes(role)) {
      setRoles(roles.filter(r => r !== role));
    } else {
      setRoles([...roles, role]);
    }
  };

  const calculateProratedDays = (defaultDays: number, accrualRate?: number, frequency?: string, joinDateStr?: string) => {
    if (!joinDateStr || !defaultDays) return defaultDays || 0;
    const parts = joinDateStr.split('-').map(Number);
    const m = parts[1] || 1;
    if (frequency === 'MONTHLY' && accrualRate && accrualRate > 0) {
      const remainingMonths = Math.max(1, 12 - m + 1);
      return Math.min(defaultDays, Math.round(remainingMonths * accrualRate));
    }
    const [year, month, day] = parts;
    const join = new Date(year, month - 1, day);
    const start = new Date(year, 0, 1);
    const end = new Date(year, 11, 31);
    const totalDays = Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
    const remainingDays = Math.max(0, Math.round((end.getTime() - join.getTime()) / (1000 * 60 * 60 * 24)) + 1);
    if (remainingDays >= totalDays) return defaultDays;
    const prorated = defaultDays * (remainingDays / totalDays);
    return Math.max(1, Math.round(prorated));
  };

  const getMonth1Accrual = (defaultDays: number, accrualRate?: number, frequency?: string) => {
    if (frequency === 'MONTHLY' && accrualRate && accrualRate > 0) {
      return Math.round(accrualRate);
    }
    return Math.max(1, Math.round(defaultDays / 12));
  };

  // Filter policies applicable to selected role, region, and employee type
  const applicablePolicies = useMemo(() => {
    return policies.filter(p => {
      // Region check
      if (p.region && p.region !== 'ALL' && p.region !== 'Global' && region !== 'Global') {
        if (p.region.toLowerCase() !== region.toLowerCase()) return false;
      }
      // Employee Type check
      if (p.employeeType && p.employeeType !== 'ALL') {
        if (p.employeeType.toLowerCase() !== employeeType.toLowerCase()) return false;
      }
      return true;
    });
  }, [policies, region, employeeType]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!name.trim()) {
      setError('Please provide employee full name.');
      return;
    }
    if (!email.trim() || !email.includes('@')) {
      setError('Please provide a valid work email address.');
      return;
    }

    setLoading(true);
    try {
      const res = await api.post('/admin/employees/onboard', {
        name: name.trim(),
        email: email.trim().toLowerCase(),
        password: password.trim(),
        roles,
        managerId: managerId ? Number(managerId) : null,
        department,
        designation: designation.trim() || 'Team Member',
        employeeType,
        region,
        hireDate
      });
      onSuccess(res.data);
    } catch (err: any) {
      const msg = err.response?.data?.message || err.response?.data || err.message;
      setError(typeof msg === 'string' ? msg : 'Failed to onboard employee.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: 660, maxHeight: '90vh', overflowY: 'auto' }}>
        <div className="modal-header">
          <div>
            <h2 className="modal-title">👤 Onboard New Employee</h2>
            <div style={{ fontSize: 'var(--font-size-2xs)', color: 'var(--text-tertiary)', marginTop: 2 }}>
              Provision worker account with regional compliance and auto-calculated prorated benefits
            </div>
          </div>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>

        <div className="modal-body">
          {error && <div className="alert alert-error"><span>⚠</span> {error}</div>}

          <form onSubmit={handleSubmit}>
            {/* Section 1: Basic Credentials */}
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Full Name *</label>
                <input
                  type="text"
                  className="form-input"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder="e.g. Alex Morgan"
                  required
                />
              </div>
              <div className="form-group">
                <label className="form-label">Work Email *</label>
                <input
                  type="email"
                  className="form-input"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="e.g. alex.morgan@company.com"
                  required
                />
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Temporary Password</label>
                <input
                  type="text"
                  className="form-input"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="Password@123"
                  required
                />
                <div className="form-hint">Employee can change upon first login</div>
              </div>
              <div className="form-group">
                <label className="form-label">Hire Date / Join Date *</label>
                <input
                  type="date"
                  className="form-input"
                  value={hireDate}
                  onChange={e => setHireDate(e.target.value)}
                  required
                />
                <div className="form-hint" style={{ color: 'var(--wd-orange)', fontWeight: 600 }}>
                  ⚡ Balances will be strictly prorated from this join date
                </div>
              </div>
            </div>

            {/* Section 2: Roles Assignment */}
            <div className="form-group" style={{ marginTop: 8 }}>
              <label className="form-label">Role Assignment & System Privileges</label>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 10 }}>
                {[
                  { key: 'ROLE_EMPLOYEE', label: 'Employee', desc: 'Standard self-service', locked: true },
                  { key: 'ROLE_MANAGER', label: 'Manager', desc: 'Approve team requests' },
                  { key: 'ROLE_HR', label: 'HR Specialist', desc: 'Manage HR approvals' },
                  { key: 'ROLE_HR_ADMIN', label: 'HR Admin', desc: 'Full administration' }
                ].map(r => {
                  const isChecked = roles.includes(r.key);
                  return (
                    <div
                      key={r.key}
                      onClick={() => !r.locked && handleToggleRole(r.key)}
                      style={{
                        padding: '12px 14px',
                        borderRadius: 'var(--radius-md)',
                        border: isChecked ? '1.5px solid var(--wd-blue)' : '1px solid var(--border-default)',
                        background: isChecked ? 'var(--wd-blue-50)' : 'var(--bg-card)',
                        cursor: r.locked ? 'default' : 'pointer',
                        transition: 'all var(--transition-fast)'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <input
                          type="checkbox"
                          checked={isChecked}
                          disabled={r.locked}
                          onChange={() => {}}
                          style={{ accentColor: 'var(--wd-blue)' }}
                        />
                        <span style={{ fontWeight: 700, fontSize: 'var(--font-size-xs)', color: isChecked ? 'var(--wd-blue)' : 'var(--text-primary)' }}>
                          {r.label}
                        </span>
                      </div>
                      <div style={{ fontSize: '10px', color: 'var(--text-tertiary)', marginTop: 4 }}>
                        {r.desc}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Section 3: Hierarchy, Region & Department */}
            <div className="form-row" style={{ marginTop: 8 }}>
              <div className="form-group">
                <label className="form-label">Work Region / Location *</label>
                <select
                  className="form-select"
                  value={region}
                  onChange={e => setRegion(e.target.value)}
                  required
                >
                  {REGIONS.map(r => (
                    <option key={r} value={r}>{r}</option>
                  ))}
                </select>
                <div className="form-hint">Enforces regional holiday calendar & leave policies</div>
              </div>

              <div className="form-group">
                <label className="form-label">Department</label>
                <select
                  className="form-select"
                  value={department}
                  onChange={e => setDepartment(e.target.value)}
                >
                  {DEPARTMENTS.map(d => (
                    <option key={d} value={d}>{d}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Reporting Manager</label>
                <select
                  className="form-select"
                  value={managerId}
                  onChange={e => setManagerId(e.target.value)}
                >
                  <option value="">None (Direct to HR / Self-Managed)</option>
                  {managers.map(m => (
                    <option key={m.id} value={m.id}>
                      {m.name} ({m.roles.map(r => r.replace('ROLE_', '')).join(', ')})
                    </option>
                  ))}
                </select>
                <div className="form-hint">Approves Step 1 of employee leave requests</div>
              </div>

              <div className="form-group">
                <label className="form-label">Employment Type</label>
                <select
                  className="form-select"
                  value={employeeType}
                  onChange={e => setEmployeeType(e.target.value)}
                >
                  {EMPLOYEE_TYPES.map(t => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Designation / Job Title</label>
              <input
                type="text"
                className="form-input"
                value={designation}
                onChange={e => setDesignation(e.target.value)}
                placeholder="e.g. Senior Software Engineer"
              />
            </div>

            {/* Section 4: Auto-Calculated Proration Preview */}
            <div style={{
              background: 'var(--wd-blue-light)',
              border: '1px solid rgba(0, 85, 179, 0.2)',
              borderRadius: 'var(--radius-lg)',
              padding: '14px 16px',
              marginTop: 10,
              marginBottom: 16
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                <span style={{ fontSize: 'var(--font-size-xs)', fontWeight: 700, color: 'var(--wd-blue)' }}>
                  ⚡ Auto-Calculated Prorated Leave Benefits ({applicablePolicies.length} Policies)
                </span>
                <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--wd-orange)' }}>
                  Region: {region}
                </span>
              </div>
              <div style={{ fontSize: 'var(--font-size-2xs)', color: 'var(--text-secondary)', marginBottom: 8 }}>
                Based on join date <strong>{hireDate}</strong>, benefits are calculated proportionally for the remaining days of the annual period:
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 8 }}>
                {applicablePolicies.map(p => {
                  const proratedDays = calculateProratedDays(p.defaultDays, p.accrualRate, p.accrualFrequency, hireDate);
                  const month1Accrual = getMonth1Accrual(p.defaultDays, p.accrualRate, p.accrualFrequency);
                  return (
                    <div
                      key={p.id}
                      style={{
                        padding: '8px 10px',
                        borderRadius: 'var(--radius-md)',
                        background: 'white',
                        border: '1px solid rgba(0, 85, 179, 0.15)',
                        boxShadow: 'var(--shadow-xs)'
                      }}
                    >
                      <div style={{ fontWeight: 700, fontSize: '11px', color: 'var(--wd-blue)' }}>
                        {p.leaveType} Leave
                      </div>
                      <div style={{ fontSize: '13px', fontWeight: 800, color: 'var(--text-primary)', marginTop: 2 }}>
                        {proratedDays} Days <span style={{ fontSize: '10px', fontWeight: 500, color: 'var(--text-tertiary)' }}>(Total)</span>
                      </div>
                      <div style={{ fontSize: '10px', fontWeight: 600, color: 'var(--wd-green)', marginTop: 2 }}>
                        ⚡ {month1Accrual} Day{month1Accrual > 1 ? 's' : ''} Month 1 Accrual
                      </div>
                      <div style={{ fontSize: '10px', color: 'var(--text-tertiary)', marginTop: 2 }}>
                        Baseline: {p.defaultDays}d/yr ({p.accrualRate || 1}d/mo)
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="modal-footer" style={{ padding: 0, borderTop: 'none' }}>
              <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
              <button type="submit" className="btn btn-primary" disabled={loading}>
                {loading ? 'Onboarding Employee...' : '✓ Complete Onboarding with Prorated Benefits'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

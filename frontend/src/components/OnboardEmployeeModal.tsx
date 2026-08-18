import { useState, useEffect } from 'react';
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

export default function OnboardEmployeeModal({ onClose, onSuccess }: Props) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('Password@123');
  const [department, setDepartment] = useState('Engineering');
  const [designation, setDesignation] = useState('');
  const [employeeType, setEmployeeType] = useState('FULL_TIME');
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
      <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: 620, maxHeight: '90vh', overflowY: 'auto' }}>
        <div className="modal-header">
          <div>
            <h2 className="modal-title">👤 Onboard New Employee</h2>
            <div style={{ fontSize: 'var(--font-size-2xs)', color: 'var(--text-tertiary)', marginTop: 2 }}>
              Provision worker account, assign roles, and auto-initialize leave balances
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
                <div className="form-hint">Used for automatic join-date leave proration</div>
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

            {/* Section 3: Hierarchy & Organization */}
            <div className="form-row" style={{ marginTop: 8 }}>
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
                <label className="form-label">Designation / Job Title</label>
                <input
                  type="text"
                  className="form-input"
                  value={designation}
                  onChange={e => setDesignation(e.target.value)}
                  placeholder="e.g. Senior Software Engineer"
                />
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

            {/* Section 4: Auto-Provisioning Preview */}
            <div style={{
              background: 'var(--bg-subtle)',
              border: '1px solid var(--border-light)',
              borderRadius: 'var(--radius-lg)',
              padding: '12px 16px',
              marginTop: 10,
              marginBottom: 16
            }}>
              <div style={{ fontSize: 'var(--font-size-xs)', fontWeight: 700, color: 'var(--wd-blue)', marginBottom: 4 }}>
                ⚡ Automatic Leave Balance Provisioning
              </div>
              <div style={{ fontSize: 'var(--font-size-2xs)', color: 'var(--text-secondary)' }}>
                Upon onboarding, this employee will automatically receive prorated balances for {policies.length} active policies:
              </div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 8 }}>
                {policies.map(p => (
                  <span
                    key={p.id}
                    style={{
                      fontSize: '11px', fontWeight: 600, padding: '2px 8px',
                      borderRadius: 'var(--radius-full)', background: 'white',
                      border: '1px solid var(--border-default)', color: 'var(--text-primary)'
                    }}
                  >
                    {p.leaveType} ({p.defaultDays}d/yr · {p.isProrated !== false ? 'Prorated' : 'Full'})
                  </span>
                ))}
              </div>
            </div>

            <div className="modal-footer" style={{ padding: 0, borderTop: 'none' }}>
              <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
              <button type="submit" className="btn btn-primary" disabled={loading}>
                {loading ? 'Onboarding Employee...' : '✓ Complete Onboarding'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

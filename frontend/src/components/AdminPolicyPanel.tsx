import { useState, useEffect } from 'react';
import api, { API_BASE_URL } from '../api';
import type { LeavePolicyInfo } from '../types';

export default function AdminPolicyPanel() {
  const [policies, setPolicies] = useState<LeavePolicyInfo[]>([]);
  const [editing, setEditing] = useState<LeavePolicyInfo | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [viewTab, setViewTab] = useState<'active' | 'history'>('active');
  const [activeFormTab, setActiveFormTab] = useState<'basic' | 'eligibility' | 'accrual' | 'carryover' | 'workflow' | 'validation'>('basic');

  // Restart / Renew Policy Modal State
  const [restartPolicyTarget, setRestartPolicyTarget] = useState<LeavePolicyInfo | null>(null);
  const [restartStartDate, setRestartStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [restartEndDate, setRestartEndDate] = useState(
    new Date(new Date().setFullYear(new Date().getFullYear() + 1)).toISOString().split('T')[0]
  );
  const [isRestarting, setIsRestarting] = useState(false);

  // Simulation Tool State
  const [showSimulator, setShowSimulator] = useState(false);
  const [simEmpType, setSimEmpType] = useState('FULL_TIME');
  const [simTenure, setSimTenure] = useState(6);
  const [simLeaveType, setSimLeaveType] = useState('ANNUAL');
  const [simDays, setSimDays] = useState(3);
  const [simResult, setSimResult] = useState<any>(null);

  useEffect(() => {
    fetchPolicies();

    const token = localStorage.getItem('token');
    if (!token) return;

    const eventSource = new EventSource(`${API_BASE_URL}/events/subscribe?token=${encodeURIComponent(token)}`);
    eventSource.addEventListener('POLICY_UPDATE', () => {
      fetchPolicies();
    });

    return () => {
      eventSource.close();
    };
  }, []);

  const fetchPolicies = async () => {
    try {
      const res = await api.get('/admin/policies');
      setPolicies(res.data);
    } catch (err) {
      console.error('Failed to fetch policies', err);
    }
  };

  const activePolicies = policies.filter(p => p.isActive !== false && p.policyStatus !== 'ARCHIVED');
  const historyPolicies = policies.filter(p => p.isActive === false || p.policyStatus === 'ARCHIVED');

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editing) return;
    try {
      await api.post('/admin/policies', editing);
      fetchPolicies();
      setShowForm(false);
      setEditing(null);
    } catch (err) {
      alert('Failed to save policy.');
    }
  };

  const handleDelete = async (id: number, permanent: boolean = false) => {
    const msg = permanent
      ? '⚠️ Are you sure you want to permanently delete this policy from the database? This action CANNOT be undone.'
      : '📦 Move this policy to the Recycle Bin / Policy History? It will no longer apply to employees, but can be restored or re-modified later.';
    if (!confirm(msg)) return;
    try {
      await api.delete(`/admin/policies/${id}?permanent=${permanent}`);
      fetchPolicies();
    } catch (err) {
      alert('Failed to update policy status.');
    }
  };

  const handleRestore = async (id: number) => {
    if (!confirm('🔄 Restore this policy back to Active status? Eligible employees will have their balances re-synced.')) return;
    try {
      await api.post(`/admin/policies/${id}/restore`);
      fetchPolicies();
      setViewTab('active');
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to restore policy.');
    }
  };

  const handleRestartSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!restartPolicyTarget?.id) return;
    setIsRestarting(true);
    try {
      await api.post(`/admin/policies/${restartPolicyTarget.id}/restart`, {
        newStartDate: restartStartDate,
        newEndDate: restartEndDate
      });
      fetchPolicies();
      setRestartPolicyTarget(null);
      setViewTab('active');
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to restart policy.');
    } finally {
      setIsRestarting(false);
    }
  };

  const openCreate = () => {
    const today = new Date();
    const nextYear = new Date(today);
    nextYear.setFullYear(today.getFullYear() + 1);

    setEditing({
      policyName: 'New Leave Policy',
      leaveType: 'ANNUAL',
      effectiveDate: today.toISOString().split('T')[0],
      endDate: nextYear.toISOString().split('T')[0],
      isActive: true,
      policyStatus: 'ACTIVE',
      description: 'Standard company leave policy with configurable period and rules.',
      eligibleRole: 'ALL',
      employeeType: 'ALL',
      region: 'Global',
      tenureMonths: 0,
      department: 'All Departments',
      gradeLevel: 'All Grades',
      accrualRate: 2,
      accrualFrequency: 'MONTHLY',
      defaultDays: 24,
      allowNegativeBalance: false,
      maxNegativeLimit: 0,
      isProrated: true,
      prorationBasis: 'HIRE_DATE',
      prorationRounding: 'ROUND_UP',
      isCarryForwardAllowed: true,
      maxCarryForwardDays: 5,
      expirationMonths: 6,
      approvalStep1: 'MANAGER',
      approvalStep2: 'HR',
      approvalStep3: 'SKIP',
      preventOverlapWith: 'ANNUAL,SICK,CASUAL',
      preventExceedingLimit: true,
      allowSpecialExceptions: true
    });
    setActiveFormTab('basic');
    setShowForm(true);
  };

  const openEdit = (p: LeavePolicyInfo) => {
    setEditing({
      ...p,
      policyName: p.policyName || `${p.leaveType} Policy`,
      effectiveDate: p.effectiveDate || '2026-01-01',
      endDate: p.endDate || '2026-12-31',
      isActive: p.isActive ?? true,
      policyStatus: p.policyStatus || 'ACTIVE',
      description: p.description || 'Configured absence policy.',
      eligibleRole: p.eligibleRole || 'ALL',
      employeeType: p.employeeType || 'ALL',
      region: p.region || 'Global',
      tenureMonths: p.tenureMonths || 0,
      department: p.department || 'All Departments',
      gradeLevel: p.gradeLevel || 'All Grades',
      accrualRate: p.accrualRate ? Math.round(p.accrualRate) : 2,
      accrualFrequency: p.accrualFrequency || 'MONTHLY',
      allowNegativeBalance: p.allowNegativeBalance || false,
      maxNegativeLimit: p.maxNegativeLimit || 0,
      isProrated: p.isProrated ?? true,
      prorationBasis: p.prorationBasis || 'HIRE_DATE',
      prorationRounding: p.prorationRounding || 'ROUND_UP',
      expirationMonths: p.expirationMonths || 0,
      approvalStep1: p.approvalStep1 || 'MANAGER',
      approvalStep2: p.approvalStep2 || 'HR',
      approvalStep3: p.approvalStep3 || 'SKIP',
      preventOverlapWith: p.preventOverlapWith || 'ALL',
      preventExceedingLimit: p.preventExceedingLimit ?? true,
      allowSpecialExceptions: p.allowSpecialExceptions ?? true
    });
    setActiveFormTab('basic');
    setShowForm(true);
  };

  const runSimulation = () => {
    const matchedPolicy = activePolicies.find(p => p.leaveType === simLeaveType) || activePolicies[0];
    if (!matchedPolicy) {
      setSimResult({ success: false, reason: 'No active policy found for this category.' });
      return;
    }

    const isEligible = (matchedPolicy.employeeType === 'ALL' || matchedPolicy.employeeType === simEmpType) &&
      (simTenure >= (matchedPolicy.tenureMonths || 0));

    if (!isEligible) {
      setSimResult({
        success: false,
        policyName: matchedPolicy.policyName,
        reason: `Ineligible: Requires ${matchedPolicy.employeeType} employee type and minimum ${matchedPolicy.tenureMonths} months tenure.`
      });
      return;
    }

    const quota = matchedPolicy.defaultDays;
    const allowsNegative = matchedPolicy.allowNegativeBalance;
    const isWithinQuota = simDays <= quota || allowsNegative;

    setSimResult({
      success: isWithinQuota,
      policyName: matchedPolicy.policyName,
      quota,
      accrualRate: `${matchedPolicy.accrualRate} days / ${matchedPolicy.accrualFrequency?.toLowerCase()}`,
      carryover: matchedPolicy.isCarryForwardAllowed ? `Max ${matchedPolicy.maxCarryForwardDays} days (expires in ${matchedPolicy.expirationMonths} mos)` : 'Not allowed',
      workflow: [matchedPolicy.approvalStep1, matchedPolicy.approvalStep2, matchedPolicy.approvalStep3].filter(s => s && s !== 'SKIP').join(' ➔ '),
      overlapRule: matchedPolicy.preventOverlapWith,
      reason: isWithinQuota ? 'Eligible and valid for leave submission.' : 'Requested duration exceeds available quota.'
    });
  };

  const displayedPolicies = viewTab === 'active' ? activePolicies : historyPolicies;

  return (
    <>
      {/* Main Policy Configuration Table & Tools */}
      <div className="card animate-in">
        <div className="card-header">
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <h2 className="card-title" style={{ margin: 0 }}>Leave Management Policy Engine</h2>
              <span style={{
                background: 'var(--wd-green-light)',
                color: 'var(--wd-green)',
                fontSize: '12px',
                fontWeight: 700,
                padding: '3px 10px',
                borderRadius: 'var(--radius-full)',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px'
              }}>
                ● {activePolicies.length} Active {activePolicies.length === 1 ? 'Policy' : 'Policies'}
              </span>
            </div>
            <div className="card-subtitle" style={{ marginTop: '4px' }}>
              Dynamic policy configurations, validity periods (Start ➔ End), and historical renew options
            </div>
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            {/* Policy Simulator button (commented out as requested - uncomment when needed)
            <button className="btn btn-secondary" onClick={() => setShowSimulator(true)}>
              ⚡ Policy Simulator
            </button>
            */}
            <button className="btn btn-primary" onClick={openCreate}>
              ＋ Create Policy
            </button>
          </div>
        </div>

        {/* View Tabs: Active Policies vs History / Recycle Bin */}
        <div style={{
          display: 'flex',
          gap: '8px',
          padding: '12px 24px',
          borderBottom: '1px solid var(--border-default)',
          background: 'var(--bg-hover)'
        }}>
          <button
            className={`btn ${viewTab === 'active' ? 'btn-primary' : 'btn-secondary'} btn-sm`}
            onClick={() => setViewTab('active')}
          >
            🟢 Active Policies ({activePolicies.length})
          </button>
          <button
            className={`btn ${viewTab === 'history' ? 'btn-primary' : 'btn-secondary'} btn-sm`}
            onClick={() => setViewTab('history')}
          >
            🗑️ Recycle Bin & Policy History ({historyPolicies.length})
          </button>
        </div>

        <div className="card-body">
          {displayedPolicies.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-icon">{viewTab === 'active' ? '⚙️' : '🗑️'}</div>
              <div className="empty-state-text">
                {viewTab === 'active'
                  ? 'No active policies configured yet. Click "Create Policy" to build one.'
                  : 'Recycle Bin is empty. No archived or deleted policies.'}
              </div>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(420px, 1fr))', gap: '16px' }}>
              {displayedPolicies.map(p => (
                <div key={p.id} style={{
                  border: p.isActive === false ? '1.5px dashed var(--border-default)' : '1px solid var(--border-default)',
                  borderRadius: 'var(--radius-lg)',
                  padding: '20px',
                  background: p.isActive === false ? 'var(--bg-subtle)' : 'white',
                  boxShadow: 'var(--shadow-sm)',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  opacity: p.isActive === false ? 0.92 : 1
                }}>
                  <div>
                    {/* Policy Header */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
                          <span style={{
                            fontSize: '11px',
                            fontWeight: 700,
                            padding: '2px 8px',
                            borderRadius: 'var(--radius-full)',
                            background: 'var(--wd-blue-50)',
                            color: 'var(--wd-blue)'
                          }}>
                            {p.leaveType} LEAVE
                          </span>
                          {p.isActive === false && (
                            <span style={{
                              fontSize: '10px',
                              fontWeight: 700,
                              padding: '2px 8px',
                              borderRadius: 'var(--radius-full)',
                              background: '#fef2f2',
                              color: '#b91c1c',
                              border: '1px solid #fca5a5'
                            }}>
                              🗑️ IN RECYCLE BIN
                            </span>
                          )}
                        </div>
                        <h3 style={{ fontSize: 'var(--font-size-base)', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
                          {p.policyName || `${p.leaveType} Policy`}
                        </h3>
                      </div>

                      {/* Period Badge */}
                      <div style={{
                        textAlign: 'right',
                        padding: '4px 8px',
                        borderRadius: 'var(--radius-sm)',
                        background: 'var(--bg-hover)',
                        border: '1px solid var(--border-light)',
                        fontSize: '11px'
                      }}>
                        <div style={{ fontWeight: 700, color: 'var(--text-primary)' }}>
                          📅 Validity Period
                        </div>
                        <div style={{ color: 'var(--text-secondary)' }}>
                          {p.effectiveDate || '2026-01-01'} <span style={{ color: 'var(--text-tertiary)' }}>➔</span> {p.endDate || '2026-12-31'}
                        </div>
                      </div>
                    </div>

                    <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-secondary)', marginBottom: '14px' }}>
                      {p.description || 'Configured absence policy.'}
                    </p>

                    {/* Quick Specs Grid */}
                    <div style={{
                      display: 'grid',
                      gridTemplateColumns: '1fr 1fr',
                      gap: '8px',
                      background: 'var(--bg-hover)',
                      borderRadius: 'var(--radius-md)',
                      padding: '12px',
                      fontSize: 'var(--font-size-xs)',
                      marginBottom: '14px'
                    }}>
                      <div>
                        <strong style={{ color: 'var(--text-secondary)' }}>Eligibility:</strong><br />
                        <span>{p.eligibleRole && p.eligibleRole !== 'ALL' ? `${p.eligibleRole} · ` : ''}{p.employeeType || 'ALL'} · {p.region || 'Global'}</span>
                      </div>
                      <div>
                        <strong style={{ color: 'var(--text-secondary)' }}>Annual Quota:</strong><br />
                        <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{p.defaultDays} days/yr</span>
                      </div>
                      <div>
                        <strong style={{ color: 'var(--text-secondary)' }}>Accrual:</strong><br />
                        <span>{p.accrualRate || 2} d/{p.accrualFrequency?.toLowerCase() || 'mo'}</span>
                      </div>
                      <div>
                        <strong style={{ color: 'var(--text-secondary)' }}>Carryover:</strong><br />
                        <span>{p.isCarryForwardAllowed ? `Max ${p.maxCarryForwardDays}d (${p.expirationMonths || 6}m)` : 'None'}</span>
                      </div>
                    </div>

                    {/* Workflow Chain Preview */}
                    <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginBottom: '12px' }}>
                      <strong style={{ color: 'var(--text-primary)' }}>Approval Chain:</strong>{' '}
                      <span style={{ color: 'var(--wd-blue)', fontWeight: 600 }}>
                        {[p.approvalStep1 || 'MANAGER', p.approvalStep2 || 'HR', p.approvalStep3].filter(s => s && s !== 'SKIP').join(' ➔ ')}
                      </span>
                    </div>
                  </div>

                  {/* Footer Actions */}
                  <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    gap: '8px',
                    borderTop: '1px solid var(--border-light)',
                    paddingTop: '12px',
                    flexWrap: 'wrap'
                  }}>
                    {p.isActive === false ? (
                      <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                        <button
                          className="btn btn-primary btn-sm"
                          style={{ background: 'var(--wd-green)', borderColor: 'var(--wd-green)' }}
                          onClick={() => p.id && handleRestore(p.id)}
                          title="Restore this policy back to active status"
                        >
                          🔄 Restore Policy
                        </button>
                        <button
                          className="btn btn-secondary btn-sm"
                          onClick={() => {
                            setRestartPolicyTarget(p);
                            setRestartStartDate(new Date().toISOString().split('T')[0]);
                            const d = new Date();
                            d.setFullYear(d.getFullYear() + 1);
                            setRestartEndDate(d.toISOString().split('T')[0]);
                          }}
                          title="Restart or renew this policy for a new time period"
                        >
                          🚀 Restart from New Date
                        </button>
                      </div>
                    ) : (
                      <div />
                    )}

                    <div style={{ display: 'flex', gap: '6px' }}>
                      <button className="btn btn-secondary btn-sm" onClick={() => openEdit(p)} title="Edit policy parameters and configuration">
                        ✏️ Edit / Modify
                      </button>
                      {p.id && (
                        p.isActive !== false ? (
                          <button
                            className="btn btn-danger btn-sm"
                            onClick={() => handleDelete(p.id!, false)}
                            title="Move this policy to the Recycle Bin / History"
                          >
                            📦 Move to Bin
                          </button>
                        ) : (
                          <button
                            className="btn btn-danger btn-sm"
                            onClick={() => handleDelete(p.id!, true)}
                            title="Permanently remove from database forever"
                          >
                            🗑️ Delete Permanently
                          </button>
                        )
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Restart / Renew Policy Modal */}
      {restartPolicyTarget && (
        <div className="modal-overlay" onClick={() => setRestartPolicyTarget(null)}>
          <div className="modal-content" style={{ maxWidth: '520px' }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <div>
                <h2 className="modal-title">🔄 Restart / Renew Policy from History</h2>
                <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-secondary)' }}>
                  Launch a new active validity period for <strong>{restartPolicyTarget.policyName}</strong>
                </div>
              </div>
              <button className="modal-close" onClick={() => setRestartPolicyTarget(null)}>✕</button>
            </div>
            <div className="modal-body">
              <form onSubmit={handleRestartSubmit}>
                <div style={{
                  padding: '12px',
                  borderRadius: 'var(--radius-md)',
                  background: 'var(--wd-blue-50)',
                  border: '1px solid rgba(8, 117, 225, 0.15)',
                  fontSize: 'var(--font-size-xs)',
                  marginBottom: '16px'
                }}>
                  <strong>Original Policy Configuration:</strong><br />
                  • Category: {restartPolicyTarget.leaveType} Leave ({restartPolicyTarget.defaultDays} days/yr)<br />
                  • Previous Period: {restartPolicyTarget.effectiveDate} ➔ {restartPolicyTarget.endDate || 'Past'}
                </div>

                <div className="form-group">
                  <label className="form-label">New Period Start Date</label>
                  <input
                    type="date"
                    className="form-input"
                    value={restartStartDate}
                    onChange={e => setRestartStartDate(e.target.value)}
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">New Period End Date</label>
                  <input
                    type="date"
                    className="form-input"
                    value={restartEndDate}
                    onChange={e => setRestartEndDate(e.target.value)}
                    required
                  />
                </div>

                <div className="modal-footer" style={{ padding: 0, borderTop: 'none', marginTop: 16 }}>
                  <button type="button" className="btn btn-secondary" onClick={() => setRestartPolicyTarget(null)}>
                    Cancel
                  </button>
                  <button type="submit" className="btn btn-primary" disabled={isRestarting}>
                    {isRestarting ? 'Restarting…' : '🚀 Activate New Period'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Dynamic Policy Editor Modal */}
      {showForm && editing && (
        <div className="modal-overlay" onClick={() => setShowForm(false)}>
          <div className="modal-content" style={{ maxWidth: '780px' }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <div>
                <h2 className="modal-title">{editing.id ? 'Edit' : 'Create'} Dynamic Leave Policy</h2>
                <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-secondary)' }}>
                  Leave Management Policy Configuration Engine
                </div>
              </div>
              <button className="modal-close" onClick={() => setShowForm(false)}>✕</button>
            </div>

            {/* Navigation Tabs for Configuration Sections */}
            <div style={{
              display: 'flex',
              overflowX: 'auto',
              borderBottom: '1px solid var(--border-default)',
              padding: '0 20px',
              background: 'var(--bg-hover)'
            }}>
              {[
                { id: 'basic', label: '1. Basic Info & Period' },
                { id: 'eligibility', label: '2. Eligibility' },
                { id: 'accrual', label: '3. Accrual & Proration' },
                { id: 'carryover', label: '4. Carryover' },
                { id: 'workflow', label: '5. Workflow' },
                { id: 'validation', label: '6. Validation' }
              ].map(t => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setActiveFormTab(t.id as any)}
                  style={{
                    padding: '10px 14px',
                    border: 'none',
                    background: 'none',
                    borderBottom: activeFormTab === t.id ? '2px solid var(--wd-blue)' : '2px solid transparent',
                    color: activeFormTab === t.id ? 'var(--wd-blue)' : 'var(--text-secondary)',
                    fontWeight: activeFormTab === t.id ? 700 : 500,
                    fontSize: 'var(--font-size-xs)',
                    cursor: 'pointer',
                    whiteSpace: 'nowrap'
                  }}
                >
                  {t.label}
                </button>
              ))}
            </div>

            <div className="modal-body" style={{ maxHeight: '65vh', overflowY: 'auto' }}>
              <form onSubmit={handleSave}>
                {/* 1. Basic & Policy Info */}
                {activeFormTab === 'basic' && (
                  <div>
                    <h4 style={{ margin: '0 0 12px 0', fontSize: 'var(--font-size-sm)', color: 'var(--wd-blue)' }}>1. Policy Name & Validity Period</h4>
                    <div className="form-group">
                      <label className="form-label">Policy Name</label>
                      <input
                        type="text"
                        className="form-input"
                        value={editing.policyName}
                        onChange={e => setEditing({ ...editing, policyName: e.target.value })}
                        placeholder="e.g. Global Standard Annual Leave"
                        required
                      />
                    </div>
                    <div className="form-row">
                      <div className="form-group">
                        <label className="form-label">Leave Category</label>
                        <select className="form-select" value={editing.leaveType} onChange={e => setEditing({ ...editing, leaveType: e.target.value })}>
                          <option value="ANNUAL">Annual Leave</option>
                          <option value="SICK">Sick / Medical Leave</option>
                          <option value="CASUAL">Casual Leave</option>
                          <option value="EARNED">Earned / Privilege Leave</option>
                          <option value="MATERNITY">Maternity Leave</option>
                          <option value="PATERNITY">Paternity Leave</option>
                          <option value="UNPAID">Unpaid Leave</option>
                        </select>
                      </div>
                      <div className="form-group">
                        <label className="form-label">Status</label>
                        <select className="form-select" value={editing.policyStatus || 'ACTIVE'} onChange={e => {
                          const val = e.target.value;
                          setEditing({ ...editing, policyStatus: val, isActive: val === 'ACTIVE' });
                        }}>
                          <option value="ACTIVE">🟢 Active</option>
                          <option value="EXPIRED">🔴 Expired</option>
                          <option value="ARCHIVED">⚪ Archived</option>
                        </select>
                      </div>
                    </div>

                    <div className="form-row">
                      <div className="form-group">
                        <label className="form-label">Period Start Date (Effective From)</label>
                        <input
                          type="date"
                          className="form-input"
                          value={editing.effectiveDate || '2026-01-01'}
                          onChange={e => setEditing({ ...editing, effectiveDate: e.target.value })}
                          required
                        />
                      </div>
                      <div className="form-group">
                        <label className="form-label">Period End Date (Valid To)</label>
                        <input
                          type="date"
                          className="form-input"
                          value={editing.endDate || '2026-12-31'}
                          onChange={e => setEditing({ ...editing, endDate: e.target.value })}
                          required
                        />
                      </div>
                    </div>

                    <div className="form-group">
                      <label className="form-label">Policy Description</label>
                      <textarea
                        className="form-textarea"
                        value={editing.description || ''}
                        onChange={e => setEditing({ ...editing, description: e.target.value })}
                        placeholder="Detail the scope and purpose of this policy…"
                      />
                    </div>
                  </div>
                )}

                {/* 2. Dynamic Eligibility */}
                {activeFormTab === 'eligibility' && (
                  <div>
                    <h4 style={{ margin: '0 0 12px 0', fontSize: 'var(--font-size-sm)', color: 'var(--wd-blue)' }}>2. Dynamic Eligibility Combinations</h4>
                    <div className="form-group">
                      <label className="form-label">Eligible Roles</label>
                      <select className="form-select" value={editing.eligibleRole || 'ALL'} onChange={e => setEditing({ ...editing, eligibleRole: e.target.value })}>
                        <option value="ALL">All Roles (Employees, Managers, HR, Admins)</option>
                        <option value="EMPLOYEE">Employees Only (Individual Contributors)</option>
                        <option value="MANAGER">Managers Only</option>
                        <option value="HR">HR Staff & Specialists Only</option>
                        <option value="HR_ADMIN">HR Admins Only</option>
                        <option value="EMPLOYEE_MANAGER">Employees & Managers</option>
                      </select>
                    </div>
                    <div className="form-row">
                      <div className="form-group">
                        <label className="form-label">Employee Type</label>
                        <select className="form-select" value={editing.employeeType || 'ALL'} onChange={e => setEditing({ ...editing, employeeType: e.target.value })}>
                          <option value="ALL">All Employee Types</option>
                          <option value="FULL_TIME">Full-Time Only</option>
                          <option value="PART_TIME">Part-Time Only</option>
                          <option value="CONTRACT">Contractors</option>
                        </select>
                      </div>
                      <div className="form-group">
                        <label className="form-label">Region / Territory</label>
                        <select className="form-select" value={editing.region || 'Global'} onChange={e => setEditing({ ...editing, region: e.target.value })}>
                          <option value="Global">Global (All Regions)</option>
                          <option value="North America">North America (US / CA)</option>
                          <option value="APAC">APAC</option>
                          <option value="India">India</option>
                          <option value="EMEA">EMEA / Europe</option>
                        </select>
                      </div>
                    </div>
                    <div className="form-row">
                      <div className="form-group">
                        <label className="form-label">Minimum Tenure (Months)</label>
                        <input
                          type="number"
                          className="form-input"
                          min={0}
                          value={editing.tenureMonths ?? 0}
                          onChange={e => setEditing({ ...editing, tenureMonths: Number(e.target.value) })}
                        />
                        <span className="form-hint">0 = eligible immediately upon joining</span>
                      </div>
                      <div className="form-group">
                        <label className="form-label">Target Department</label>
                        <select className="form-select" value={editing.department || 'All Departments'} onChange={e => setEditing({ ...editing, department: e.target.value })}>
                          <option value="All Departments">All Departments</option>
                          <option value="Engineering">Engineering & Tech</option>
                          <option value="HR">Human Resources</option>
                          <option value="Sales">Sales & Marketing</option>
                          <option value="Operations">Operations</option>
                        </select>
                      </div>
                    </div>
                  </div>
                )}

                {/* 3. Accrual & Proration Rules */}
                {activeFormTab === 'accrual' && (
                  <div>
                    <h4 style={{ margin: '0 0 12px 0', fontSize: 'var(--font-size-sm)', color: 'var(--wd-blue)' }}>3. Accrual & Proration Rules (Editable Anytime)</h4>
                    <div className="form-row">
                      <div className="form-group">
                        <label className="form-label">Baseline Annual Quota (Days / Year)</label>
                        <input
                          type="number"
                          className="form-input"
                          value={editing.defaultDays}
                          onChange={e => setEditing({ ...editing, defaultDays: Number(e.target.value) })}
                          min={0}
                          required
                        />
                      </div>
                      <div className="form-group">
                        <label className="form-label">Accrual Frequency</label>
                        <select className="form-select" value={editing.accrualFrequency || 'MONTHLY'} onChange={e => setEditing({ ...editing, accrualFrequency: e.target.value })}>
                          <option value="MONTHLY">Monthly Accrual</option>
                          <option value="ANNUAL">Annual Lump-Sum</option>
                        </select>
                      </div>
                    </div>
                    <div className="form-row">
                      <div className="form-group">
                        <label className="form-label">Accrual Rate (Days per Period)</label>
                        <input
                          type="number"
                          step="0.01"
                          className="form-input"
                          value={editing.accrualRate ?? 1.67}
                          onChange={e => setEditing({ ...editing, accrualRate: Number(e.target.value) })}
                          min={0}
                        />
                      </div>
                      <div className="form-group">
                        <label className="form-label">Negative Balance Option</label>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', height: '40px' }}>
                          <input
                            type="checkbox"
                            id="negBal"
                            checked={editing.allowNegativeBalance || false}
                            onChange={e => setEditing({ ...editing, allowNegativeBalance: e.target.checked })}
                          />
                          <label htmlFor="negBal" style={{ margin: 0, fontSize: 'var(--font-size-xs)' }}>Allow Negative Balance (Advance Quota)</label>
                        </div>
                      </div>
                    </div>
                    {editing.allowNegativeBalance && (
                      <div className="form-group">
                        <label className="form-label">Max Negative Limit (Days)</label>
                        <input
                          type="number"
                          className="form-input"
                          value={editing.maxNegativeLimit ?? 3}
                          onChange={e => setEditing({ ...editing, maxNegativeLimit: Number(e.target.value) })}
                          min={0}
                        />
                      </div>
                    )}

                    {/* Proration Configuration Logic */}
                    <div style={{
                      marginTop: '16px',
                      padding: '16px',
                      borderRadius: 'var(--radius-md)',
                      background: 'var(--bg-hover)',
                      border: '1px solid var(--border-default)'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                        <input
                          type="checkbox"
                          id="isProrated"
                          checked={editing.isProrated ?? true}
                          onChange={e => setEditing({ ...editing, isProrated: e.target.checked })}
                        />
                        <label htmlFor="isProrated" style={{ margin: 0, fontWeight: 700, fontSize: 'var(--font-size-sm)', color: 'var(--text-primary)' }}>
                          ⚖️ Enable Automated Balance Proration
                        </label>
                      </div>

                      {editing.isProrated !== false && (
                        <div>
                          <div className="form-row">
                            <div className="form-group">
                              <label className="form-label">Proration Basis</label>
                              <select
                                className="form-select"
                                value={editing.prorationBasis || 'HIRE_DATE'}
                                onChange={e => setEditing({ ...editing, prorationBasis: e.target.value })}
                              >
                                <option value="HIRE_DATE">Employee Join Date (Hire Date)</option>
                                <option value="POLICY_PERIOD">Policy Active Window (Period Start ➔ End)</option>
                                <option value="FTE_HOURS">Part-Time FTE / Working Hours Ratio</option>
                              </select>
                            </div>
                            <div className="form-group">
                              <label className="form-label">Rounding Rule</label>
                              <select
                                className="form-select"
                                value={editing.prorationRounding || 'ROUND_HALF'}
                                onChange={e => setEditing({ ...editing, prorationRounding: e.target.value })}
                              >
                                <option value="ROUND_HALF">Round to Nearest Half Day (0.5) — Standard</option>
                                <option value="ROUND_UP">Round Up to Nearest Whole Day (1.0)</option>
                                <option value="ROUND_DOWN">Round Down (Floor Whole Day)</option>
                                <option value="EXACT">Exact Decimals (No Rounding)</option>
                              </select>
                            </div>
                          </div>

                          <div style={{
                            padding: '10px 12px',
                            borderRadius: 'var(--radius-sm)',
                            background: 'var(--wd-blue-50)',
                            fontSize: '11px',
                            color: 'var(--wd-blue)',
                            marginTop: '8px'
                          }}>
                            💡 <strong>Proration Formula:</strong> Prorated Quota = Baseline Quota × (Remaining Active Days / Total Cycle Days).<br />
                            <em>e.g. An employee joining on July 1st with a {editing.defaultDays || 20}-day quota receives {((editing.defaultDays || 20) / 2).toFixed(1)} days for their remaining 6 months.</em>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* 4. Carryover Rules */}
                {activeFormTab === 'carryover' && (
                  <div>
                    <h4 style={{ margin: '0 0 12px 0', fontSize: 'var(--font-size-sm)', color: 'var(--wd-blue)' }}>4. Carryover & Rollover Rules</h4>
                    <div className="form-group" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <input
                        type="checkbox"
                        id="carryForward"
                        checked={editing.isCarryForwardAllowed}
                        onChange={e => setEditing({ ...editing, isCarryForwardAllowed: e.target.checked })}
                      />
                      <label htmlFor="carryForward" className="form-label" style={{ marginBottom: 0 }}>Allow Unused Balance Carryover to Next Year</label>
                    </div>

                    {editing.isCarryForwardAllowed && (
                      <div className="form-row">
                        <div className="form-group">
                          <label className="form-label">Max Carryover (Days)</label>
                          <input
                            type="number"
                            className="form-input"
                            value={editing.maxCarryForwardDays}
                            onChange={e => setEditing({ ...editing, maxCarryForwardDays: Number(e.target.value) })}
                            min={0}
                          />
                        </div>
                        <div className="form-group">
                          <label className="form-label">Expiration Window (Months)</label>
                          <select className="form-select" value={editing.expirationMonths ?? 6} onChange={e => setEditing({ ...editing, expirationMonths: Number(e.target.value) })}>
                            <option value={3}>3 Months</option>
                            <option value={6}>6 Months</option>
                            <option value={12}>12 Months (Full Year)</option>
                            <option value={0}>No Expiration</option>
                          </select>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* 5. Approval Workflow Chain */}
                {activeFormTab === 'workflow' && (
                  <div>
                    <h4 style={{ margin: '0 0 12px 0', fontSize: 'var(--font-size-sm)', color: 'var(--wd-blue)' }}>5. Configurable Approval Workflow Chain</h4>
                    <div className="form-row">
                      <div className="form-group">
                        <label className="form-label">Step 1 Approver</label>
                        <select className="form-select" value={editing.approvalStep1 || 'MANAGER'} onChange={e => setEditing({ ...editing, approvalStep1: e.target.value })}>
                          <option value="MANAGER">Direct Manager (Standard)</option>
                          <option value="HR">HR Specialist</option>
                          <option value="AUTO_APPROVE">Auto-Approve (No review)</option>
                        </select>
                      </div>
                      <div className="form-group">
                        <label className="form-label">Step 2 Approver</label>
                        <select className="form-select" value={editing.approvalStep2 || 'HR'} onChange={e => setEditing({ ...editing, approvalStep2: e.target.value })}>
                          <option value="HR">HR Review (Standard)</option>
                          <option value="ADMIN">HR Admin</option>
                          <option value="SKIP">Skip Step 2</option>
                        </select>
                      </div>
                      <div className="form-group">
                        <label className="form-label">Step 3 Approver</label>
                        <select className="form-select" value={editing.approvalStep3 || 'SKIP'} onChange={e => setEditing({ ...editing, approvalStep3: e.target.value })}>
                          <option value="SKIP">Skip Step 3</option>
                          <option value="ADMIN">HR Admin Signoff</option>
                        </select>
                      </div>
                    </div>
                    <div className="alert alert-info" style={{ fontSize: '11px' }}>
                      ℹ️ Note: If the applicant is an HR member, Step 2/3 automatically elevates to <strong>HR Admin</strong> to guarantee unbiased compliance.
                    </div>
                  </div>
                )}

                {/* 6. Validation Rules */}
                {activeFormTab === 'validation' && (
                  <div>
                    <h4 style={{ margin: '0 0 12px 0', fontSize: 'var(--font-size-sm)', color: 'var(--wd-blue)' }}>6. Validation & Policy Guardrails</h4>
                    <div className="form-group">
                      <label className="form-label">Prevent Overlapping With</label>
                      <select className="form-select" value={editing.preventOverlapWith || 'ALL'} onChange={e => setEditing({ ...editing, preventOverlapWith: e.target.value })}>
                        <option value="ALL">All Other Active Leaves</option>
                        <option value="ANNUAL,SICK,CASUAL">Annual, Sick, & Casual Leaves</option>
                        <option value="ANNUAL">Annual Leave Only</option>
                      </select>
                    </div>
                    <div className="form-group" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <input
                        type="checkbox"
                        id="preventExceed"
                        checked={editing.preventExceedingLimit ?? true}
                        onChange={e => setEditing({ ...editing, preventExceedingLimit: e.target.checked })}
                      />
                      <label htmlFor="preventExceed" style={{ margin: 0, fontSize: 'var(--font-size-xs)' }}>Prevent Submissions Exceeding Available Balance Limit</label>
                    </div>
                    <div className="form-group" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <input
                        type="checkbox"
                        id="allowExcept"
                        checked={editing.allowSpecialExceptions ?? true}
                        onChange={e => setEditing({ ...editing, allowSpecialExceptions: e.target.checked })}
                      />
                      <label htmlFor="allowExcept" style={{ margin: 0, fontSize: 'var(--font-size-xs)' }}>Allow HR Admin Exceptions for Special Circumstances</label>
                    </div>
                  </div>
                )}

                <div className="modal-footer" style={{ padding: '16px 0 0 0', borderTop: '1px solid var(--border-light)', marginTop: '20px', display: 'flex', justifyContent: 'space-between' }}>
                  <button type="button" className="btn btn-secondary" onClick={() => setShowForm(false)}>Cancel</button>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button type="submit" className="btn btn-primary">Save Policy Configuration</button>
                  </div>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Policy Simulation Tool Modal (commented out as requested - uncomment when needed)
      {showSimulator && (
        <div className="modal-overlay" onClick={() => setShowSimulator(false)}>
          <div className="modal-content" style={{ maxWidth: '640px' }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <div>
                <h2 className="modal-title">⚡ Policy Simulation Engine</h2>
                <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-secondary)' }}>
                  Test policy eligibility, accrual rates, and validation gates before deploying
                </div>
              </div>
              <button className="modal-close" onClick={() => setShowSimulator(false)}>✕</button>
            </div>
            <div className="modal-body">
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Employee Type</label>
                  <select className="form-select" value={simEmpType} onChange={e => setSimEmpType(e.target.value)}>
                    <option value="FULL_TIME">Full-Time</option>
                    <option value="PART_TIME">Part-Time</option>
                    <option value="CONTRACT">Contractor</option>
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Tenure (Months)</label>
                  <input type="number" className="form-input" value={simTenure} onChange={e => setSimTenure(Number(e.target.value))} min={0} />
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Target Leave Category</label>
                  <select className="form-select" value={simLeaveType} onChange={e => setSimLeaveType(e.target.value)}>
                    <option value="ANNUAL">Annual Leave</option>
                    <option value="SICK">Sick Leave</option>
                    <option value="CASUAL">Casual Leave</option>
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Requested Days</label>
                  <input type="number" className="form-input" value={simDays} onChange={e => setSimDays(Number(e.target.value))} min={1} />
                </div>
              </div>

              <button type="button" className="btn btn-primary" style={{ width: '100%', marginBottom: '16px' }} onClick={runSimulation}>
                🚀 Run Simulation
              </button>

              {simResult && (
                <div style={{
                  padding: '14px',
                  borderRadius: 'var(--radius-md)',
                  background: simResult.success ? 'var(--wd-green-light)' : 'var(--wd-orange-light)',
                  border: `1px solid ${simResult.success ? 'var(--wd-green)' : 'var(--wd-orange)'}`,
                  fontSize: 'var(--font-size-xs)'
                }}>
                  <div style={{ fontWeight: 700, fontSize: 'var(--font-size-sm)', color: simResult.success ? 'var(--wd-green)' : 'var(--wd-orange)', marginBottom: '6px' }}>
                    {simResult.success ? '✓ Simulation Passed' : '⚠ Simulation Flagged'}
                  </div>
                  <div><strong>Matched Policy:</strong> {simResult.policyName}</div>
                  <div><strong>Outcome:</strong> {simResult.reason}</div>
                  {simResult.quota && <div><strong>Available Quota:</strong> {simResult.quota} days/yr ({simResult.accrualRate})</div>}
                  {simResult.carryover && <div><strong>Carryover:</strong> {simResult.carryover}</div>}
                  {simResult.workflow && <div><strong>Approval Path:</strong> {simResult.workflow}</div>}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
      */}
    </>
  );
}

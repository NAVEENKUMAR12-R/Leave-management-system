import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../AuthContext';
import api from '../api';
import type { TimeOffResponse, UserSummary, LeaveBalanceInfo } from '../types';
import ExtendLeaveModal from './ExtendLeaveModal';

type HistoryScope = 'MY' | 'TEAM' | 'ORG';

export default function LeaveHistory() {
  const { user, hasRole } = useAuth();
  const isHR = hasRole('ROLE_HR') || hasRole('ROLE_HR_ADMIN');
  const isManager = hasRole('ROLE_MANAGER');

  // Default active tab
  const [activeTab, setActiveTab] = useState<HistoryScope>('MY');

  // Data states
  const [leaves, setLeaves] = useState<TimeOffResponse[]>([]);
  const [employees, setEmployees] = useState<UserSummary[]>([]);
  const [balances, setBalances] = useState<LeaveBalanceInfo[]>([]);
  const [extendingLeave, setExtendingLeave] = useState<TimeOffResponse | null>(null);
  const [loading, setLoading] = useState(true);

  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string>('ALL');
  const [selectedType, setSelectedType] = useState<string>('ALL');
  const [selectedPayStatus, setSelectedPayStatus] = useState<string>('ALL');
  const [selectedStatus, setSelectedStatus] = useState<string>('ALL');

  useEffect(() => {
    fetchDataForScope(activeTab);
  }, [activeTab]);

  const fetchDataForScope = async (scope: HistoryScope) => {
    setLoading(true);
    setSearchTerm('');
    setSelectedEmployeeId('ALL');
    setSelectedType('ALL');
    setSelectedPayStatus('ALL');
    setSelectedStatus('ALL');

    try {
      const balRes = await api.get('/leaves/my-balances');
      setBalances(balRes.data || []);

      if (scope === 'MY') {
        const res = await api.get('/leaves/history/my');
        setLeaves(res.data);
        setEmployees([]);
      } else if (scope === 'TEAM') {
        const [leavesRes, teamRes] = await Promise.all([
          api.get('/leaves/history/team'),
          api.get('/leaves/team-members')
        ]);
        setLeaves(leavesRes.data);
        setEmployees(teamRes.data || []);
      } else if (scope === 'ORG') {
        const [leavesRes, empRes] = await Promise.all([
          api.get('/leaves/history/organization'),
          api.get('/leaves/employees')
        ]);
        setLeaves(leavesRes.data);
        setEmployees(empRes.data || []);
      }
    } catch (err) {
      console.error('Failed to load leave history', err);
    } finally {
      setLoading(false);
    }
  };

  // Filtered leaves
  const filteredLeaves = useMemo(() => {
    return leaves.filter(l => {
      // Search term
      if (searchTerm) {
        const term = searchTerm.toLowerCase();
        const matchesName = (l.workerName || '').toLowerCase().includes(term);
        const matchesType = (l.timeOffType || '').toLowerCase().includes(term);
        const matchesWorkerId = (l.workerId || '').toLowerCase().includes(term);
        if (!matchesName && !matchesType && !matchesWorkerId) return false;
      }

      // Employee Filter
      if (selectedEmployeeId !== 'ALL') {
        if (l.workerId !== selectedEmployeeId) return false;
      }

      // Leave Type Filter
      if (selectedType !== 'ALL') {
        if (l.timeOffType !== selectedType) return false;
      }

      // Pay Status Filter
      if (selectedPayStatus === 'PAID') {
        if (l.isCompanySponsored === false) return false;
      } else if (selectedPayStatus === 'UNPAID') {
        if (l.isCompanySponsored !== false) return false;
      }

      // Approval Status Filter
      if (selectedStatus !== 'ALL') {
        if (l.routingStatus !== selectedStatus) return false;
      }

      return true;
    });
  }, [leaves, searchTerm, selectedEmployeeId, selectedType, selectedPayStatus, selectedStatus]);

  // Aggregate Stats
  const stats = useMemo(() => {
    const totalRequests = filteredLeaves.length;
    const approvedLeaves = filteredLeaves.filter(l => l.routingStatus === 'APPROVED');
    const totalApprovedDays = approvedLeaves.reduce((acc, curr) => acc + (curr.totalQuantity || 0), 0);
    const paidDays = approvedLeaves
      .filter(l => l.isCompanySponsored !== false)
      .reduce((acc, curr) => acc + (curr.totalQuantity || 0), 0);
    const unpaidDays = approvedLeaves
      .filter(l => l.isCompanySponsored === false)
      .reduce((acc, curr) => acc + (curr.totalQuantity || 0), 0);

    return {
      totalRequests,
      approvedLeavesCount: approvedLeaves.length,
      totalApprovedDays,
      paidDays,
      unpaidDays,
    };
  }, [filteredLeaves]);

  const withdrawLeave = async (id: number) => {
    if (!confirm('Are you sure you want to withdraw this leave request?')) return;
    try {
      await api.put(`/leaves/${id}/withdraw`);
      fetchDataForScope(activeTab);
    } catch {
      alert('Failed to withdraw leave request.');
    }
  };

  const getInitials = (name: string) =>
    name ? name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) : '?';

  const getTypeColor = (type: string) => {
    switch (type.toUpperCase()) {
      case 'ANNUAL': return 'var(--wd-blue)';
      case 'SICK': return 'var(--wd-green)';
      case 'CASUAL': return 'var(--wd-orange)';
      case 'EARNED': return 'var(--wd-purple)';
      default: return 'var(--wd-blue)';
    }
  };

  const tabItems: { key: HistoryScope; label: string; icon: string; show: boolean }[] = [
    { key: 'MY', label: 'My History', icon: '👤', show: true },
    { key: 'TEAM', label: 'Team History', icon: '👥', show: isManager },
    { key: 'ORG', label: 'Organization', icon: '🏢', show: isHR },
  ];

  return (
    <>
      {/* Scope Navigation Tabs */}
      {(isManager || isHR) && (
        <div style={{
          display: 'flex', gap: 6, marginBottom: 24,
          background: 'var(--bg-card)', padding: '6px',
          borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-default)',
          width: 'fit-content', boxShadow: 'var(--shadow-xs)'
        }}>
          {tabItems.filter(t => t.show).map(t => (
            <button
              key={t.key}
              className="btn"
              onClick={() => setActiveTab(t.key)}
              style={{
                background: activeTab === t.key ? 'var(--wd-blue-gradient)' : 'transparent',
                color: activeTab === t.key ? 'white' : 'var(--text-secondary)',
                boxShadow: activeTab === t.key ? 'var(--shadow-blue)' : 'none',
                padding: '8px 16px', fontSize: 'var(--font-size-sm)',
                borderRadius: 'var(--radius-md)'
              }}
            >
              {t.icon} {t.label}
            </button>
          ))}
        </div>
      )}

      {/* Overview Stat Cards */}
      <div className="stats-grid animate-in">
        <div className="stat-card blue">
          <div className="stat-label">
            {activeTab === 'MY' ? 'My Leave Requests' : activeTab === 'TEAM' ? 'Team Requests' : 'Total Requests'}
          </div>
          <div className="stat-value">{stats.totalRequests}</div>
        </div>
        <div className="stat-card green">
          <div className="stat-label">Approved Paid Days</div>
          <div className="stat-value">{stats.paidDays} <span style={{ fontSize: 'var(--font-size-sm)', fontWeight: 500 }}>days</span></div>
        </div>
        <div className="stat-card red">
          <div className="stat-label">Unpaid (LOP) Days</div>
          <div className="stat-value">{stats.unpaidDays} <span style={{ fontSize: 'var(--font-size-sm)', fontWeight: 500 }}>days</span></div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Approved Requests</div>
          <div className="stat-value">{stats.approvedLeavesCount}</div>
        </div>
      </div>

      {/* Main Leave Records Card */}
      <div className="card animate-in animate-in-1">
        <div className="card-header">
          <div>
            <div className="card-title">
              {activeTab === 'MY'
                ? 'My Personal Leave History'
                : activeTab === 'TEAM'
                  ? 'Direct Subordinates\' Leave History'
                  : 'All Organization Employees\' Leave History'}
            </div>
            <div className="card-subtitle">
              {activeTab === 'MY'
                ? 'All your past and upcoming leave applications'
                : activeTab === 'TEAM'
                  ? 'Leave records of employees who report directly to you'
                  : 'Complete leave records across all departments'}
            </div>
          </div>
          <button className="btn btn-secondary btn-sm" onClick={() => fetchDataForScope(activeTab)}>
            🔄 Refresh
          </button>
        </div>

        {/* Filter Controls Bar */}
        <div style={{
          padding: '14px 24px',
          background: 'var(--bg-subtle)',
          borderBottom: '1px solid var(--border-default)',
          display: 'flex',
          flexWrap: 'wrap',
          gap: '10px',
          alignItems: 'center'
        }}>
          {/* Search Box */}
          <div style={{ flex: '1 1 200px' }}>
            <input
              type="text"
              className="form-input"
              style={{ marginBottom: 0 }}
              placeholder={activeTab === 'MY' ? "🔍 Search by category…" : "🔍 Search employee name or category…"}
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
            />
          </div>

          {/* Subordinate / Employee Dropdown for Team & Org scope */}
          {activeTab !== 'MY' && employees.length > 0 && (
            <div style={{ minWidth: '200px' }}>
              <select
                className="form-select"
                style={{ marginBottom: 0 }}
                value={selectedEmployeeId}
                onChange={e => setSelectedEmployeeId(e.target.value)}
              >
                <option value="ALL">
                  {activeTab === 'TEAM' ? `👥 All Subordinates (${employees.length})` : `👥 All Employees (${employees.length})`}
                </option>
                {employees.map(emp => (
                  <option key={emp.id} value={emp.id.toString()}>
                    {emp.name} ({emp.email})
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Leave Type Filter */}
          <div style={{ minWidth: '140px' }}>
            <select
              className="form-select"
              style={{ marginBottom: 0 }}
              value={selectedType}
              onChange={e => setSelectedType(e.target.value)}
            >
              <option value="ALL">All Categories</option>
              <option value="ANNUAL">Annual Leave</option>
              <option value="SICK">Sick Leave</option>
              <option value="CASUAL">Casual Leave</option>
              <option value="EARNED">Earned Leave</option>
              <option value="UNPAID">Unpaid Leave</option>
            </select>
          </div>

          {/* Pay Status Filter */}
          <div style={{ minWidth: '140px' }}>
            <select
              className="form-select"
              style={{ marginBottom: 0 }}
              value={selectedPayStatus}
              onChange={e => setSelectedPayStatus(e.target.value)}
            >
              <option value="ALL">All Pay</option>
              <option value="PAID">● Paid</option>
              <option value="UNPAID">○ Unpaid (LOP)</option>
            </select>
          </div>

          {/* Routing Status Filter */}
          <div style={{ minWidth: '140px' }}>
            <select
              className="form-select"
              style={{ marginBottom: 0 }}
              value={selectedStatus}
              onChange={e => setSelectedStatus(e.target.value)}
            >
              <option value="ALL">All Statuses</option>
              <option value="APPROVED">Approved</option>
              <option value="PENDING_MANAGER">Pending Manager</option>
              <option value="PENDING_HR">Pending HR</option>
              <option value="REJECTED">Rejected</option>
              <option value="WITHDRAWN">Withdrawn</option>
            </select>
          </div>
        </div>

        {/* Records Table */}
        <div className="card-body-compact">
          {loading ? (
            <div className="empty-state">
              <div style={{
                width: 32, height: 32, border: '3px solid var(--border-default)',
                borderTopColor: 'var(--wd-blue)', borderRadius: '50%',
                animation: 'spin 0.8s linear infinite', margin: '0 auto 12px'
              }} />
              <div className="empty-state-text">Loading leave records…</div>
              <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
            </div>
          ) : filteredLeaves.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-icon">📋</div>
              <div className="empty-state-text">
                {activeTab === 'MY'
                  ? 'You have no leave records matching the filters.'
                  : activeTab === 'TEAM'
                    ? 'No subordinates have leave records matching the filters.'
                    : 'No organization leave records match the filters.'}
              </div>
            </div>
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>Employee</th>
                  <th>Leave Category</th>
                  <th>Date Range</th>
                  <th>Days</th>
                  <th>Pay Status</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredLeaves.map(l => {
                  const isOwner = user?.id?.toString() === l.workerId;
                  const isPending = l.routingStatus === 'PENDING_MANAGER' || l.routingStatus === 'PENDING_HR';
                  const typeColor = getTypeColor(l.timeOffType);

                  return (
                    <tr key={l.id}>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <span style={{
                            width: 30, height: 30, borderRadius: '50%',
                            background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)',
                            color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontSize: 'var(--font-size-2xs)', fontWeight: 700, flexShrink: 0
                          }}>
                            {getInitials(l.workerName || '')}
                          </span>
                          <div>
                            <div style={{ fontWeight: 600, fontSize: 'var(--font-size-sm)' }}>
                              {l.workerName || `Worker #${l.workerId}`}
                            </div>
                            {isOwner && (
                              <span style={{ fontSize: 'var(--font-size-2xs)', color: 'var(--wd-blue)', fontWeight: 600 }}>
                                (You)
                              </span>
                            )}
                          </div>
                        </div>
                      </td>
                      <td>
                        <span style={{
                          fontWeight: 700, padding: '3px 10px', borderRadius: 'var(--radius-full)',
                          fontSize: 'var(--font-size-xs)',
                          background: `${typeColor}10`, color: typeColor,
                          border: `1px solid ${typeColor}20`
                        }}>
                          {l.timeOffType}
                        </span>
                      </td>
                      <td style={{ fontWeight: 500, fontSize: 'var(--font-size-sm)' }}>
                        {l.startDate} <span style={{ color: 'var(--text-tertiary)' }}>→</span> {l.endDate}
                      </td>
                      <td style={{ fontWeight: 700 }}>
                        {l.totalQuantity}
                      </td>
                      <td>
                        <span style={{
                          display: 'inline-flex', alignItems: 'center', gap: '4px',
                          padding: '3px 10px', borderRadius: 'var(--radius-full)',
                          fontSize: 'var(--font-size-xs)', fontWeight: 600,
                          background: l.isCompanySponsored !== false ? 'var(--wd-green-light)' : 'var(--wd-orange-light)',
                          color: l.isCompanySponsored !== false ? 'var(--wd-green)' : 'var(--wd-orange)'
                        }}>
                          {l.isCompanySponsored !== false ? '● Paid' : '○ LOP'}
                        </span>
                      </td>
                      <td>
                        <span className={`status-badge status-${l.routingStatus.toLowerCase()}`}>
                          {l.routingStatus.replace('_', ' ')}
                        </span>
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                          {isOwner && (l.routingStatus === 'APPROVED' || isPending) && (
                            <button
                              type="button"
                              className="btn btn-primary btn-sm"
                              onClick={() => setExtendingLeave(l)}
                              style={{ padding: '3px 8px', fontSize: '11px', display: 'inline-flex', alignItems: 'center', gap: 3 }}
                              title="Extend leave request"
                            >
                              🔄 Extend
                            </button>
                          )}
                          {isOwner && isPending && (
                            <button
                              type="button"
                              className="btn btn-secondary btn-sm"
                              onClick={() => withdrawLeave(l.id)}
                              style={{ padding: '3px 8px', fontSize: '11px' }}
                              title="Withdraw request"
                            >
                              Withdraw
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {extendingLeave && (
        <ExtendLeaveModal
          leave={extendingLeave}
          balances={balances}
          onClose={() => setExtendingLeave(null)}
          onExtended={() => {
            setExtendingLeave(null);
            fetchDataForScope(activeTab);
          }}
        />
      )}
    </>
  );
}

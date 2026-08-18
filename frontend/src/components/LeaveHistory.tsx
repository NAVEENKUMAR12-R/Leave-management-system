import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../AuthContext';
import api from '../api';
import type { TimeOffResponse, UserSummary } from '../types';

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
    } catch (err) {
      alert('Failed to withdraw leave request.');
    }
  };

  return (
    <>
      {/* Scope Navigation Tabs for Managers & HR */}
      {(isManager || isHR) && (
        <div style={{
          display: 'flex',
          gap: '8px',
          marginBottom: '20px',
          borderBottom: '1px solid var(--border-default)',
          paddingBottom: '12px'
        }}>
          <button
            className={`btn ${activeTab === 'MY' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setActiveTab('MY')}
          >
            👤 My Personal History
          </button>

          {isManager && (
            <button
              className={`btn ${activeTab === 'TEAM' ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setActiveTab('TEAM')}
            >
              👥 My Subordinates & Team History
            </button>
          )}

          {isHR && (
            <button
              className={`btn ${activeTab === 'ORG' ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setActiveTab('ORG')}
            >
              🏢 Company-Wide Employee History
            </button>
          )}
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
          <div className="stat-value">{stats.paidDays} <span style={{ fontSize: '0.875rem', fontWeight: 500 }}>days</span></div>
        </div>
        <div className="stat-card red">
          <div className="stat-label">Unpaid (LOP) Days</div>
          <div className="stat-value">{stats.unpaidDays} <span style={{ fontSize: '0.875rem', fontWeight: 500 }}>days</span></div>
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
                ? 'Direct Subordinates’ Leave History'
                : 'All Organization Employees’ Leave History'}
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
          padding: '16px 24px',
          background: 'var(--bg-hover)',
          borderBottom: '1px solid var(--border-default)',
          display: 'flex',
          flexWrap: 'wrap',
          gap: '12px',
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
          <div style={{ minWidth: '160px' }}>
            <select
              className="form-select"
              style={{ marginBottom: 0 }}
              value={selectedPayStatus}
              onChange={e => setSelectedPayStatus(e.target.value)}
            >
              <option value="ALL">All Pay Statuses</option>
              <option value="PAID">● Paid (Salary Credited)</option>
              <option value="UNPAID">○ Unpaid (No Salary / LOP)</option>
            </select>
          </div>

          {/* Routing Status Filter */}
          <div style={{ minWidth: '150px' }}>
            <select
              className="form-select"
              style={{ marginBottom: 0 }}
              value={selectedStatus}
              onChange={e => setSelectedStatus(e.target.value)}
            >
              <option value="ALL">All Approval Statuses</option>
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
              <div className="empty-state-icon">⏳</div>
              <div className="empty-state-text">Loading leave records…</div>
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
                  <th>Working Days</th>
                  <th>Pay Status</th>
                  <th>Workflow Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredLeaves.map(l => {
                  const isOwner = user?.id?.toString() === l.workerId;
                  const isPending = l.routingStatus === 'PENDING_MANAGER' || l.routingStatus === 'PENDING_HR';

                  return (
                    <tr key={l.id}>
                      <td>
                        <div style={{ fontWeight: 700, color: 'var(--text-primary)' }}>
                          {l.workerName || `Worker #${l.workerId}`}
                        </div>
                        {isOwner && (
                          <span style={{ fontSize: '10px', color: 'var(--wd-blue)', fontWeight: 600 }}>
                            (You)
                          </span>
                        )}
                      </td>
                      <td>
                        <span style={{
                          fontWeight: 600,
                          padding: '3px 8px',
                          borderRadius: 'var(--radius-sm)',
                          background: 'var(--bg-hover)',
                          fontSize: 'var(--font-size-xs)'
                        }}>
                          {l.timeOffType}
                        </span>
                      </td>
                      <td>
                        <div style={{ fontSize: 'var(--font-size-sm)', fontWeight: 500 }}>
                          {l.startDate} <span style={{ color: 'var(--text-tertiary)' }}>→</span> {l.endDate}
                        </div>
                      </td>
                      <td style={{ fontWeight: 700 }}>
                        {l.totalQuantity} {l.totalQuantity === 1 ? 'day' : 'days'}
                      </td>
                      <td>
                        <span style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px',
                          padding: '3px 10px',
                          borderRadius: 'var(--radius-full)',
                          fontSize: 'var(--font-size-xs)',
                          fontWeight: 600,
                          background: l.isCompanySponsored !== false ? 'var(--wd-green-light)' : 'var(--wd-orange-light)',
                          color: l.isCompanySponsored !== false ? 'var(--wd-green)' : 'var(--wd-orange)'
                        }}>
                          {l.isCompanySponsored !== false ? '● Company Sponsored (Paid)' : '○ Unpaid (No Salary / LOP)'}
                        </span>
                      </td>
                      <td>
                        <span className={`status-badge status-${l.routingStatus.toLowerCase()}`}>
                          {l.routingStatus.replace('_', ' ')}
                        </span>
                      </td>
                      <td>
                        {isOwner && isPending && (
                          <button
                            className="btn btn-secondary btn-sm"
                            onClick={() => withdrawLeave(l.id)}
                            title="Withdraw request"
                          >
                            Withdraw
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </>
  );
}

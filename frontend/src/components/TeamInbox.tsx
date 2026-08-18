import { useState, useEffect } from 'react';
import { useAuth } from '../AuthContext';
import api from '../api';
import type { TimeOffResponse, DashboardStats } from '../types';

export default function TeamInbox() {
  const { hasRole } = useAuth();
  const [tab, setTab] = useState<'pending' | 'all'>('pending');
  const [pendingLeaves, setPendingLeaves] = useState<TimeOffResponse[]>([]);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [dateFilter, setDateFilter] = useState(new Date().toISOString().split('T')[0]);
  const [viewMode, setViewMode] = useState<'day' | 'week' | 'month'>('day');

  const isHR = hasRole('ROLE_HR') || hasRole('ROLE_HR_ADMIN');

  const [allLeaves, setAllLeaves] = useState<TimeOffResponse[]>([]);

  useEffect(() => {
    fetchPendingLeaves();
    fetchStats();
  }, [dateFilter, tab]);

  const fetchPendingLeaves = async () => {
    try {
      if (tab === 'pending') {
        const res = await api.get('/leaves/pending-approvals');
        setPendingLeaves(res.data);
      } else {
        const res = await api.get('/leaves/history');
        setAllLeaves(res.data);
      }
    } catch (err) {
      console.error('Failed to fetch inbox leaves', err);
    }
  };

  const fetchStats = async () => {
    try {
      const res = await api.get(`/dashboard/stats?date=${dateFilter}`);
      setStats(res.data);
    } catch (err) {
      console.error('Failed to fetch stats', err);
    }
  };

  const processLeave = async (id: number, action: 'APPROVE' | 'REJECT') => {
    try {
      await api.put(`/leaves/${id}/process`, { action });
      fetchPendingLeaves();
      fetchStats();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to process leave.');
    }
  };

  // Generate week range for week mode
  const getWeekLabel = () => {
    const d = new Date(dateFilter);
    const day = d.getDay();
    const start = new Date(d);
    start.setDate(d.getDate() - day);
    const end = new Date(start);
    end.setDate(start.getDate() + 6);
    return `${start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} – ${end.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;
  };

  return (
    <>
      {/* Stats Overview */}
      <div className="stats-grid animate-in">
        <div className="stat-card blue">
          <div className="stat-label">Total Team</div>
          <div className="stat-value">{stats?.totalEmployees ?? '–'}</div>
        </div>
        <div className="stat-card green">
          <div className="stat-label">Present Today</div>
          <div className="stat-value">{stats?.employeesPresent ?? '–'}</div>
        </div>
        <div className="stat-card red">
          <div className="stat-label">On Leave</div>
          <div className="stat-value">{stats?.employeesOnLeave ?? '–'}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Pending Approvals</div>
          <div className="stat-value">{pendingLeaves.length}</div>
        </div>
      </div>

      {/* Date & View Controls */}
      <div className="card animate-in animate-in-1" style={{ marginBottom: 24 }}>
        <div className="card-header">
          <div>
            <div className="card-title">Team Availability</div>
            <div className="card-subtitle">
              {viewMode === 'day' && new Date(dateFilter).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
              {viewMode === 'week' && getWeekLabel()}
              {viewMode === 'month' && new Date(dateFilter).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <div className="tabs" style={{ marginBottom: 0, borderBottom: 'none' }}>
              {(['day', 'week', 'month'] as const).map(m => (
                <button key={m} className={`tab ${viewMode === m ? 'active' : ''}`} onClick={() => setViewMode(m)}>{m.charAt(0).toUpperCase() + m.slice(1)}</button>
              ))}
            </div>
            <input type="date" className="form-input" style={{ width: 'auto', marginBottom: 0 }} value={dateFilter} onChange={e => setDateFilter(e.target.value)} />
          </div>
        </div>
        <div className="card-body">
          {stats?.onLeaveNames && stats.onLeaveNames.length > 0 ? (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {stats.onLeaveNames.map((name, i) => (
                <span key={i} style={{ background: 'var(--wd-red-light)', color: 'var(--wd-red)', padding: '6px 14px', borderRadius: 'var(--radius-full)', fontSize: 'var(--font-size-sm)', fontWeight: 600 }}>{name}</span>
              ))}
            </div>
          ) : (
            <div className="empty-state" style={{ padding: '20px 0' }}>
              <div className="empty-state-text">All team members are available on this date ✓</div>
            </div>
          )}
        </div>
      </div>

      {/* Pending Approvals Inbox */}
      <div className="card animate-in animate-in-2">
        <div className="card-header">
          <div>
            <div className="card-title">Inbox — Leave Requests</div>
            <div className="card-subtitle">{pendingLeaves.length} request{pendingLeaves.length !== 1 ? 's' : ''} awaiting your action</div>
          </div>
          <div className="tabs" style={{ marginBottom: 0, borderBottom: 'none' }}>
            <button className={`tab ${tab === 'pending' ? 'active' : ''}`} onClick={() => setTab('pending')}>Pending</button>
            <button className={`tab ${tab === 'all' ? 'active' : ''}`} onClick={() => setTab('all')}>All</button>
          </div>
        </div>
        <div className="card-body-compact">
          {(() => {
            const displayLeaves = tab === 'pending' ? pendingLeaves : allLeaves;
            if (displayLeaves.length === 0) {
              return (
                <div className="empty-state">
                  <div className="empty-state-icon">✅</div>
                  <div className="empty-state-text">
                    {tab === 'pending' ? 'All caught up! No pending requests.' : 'No processed requests found.'}
                  </div>
                </div>
              );
            }
            return (
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Employee</th>
                    <th>Type</th>
                    <th>Date Range</th>
                    <th>Days</th>
                    <th>Pay Status</th>
                    <th>Workflow Stage</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {displayLeaves.map(l => {
                    const isPending = l.routingStatus === 'PENDING_MANAGER' || l.routingStatus === 'PENDING_HR' || l.routingStatus === 'PENDING_ADMIN';
                    return (
                      <tr key={l.id}>
                        <td style={{ fontWeight: 600 }}>{l.workerName || `Worker #${l.workerId}`}</td>
                        <td>
                          <span style={{ fontWeight: 600, padding: '2px 8px', borderRadius: 'var(--radius-sm)', background: 'var(--bg-hover)', fontSize: 'var(--font-size-xs)' }}>
                            {l.timeOffType}
                          </span>
                        </td>
                        <td>{l.startDate} → {l.endDate}</td>
                        <td style={{ fontWeight: 700 }}>{l.totalQuantity} {l.totalQuantity === 1 ? 'day' : 'days'}</td>
                        <td>
                          <span style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                            padding: '3px 8px',
                            borderRadius: 'var(--radius-full)',
                            fontSize: 'var(--font-size-xs)',
                            fontWeight: 600,
                            background: l.isCompanySponsored !== false ? 'var(--wd-green-light)' : 'var(--wd-orange-light)',
                            color: l.isCompanySponsored !== false ? 'var(--wd-green)' : 'var(--wd-orange)'
                          }}>
                            {l.isCompanySponsored !== false ? '● Paid (Salary Credited)' : '○ Unpaid (No Salary / LOP)'}
                          </span>
                        </td>
                        <td>
                          <span className={`status-badge status-${l.routingStatus.toLowerCase()}`}>
                            {l.routingStatus === 'PENDING_ADMIN' ? 'Pending Admin (HR Request)' : l.routingStatus.replace('_', ' ')}
                          </span>
                        </td>
                        <td>
                          {isPending ? (
                            <div className="table-actions">
                              <button className="btn btn-success btn-sm" onClick={() => processLeave(l.id, 'APPROVE')}>Approve</button>
                              <button className="btn btn-danger btn-sm" onClick={() => processLeave(l.id, 'REJECT')}>Deny</button>
                            </div>
                          ) : (
                            <span style={{ fontSize: '11px', color: 'var(--text-tertiary)' }}>Completed</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            );
          })()}
        </div>
      </div>
    </>
  );
}

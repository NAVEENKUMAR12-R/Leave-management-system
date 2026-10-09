import { useState, useEffect } from 'react';
import { useAuth } from '../AuthContext';
import api, { API_BASE_URL } from '../api';
import type { TimeOffResponse, DashboardStats } from '../types';

export default function TeamInbox() {
  const { hasRole } = useAuth();
  const [tab, setTab] = useState<'pending' | 'all'>('pending');
  const [pendingLeaves, setPendingLeaves] = useState<TimeOffResponse[]>([]);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const getTodayLocal = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  };
  const [dateFilter, setDateFilter] = useState(getTodayLocal);
  const [viewMode, setViewMode] = useState<'day' | 'week' | 'month'>('day');
  const [allLeaves, setAllLeaves] = useState<TimeOffResponse[]>([]);
  const [processing, setProcessing] = useState<number | null>(null);

  useEffect(() => {
    fetchPendingLeaves();
    fetchStats();

    const token = localStorage.getItem('token');
    if (!token) return;

    const eventSource = new EventSource(`${API_BASE_URL}/events/subscribe?token=${encodeURIComponent(token)}`);
    eventSource.addEventListener('LEAVE_UPDATE', () => {
      fetchPendingLeaves();
      fetchStats();
    });

    return () => {
      eventSource.close();
    };
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
    setProcessing(id);
    try {
      await api.put(`/leaves/${id}/process`, { action });
      fetchPendingLeaves();
      fetchStats();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to process leave.');
    } finally {
      setProcessing(null);
    }
  };

  const getDateObj = (dStr: string) => {
    const [y, m, d] = dStr.split('-').map(Number);
    return new Date(y, m - 1, d);
  };

  // Generate week range for week mode
  const getWeekLabel = () => {
    const d = getDateObj(dateFilter);
    const day = d.getDay();
    const start = new Date(d);
    start.setDate(d.getDate() - day);
    const end = new Date(start);
    end.setDate(start.getDate() + 6);
    return `${start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} – ${end.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;
  };

  const getInitials = (name: string) =>
    name ? name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) : '?';

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
          <div className="stat-value" style={{ color: pendingLeaves.length > 0 ? 'var(--wd-orange)' : 'var(--text-primary)' }}>
            {pendingLeaves.length}
          </div>
        </div>
      </div>

      {/* Date & View Controls */}
      <div className="card animate-in animate-in-1" style={{ marginBottom: 24 }}>
        <div className="card-header">
          <div>
            <div className="card-title">Team Availability</div>
            <div className="card-subtitle">
              {viewMode === 'day' && getDateObj(dateFilter).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
              {viewMode === 'week' && getWeekLabel()}
              {viewMode === 'month' && getDateObj(dateFilter).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
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
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
              {stats.onLeaveNames.map((name, i) => (
                <div key={i} style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  background: 'var(--wd-red-light)', padding: '6px 14px 6px 8px',
                  borderRadius: 'var(--radius-full)', fontSize: 'var(--font-size-sm)', fontWeight: 600, color: 'var(--wd-red)'
                }}>
                  <span style={{
                    width: 24, height: 24, borderRadius: '50%', background: 'var(--wd-red)',
                    color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 'var(--font-size-2xs)', fontWeight: 700
                  }}>
                    {getInitials(name)}
                  </span>
                  {name}
                </div>
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
                  <div className="empty-state-icon">{tab === 'pending' ? '✅' : '📂'}</div>
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
                    <th>Reason</th>
                    <th>Pay Status</th>
                    <th>Workflow Stage</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {displayLeaves.map(l => {
                    const isPending = l.routingStatus === 'PENDING_MANAGER' || l.routingStatus === 'PENDING_HR' || l.routingStatus === 'PENDING_ADMIN';
                    const isProcessingThis = processing === l.id;
                    return (
                      <tr key={l.id}>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <span style={{
                              width: 32, height: 32, borderRadius: '50%',
                              background: 'linear-gradient(135deg, #0875e1, #6b46c1)',
                              color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center',
                              fontSize: 'var(--font-size-2xs)', fontWeight: 700, flexShrink: 0
                            }}>
                              {getInitials(l.workerName || '')}
                            </span>
                            <span style={{ fontWeight: 600 }}>{l.workerName || `Worker #${l.workerId}`}</span>
                          </div>
                        </td>
                        <td>
                          <span style={{
                            fontWeight: 700, padding: '3px 10px', borderRadius: 'var(--radius-full)',
                            background: 'var(--bg-hover)', fontSize: 'var(--font-size-xs)'
                          }}>
                            {l.timeOffType}
                          </span>
                        </td>
                        <td style={{ fontWeight: 500 }}>{l.startDate} → {l.endDate}</td>
                        <td style={{ fontWeight: 700 }}>{l.totalQuantity} {l.totalQuantity === 1 ? 'day' : 'days'}</td>
                        <td>
                          <div style={{
                            maxWidth: 200,
                            fontSize: 'var(--font-size-xs)',
                            color: 'var(--text-secondary)',
                            lineHeight: 1.4,
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap'
                          }} title={l.reason || 'No reason provided'}>
                            {l.reason ? (
                              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                                <span style={{ opacity: 0.7 }}>💬</span> {l.reason}
                              </span>
                            ) : (
                              <span style={{ color: 'var(--text-tertiary)', fontStyle: 'italic' }}>— None —</span>
                            )}
                          </div>
                        </td>
                        <td>
                          <span style={{
                            display: 'inline-flex', alignItems: 'center', gap: '4px',
                            padding: '3px 10px', borderRadius: 'var(--radius-full)',
                            fontSize: 'var(--font-size-xs)', fontWeight: 600,
                            background: l.isCompanySponsored !== false ? 'var(--wd-green-light)' : 'var(--wd-orange-light)',
                            color: l.isCompanySponsored !== false ? 'var(--wd-green)' : 'var(--wd-orange)'
                          }}>
                            {l.isCompanySponsored !== false ? '● Paid' : '○ Unpaid (LOP)'}
                          </span>
                        </td>
                        <td>
                          <span className={`status-badge status-${l.routingStatus.toLowerCase()}`}>
                            {l.routingStatus === 'PENDING_ADMIN' ? 'Pending Admin' : l.routingStatus.replace('_', ' ')}
                          </span>
                        </td>
                        <td>
                          {isPending ? (
                            <div className="table-actions">
                              <button
                                className="btn btn-success btn-sm"
                                onClick={() => processLeave(l.id, 'APPROVE')}
                                disabled={isProcessingThis}
                              >
                                {isProcessingThis ? '...' : 'Approve'}
                              </button>
                              <button
                                className="btn btn-danger btn-sm"
                                onClick={() => processLeave(l.id, 'REJECT')}
                                disabled={isProcessingThis}
                              >
                                Deny
                              </button>
                            </div>
                          ) : (
                            <span style={{ fontSize: 'var(--font-size-2xs)', color: 'var(--text-tertiary)', fontWeight: 500 }}>Completed</span>
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

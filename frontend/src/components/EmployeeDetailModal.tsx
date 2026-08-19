import { useState, useEffect } from 'react';
import api from '../api';
import type { UserSummary, TimeOffResponse } from '../types';

interface Props {
  employee: UserSummary;
  onClose: () => void;
}

export default function EmployeeDetailModal({ employee, onClose }: Props) {
  const [leaves, setLeaves] = useState<TimeOffResponse[]>([]);
  const [loadingLeaves, setLoadingLeaves] = useState(true);

  useEffect(() => {
    fetchEmployeeLeaves();
  }, [employee.id]);

  const fetchEmployeeLeaves = async () => {
    setLoadingLeaves(true);
    try {
      const res = await api.get(`/leaves/history/user/${employee.id}`);
      setLeaves(res.data || []);
    } catch (err) {
      console.error('Failed to load user leave history', err);
    } finally {
      setLoadingLeaves(false);
    }
  };

  const getInitials = (name: string) => {
    if (!name) return 'U';
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  const getTypeColor = (type: string) => {
    switch (type.toUpperCase()) {
      case 'ANNUAL': return 'var(--wd-blue)';
      case 'SICK': return 'var(--wd-green)';
      case 'CASUAL': return 'var(--wd-orange)';
      case 'EARNED': return 'var(--wd-purple)';
      default: return 'var(--wd-blue)';
    }
  };

  const totalAllocated = employee.totalPtoAllocated ?? 0;
  const totalUsed = employee.totalPtoUsed ?? 0;
  const totalAvailable = employee.totalPtoAvailable ?? 0;
  const totalUnpaid = employee.totalUnpaidDays ?? 0;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: 840, maxHeight: '90vh', overflowY: 'auto' }}>
        
        {/* Header */}
        <div className="modal-header" style={{ paddingBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <div style={{
              width: 52, height: 52, borderRadius: '50%',
              background: 'linear-gradient(135deg, #0055b3, #0284c7)',
              color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontWeight: 800, fontSize: '1.15rem', flexShrink: 0,
              boxShadow: '0 4px 12px rgba(0, 85, 179, 0.25)'
            }}>
              {getInitials(employee.name)}
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <h2 className="modal-title" style={{ margin: 0 }}>{employee.name}</h2>
                <span style={{
                  fontSize: '11px', fontWeight: 600, padding: '2px 8px',
                  borderRadius: 'var(--radius-full)', background: 'var(--bg-subtle)',
                  border: '1px solid var(--border-light)', color: 'var(--text-secondary)'
                }}>
                  ID #{employee.id}
                </span>
              </div>
              <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-secondary)', marginTop: 3, display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                <span>📧 {employee.email}</span>
                <span>🏢 {employee.department || 'General'}</span>
                <span>💼 {employee.designation || 'Team Member'}</span>
                <span>📅 Hired: {employee.hireDate || '2026-01-01'}</span>
              </div>
            </div>
          </div>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>

        <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          
          {/* Key Leave & PTO Metrics */}
          <div>
            <div style={{ fontSize: 'var(--font-size-xs)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-tertiary)', marginBottom: 10 }}>
              📊 Leave & Time Off Overview
            </div>
            <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 12 }}>
              
              <div className="stat-card blue" style={{ padding: '12px 16px' }}>
                <div className="stat-label">Total PTO Allocated</div>
                <div className="stat-value" style={{ fontSize: '1.4rem' }}>
                  {totalAllocated} <span style={{ fontSize: 'var(--font-size-xs)', fontWeight: 500 }}>days</span>
                </div>
                <div style={{ fontSize: '10px', color: 'var(--text-tertiary)', marginTop: 2 }}>Annual paid leave quota</div>
              </div>

              <div className="stat-card green" style={{ padding: '12px 16px' }}>
                <div className="stat-label">Available PTO</div>
                <div className="stat-value" style={{ fontSize: '1.4rem', color: 'var(--wd-green)' }}>
                  {totalAvailable} <span style={{ fontSize: 'var(--font-size-xs)', fontWeight: 500 }}>days</span>
                </div>
                <div style={{ fontSize: '10px', color: 'var(--text-tertiary)', marginTop: 2 }}>Accrued & ready to use</div>
              </div>

              <div className="stat-card" style={{ padding: '12px 16px', borderLeft: '4px solid var(--wd-orange)' }}>
                <div className="stat-label">PTO Used</div>
                <div className="stat-value" style={{ fontSize: '1.4rem', color: 'var(--wd-orange)' }}>
                  {totalUsed} <span style={{ fontSize: 'var(--font-size-xs)', fontWeight: 500 }}>days</span>
                </div>
                <div style={{ fontSize: '10px', color: 'var(--text-tertiary)', marginTop: 2 }}>Approved paid leaves</div>
              </div>

              <div className="stat-card red" style={{ padding: '12px 16px' }}>
                <div className="stat-label">Non-Paid Off (LOP)</div>
                <div className="stat-value" style={{ fontSize: '1.4rem', color: totalUnpaid > 0 ? 'var(--wd-red)' : 'var(--text-secondary)' }}>
                  {totalUnpaid} <span style={{ fontSize: 'var(--font-size-xs)', fontWeight: 500 }}>days</span>
                </div>
                <div style={{ fontSize: '10px', color: 'var(--text-tertiary)', marginTop: 2 }}>Unpaid leave of absence</div>
              </div>

            </div>
          </div>

          {/* Individual Leave Type Balances */}
          {employee.leaveBalances && employee.leaveBalances.length > 0 && (
            <div style={{
              background: 'var(--bg-subtle)',
              borderRadius: 'var(--radius-lg)',
              padding: '16px 20px',
              border: '1px solid var(--border-light)'
            }}>
              <div style={{ fontSize: 'var(--font-size-xs)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-tertiary)', marginBottom: 12 }}>
                🎯 Policy-Specific Paid Leave Balances
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14 }}>
                {employee.leaveBalances.map(bal => {
                  const used = bal.usedLeaves ?? 0;
                  const total = bal.totalLeaves ?? 0;
                  const available = bal.availableLeaves ?? Math.max(0, total - used);
                  const pct = total > 0 ? Math.min(100, Math.round((used / total) * 100)) : 0;
                  const typeColor = getTypeColor(bal.leaveType);

                  return (
                    <div key={bal.id || bal.leaveType} style={{
                      background: 'var(--bg-card)',
                      borderRadius: 'var(--radius-md)',
                      padding: '12px 14px',
                      border: '1px solid var(--border-light)',
                      boxShadow: 'var(--shadow-sm)'
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                        <span style={{
                          fontWeight: 700, fontSize: 'var(--font-size-xs)',
                          padding: '2px 8px', borderRadius: 'var(--radius-full)',
                          background: `${typeColor}15`, color: typeColor
                        }}>
                          {bal.leaveType} Leave
                        </span>
                        <span style={{ fontSize: 'var(--font-size-2xs)', color: 'var(--text-tertiary)', fontWeight: 600 }}>
                          {bal.accrualFrequency || 'Annual'}
                        </span>
                      </div>

                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginTop: 8, marginBottom: 4 }}>
                        <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-secondary)' }}>Available:</span>
                        <span style={{ fontSize: 'var(--font-size-sm)', fontWeight: 700, color: 'var(--text-primary)' }}>
                          {available} <span style={{ fontSize: '10px', color: 'var(--text-tertiary)', fontWeight: 500 }}>/ {total} days</span>
                        </span>
                      </div>

                      {/* Progress Bar */}
                      <div style={{
                        width: '100%', height: 6, background: 'var(--border-light)',
                        borderRadius: 3, overflow: 'hidden', margin: '6px 0'
                      }}>
                        <div style={{
                          width: `${pct}%`, height: '100%',
                          background: pct > 80 ? 'var(--wd-red)' : typeColor,
                          borderRadius: 3, transition: 'width 0.3s ease'
                        }} />
                      </div>

                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', color: 'var(--text-tertiary)' }}>
                        <span>Used: {used} days</span>
                        <span>{pct}% Consumed</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Leave History Table for this Employee */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <div style={{ fontSize: 'var(--font-size-xs)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-tertiary)' }}>
                📜 Leave Applications History ({leaves.length})
              </div>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={fetchEmployeeLeaves}
                style={{ fontSize: '11px', padding: '3px 8px' }}
              >
                🔄 Refresh History
              </button>
            </div>

            {loadingLeaves ? (
              <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-secondary)', fontSize: 'var(--font-size-xs)' }}>
                ⏳ Loading leave records...
              </div>
            ) : leaves.length === 0 ? (
              <div style={{
                padding: '24px', textAlign: 'center', background: 'var(--bg-subtle)',
                borderRadius: 'var(--radius-md)', border: '1px dashed var(--border-default)',
                color: 'var(--text-secondary)', fontSize: 'var(--font-size-xs)'
              }}>
                📋 No leave requests recorded for this employee yet.
              </div>
            ) : (
              <div style={{ overflowX: 'auto', border: '1px solid var(--border-light)', borderRadius: 'var(--radius-md)' }}>
                <table className="data-table" style={{ margin: 0, fontSize: 'var(--font-size-xs)' }}>
                  <thead>
                    <tr>
                      <th>Type</th>
                      <th>Date Range</th>
                      <th>Days</th>
                      <th>Pay Classification</th>
                      <th>Status</th>
                      <th>Reason</th>
                    </tr>
                  </thead>
                  <tbody>
                    {leaves.map(l => (
                      <tr key={l.id}>
                        <td>
                          <span style={{
                            fontWeight: 700, padding: '2px 8px', borderRadius: 'var(--radius-full)',
                            fontSize: '11px', background: `${getTypeColor(l.timeOffType)}15`,
                            color: getTypeColor(l.timeOffType)
                          }}>
                            {l.timeOffType}
                          </span>
                        </td>
                        <td style={{ fontWeight: 500 }}>
                          {l.startDate} → {l.endDate}
                        </td>
                        <td style={{ fontWeight: 700 }}>
                          {l.totalQuantity} {l.totalQuantity === 1 ? 'day' : 'days'}
                        </td>
                        <td>
                          <span style={{
                            display: 'inline-flex', alignItems: 'center', gap: 4,
                            padding: '2px 8px', borderRadius: 'var(--radius-full)',
                            fontSize: '11px', fontWeight: 600,
                            background: l.isCompanySponsored !== false ? 'var(--wd-green-light)' : 'var(--wd-orange-light)',
                            color: l.isCompanySponsored !== false ? 'var(--wd-green)' : 'var(--wd-orange)'
                          }}>
                            {l.isCompanySponsored !== false ? '● Paid (PTO)' : '○ Non-Paid (LOP)'}
                          </span>
                        </td>
                        <td>
                          <span className={`status-badge status-${l.routingStatus.toLowerCase()}`} style={{ fontSize: '10px', padding: '2px 6px' }}>
                            {l.routingStatus.replace('_', ' ')}
                          </span>
                        </td>
                        <td style={{ color: 'var(--text-secondary)', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={l.reason}>
                          {l.reason || '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

        </div>

        <div className="modal-footer" style={{ borderTop: '1px solid var(--border-light)', paddingTop: 14, marginTop: 16 }}>
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            Close
          </button>
        </div>

      </div>
    </div>
  );
}

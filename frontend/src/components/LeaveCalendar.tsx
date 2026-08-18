import { useState, useEffect } from 'react';
import { useAuth } from '../AuthContext';
import api from '../api';
import type { LeaveBalanceInfo, TimeOffResponse, Holiday, LeavePolicyInfo } from '../types';
import RequestLeaveModal from './RequestLeaveModal';
import ExtendLeaveModal from './ExtendLeaveModal';

const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export default function LeaveCalendar() {
  const { } = useAuth();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [balances, setBalances] = useState<LeaveBalanceInfo[]>([]);
  const [myLeaves, setMyLeaves] = useState<TimeOffResponse[]>([]);
  const [myPolicies, setMyPolicies] = useState<LeavePolicyInfo[]>([]);
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [extendingLeave, setExtendingLeave] = useState<TimeOffResponse | null>(null);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [expandedPolicy, setExpandedPolicy] = useState<number | null>(null);

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  useEffect(() => {
    fetchData();

    // Persistent Real-time SSE Connection
    const token = localStorage.getItem('token');
    if (!token) return;

    const eventSource = new EventSource(`http://localhost:8080/api/events/subscribe?token=${encodeURIComponent(token)}`);
    
    eventSource.addEventListener('POLICY_UPDATE', () => {
      fetchData();
    });
    eventSource.addEventListener('LEAVE_UPDATE', () => {
      fetchData();
    });

    return () => {
      eventSource.close();
    };
  }, [year, month]);

  const fetchData = async () => {
    try {
      const startDate = `${year}-${String(month + 1).padStart(2, '0')}-01`;
      const lastDay = new Date(year, month + 1, 0).getDate();
      const endDate = `${year}-${String(month + 1).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;

      const [balRes, leavesRes, polRes, holRes] = await Promise.all([
        api.get('/leaves/my-balances'),
        api.get('/leaves/my-leaves'),
        api.get('/leaves/my-policies'),
        api.get(`/calendar/holidays?startDate=${startDate}&endDate=${endDate}`)
      ]);
      setBalances(balRes.data);
      setMyLeaves(leavesRes.data);
      setMyPolicies(polRes.data);
      setHolidays(holRes.data);
    } catch (err) {
      console.error('Failed to fetch calendar data', err);
    }
  };

  const prevMonth = () => setCurrentDate(new Date(year, month - 1, 1));
  const nextMonth = () => setCurrentDate(new Date(year, month + 1, 1));
  const goToday = () => setCurrentDate(new Date());

  // Build calendar days
  const firstDayOfMonth = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const daysInPrevMonth = new Date(year, month, 0).getDate();

  const calendarDays: { day: number; month: number; year: number; isCurrentMonth: boolean }[] = [];

  // Previous month trailing days
  for (let i = firstDayOfMonth - 1; i >= 0; i--) {
    const prevMonthIdx = month === 0 ? 11 : month - 1;
    const prevYear = month === 0 ? year - 1 : year;
    calendarDays.push({ day: daysInPrevMonth - i, month: prevMonthIdx, year: prevYear, isCurrentMonth: false });
  }
  // Current month
  for (let d = 1; d <= daysInMonth; d++) {
    calendarDays.push({ day: d, month, year, isCurrentMonth: true });
  }
  // Fill remaining
  const remaining = 42 - calendarDays.length;
  for (let d = 1; d <= remaining; d++) {
    const nextMonthIdx = month === 11 ? 0 : month + 1;
    const nextYear = month === 11 ? year + 1 : year;
    calendarDays.push({ day: d, month: nextMonthIdx, year: nextYear, isCurrentMonth: false });
  }

  const today = new Date();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

  const getDateStr = (d: { day: number; month: number; year: number }) => {
    return `${d.year}-${String(d.month + 1).padStart(2, '0')}-${String(d.day).padStart(2, '0')}`;
  };

  const getHolidayForDate = (dateStr: string) => holidays.find(h => h.date === dateStr);

  const getLeaveForDate = (dateStr: string) => {
    return myLeaves.find(l => {
      return dateStr >= l.startDate && dateStr <= l.endDate &&
        (l.routingStatus === 'APPROVED' || l.routingStatus === 'PENDING_MANAGER' || l.routingStatus === 'PENDING_HR');
    });
  };

  const isWeekend = (dayOfWeek: number) => dayOfWeek === 0 || dayOfWeek === 6;

  const handleDayClick = (d: { day: number; month: number; year: number; isCurrentMonth: boolean }) => {
    if (!d.isCurrentMonth) return;
    const dateStr = getDateStr(d);
    setSelectedDate(dateStr);
    setShowModal(true);
  };

  const getBalancePercent = (b: LeaveBalanceInfo) => {
    const base = b.accruedLeaves ?? b.totalLeaves;
    if (base === 0) return 0;
    const avail = b.availableLeaves ?? (b.totalLeaves - b.usedLeaves);
    return Math.min(100, Math.max(0, Math.round((avail / base) * 100)));
  };

  const getBalanceTypeClass = (type: string) => {
    switch (type.toUpperCase()) {
      case 'ANNUAL': return 'type-annual';
      case 'SICK': return 'type-sick';
      case 'CASUAL': return 'type-casual';
      case 'EARNED': return 'type-earned';
      default: return 'type-annual';
    }
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

  const currentMonthName = new Date().toLocaleDateString('en-US', { month: 'short' });
  const currentMonthNum = new Date().getMonth() + 1;

  // Current leave active TODAY
  const currentActiveLeave = myLeaves.find(l =>
    (l.routingStatus === 'APPROVED' || l.routingStatus === 'PENDING_MANAGER' || l.routingStatus === 'PENDING_HR') &&
    l.startDate <= todayStr && todayStr <= l.endDate
  );

  return (
    <>
      {/* Current Leave Section - Displayed ONLY if employee is on leave on current date */}
      {currentActiveLeave && (
        <div className="card animate-in" style={{
          marginBottom: 20,
          border: '1.5px solid rgba(5, 150, 105, 0.3)',
          background: 'linear-gradient(135deg, rgba(5, 150, 105, 0.06) 0%, rgba(0, 85, 179, 0.04) 100%)',
          boxShadow: 'var(--shadow-md)'
        }}>
          <div className="card-header" style={{ padding: '16px 20px', borderBottom: '1px solid rgba(5, 150, 105, 0.15)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontSize: '1.4rem' }}>🌴</span>
              <div>
                <div className="card-title" style={{ color: 'var(--wd-green)', display: 'flex', alignItems: 'center', gap: 8 }}>
                  Current Leave
                  <span style={{
                    fontSize: '11px', fontWeight: 700, padding: '2px 8px',
                    borderRadius: 'var(--radius-full)', background: 'var(--wd-green)', color: 'white',
                    letterSpacing: '0.04em'
                  }}>
                    ACTIVE TODAY
                  </span>
                </div>
                <div className="card-subtitle">You currently have an active leave for today ({todayStr})</div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
              <button
                type="button"
                className="btn btn-primary btn-sm"
                onClick={() => setExtendingLeave(currentActiveLeave)}
                style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}
              >
                🔄 Extend Current Leave
              </button>
              {(currentActiveLeave.routingStatus === 'PENDING_MANAGER' || currentActiveLeave.routingStatus === 'PENDING_HR') && (
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => withdrawLeave(currentActiveLeave.id)}
                >
                  Withdraw
                </button>
              )}
            </div>
          </div>

          <div className="card-body" style={{ padding: '16px 20px' }}>
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
              gap: 12,
              background: 'white',
              borderRadius: 'var(--radius-lg)',
              padding: '14px 18px',
              border: '1px solid var(--border-light)'
            }}>
              <div>
                <div style={{ fontSize: 'var(--font-size-2xs)', color: 'var(--text-tertiary)', fontWeight: 600 }}>Category</div>
                <div style={{ fontWeight: 700, fontSize: 'var(--font-size-sm)', color: getTypeColor(currentActiveLeave.timeOffType), marginTop: 2 }}>
                  {currentActiveLeave.timeOffType} Leave
                </div>
              </div>

              <div>
                <div style={{ fontSize: 'var(--font-size-2xs)', color: 'var(--text-tertiary)', fontWeight: 600 }}>Date Range</div>
                <div style={{ fontWeight: 700, fontSize: 'var(--font-size-sm)', color: 'var(--text-primary)', marginTop: 2 }}>
                  {currentActiveLeave.startDate} ➔ {currentActiveLeave.endDate}
                </div>
              </div>

              <div>
                <div style={{ fontSize: 'var(--font-size-2xs)', color: 'var(--text-tertiary)', fontWeight: 600 }}>Duration</div>
                <div style={{ fontWeight: 700, fontSize: 'var(--font-size-sm)', color: 'var(--text-primary)', marginTop: 2 }}>
                  {currentActiveLeave.totalQuantity} {currentActiveLeave.totalQuantity === 1 ? 'Working Day' : 'Working Days'}
                </div>
              </div>

              <div>
                <div style={{ fontSize: 'var(--font-size-2xs)', color: 'var(--text-tertiary)', fontWeight: 600 }}>Pay Status</div>
                <div style={{ fontWeight: 700, fontSize: 'var(--font-size-sm)', color: currentActiveLeave.isCompanySponsored !== false ? 'var(--wd-green)' : 'var(--wd-orange)', marginTop: 2 }}>
                  {currentActiveLeave.isCompanySponsored !== false ? '● Paid' : '○ Unpaid (LOP)'}
                </div>
              </div>

              <div>
                <div style={{ fontSize: 'var(--font-size-2xs)', color: 'var(--text-tertiary)', fontWeight: 600 }}>Approval Status</div>
                <div style={{ marginTop: 2 }}>
                  <span className={`status-badge status-${currentActiveLeave.routingStatus.toLowerCase()}`}>
                    {currentActiveLeave.routingStatus.replace('_', ' ')}
                  </span>
                </div>
              </div>
            </div>

            {currentActiveLeave.reason && (
              <div style={{ marginTop: 12, fontSize: 'var(--font-size-xs)', color: 'var(--text-secondary)', background: 'var(--bg-subtle)', padding: '10px 14px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-light)' }}>
                <strong>Reason:</strong> {currentActiveLeave.reason}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Balance Cards with Dynamic Cumulative Accrual Display */}
      <div className="balance-grid animate-in">
        {balances.map(b => {
          const matchingPolicy = myPolicies.find(p => p.leaveType.toUpperCase() === b.leaveType.toUpperCase());
          const displayAvailable = b.availableLeaves ?? (b.totalLeaves - b.usedLeaves);
          const displayAccrued = b.accruedLeaves ?? b.totalLeaves;
          const isMonthly = b.accrualFrequency?.toUpperCase() === 'MONTHLY' || matchingPolicy?.accrualFrequency?.toUpperCase() === 'MONTHLY';

          return (
            <div key={b.id} className={`balance-card ${getBalanceTypeClass(b.leaveType)}`}>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                  <div className="balance-type-label" style={{ marginBottom: 0 }}>{b.leaveType} Leave</div>
                  <span style={{
                    fontSize: '11px',
                    fontWeight: 700,
                    color: getTypeColor(b.leaveType),
                    background: 'rgba(255, 255, 255, 0.9)',
                    padding: '2px 8px',
                    borderRadius: 'var(--radius-full)',
                    border: '1px solid var(--border-light)',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 3
                  }}>
                    {isMonthly
                      ? `⚡ +${b.accrualRate ?? matchingPolicy?.accrualRate ?? (b.leaveType === 'ANNUAL' ? 1.67 : 0.83)} d/mo (${currentMonthName})`
                      : `⚡ +${b.totalLeaves} d/yr Grant`}
                  </span>
                </div>
                <div className="balance-gauge">
                  <span className="balance-number">{displayAvailable}</span>
                  <span className="balance-unit">{displayAvailable === 1 ? 'day accrued' : 'days accrued'}</span>
                </div>
                <div className="balance-bar-container">
                  <div
                    className={`balance-bar ${getBalanceTypeClass(b.leaveType)}`}
                    style={{ width: `${getBalancePercent(b)}%` }}
                  />
                </div>
                <div className="balance-detail" style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>{b.usedLeaves} used of {displayAccrued} earned ({b.totalLeaves}/yr)</span>
                  <span style={{ color: 'var(--text-tertiary)' }}>
                    {matchingPolicy?.isCarryForwardAllowed ? `Carryover: ≤${matchingPolicy.maxCarryForwardDays}d` : 'No carryover'}
                  </span>
                </div>
              </div>
            </div>
          );
        })}
        {balances.length === 0 && (
          <div className="balance-card type-annual">
            <div>
              <div className="balance-type-label">No Balances</div>
              <div className="balance-gauge">
                <span className="balance-number">—</span>
              </div>
              <div className="balance-detail">Contact HR to set up your leave policy</div>
            </div>
          </div>
        )}
      </div>

      {/* Calendar Card */}
      <div className="card animate-in animate-in-1 leave-calendar">
        <div className="cal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span className="cal-month-label">{MONTH_NAMES[month]} {year}</span>
            <button className="btn btn-secondary btn-sm" onClick={goToday}>Today</button>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <button className="btn btn-primary" onClick={() => { setSelectedDate(todayStr); setShowModal(true); }}>
              ＋ Request Leave
            </button>
            <div className="cal-nav">
              <button className="cal-nav-btn" onClick={prevMonth}>‹</button>
              <button className="cal-nav-btn" onClick={nextMonth}>›</button>
            </div>
          </div>
        </div>
        <div className="cal-grid">
          {WEEKDAYS.map(w => <div key={w} className="cal-weekday">{w}</div>)}
          {calendarDays.map((d, i) => {
            const dateStr = getDateStr(d);
            const dayOfWeek = new Date(dateStr).getDay();
            const holiday = getHolidayForDate(dateStr);
            const leave = getLeaveForDate(dateStr);
            const isToday = dateStr === todayStr;

            let classes = 'cal-day';
            if (!d.isCurrentMonth) classes += ' other-month';
            if (isToday) classes += ' today';
            if (isWeekend(dayOfWeek) && d.isCurrentMonth) classes += ' weekend';

            return (
              <div key={i} className={classes} onClick={() => handleDayClick(d)}>
                <div className="cal-day-num">{d.day}</div>
                {holiday && <div className="cal-day-tag holiday">{holiday.name}</div>}
                {leave && (
                  <div className={`cal-day-tag ${leave.routingStatus === 'APPROVED' ? 'approved' : 'pending'}`}>
                    {leave.timeOffType}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* My Leave Requests */}
      <div className="card animate-in animate-in-2" style={{ marginTop: 24 }}>
        <div className="card-header">
          <div>
            <div className="card-title">My Leave Requests</div>
            <div className="card-subtitle">Track and manage your time off</div>
          </div>
          <span style={{
            fontSize: 'var(--font-size-2xs)', fontWeight: 700,
            padding: '4px 10px', borderRadius: 'var(--radius-full)',
            background: 'var(--wd-blue-50)', color: 'var(--wd-blue)',
            letterSpacing: '0.02em'
          }}>
            {myLeaves.length} {myLeaves.length === 1 ? 'Request' : 'Requests'}
          </span>
        </div>
        <div className="card-body-compact">
          {myLeaves.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-icon">📋</div>
              <div className="empty-state-text">No leave requests yet. Click a date on the calendar to get started.</div>
            </div>
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>Type</th>
                  <th>Date Range</th>
                  <th>Days</th>
                  <th>Pay Status</th>
                  <th>Approval Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {myLeaves.map(l => (
                  <tr key={l.id}>
                    <td>
                      <span style={{
                        fontWeight: 700, padding: '3px 10px', borderRadius: 'var(--radius-full)',
                        fontSize: 'var(--font-size-xs)',
                        background: `${getTypeColor(l.timeOffType)}10`,
                        color: getTypeColor(l.timeOffType),
                        border: `1px solid ${getTypeColor(l.timeOffType)}20`
                      }}>
                        {l.timeOffType}
                      </span>
                    </td>
                    <td style={{ fontWeight: 500 }}>{l.startDate} → {l.endDate}</td>
                    <td style={{ fontWeight: 700 }}>{l.totalQuantity}</td>
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
                    <td><span className={`status-badge status-${l.routingStatus.toLowerCase()}`}>{l.routingStatus.replace('_', ' ')}</span></td>
                    <td>
                      <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                        {(l.routingStatus === 'APPROVED' || l.routingStatus === 'PENDING_MANAGER' || l.routingStatus === 'PENDING_HR') && (
                          <button
                            type="button"
                            className="btn btn-primary btn-sm"
                            onClick={() => setExtendingLeave(l)}
                            style={{ padding: '3px 8px', fontSize: '11px', display: 'inline-flex', alignItems: 'center', gap: 3 }}
                          >
                            🔄 Extend
                          </button>
                        )}
                        {(l.routingStatus === 'PENDING_MANAGER' || l.routingStatus === 'PENDING_HR') && (
                          <button
                            type="button"
                            className="btn btn-secondary btn-sm"
                            onClick={() => withdrawLeave(l.id)}
                            style={{ padding: '3px 8px', fontSize: '11px' }}
                          >
                            Withdraw
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Applicable Leave Policies */}
      <div className="card animate-in animate-in-3" style={{ marginTop: 24 }}>
        <div className="card-header">
          <div>
            <div className="card-title">My Applicable Leave Policies & Guidelines</div>
            <div className="card-subtitle">Policies, validity periods, quotas, and approval workflows</div>
          </div>
          <span style={{
            fontSize: 'var(--font-size-2xs)', fontWeight: 700,
            padding: '4px 10px', borderRadius: 'var(--radius-full)',
            background: 'var(--wd-blue-50)', color: 'var(--wd-blue)'
          }}>
            {myPolicies.length} Active {myPolicies.length === 1 ? 'Policy' : 'Policies'}
          </span>
        </div>
        <div className="card-body">
          {myPolicies.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-icon">📋</div>
              <div className="empty-state-text">No active leave policies assigned yet. Contact HR for details.</div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {myPolicies.map(p => {
                const isExpanded = expandedPolicy === p.id;
                const typeColor = getTypeColor(p.leaveType);
                return (
                  <div key={p.id} style={{
                    border: '1px solid var(--border-default)',
                    borderRadius: 'var(--radius-lg)',
                    background: 'var(--bg-card)',
                    overflow: 'hidden',
                    transition: 'all var(--transition-base)',
                    borderLeft: `3px solid ${typeColor}`,
                    cursor: 'pointer'
                  }} onClick={() => setExpandedPolicy(isExpanded ? null : (p.id ?? null))}>
                    <div style={{
                      padding: '16px 20px',
                      display: 'flex', justifyContent: 'space-between', alignItems: 'center'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                        <span style={{
                          fontSize: 'var(--font-size-xs)', fontWeight: 700,
                          padding: '3px 10px', borderRadius: 'var(--radius-full)',
                          background: `${typeColor}10`, color: typeColor,
                          border: `1px solid ${typeColor}20`
                        }}>
                          {p.leaveType}
                        </span>
                        <div>
                          <div style={{ fontWeight: 700, fontSize: 'var(--font-size-sm)', color: 'var(--text-primary)' }}>
                            {p.policyName || `${p.leaveType} Policy`}
                          </div>
                          <div style={{ fontSize: 'var(--font-size-2xs)', color: 'var(--text-tertiary)', marginTop: 2 }}>
                            📅 {p.effectiveDate || '2026-01-01'} ➔ {p.endDate || '2026-12-31'} · {p.defaultDays} days/yr
                          </div>
                        </div>
                      </div>
                      <span style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-tertiary)', transition: 'transform var(--transition-fast)', transform: isExpanded ? 'rotate(180deg)' : 'none' }}>▼</span>
                    </div>

                    {isExpanded && (
                      <div style={{
                        padding: '0 20px 16px',
                        borderTop: '1px solid var(--border-light)',
                        animation: 'slideDown 200ms ease'
                      }}>
                        <div style={{
                          display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
                          gap: '12px', marginTop: 12,
                          background: 'var(--bg-subtle)', borderRadius: 'var(--radius-md)',
                          padding: '14px', fontSize: 'var(--font-size-xs)'
                        }}>
                          <div>
                            <div style={{ color: 'var(--text-tertiary)', fontWeight: 600, marginBottom: 2 }}>Annual Quota</div>
                            <div style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{p.defaultDays} days/yr</div>
                          </div>
                          <div>
                            <div style={{ color: 'var(--text-tertiary)', fontWeight: 600, marginBottom: 2 }}>Accrual Cadence</div>
                            <div style={{ fontWeight: 700, color: 'var(--wd-blue)' }}>⚡ {p.accrualRate || 1.67} d/{p.accrualFrequency?.toLowerCase() || 'mo'}</div>
                          </div>
                          <div>
                            <div style={{ color: 'var(--text-tertiary)', fontWeight: 600, marginBottom: 2 }}>Proration</div>
                            <div style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{p.isProrated !== false ? 'Join-Date Prorated' : 'Full Grant'}</div>
                          </div>
                          <div>
                            <div style={{ color: 'var(--text-tertiary)', fontWeight: 600, marginBottom: 2 }}>Carryover Limit</div>
                            <div style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{p.isCarryForwardAllowed ? `Max ${p.maxCarryForwardDays}d` : 'None'}</div>
                          </div>
                          <div>
                            <div style={{ color: 'var(--text-tertiary)', fontWeight: 600, marginBottom: 2 }}>Eligible Role</div>
                            <div style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{p.eligibleRole && p.eligibleRole !== 'ALL' ? p.eligibleRole : 'All Roles'}</div>
                          </div>
                        </div>
                        <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-secondary)', marginTop: 10 }}>
                          <strong>Approval Workflow:</strong>{' '}
                          <span style={{ color: 'var(--wd-blue)', fontWeight: 600 }}>
                            {[p.approvalStep1 || 'MANAGER', p.approvalStep2 || 'HR', p.approvalStep3].filter(s => s && s !== 'SKIP').join(' ➔ ')}
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {showModal && (
        <RequestLeaveModal
          initialDate={selectedDate}
          balances={balances}
          existingLeaves={myLeaves}
          policies={myPolicies}
          onClose={() => setShowModal(false)}
          onSubmitted={() => { setShowModal(false); fetchData(); }}
        />
      )}

      {extendingLeave && (
        <ExtendLeaveModal
          leave={extendingLeave}
          balances={balances}
          onClose={() => setExtendingLeave(null)}
          onExtended={() => { setExtendingLeave(null); fetchData(); }}
        />
      )}
    </>
  );

  async function withdrawLeave(id: number) {
    if (!confirm('Are you sure you want to withdraw this request?')) return;
    try {
      await api.put(`/leaves/${id}/withdraw`);
      fetchData();
    } catch {
      alert('Failed to withdraw leave request.');
    }
  }
}

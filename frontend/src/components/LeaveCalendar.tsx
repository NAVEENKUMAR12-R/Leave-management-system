import { useState, useEffect } from 'react';
import { useAuth } from '../AuthContext';
import api from '../api';
import type { LeaveBalanceInfo, TimeOffResponse, Holiday, LeavePolicyInfo } from '../types';
import RequestLeaveModal from './RequestLeaveModal';

const MONTH_NAMES = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const WEEKDAYS = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];

export default function LeaveCalendar() {
  const { user } = useAuth();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [balances, setBalances] = useState<LeaveBalanceInfo[]>([]);
  const [myLeaves, setMyLeaves] = useState<TimeOffResponse[]>([]);
  const [myPolicies, setMyPolicies] = useState<LeavePolicyInfo[]>([]);
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  useEffect(() => {
    fetchData();
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
    calendarDays.push({ day: daysInPrevMonth - i, month: month - 1, year, isCurrentMonth: false });
  }
  // Current month
  for (let d = 1; d <= daysInMonth; d++) {
    calendarDays.push({ day: d, month, year, isCurrentMonth: true });
  }
  // Fill remaining
  const remaining = 42 - calendarDays.length;
  for (let d = 1; d <= remaining; d++) {
    calendarDays.push({ day: d, month: month + 1, year, isCurrentMonth: false });
  }

  const today = new Date();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

  const getDateStr = (d: { day: number; month: number; year: number }) => {
    const m = d.month < 0 ? 11 : d.month > 11 ? 0 : d.month;
    const y = d.month < 0 ? d.year - 1 : d.month > 11 ? d.year + 1 : d.year;
    return `${y}-${String(m + 1).padStart(2, '0')}-${String(d.day).padStart(2, '0')}`;
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
    if (b.totalLeaves === 0) return 0;
    return Math.round(((b.totalLeaves - b.usedLeaves) / b.totalLeaves) * 100);
  };

  const getBalanceTypeClass = (type: string) => {
    switch (type.toUpperCase()) {
      case 'ANNUAL': return 'type-annual';
      case 'SICK': return 'type-sick';
      case 'CASUAL': return 'type-casual';
      default: return 'type-annual';
    }
  };

  return (
    <>
      {/* Balance Cards */}
      <div className="balance-grid animate-in">
        {balances.map(b => (
          <div key={b.id} className={`balance-card ${getBalanceTypeClass(b.leaveType)}`}>
            <div className="balance-type-label">{b.leaveType} Leave</div>
            <div className="balance-gauge">
              <span className="balance-number">{b.totalLeaves - b.usedLeaves}</span>
              <span className="balance-unit">days left</span>
            </div>
            <div className="balance-bar-container">
              <div
                className={`balance-bar ${getBalanceTypeClass(b.leaveType)}`}
                style={{ width: `${getBalancePercent(b)}%` }}
              />
            </div>
            <div className="balance-detail">{b.usedLeaves} used of {b.totalLeaves} total</div>
          </div>
        ))}
        {balances.length === 0 && (
          <div className="balance-card type-annual">
            <div className="balance-type-label">No Balances</div>
            <div className="balance-gauge">
              <span className="balance-number">—</span>
            </div>
            <div className="balance-detail">Contact HR to set up your leave policy</div>
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

      {/* Leave History */}
      <div className="card animate-in animate-in-2" style={{ marginTop: 24 }}>
        <div className="card-header">
          <div>
            <div className="card-title">My Leave Requests</div>
            <div className="card-subtitle">Track and manage your time off</div>
          </div>
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
                    <td style={{ fontWeight: 600 }}>{l.timeOffType}</td>
                    <td>{l.startDate} → {l.endDate}</td>
                    <td>{l.totalQuantity}</td>
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
                    <td><span className={`status-badge status-${l.routingStatus.toLowerCase()}`}>{l.routingStatus.replace('_', ' ')}</span></td>
                    <td>
                      {(l.routingStatus === 'PENDING_MANAGER' || l.routingStatus === 'PENDING_HR') && (
                        <button className="btn btn-secondary btn-sm" onClick={() => withdrawLeave(l.id)}>Withdraw</button>
                      )}
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
            <div className="card-subtitle">Detailed rules, validity periods, quotas, carryover limits, and approval chains</div>
          </div>
          <span style={{
            fontSize: '12px',
            fontWeight: 700,
            padding: '3px 10px',
            borderRadius: 'var(--radius-full)',
            background: 'var(--wd-blue-50)',
            color: 'var(--wd-blue)'
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
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))', gap: '16px' }}>
              {myPolicies.map(p => (
                <div key={p.id} style={{
                  border: '1px solid var(--border-default)',
                  borderRadius: 'var(--radius-lg)',
                  padding: '16px',
                  background: 'var(--bg-hover)',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between'
                }}>
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                      <span style={{
                        fontSize: '11px',
                        fontWeight: 700,
                        padding: '2px 8px',
                        borderRadius: 'var(--radius-full)',
                        background: 'white',
                        border: '1px solid var(--border-default)',
                        color: 'var(--wd-blue)'
                      }}>
                        {p.leaveType} LEAVE
                      </span>
                      <span style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: 600 }}>
                        📅 {p.effectiveDate || '2026-01-01'} ➔ {p.endDate || '2026-12-31'}
                      </span>
                    </div>

                    <h4 style={{ margin: '0 0 6px 0', fontSize: 'var(--font-size-sm)', fontWeight: 700, color: 'var(--text-primary)' }}>
                      {p.policyName || `${p.leaveType} Policy`}
                    </h4>

                    <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-secondary)', marginBottom: '12px' }}>
                      {p.description || 'Active company absence policy guidelines.'}
                    </p>

                    <div style={{
                      display: 'grid',
                      gridTemplateColumns: '1fr 1fr',
                      gap: '8px',
                      background: 'white',
                      borderRadius: 'var(--radius-md)',
                      padding: '10px',
                      fontSize: 'var(--font-size-xs)',
                      marginBottom: '10px',
                      border: '1px solid var(--border-light)'
                    }}>
                      <div>
                        <strong style={{ color: 'var(--text-secondary)' }}>Annual Quota:</strong><br />
                        <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{p.defaultDays} days/yr</span>
                      </div>
                      <div>
                        <strong style={{ color: 'var(--text-secondary)' }}>Accrual:</strong><br />
                        <span>{p.accrualRate || 1.67} d/{p.accrualFrequency?.toLowerCase() || 'mo'}</span>
                      </div>
                      <div>
                        <strong style={{ color: 'var(--text-secondary)' }}>Carryover:</strong><br />
                        <span>{p.isCarryForwardAllowed ? `Max ${p.maxCarryForwardDays}d (${p.expirationMonths || 6}m)` : 'None'}</span>
                      </div>
                      <div>
                        <strong style={{ color: 'var(--text-secondary)' }}>Eligibility:</strong><br />
                        <span>{p.eligibleRole && p.eligibleRole !== 'ALL' ? `${p.eligibleRole} · ` : ''}{p.employeeType || 'ALL'} · {p.region || 'Global'}</span>
                      </div>
                    </div>
                  </div>

                  <div style={{ fontSize: '11px', color: 'var(--text-secondary)', borderTop: '1px solid var(--border-light)', paddingTop: '8px' }}>
                    <strong style={{ color: 'var(--text-primary)' }}>Approval Path:</strong>{' '}
                    <span style={{ color: 'var(--wd-blue)', fontWeight: 600 }}>
                      {[p.approvalStep1 || 'MANAGER', p.approvalStep2 || 'HR', p.approvalStep3].filter(s => s && s !== 'SKIP').join(' ➔ ')}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {showModal && (
        <RequestLeaveModal
          initialDate={selectedDate}
          balances={balances}
          existingLeaves={myLeaves}
          onClose={() => setShowModal(false)}
          onSubmitted={() => { setShowModal(false); fetchData(); }}
        />
      )}
    </>
  );

  async function withdrawLeave(id: number) {
    if (!confirm('Are you sure you want to withdraw this request?')) return;
    try {
      await api.put(`/leaves/${id}/withdraw`);
      fetchData();
    } catch (err) {
      alert('Failed to withdraw leave request.');
    }
  }
}

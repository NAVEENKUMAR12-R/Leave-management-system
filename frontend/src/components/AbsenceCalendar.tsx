import { useState, useEffect } from 'react';
import { useAuth } from '../AuthContext';
import api from '../api';
import type { LeaveBalanceInfo, TimeOffResponse, Holiday } from '../types';
import RequestAbsenceModal from './RequestAbsenceModal';

const MONTH_NAMES = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const WEEKDAYS = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];

export default function AbsenceCalendar() {
  const { user } = useAuth();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [balances, setBalances] = useState<LeaveBalanceInfo[]>([]);
  const [myLeaves, setMyLeaves] = useState<TimeOffResponse[]>([]);
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

      const [balRes, leavesRes, holRes] = await Promise.all([
        api.get('/leaves/my-balances'),
        api.get('/leaves/my-leaves'),
        api.get(`/calendar/holidays?startDate=${startDate}&endDate=${endDate}`)
      ]);
      setBalances(balRes.data);
      setMyLeaves(leavesRes.data);
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
      <div className="card animate-in animate-in-1 absence-calendar">
        <div className="cal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span className="cal-month-label">{MONTH_NAMES[month]} {year}</span>
            <button className="btn btn-secondary btn-sm" onClick={goToday}>Today</button>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <button className="btn btn-primary" onClick={() => { setSelectedDate(todayStr); setShowModal(true); }}>
              ＋ Request Absence
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
            <div className="card-title">My Absence Requests</div>
            <div className="card-subtitle">Track and manage your time off</div>
          </div>
        </div>
        <div className="card-body-compact">
          {myLeaves.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-icon">📋</div>
              <div className="empty-state-text">No absence requests yet. Click a date on the calendar to get started.</div>
            </div>
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>Type</th>
                  <th>Date Range</th>
                  <th>Days</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {myLeaves.map(l => (
                  <tr key={l.id}>
                    <td style={{ fontWeight: 600 }}>{l.timeOffType}</td>
                    <td>{l.startDate} → {l.endDate}</td>
                    <td>{l.totalQuantity}</td>
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

      {showModal && (
        <RequestAbsenceModal
          initialDate={selectedDate}
          balances={balances}
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

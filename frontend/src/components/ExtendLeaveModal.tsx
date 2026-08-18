import { useState, useMemo } from 'react';
import api from '../api';
import type { TimeOffResponse, LeaveBalanceInfo } from '../types';

interface Props {
  leave: TimeOffResponse;
  balances: LeaveBalanceInfo[];
  onClose: () => void;
  onExtended: () => void;
}

export default function ExtendLeaveModal({ leave, balances, onClose, onExtended }: Props) {
  // Compute minimum next day from current end date without timezone shift
  const [ey, em, ed] = leave.endDate.split('-').map(Number);
  const nextDayObj = new Date(ey, em - 1, ed + 1);
  const minExtensionDate = `${nextDayObj.getFullYear()}-${String(nextDayObj.getMonth() + 1).padStart(2, '0')}-${String(nextDayObj.getDate()).padStart(2, '0')}`;

  const [newEndDate, setNewEndDate] = useState(minExtensionDate);
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const selectedBalance = balances.find(b => b.leaveType.toUpperCase() === leave.timeOffType.toUpperCase());
  const availableAccrued = selectedBalance?.availableLeaves ?? (selectedBalance ? selectedBalance.totalLeaves - selectedBalance.usedLeaves : 0);

  // Calculate additional Mon-Fri working days between (oldEndDate + 1) and newEndDate
  const additionalDays = useMemo(() => {
    if (!newEndDate || newEndDate < minExtensionDate) return 0;
    const [sy, sm, sd] = minExtensionDate.split('-').map(Number);
    const [ny, nm, nd] = newEndDate.split('-').map(Number);
    const cur = new Date(sy, sm - 1, sd);
    const end = new Date(ny, nm - 1, nd);
    let count = 0;
    while (cur <= end) {
      const day = cur.getDay();
      if (day !== 0 && day !== 6) count++;
      cur.setDate(cur.getDate() + 1);
    }
    return count;
  }, [minExtensionDate, newEndDate]);

  const newTotalDays = leave.totalDays + additionalDays;
  const isPaid = leave.isCompanySponsored !== false && leave.timeOffType !== 'UNPAID';
  const isExceeding = isPaid && additionalDays > availableAccrued;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!newEndDate || newEndDate <= leave.endDate) {
      setError(`New end date must be after current end date (${leave.endDate}).`);
      return;
    }

    if (additionalDays <= 0) {
      setError('The selected extension period contains 0 working days (e.g., falls on weekend).');
      return;
    }

    setIsSubmitting(true);
    try {
      await api.put(`/leaves/${leave.id}/extend`, {
        newEndDate,
        reason
      });
      onExtended();
    } catch (err: any) {
      const msg = err.response?.data?.message || err.response?.data || err.message;
      setError(typeof msg === 'string' ? msg : 'Failed to extend leave.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: 540 }}>
        <div className="modal-header">
          <div>
            <h2 className="modal-title">🔄 Extend Approved Leave</h2>
            <div style={{ fontSize: 'var(--font-size-2xs)', color: 'var(--text-tertiary)', marginTop: 2 }}>
              Request additional days for your active/approved leave
            </div>
          </div>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>

        <div className="modal-body">
          {error && <div className="alert alert-error"><span>⚠</span> {error}</div>}

          {/* Current Leave Summary Card */}
          <div style={{
            background: 'var(--bg-subtle)',
            borderRadius: 'var(--radius-lg)',
            padding: '14px 16px',
            marginBottom: '16px',
            border: '1px solid var(--border-light)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <span className={`badge badge-${leave.timeOffType?.toLowerCase()}`} style={{ fontWeight: 700 }}>
                {leave.timeOffType} Leave
              </span>
              <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-secondary)', fontWeight: 600 }}>
                Current: <strong>{leave.totalDays} days</strong>
              </span>
            </div>
            <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-primary)', display: 'flex', gap: 12 }}>
              <span>📅 Current Span: <strong>{leave.startDate}</strong> → <strong>{leave.endDate}</strong></span>
            </div>
            {isPaid && selectedBalance && (
              <div style={{ fontSize: 'var(--font-size-2xs)', color: 'var(--wd-blue)', marginTop: 6, fontWeight: 600 }}>
                ⚡ Available Accrued Balance: {availableAccrued} days
              </div>
            )}
          </div>

          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label className="form-label">New Extended End Date</label>
              <input
                type="date"
                className="form-input"
                value={newEndDate}
                min={minExtensionDate}
                onChange={e => setNewEndDate(e.target.value)}
                required
              />
              <div className="form-hint">
                Must be on or after <strong>{minExtensionDate}</strong>
              </div>
            </div>

            {/* Extension Calculation Preview */}
            {additionalDays > 0 && (
              <div style={{
                background: 'var(--wd-blue-light)',
                border: '1px solid rgba(0, 85, 179, 0.15)',
                borderRadius: 'var(--radius-md)',
                padding: '12px 14px',
                marginBottom: '14px',
                fontSize: 'var(--font-size-xs)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
              }}>
                <div>
                  <div style={{ fontWeight: 700, color: 'var(--wd-blue)' }}>
                    ➕ Extension: +{additionalDays} {additionalDays === 1 ? 'working day' : 'working days'}
                  </div>
                  <div style={{ color: 'var(--text-secondary)', fontSize: 'var(--font-size-2xs)', marginTop: 2 }}>
                    New Duration: {leave.startDate} → {newEndDate}
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontWeight: 700, fontSize: 'var(--font-size-sm)', color: 'var(--text-primary)' }}>
                    {newTotalDays} Total Days
                  </div>
                </div>
              </div>
            )}

            {isExceeding && (
              <div className="alert alert-warning" style={{ marginBottom: 14 }}>
                <span>⚠️</span>
                <div>
                  <strong>Insufficient Accrued Quota:</strong> You are requesting {additionalDays} extra days, but only have {availableAccrued} days accrued.
                </div>
              </div>
            )}

            <div className="form-group">
              <label className="form-label">Reason for Extension</label>
              <textarea
                className="form-textarea"
                value={reason}
                onChange={e => setReason(e.target.value)}
                placeholder="Explain why you are requesting to extend this leave..."
                required
              />
            </div>

            <div className="modal-footer" style={{ padding: 0, borderTop: 'none', marginTop: 8 }}>
              <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
              <button
                type="submit"
                className="btn btn-primary"
                disabled={isSubmitting || additionalDays <= 0 || isExceeding}
              >
                {isSubmitting ? 'Submitting Extension...' : 'Submit Extension for Approval'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

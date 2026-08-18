import { useState } from 'react';
import api from '../api';
import type { LeaveBalanceInfo } from '../types';

interface Props {
  initialDate: string | null;
  balances: LeaveBalanceInfo[];
  onClose: () => void;
  onSubmitted: () => void;
}

export default function RequestAbsenceModal({ initialDate, balances, onClose, onSubmitted }: Props) {
  const [startDate, setStartDate] = useState(initialDate || '');
  const [endDate, setEndDate] = useState(initialDate || '');
  const [leaveType, setLeaveType] = useState('ANNUAL');
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showUnpaidWarning, setShowUnpaidWarning] = useState(false);

  const selectedBalance = balances.find(b => b.leaveType === leaveType);
  const remaining = selectedBalance ? selectedBalance.totalLeaves - selectedBalance.usedLeaves : 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsSubmitting(true);

    try {
      await api.post('/leaves/apply', {
        timeOffType: leaveType,
        startDate,
        endDate,
        reason,
      });
      onSubmitted();
    } catch (err: any) {
      const msg = err.response?.data?.message || err.response?.data || err.message;
      if (typeof msg === 'string' && msg.includes('Insufficient paid leave')) {
        setShowUnpaidWarning(true);
      } else {
        setError(typeof msg === 'string' ? msg : 'Failed to submit request.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSwitchToUnpaid = () => {
    setLeaveType('UNPAID');
    setShowUnpaidWarning(false);
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2 className="modal-title">Request Absence</h2>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">
          {error && <div className="alert alert-error"><span>⚠</span> {error}</div>}

          {showUnpaidWarning && (
            <div className="alert alert-warning" style={{ flexDirection: 'column', alignItems: 'flex-start' }}>
              <strong>⚠ Insufficient Paid Leave Balance</strong>
              <p style={{ margin: '6px 0', fontSize: '0.8125rem' }}>You don't have enough paid days. Would you like to apply for <strong>Unpaid Leave</strong> instead?</p>
              <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                <button className="btn btn-primary btn-sm" onClick={handleSwitchToUnpaid}>Yes, Unpaid Leave</button>
                <button className="btn btn-secondary btn-sm" onClick={() => setShowUnpaidWarning(false)}>Cancel</button>
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label className="form-label">Absence Type</label>
              <select className="form-select" value={leaveType} onChange={e => setLeaveType(e.target.value)}>
                <option value="ANNUAL">Annual Leave</option>
                <option value="SICK">Sick Leave</option>
                <option value="CASUAL">Casual Leave</option>
                <option value="UNPAID">Unpaid Leave</option>
              </select>
              {leaveType !== 'UNPAID' && selectedBalance && (
                <div className="form-hint">
                  Balance: <strong>{remaining} days</strong> remaining of {selectedBalance.totalLeaves}
                </div>
              )}
            </div>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Start Date</label>
                <input type="date" className="form-input" value={startDate} onChange={e => setStartDate(e.target.value)} required />
              </div>
              <div className="form-group">
                <label className="form-label">End Date</label>
                <input type="date" className="form-input" value={endDate} onChange={e => setEndDate(e.target.value)} required />
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">Reason / Comments</label>
              <textarea className="form-textarea" value={reason} onChange={e => setReason(e.target.value)} placeholder="Optional: Provide additional context…" />
            </div>
            <div className="modal-footer" style={{ padding: 0, borderTop: 'none', marginTop: 8 }}>
              <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
              <button type="submit" className="btn btn-primary" disabled={isSubmitting}>
                {isSubmitting ? 'Submitting…' : 'Submit Request'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

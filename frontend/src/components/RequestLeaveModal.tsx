import { useState } from 'react';
import api from '../api';
import type { LeaveBalanceInfo, TimeOffResponse } from '../types';

interface Props {
  initialDate: string | null;
  balances: LeaveBalanceInfo[];
  existingLeaves?: TimeOffResponse[];
  onClose: () => void;
  onSubmitted: () => void;
}

export default function RequestLeaveModal({ initialDate, balances, existingLeaves = [], onClose, onSubmitted }: Props) {
  const [startDate, setStartDate] = useState(initialDate || '');
  const [endDate, setEndDate] = useState(initialDate || '');
  const [leaveType, setLeaveType] = useState('ANNUAL');
  const [isCompanySponsored, setIsCompanySponsored] = useState(true);
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showUnpaidWarning, setShowUnpaidWarning] = useState(false);

  const selectedBalance = balances.find(b => b.leaveType === leaveType);
  const remaining = selectedBalance ? selectedBalance.totalLeaves - selectedBalance.usedLeaves : 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!startDate || !endDate) {
      setError('Please select both start and end dates.');
      return;
    }

    if (startDate > endDate) {
      setError('Start date cannot be after end date.');
      return;
    }

    // Edge Case Check: Overlapping leave check on client side
    const overlapping = existingLeaves.find(l => {
      const isActive = l.routingStatus === 'APPROVED' || l.routingStatus === 'PENDING_MANAGER' || l.routingStatus === 'PENDING_HR';
      if (!isActive) return false;
      return !(endDate < l.startDate || startDate > l.endDate);
    });

    if (overlapping) {
      setError(`You already have an active or pending leave from ${overlapping.startDate} to ${overlapping.endDate} (${overlapping.timeOffType} - ${overlapping.routingStatus}). You cannot apply for overlapping dates while on leave.`);
      return;
    }

    setIsSubmitting(true);

    try {
      await api.post('/leaves/apply', {
        timeOffType: leaveType,
        startDate,
        endDate,
        reason,
        isCompanySponsored: leaveType === 'UNPAID' ? false : isCompanySponsored,
      });
      onSubmitted();
    } catch (err: any) {
      const msg = err.response?.data?.message || err.response?.data || err.message;
      if (typeof msg === 'string' && (msg.includes('Insufficient paid leave') || msg.includes('balance'))) {
        setShowUnpaidWarning(true);
      } else {
        setError(typeof msg === 'string' ? msg : 'Failed to submit request.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSwitchToUnpaid = () => {
    setIsCompanySponsored(false);
    setShowUnpaidWarning(false);
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2 className="modal-title">Request Leave</h2>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">
          {error && <div className="alert alert-error"><span>⚠</span> {error}</div>}

          {showUnpaidWarning && (
            <div className="alert alert-warning" style={{ flexDirection: 'column', alignItems: 'flex-start' }}>
              <strong>⚠ Insufficient Paid Leave Balance</strong>
              <p style={{ margin: '6px 0', fontSize: '0.8125rem' }}>
                You do not have enough paid quota for a Company-Sponsored leave. You can choose to apply as a <strong>Non-Sponsored / Unpaid Leave of Absence (No Salary / Loss of Pay)</strong>.
              </p>
              <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                <button type="button" className="btn btn-primary btn-sm" onClick={handleSwitchToUnpaid}>Switch to Non-Sponsored (Unpaid)</button>
                <button type="button" className="btn btn-secondary btn-sm" onClick={() => setShowUnpaidWarning(false)}>Cancel</button>
              </div>
            </div>
          )}

          {/* Policy Information Box */}
          <div style={{
            background: 'var(--wd-blue-50)',
            border: '1px solid rgba(8, 117, 225, 0.15)',
            borderRadius: 'var(--radius-md)',
            padding: '12px 14px',
            marginBottom: '18px',
            fontSize: 'var(--font-size-xs)',
            color: 'var(--text-secondary)'
          }}>
            <div style={{ fontWeight: 700, color: 'var(--wd-blue)', marginBottom: '4px' }}>
              ℹ️ Annual Leave & Overlap Rules
            </div>
            <div>
              • <strong>Overlap Prevention:</strong> You cannot apply for a leave period that overlaps with an existing pending or approved leave.<br />
              • <strong>Annual Leave:</strong> Evaluated separately and cannot be combined or bridged with other leave categories.<br />
              • <strong>Company Sponsorship:</strong> Annual leave gives you the option to choose between Company Sponsored (paid) or Non-Sponsored (unpaid).
            </div>
          </div>

          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label className="form-label">Leave Category</label>
              <select className="form-select" value={leaveType} onChange={e => {
                const val = e.target.value;
                setLeaveType(val);
                if (val === 'UNPAID') setIsCompanySponsored(false);
                else setIsCompanySponsored(true);
              }}>
                <option value="ANNUAL">Annual Leave (Standalone)</option>
                <option value="SICK">Sick Leave</option>
                <option value="CASUAL">Casual Leave</option>
                <option value="EARNED">Earned Leave</option>
                <option value="UNPAID">Unpaid Leave</option>
              </select>
              {leaveType !== 'UNPAID' && selectedBalance && (
                <div className="form-hint">
                  Available Paid Quota: <strong>{remaining} days</strong> remaining of {selectedBalance.totalLeaves} total
                </div>
              )}
            </div>

            {/* Sponsorship Selection Options - ONLY FOR ANNUAL LEAVE */}
            {leaveType === 'ANNUAL' && (
              <div className="form-group">
                <label className="form-label">Annual Leave Sponsorship & Pay Option</label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                  <label style={{
                    display: 'flex',
                    flexDirection: 'column',
                    padding: '12px',
                    borderRadius: 'var(--radius-md)',
                    border: isCompanySponsored ? '2px solid var(--wd-green)' : '1px solid var(--border-default)',
                    background: isCompanySponsored ? 'var(--wd-green-light)' : 'white',
                    cursor: 'pointer',
                    transition: 'all var(--transition-fast)'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                      <input
                        type="radio"
                        name="sponsorship"
                        checked={isCompanySponsored}
                        onChange={() => setIsCompanySponsored(true)}
                      />
                      <span style={{ fontWeight: 700, fontSize: 'var(--font-size-sm)', color: isCompanySponsored ? 'var(--wd-green)' : 'var(--text-primary)' }}>
                        Company Sponsored
                      </span>
                    </div>
                    <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                      Paid Annual Leave — salary is credited (deducted from annual balance).
                    </span>
                  </label>

                  <label style={{
                    display: 'flex',
                    flexDirection: 'column',
                    padding: '12px',
                    borderRadius: 'var(--radius-md)',
                    border: !isCompanySponsored ? '2px solid var(--wd-orange)' : '1px solid var(--border-default)',
                    background: !isCompanySponsored ? 'var(--wd-orange-light)' : 'white',
                    cursor: 'pointer',
                    transition: 'all var(--transition-fast)'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                      <input
                        type="radio"
                        name="sponsorship"
                        checked={!isCompanySponsored}
                        onChange={() => setIsCompanySponsored(false)}
                      />
                      <span style={{ fontWeight: 700, fontSize: 'var(--font-size-sm)', color: !isCompanySponsored ? 'var(--wd-orange)' : 'var(--text-primary)' }}>
                        Non-Sponsored (Unpaid)
                      </span>
                    </div>
                    <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                      Unpaid leave of absence — no salary credited (Loss of Pay).
                    </span>
                  </label>
                </div>
              </div>
            )}

            {/* Live Pay Status Preview */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '10px 14px',
              borderRadius: 'var(--radius-md)',
              background: ((leaveType === 'ANNUAL' ? isCompanySponsored : leaveType !== 'UNPAID')) ? 'var(--wd-green-light)' : 'var(--wd-orange-light)',
              border: `1px solid ${((leaveType === 'ANNUAL' ? isCompanySponsored : leaveType !== 'UNPAID')) ? 'rgba(13, 128, 80, 0.2)' : 'rgba(217, 119, 6, 0.2)'}`,
              marginBottom: '16px'
            }}>
              <div>
                <div style={{ fontSize: 'var(--font-size-xs)', fontWeight: 700, color: ((leaveType === 'ANNUAL' ? isCompanySponsored : leaveType !== 'UNPAID')) ? 'var(--wd-green)' : 'var(--wd-orange)' }}>
                  {((leaveType === 'ANNUAL' ? isCompanySponsored : leaveType !== 'UNPAID')) ? '🟢 STATUS: PAID (SALARY CREDITED)' : '🔴 STATUS: UNPAID LEAVE OF ABSENCE (LOSS OF PAY)'}
                </div>
                <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                  {((leaveType === 'ANNUAL' ? isCompanySponsored : leaveType !== 'UNPAID'))
                    ? 'Salary will be credited as normal for approved working days.'
                    : 'Salary will NOT be credited for this absence duration.'}
                </div>
              </div>
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
              <textarea className="form-textarea" value={reason} onChange={e => setReason(e.target.value)} placeholder="Provide any context or justification for your manager & HR…" required />
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

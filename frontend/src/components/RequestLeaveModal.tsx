import { useState, useMemo } from 'react';
import api from '../api';
import type { LeaveBalanceInfo, TimeOffResponse, LeavePolicyInfo } from '../types';

interface Props {
  initialDate: string | null;
  balances: LeaveBalanceInfo[];
  existingLeaves?: TimeOffResponse[];
  policies?: LeavePolicyInfo[];
  onClose: () => void;
  onSubmitted: () => void;
}

export default function RequestLeaveModal({ initialDate, balances, existingLeaves = [], policies = [], onClose, onSubmitted }: Props) {
  const [startDate, setStartDate] = useState(initialDate || '');
  const [endDate, setEndDate] = useState(initialDate || '');
  const [leaveType, setLeaveType] = useState(() => balances[0]?.leaveType || 'ANNUAL');
  const [isCompanySponsored, setIsCompanySponsored] = useState(true);
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showUnpaidWarning, setShowUnpaidWarning] = useState(false);

  const selectedBalance = balances.find(b => b.leaveType === leaveType);
  const remaining = selectedBalance ? selectedBalance.totalLeaves - selectedBalance.usedLeaves : 0;

  // Calculate working day count between dates without timezone shift
  const dayCount = useMemo(() => {
    if (!startDate || !endDate || startDate > endDate) return 0;
    const [sy, sm, sd] = startDate.split('-').map(Number);
    const [ey, em, ed] = endDate.split('-').map(Number);
    let count = 0;
    const cur = new Date(sy, sm - 1, sd);
    const end = new Date(ey, em - 1, ed);
    while (cur <= end) {
      const day = cur.getDay();
      if (day !== 0 && day !== 6) { // Mon-Fri working days
        count++;
      }
      cur.setDate(cur.getDate() + 1);
    }
    return count;
  }, [startDate, endDate]);

  const handleStartDateChange = (val: string) => {
    setStartDate(val);
    if (!endDate || val > endDate) {
      setEndDate(val);
    }
  };

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

    if (leaveType !== 'UNPAID') {
      const isEligible = balances.some(b => b.leaveType.toUpperCase() === leaveType.toUpperCase()) ||
        policies.some(p => p.leaveType.toUpperCase() === leaveType.toUpperCase());
      if (!isEligible) {
        setError(`You are not eligible to request ${leaveType} leave under your current assigned policies.`);
        return;
      }
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

  const isPaid = leaveType === 'ANNUAL' ? isCompanySponsored : leaveType !== 'UNPAID';

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: 560 }}>
        <div className="modal-header">
          <div>
            <h2 className="modal-title">Request Leave</h2>
            <div style={{ fontSize: 'var(--font-size-2xs)', color: 'var(--text-tertiary)', marginTop: 2 }}>
              Submit a new leave request for approval
            </div>
          </div>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">
          {error && <div className="alert alert-error"><span>⚠</span> {error}</div>}

          {showUnpaidWarning && (
            <div className="alert alert-warning" style={{ flexDirection: 'column', alignItems: 'flex-start' }}>
              <strong>⚠ Insufficient Paid Leave Balance</strong>
              <p style={{ margin: '6px 0', fontSize: 'var(--font-size-xs)' }}>
                You do not have enough paid quota. You can apply as a <strong>Non-Sponsored / Unpaid Leave (Loss of Pay)</strong>.
              </p>
              <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                <button type="button" className="btn btn-primary btn-sm" onClick={handleSwitchToUnpaid}>Switch to Unpaid</button>
                <button type="button" className="btn btn-secondary btn-sm" onClick={() => setShowUnpaidWarning(false)}>Cancel</button>
              </div>
            </div>
          )}

          {/* Policy Information Box */}
          <div style={{
            background: 'var(--wd-blue-50)',
            border: '1px solid rgba(0, 100, 210, 0.1)',
            borderRadius: 'var(--radius-lg)',
            padding: '12px 14px',
            marginBottom: '18px',
            fontSize: 'var(--font-size-xs)',
            color: 'var(--text-secondary)'
          }}>
            <div style={{ fontWeight: 700, color: 'var(--wd-blue)', marginBottom: '4px', fontSize: 'var(--font-size-xs)' }}>
              ℹ️ Leave Request Guidelines
            </div>
            <div>
              • <strong>Overlap Prevention:</strong> Cannot overlap with existing pending/approved leave.<br />
              • <strong>Annual Leave:</strong> Choose between Company Sponsored (paid) or Non-Sponsored (unpaid).<br />
              • <strong>Approval:</strong> Your request will follow the configured approval chain.
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
                {balances.length > 0 ? (
                  balances.map(b => (
                    <option key={b.leaveType} value={b.leaveType}>
                      {b.leaveType.charAt(0) + b.leaveType.slice(1).toLowerCase()} Leave {b.leaveType === 'ANNUAL' ? '(Standalone)' : ''}
                    </option>
                  ))
                ) : (
                  <>
                    <option value="SICK">Sick Leave</option>
                    <option value="CASUAL">Casual Leave</option>
                  </>
                )}
                <option value="UNPAID">Unpaid Leave (Loss of Pay)</option>
              </select>
              {leaveType !== 'UNPAID' && selectedBalance && (() => {
                const pol = policies.find(p => p.leaveType.toUpperCase() === leaveType.toUpperCase());
                return (
                  <div className="form-hint" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span>
                      Available Quota: <strong style={{ color: remaining > 0 ? 'var(--wd-green)' : 'var(--wd-red)' }}>{remaining} days</strong> remaining of {selectedBalance.totalLeaves} total
                    </span>
                    {pol && (
                      <span style={{ color: 'var(--wd-blue)', fontWeight: 600 }}>
                        ⚡ Accrual: +{pol.accrualRate ?? (leaveType === 'ANNUAL' ? 1.67 : 0.83)} d/{pol.accrualFrequency?.toLowerCase() === 'annual' ? 'yr' : 'mo'}
                      </span>
                    )}
                  </div>
                );
              })()}
            </div>

            {/* Sponsorship Selection Options - ONLY FOR ANNUAL LEAVE */}
            {leaveType === 'ANNUAL' && (
              <div className="form-group">
                <label className="form-label">Annual Leave Sponsorship & Pay Option</label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                  <label style={{
                    display: 'flex', flexDirection: 'column', padding: '14px',
                    borderRadius: 'var(--radius-lg)',
                    border: isCompanySponsored ? '2px solid var(--wd-green)' : '1.5px solid var(--border-default)',
                    background: isCompanySponsored ? 'var(--wd-green-light)' : 'white',
                    cursor: 'pointer', transition: 'all var(--transition-fast)'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                      <input type="radio" name="sponsorship" checked={isCompanySponsored} onChange={() => setIsCompanySponsored(true)} style={{ accentColor: 'var(--wd-green)' }} />
                      <span style={{ fontWeight: 700, fontSize: 'var(--font-size-sm)', color: isCompanySponsored ? 'var(--wd-green)' : 'var(--text-primary)' }}>
                        Company Sponsored
                      </span>
                    </div>
                    <span style={{ fontSize: 'var(--font-size-2xs)', color: 'var(--text-secondary)', lineHeight: 1.4 }}>
                      Paid — salary credited (deducted from balance).
                    </span>
                  </label>

                  <label style={{
                    display: 'flex', flexDirection: 'column', padding: '14px',
                    borderRadius: 'var(--radius-lg)',
                    border: !isCompanySponsored ? '2px solid var(--wd-orange)' : '1.5px solid var(--border-default)',
                    background: !isCompanySponsored ? 'var(--wd-orange-light)' : 'white',
                    cursor: 'pointer', transition: 'all var(--transition-fast)'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                      <input type="radio" name="sponsorship" checked={!isCompanySponsored} onChange={() => setIsCompanySponsored(false)} style={{ accentColor: 'var(--wd-orange)' }} />
                      <span style={{ fontWeight: 700, fontSize: 'var(--font-size-sm)', color: !isCompanySponsored ? 'var(--wd-orange)' : 'var(--text-primary)' }}>
                        Non-Sponsored
                      </span>
                    </div>
                    <span style={{ fontSize: 'var(--font-size-2xs)', color: 'var(--text-secondary)', lineHeight: 1.4 }}>
                      Unpaid Leave (Loss of Pay).
                    </span>
                  </label>
                </div>
              </div>
            )}

            {/* Live Pay Status Preview */}
            <div style={{
              display: 'flex', alignItems: 'center', gap: 12,
              padding: '12px 14px', borderRadius: 'var(--radius-lg)',
              background: isPaid ? 'var(--wd-green-light)' : 'var(--wd-orange-light)',
              border: `1px solid ${isPaid ? 'rgba(5, 150, 105, 0.15)' : 'rgba(217, 119, 6, 0.15)'}`,
              marginBottom: '18px'
            }}>
              <span style={{ fontSize: '1.2rem' }}>{isPaid ? '🟢' : '🔴'}</span>
              <div>
                <div style={{ fontSize: 'var(--font-size-xs)', fontWeight: 700, color: isPaid ? 'var(--wd-green)' : 'var(--wd-orange)' }}>
                  {isPaid ? 'PAID (SALARY CREDITED)' : 'UNPAID LEAVE (LOSS OF PAY)'}
                </div>
                <div style={{ fontSize: 'var(--font-size-2xs)', color: 'var(--text-secondary)' }}>
                  {isPaid ? 'Salary will be credited as normal for approved working days.' : 'Salary will NOT be credited for this leave duration.'}
                </div>
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Start Date</label>
                <input
                  type="date"
                  className="form-input"
                  value={startDate}
                  onChange={e => handleStartDateChange(e.target.value)}
                  required
                />
              </div>
              <div className="form-group">
                <label className="form-label">End Date</label>
                <input
                  type="date"
                  className="form-input"
                  value={endDate}
                  min={startDate}
                  onChange={e => setEndDate(e.target.value)}
                  required
                />
              </div>
            </div>

            {/* Day count preview */}
            {dayCount > 0 && (
              <div style={{
                textAlign: 'center', padding: '8px', marginBottom: 14,
                background: 'var(--bg-subtle)', borderRadius: 'var(--radius-md)',
                fontSize: 'var(--font-size-xs)', color: 'var(--text-secondary)', fontWeight: 600
              }}>
                📅 <strong style={{ color: 'var(--wd-blue)' }}>{dayCount} working {dayCount === 1 ? 'day' : 'days'}</strong> (Mon–Fri)
              </div>
            )}

            {/* Exceeding Accrued Balance Alert */}
            {isPaid && dayCount > remaining && remaining >= 0 && (
              <div className="alert alert-warning" style={{ marginBottom: 14, flexDirection: 'column', alignItems: 'flex-start' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 700 }}>
                  <span>⚠️</span> Request Exceeds Available Accrued Quota
                </div>
                <div style={{ fontSize: 'var(--font-size-xs)', marginTop: 4, lineHeight: 1.4 }}>
                  You requested <strong>{dayCount} days</strong>, but only have <strong>{remaining} days</strong> of paid {leaveType.toLowerCase()} leave accrued to date.
                  The excess <strong>{dayCount - remaining} {dayCount - remaining === 1 ? 'day' : 'days'}</strong> should be applied as <strong>Unpaid Leave (Loss of Pay)</strong>.
                </div>
                <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={() => {
                      setLeaveType('UNPAID');
                      setIsCompanySponsored(false);
                    }}
                  >
                    Switch to Unpaid Leave (Loss of Pay)
                  </button>
                </div>
              </div>
            )}

            <div className="form-group">
              <label className="form-label">Reason / Comments</label>
              <textarea className="form-textarea" value={reason} onChange={e => setReason(e.target.value)} placeholder="Provide any context or justification for your manager & HR…" required />
            </div>

            <div className="modal-footer" style={{ padding: 0, borderTop: 'none', marginTop: 8 }}>
              <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
              <button type="submit" className="btn btn-primary" disabled={isSubmitting}>
                {isSubmitting ? (
                  <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{
                      width: 14, height: 14, border: '2px solid rgba(255,255,255,0.3)',
                      borderTopColor: 'white', borderRadius: '50%',
                      animation: 'spin 0.6s linear infinite', display: 'inline-block'
                    }} />
                    Submitting…
                  </span>
                ) : 'Submit Request'}
              </button>
            </div>
          </form>
        </div>
      </div>

      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}

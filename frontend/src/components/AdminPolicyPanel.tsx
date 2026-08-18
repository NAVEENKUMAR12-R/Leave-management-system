import { useState, useEffect } from 'react';
import api from '../api';
import type { LeavePolicyInfo } from '../types';

export default function AdminPolicyPanel() {
  const [policies, setPolicies] = useState<LeavePolicyInfo[]>([]);
  const [editing, setEditing] = useState<LeavePolicyInfo | null>(null);
  const [showForm, setShowForm] = useState(false);

  useEffect(() => {
    fetchPolicies();
  }, []);

  const fetchPolicies = async () => {
    try {
      const res = await api.get('/admin/policies');
      setPolicies(res.data);
    } catch (err) {
      console.error('Failed to fetch policies', err);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editing) return;
    try {
      await api.post('/admin/policies', editing);
      fetchPolicies();
      setShowForm(false);
      setEditing(null);
    } catch (err) {
      alert('Failed to save policy.');
    }
  };

  const openCreate = () => {
    setEditing({ leaveType: 'ANNUAL', defaultDays: 20, isCarryForwardAllowed: false, maxCarryForwardDays: 0 });
    setShowForm(true);
  };

  const openEdit = (p: LeavePolicyInfo) => {
    setEditing({ ...p });
    setShowForm(true);
  };

  return (
    <>
      <div className="card animate-in">
        <div className="card-header">
          <div>
            <div className="card-title">Leave Policy Configuration</div>
            <div className="card-subtitle">Manage company-wide absence policies</div>
          </div>
          <button className="btn btn-primary" onClick={openCreate}>＋ Add Policy</button>
        </div>
        <div className="card-body">
          {policies.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-icon">⚙️</div>
              <div className="empty-state-text">No policies configured yet. Create your first leave policy to get started.</div>
            </div>
          ) : (
            policies.map(p => (
              <div key={p.id} className="policy-card">
                <div>
                  <div className="policy-type">{p.leaveType} Leave</div>
                  <div className="policy-detail">
                    {p.defaultDays} days/year
                    {p.isCarryForwardAllowed && ` · Max ${p.maxCarryForwardDays} carry-forward`}
                  </div>
                </div>
                <button className="btn btn-secondary btn-sm" onClick={() => openEdit(p)}>Edit</button>
              </div>
            ))
          )}
        </div>
      </div>

      {showForm && editing && (
        <div className="modal-overlay" onClick={() => setShowForm(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">{editing.id ? 'Edit' : 'Create'} Leave Policy</h2>
              <button className="modal-close" onClick={() => setShowForm(false)}>✕</button>
            </div>
            <div className="modal-body">
              <form onSubmit={handleSave}>
                <div className="form-group">
                  <label className="form-label">Leave Type</label>
                  <select className="form-select" value={editing.leaveType} onChange={e => setEditing({ ...editing, leaveType: e.target.value })}>
                    <option value="ANNUAL">Annual</option>
                    <option value="SICK">Sick</option>
                    <option value="CASUAL">Casual</option>
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Default Days Per Year</label>
                  <input type="number" className="form-input" value={editing.defaultDays} onChange={e => setEditing({ ...editing, defaultDays: Number(e.target.value) })} min={0} required />
                </div>
                <div className="form-group" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <input type="checkbox" id="carryForward" checked={editing.isCarryForwardAllowed} onChange={e => setEditing({ ...editing, isCarryForwardAllowed: e.target.checked })} />
                  <label htmlFor="carryForward" className="form-label" style={{ marginBottom: 0 }}>Allow Carry Forward</label>
                </div>
                {editing.isCarryForwardAllowed && (
                  <div className="form-group">
                    <label className="form-label">Max Carry Forward Days</label>
                    <input type="number" className="form-input" value={editing.maxCarryForwardDays} onChange={e => setEditing({ ...editing, maxCarryForwardDays: Number(e.target.value) })} min={0} />
                  </div>
                )}
                <div className="modal-footer" style={{ padding: 0, borderTop: 'none', marginTop: 8 }}>
                  <button type="button" className="btn btn-secondary" onClick={() => setShowForm(false)}>Cancel</button>
                  <button type="submit" className="btn btn-primary">Save Policy</button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

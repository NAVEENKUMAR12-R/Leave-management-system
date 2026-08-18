import { useState, useEffect } from 'react';
import { useAuth } from '../AuthContext';
import axios from 'axios';

export default function Dashboard() {
    const { user, logout } = useAuth();
    const [myLeaves, setMyLeaves] = useState([]);
    const [teamLeaves, setTeamLeaves] = useState([]);
    
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [reason, setReason] = useState('');

    const token = user?.token;

    const axiosConfig = {
        headers: { Authorization: `Bearer ${token}` }
    };

    const fetchLeaves = async () => {
        try {
            const myLeavesRes = await axios.get('http://localhost:8080/api/leaves/my-leaves', axiosConfig);
            setMyLeaves(myLeavesRes.data);
            
            if (user.roles.includes("ROLE_MANAGER") || user.roles.includes("ROLE_HR")) {
                const teamLeavesRes = await axios.get('http://localhost:8080/api/leaves/to-approve', axiosConfig);
                setTeamLeaves(teamLeavesRes.data);
            }
        } catch (err) {
            console.error("Failed to fetch leaves", err);
        }
    };

    useEffect(() => {
        if (user) {
            fetchLeaves();
        }
    }, [user]);

    const applyLeave = async (e) => {
        e.preventDefault();
        try {
            await axios.post('http://localhost:8080/api/leaves/apply', {
                startDate, endDate, reason
            }, axiosConfig);
            setStartDate('');
            setEndDate('');
            setReason('');
            fetchLeaves();
        } catch (err) {
            alert("Failed to apply leave");
        }
    };

    const processLeave = async (leaveId, status) => {
        try {
            await axios.put(`http://localhost:8080/api/leaves/${leaveId}/process`, { status }, axiosConfig);
            fetchLeaves();
        } catch (err) {
            alert("Failed to process leave");
        }
    };

    return (
        <div>
            <nav className="nav">
                <h2>Welcome, {user.name}</h2>
                <button className="btn btn-danger" onClick={logout}>Logout</button>
            </nav>
            <div className="container">
                <div style={{ display: 'flex', gap: '2rem', flexWrap: 'wrap' }}>
                    
                    <div style={{ flex: '1 1 400px' }}>
                        <div className="glass-panel" style={{ marginBottom: '2rem' }}>
                            <h3>Apply for Leave</h3>
                            <form onSubmit={applyLeave}>
                                <input className="input-field" type="date" value={startDate} onChange={e => setStartDate(e.target.value)} required />
                                <input className="input-field" type="date" value={endDate} onChange={e => setEndDate(e.target.value)} required />
                                <input className="input-field" type="text" placeholder="Reason" value={reason} onChange={e => setReason(e.target.value)} required />
                                <button type="submit" className="btn" style={{ width: '100%' }}>Submit Request</button>
                            </form>
                        </div>

                        <div className="glass-panel">
                            <h3>My Leave History</h3>
                            <table style={{ width: '100%', textAlign: 'left', borderCollapse: 'collapse' }}>
                                <thead>
                                    <tr style={{ borderBottom: '1px solid var(--glass-border)' }}>
                                        <th style={{ padding: '0.5rem 0' }}>Date</th>
                                        <th style={{ padding: '0.5rem 0' }}>Status</th>
                                        <th style={{ padding: '0.5rem 0' }}>Reason</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {myLeaves.map(l => (
                                        <tr key={l.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                                            <td style={{ padding: '0.5rem 0' }}>{l.startDate} to {l.endDate}</td>
                                            <td style={{ padding: '0.5rem 0' }}>{l.status}</td>
                                            <td style={{ padding: '0.5rem 0' }}>{l.reason}</td>
                                        </tr>
                                    ))}
                                    {myLeaves.length === 0 && (
                                        <tr><td colSpan="3" style={{ padding: '1rem 0', textAlign: 'center' }}>No leave history</td></tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {(user.roles.includes("ROLE_MANAGER") || user.roles.includes("ROLE_HR") || user.roles.includes("ROLE_HR_ADMIN")) && (
                        <div style={{ flex: '1 1 500px' }}>
                            <div className="glass-panel">
                                <h3>Team Leaves to Approve</h3>
                                <table style={{ width: '100%', textAlign: 'left', borderCollapse: 'collapse' }}>
                                    <thead>
                                        <tr style={{ borderBottom: '1px solid var(--glass-border)' }}>
                                            <th style={{ padding: '0.5rem 0' }}>Applicant</th>
                                            <th style={{ padding: '0.5rem 0' }}>Date</th>
                                            <th style={{ padding: '0.5rem 0' }}>Status</th>
                                            <th style={{ padding: '0.5rem 0' }}>Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {teamLeaves.map(l => (
                                            <tr key={l.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                                                <td style={{ padding: '0.5rem 0' }}>{l.applicant?.name || 'Unknown'}</td>
                                                <td style={{ padding: '0.5rem 0' }}>{l.startDate}<br/>to {l.endDate}</td>
                                                <td style={{ padding: '0.5rem 0' }}>{l.status}</td>
                                                <td style={{ padding: '0.5rem 0' }}>
                                                    {l.status === 'PENDING' && (
                                                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                                                            <button className="btn btn-success" style={{ padding: '0.25rem 0.5rem', fontSize: '0.875rem' }} onClick={() => processLeave(l.id, 'APPROVED')}>Approve</button>
                                                            <button className="btn btn-danger" style={{ padding: '0.25rem 0.5rem', fontSize: '0.875rem' }} onClick={() => processLeave(l.id, 'REJECTED')}>Reject</button>
                                                        </div>
                                                    )}
                                                </td>
                                            </tr>
                                        ))}
                                        {teamLeaves.length === 0 && (
                                            <tr><td colSpan="4" style={{ padding: '1rem 0', textAlign: 'center' }}>No pending requests</td></tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

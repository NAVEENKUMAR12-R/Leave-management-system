import { useState } from 'react';
import { useAuth } from '../AuthContext';
import { useNavigate } from 'react-router-dom';
import { Copy, Check, Shield, Briefcase, User } from 'lucide-react';

interface DemoUser {
  role: string;
  name: string;
  email: string;
  icon: typeof Shield;
}

const DEMO_USERS: DemoUser[] = [
  { role: 'HR Admin', name: 'Admin HR', email: 'admin@example.com', icon: Shield },
  { role: 'Manager', name: 'Sarah Jenkins', email: 'sarah@example.com', icon: Briefcase },
  { role: 'Employee', name: 'Alice Cooper', email: 'alice@example.com', icon: User },
];

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const { login } = useAuth();
  const navigate = useNavigate();
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [copiedEmail, setCopiedEmail] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');
    try {
      await login(email, password);
      navigate('/');
    } catch {
      setError('Invalid email or password. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleQuickFill = (userEmail: string) => {
    setEmail(userEmail);
    setPassword('password');
    setError('');
  };

  const handleCopy = (userEmail: string) => {
    navigator.clipboard.writeText(`Email: ${userEmail}\nPassword: password`);
    setCopiedEmail(userEmail);
    setTimeout(() => setCopiedEmail(null), 2000);
  };

  return (
    <div className="login-page">
      <div className="login-card">
        <div className="login-logo">
          <div className="login-logo-icon">L</div>
          <span className="login-logo-text">Leave Hub</span>
        </div>
        <h1 className="login-title">Welcome back</h1>
        <p className="login-subtitle">Sign in to your leave management portal</p>

        {error && (
          <div className="alert alert-error">
            <span>⚠</span> {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">Email Address</label>
            <input
              id="login-email"
              className="form-input"
              type="email"
              placeholder="you@company.com"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              autoFocus
            />
          </div>
          <div className="form-group">
            <label className="form-label">Password</label>
            <input
              id="login-password"
              className="form-input"
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
            />
          </div>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, fontSize: 'var(--font-size-xs)' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--text-secondary)', cursor: 'pointer' }}>
              <input type="checkbox" style={{ accentColor: 'var(--wd-blue)' }} />
              Remember me
            </label>
            <a href="#" onClick={e => e.preventDefault()} style={{ color: 'var(--wd-blue)', fontWeight: 600 }}>Forgot password?</a>
          </div>

          <button
            id="login-submit"
            type="submit"
            className="btn btn-primary btn-lg"
            style={{ width: '100%' }}
            disabled={isLoading}
          >
            {isLoading ? (
              <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ 
                  width: 16, height: 16, border: '2px solid rgba(255,255,255,0.3)', 
                  borderTopColor: 'white', borderRadius: '50%',
                  animation: 'spin 0.6s linear infinite', display: 'inline-block'
                }} />
                Signing in…
              </span>
            ) : 'Sign In'}
          </button>
        </form>

        {/* Demo Users Quick Access Section */}
        <div style={{ marginTop: 24, paddingTop: 18, borderTop: '1px dashed var(--border-default)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
            <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Demo Accounts (Password: password)
            </span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {DEMO_USERS.map(u => {
              const Icon = u.icon;
              const isCopied = copiedEmail === u.email;
              return (
                <div
                  key={u.email}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '8px 10px',
                    borderRadius: 8,
                    background: 'var(--bg-subtle, #f8fafc)',
                    border: '1px solid var(--border-default, #e2e8f0)',
                    fontSize: '12px'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{
                      width: 26,
                      height: 26,
                      borderRadius: 6,
                      background: 'rgba(37, 99, 235, 0.1)',
                      color: '#2563eb',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}>
                      <Icon size={14} />
                    </div>
                    <div>
                      <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{u.role}</div>
                      <div style={{ fontSize: '11px', color: 'var(--text-tertiary)' }}>{u.email}</div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <button
                      type="button"
                      onClick={() => handleQuickFill(u.email)}
                      className="btn"
                      style={{
                        padding: '3px 8px',
                        fontSize: '11px',
                        fontWeight: 600,
                        borderRadius: 5,
                        background: '#eff6ff',
                        color: '#2563eb',
                        border: '1px solid #bfdbfe',
                        cursor: 'pointer'
                      }}
                      title="Auto-fill login inputs"
                    >
                      Fill
                    </button>
                    <button
                      type="button"
                      onClick={() => handleCopy(u.email)}
                      className="btn"
                      style={{
                        padding: '3px 7px',
                        fontSize: '11px',
                        borderRadius: 5,
                        background: isCopied ? '#ecfdf5' : '#f1f5f9',
                        color: isCopied ? '#059669' : '#64748b',
                        border: isCopied ? '1px solid #a7f3d0' : '1px solid #cbd5e1',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 4,
                        cursor: 'pointer'
                      }}
                      title="Copy credentials"
                    >
                      {isCopied ? <Check size={12} /> : <Copy size={12} />}
                      {isCopied ? 'Copied' : 'Copy'}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div style={{ textAlign: 'center', marginTop: 24, paddingTop: 16, borderTop: '1px solid var(--border-default)' }}>
          <p style={{ fontSize: 'var(--font-size-2xs)', color: 'var(--text-tertiary)' }}>
            Leave Management System · © {new Date().getFullYear()} Leave Hub
          </p>
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

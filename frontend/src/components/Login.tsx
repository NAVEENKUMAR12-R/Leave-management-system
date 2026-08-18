import { useState } from 'react';
import { useAuth } from '../AuthContext';
import { useNavigate } from 'react-router-dom';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const { login } = useAuth();
  const navigate = useNavigate();
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

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

        <div style={{ textAlign: 'center', marginTop: 28, paddingTop: 20, borderTop: '1px solid var(--border-default)' }}>
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

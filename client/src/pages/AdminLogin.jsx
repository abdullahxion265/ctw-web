import { useState } from 'react';
import { useNavigate, Navigate } from 'react-router-dom';
import { LogIn, Eye, EyeOff, ShieldCheck } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { LogoFull } from '../components/Logo';

export default function AdminLogin() {
  const { login, user, loading } = useAuth();
  const navigate = useNavigate();

  const [form, setForm] = useState({ email: '', password: '' });
  const [showPw, setShowPw] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  // Already logged in — redirect
  if (!loading && user?.role === 'admin') return <Navigate to="/admin" replace />;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      await login(form.email, form.password);
      navigate('/admin');
    } catch (err) {
      setError(err.message || 'Login failed. Check your credentials.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '2rem 1.5rem',
        background: 'var(--color-primary-dark)',
      }}
    >
      <div className="hero-bg" />
      <div className="hero-lines" />

      <div
        style={{
          position: 'relative',
          zIndex: 1,
          width: '100%',
          maxWidth: '420px',
        }}
      >
        {/* Logo */}
        <div style={{ marginBottom: '2.25rem' }}>
          <LogoFull width={210} style={{ margin: '0 auto' }} />
        </div>

        {/* Card */}
        <div
          style={{
            background: 'var(--color-secondary-dark)',
            border: '1px solid rgba(170,124,17,0.2)',
            borderRadius: '14px',
            padding: '2.5rem 2rem',
            boxShadow: '0 24px 60px rgba(0,0,0,0.4)',
          }}
        >
          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
            <ShieldCheck size={20} style={{ color: 'var(--color-accent-gold)' }} />
            <h1 className="font-display" style={{ fontSize: '1.4rem', fontWeight: 700, color: 'var(--color-neutral-light)' }}>
              Admin Login
            </h1>
          </div>
          <p style={{ fontSize: '0.82rem', color: 'var(--color-muted-gray)', marginBottom: '2rem' }}>
            Restricted to authorised personnel only.
          </p>

          {/* Error */}
          {error && (
            <div
              style={{
                padding: '0.75rem 1rem',
                background: 'rgba(239,68,68,0.08)',
                border: '1px solid rgba(239,68,68,0.25)',
                borderRadius: '6px',
                color: '#ef4444',
                fontSize: '0.83rem',
                marginBottom: '1.25rem',
              }}
            >
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.1rem' }}>
            {/* Email */}
            <div>
              <label
                htmlFor="email"
                className="font-mono"
                style={{ display: 'block', fontSize: '0.68rem', letterSpacing: '0.14em', color: 'var(--color-muted-gold)', textTransform: 'uppercase', marginBottom: '0.45rem' }}
              >
                Email
              </label>
              <input
                id="email"
                type="email"
                className="input-dark"
                placeholder="Email address"
                value={form.email}
                onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                required
                autoComplete="email"
              />
            </div>

            {/* Password */}
            <div>
              <label
                htmlFor="password"
                className="font-mono"
                style={{ display: 'block', fontSize: '0.68rem', letterSpacing: '0.14em', color: 'var(--color-muted-gold)', textTransform: 'uppercase', marginBottom: '0.45rem' }}
              >
                Password
              </label>
              <div style={{ position: 'relative' }}>
                <input
                  id="password"
                  type={showPw ? 'text' : 'password'}
                  className="input-dark"
                  placeholder="••••••••"
                  value={form.password}
                  onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                  required
                  autoComplete="current-password"
                  style={{ paddingRight: '2.75rem' }}
                />
                <button
                  type="button"
                  onClick={() => setShowPw(v => !v)}
                  style={{
                    position: 'absolute',
                    right: '0.85rem',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    color: 'var(--color-muted-gray)',
                    display: 'flex',
                    padding: 0,
                  }}
                >
                  {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {/* Submit */}
            <button
              type="submit"
              className="btn-gold"
              disabled={submitting}
              style={{ marginTop: '0.5rem', justifyContent: 'center', padding: '0.9rem', opacity: submitting ? 0.7 : 1 }}
            >
              <LogIn size={15} />
              <span>{submitting ? 'Signing in...' : 'Sign In'}</span>
            </button>
          </form>
        </div>
      </div>
    </main>
  );
}

import { useState, useRef, useLayoutEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { Lock, User, Eye, EyeOff, Radio, AlertTriangle, ArrowRight } from 'lucide-react';
import gsap from 'gsap';

export default function LoginPage() {
  const { login } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const containerRef = useRef(null);
  const formRef = useRef(null);

  useLayoutEffect(() => {
    if (containerRef.current) {
      const tl = gsap.timeline();
      tl.fromTo(containerRef.current,
        { opacity: 0 },
        { opacity: 1, duration: 0.6, ease: 'power2.out' }
      );
      tl.fromTo(formRef.current,
        { opacity: 0, y: 40, scale: 0.95 },
        { opacity: 1, y: 0, scale: 1, duration: 0.8, ease: 'power3.out' },
        '-=0.3'
      );
    }
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!username.trim() || !password.trim()) return;

    setLoading(true);
    setError(null);

    try {
      await login(username.trim(), password);
    } catch (err) {
      setError(err.message);
      // Shake animation on error
      gsap.fromTo(formRef.current,
        { x: -10 },
        { x: 0, duration: 0.5, ease: 'elastic.out(1, 0.3)' }
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div ref={containerRef} className="login-container">
      {/* Background effects */}
      <div className="login-bg-grid" />
      <div className="login-bg-glow login-bg-glow-1" />
      <div className="login-bg-glow login-bg-glow-2" />
      <div className="login-bg-glow login-bg-glow-3" />

      {/* Floating particles */}
      <div className="login-particles">
        {[...Array(20)].map((_, i) => (
          <div
            key={i}
            className="login-particle"
            style={{
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`,
              animationDelay: `${Math.random() * 6}s`,
              animationDuration: `${4 + Math.random() * 6}s`,
              width: `${2 + Math.random() * 3}px`,
              height: `${2 + Math.random() * 3}px`,
            }}
          />
        ))}
      </div>

      <div ref={formRef} className="login-card">
        {/* Header */}
        <div className="login-header">
          <div className="login-logo">
            <div className="login-logo-icon">
              <Radio size={28} />
            </div>
            <div className="login-logo-ring" />
            <div className="login-logo-ring login-logo-ring-2" />
          </div>
          <h1 className="login-title">
            Lolly<span className="text-gradient">D</span>
          </h1>
          <p className="login-subtitle">Travel Sensor Dashboard</p>
          <div className="glow-line" style={{ width: 120, margin: '12px auto 0' }} />
        </div>

        {/* Error message */}
        {error && (
          <div className="login-error">
            <AlertTriangle size={16} />
            <span>{error}</span>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="login-form">
          <div className="login-field">
            <label className="login-label">Username</label>
            <div className="login-input-wrapper">
              <User size={16} className="login-input-icon" />
              <input
                id="login-username"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Enter username"
                autoComplete="username"
                autoFocus
                disabled={loading}
              />
            </div>
          </div>

          <div className="login-field">
            <label className="login-label">Password</label>
            <div className="login-input-wrapper">
              <Lock size={16} className="login-input-icon" />
              <input
                id="login-password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter password"
                autoComplete="current-password"
                disabled={loading}
              />
              <button
                type="button"
                className="login-toggle-password"
                onClick={() => setShowPassword(!showPassword)}
                tabIndex={-1}
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            className="login-submit"
            disabled={loading || !username.trim() || !password.trim()}
          >
            {loading ? (
              <div className="login-spinner" />
            ) : (
              <>
                Access Dashboard
                <ArrowRight size={18} />
              </>
            )}
          </button>
        </form>

        {/* Footer */}
        <div className="login-footer">
          <div className="login-footer-line" />
          <p>Secure IoT Telemetry Access</p>
          <div style={{ display: 'flex', gap: 16, justifyContent: 'center', marginTop: 8 }}>
            <span className="login-footer-badge">🔒 SHA-256</span>
            <span className="login-footer-badge">📡 Real-time</span>
            <span className="login-footer-badge">🛰️ 8 Sensors</span>
          </div>
        </div>
      </div>
    </div>
  );
}

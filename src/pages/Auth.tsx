import { useState } from 'react';
import logo from '../assets/logo.png';

const BASE = (import.meta.env.VITE_API_URL as string | undefined) ?? 'http://localhost:8000';

export function AuthPage({ onLogin }: { onLogin: (token: string, user: {id: string, name: string, identifier: string}) => void }) {
  const [screen, setScreen] = useState<'login' | 'signup' | 'otp' | 'reset' | 'reset-otp'>('login');
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [debugOtp, setDebugOtp] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);

  const clearMessages = () => {
    setError(null);
    setSuccess(null);
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    clearMessages();
    setLoading(true);
    try {
      const res = await fetch(`${BASE}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier, password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || data.detail || 'Login failed');
      onLogin(data.token, data.user);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    clearMessages();
    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`${BASE}/api/auth/signup/send-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, identifier, password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || data.detail || 'Signup failed');
      if (data.debug_otp) setDebugOtp(data.debug_otp);
      setScreen('otp');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const resendOtp = async () => {
    clearMessages();
    setLoading(true);
    try {
      const res = await fetch(`${BASE}/api/auth/signup/send-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, identifier, password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || data.detail || 'Resend failed');
      if (data.debug_otp) setDebugOtp(data.debug_otp);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async () => {
    clearMessages();
    setLoading(true);
    const otpCode = otp.join('');
    try {
      const res = await fetch(`${BASE}/api/auth/signup/verify-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier, otp_code: otpCode }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || data.detail || 'Verification failed');
      onLogin(data.token, data.user);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleResetSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    clearMessages();
    setLoading(true);
    try {
      const res = await fetch(`${BASE}/api/auth/reset-password/send-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || data.detail || 'Failed to send OTP');
      if (data.debug_otp) setDebugOtp(data.debug_otp);
      setSuccess('Reset code sent');
      setScreen('reset-otp');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleResetVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    clearMessages();
    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`${BASE}/api/auth/reset-password/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier, otp_code: otp.join(''), new_password: password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || data.detail || 'Reset failed');
      setSuccess('Password reset successfully. Please login.');
      setScreen('login');
      setPassword('');
      setConfirmPassword('');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleOtpChange = (index: number, value: string) => {
    if (!/^\d*$/.test(value)) return;
    const newOtp = [...otp];
    newOtp[index] = value;
    setOtp(newOtp);
    if (value && index < 5) {
      const nextInput = document.getElementById(`otp-${index + 1}`);
      nextInput?.focus();
    }
  };

  return (
    <div className="auth-container">
      <div className="auth-card">
        <img src={logo} width={56} height={56} alt="Sigma" style={{ margin: 'auto' }} />
        
        {screen === 'login' && (
          <form onSubmit={handleLogin}>
            <h2>Welcome back</h2>
            <p className="subtitle">Sign in to continue</p>
            {error && <div className="auth-error">{error}</div>}
            {success && <div className="auth-success">{success}</div>}
            <input className="t" type="text" placeholder="Email or Phone" value={identifier} onChange={e => setIdentifier(e.target.value)} required />
            <input className="t" type="password" placeholder="Password" value={password} onChange={e => setPassword(e.target.value)} required />
            <button className="btn" type="submit" disabled={loading}>{loading ? 'Loading...' : 'Login'}</button>
            <div className="auth-divider">or</div>
            <a className="auth-link" onClick={() => { setScreen('signup'); clearMessages(); }}>Don't have an account? Sign up</a>
            <br />
            <a className="auth-link" onClick={() => { setScreen('reset'); clearMessages(); }}>Forgot password?</a>
          </form>
        )}

        {screen === 'signup' && (
          <form onSubmit={handleSignup}>
            <h2>Create an account</h2>
            <p className="subtitle">Join Sigma AI</p>
            {error && <div className="auth-error">{error}</div>}
            <input className="t" type="text" placeholder="Full Name" value={name} onChange={e => setName(e.target.value)} required />
            <input className="t" type="text" placeholder="Email or Phone" value={identifier} onChange={e => setIdentifier(e.target.value)} required />
            <input className="t" type="password" placeholder="Password" value={password} onChange={e => setPassword(e.target.value)} required />
            <input className="t" type="password" placeholder="Confirm Password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} required />
            <button className="btn" type="submit" disabled={loading}>{loading ? 'Loading...' : 'Sign Up'}</button>
            <div className="auth-divider">or</div>
            <a className="auth-link" onClick={() => { setScreen('login'); clearMessages(); }}>Already have an account? Login</a>
          </form>
        )}

        {screen === 'otp' && (
          <div>
            <h2>Verify your account</h2>
            <p className="subtitle">We sent a 6-digit code to {identifier}</p>
            {error && <div className="auth-error">{error}</div>}
            {debugOtp && <div className="debug-otp">For testing: Your OTP is {debugOtp}</div>}
            <div className="otp-inputs">
              {otp.map((d, i) => (
                <input key={i} id={`otp-${i}`} type="text" maxLength={1} value={d} onChange={e => handleOtpChange(i, e.target.value)} />
              ))}
            </div>
            <button className="btn" onClick={handleVerifyOtp} disabled={loading || otp.join('').length < 6}>{loading ? 'Loading...' : 'Verify'}</button>
            <button className="btn o" style={{ marginTop: '12px', width: '100%', justifyContent: 'center' }} onClick={resendOtp} disabled={loading}>Resend OTP</button>
            <a className="auth-link" onClick={() => setScreen('signup')}>Back</a>
          </div>
        )}

        {screen === 'reset' && (
          <form onSubmit={handleResetSendOtp}>
            <h2>Reset Password</h2>
            <p className="subtitle">Enter your email or phone number</p>
            {error && <div className="auth-error">{error}</div>}
            <input className="t" type="text" placeholder="Email or Phone" value={identifier} onChange={e => setIdentifier(e.target.value)} required />
            <button className="btn" type="submit" disabled={loading}>{loading ? 'Loading...' : 'Send Reset Code'}</button>
            <a className="auth-link" onClick={() => { setScreen('login'); clearMessages(); }}>Back to login</a>
          </form>
        )}

        {screen === 'reset-otp' && (
          <form onSubmit={handleResetVerify}>
            <h2>Enter Reset Code</h2>
            <p className="subtitle">We sent a code to {identifier}</p>
            {error && <div className="auth-error">{error}</div>}
            {success && <div className="auth-success">{success}</div>}
            {debugOtp && <div className="debug-otp">For testing: Your OTP is {debugOtp}</div>}
            <div className="otp-inputs">
              {otp.map((d, i) => (
                <input key={i} id={`otp-${i}`} type="text" maxLength={1} value={d} onChange={e => handleOtpChange(i, e.target.value)} />
              ))}
            </div>
            <input className="t" type="password" placeholder="New Password" value={password} onChange={e => setPassword(e.target.value)} required />
            <input className="t" type="password" placeholder="Confirm New Password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} required />
            <button className="btn" type="submit" disabled={loading || otp.join('').length < 6}>{loading ? 'Loading...' : 'Reset Password'}</button>
            <a className="auth-link" onClick={() => { setScreen('login'); clearMessages(); }}>Back to login</a>
          </form>
        )}
      </div>
    </div>
  );
}

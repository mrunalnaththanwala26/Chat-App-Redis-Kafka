import { useState } from 'react';
import { Link } from 'react-router-dom';
import { authApi } from '../services/api';

export default function ForgotPassword() {
  const [step, setStep] = useState(1);
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [resetToken, setResetToken] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [pending, setPending] = useState(false);

  async function submitEmail(e) {
    e.preventDefault();
    setError('');
    setPending(true);
    try {
      await authApi.post('forgot-password', { email });
      setMessage('If an account exists, a code has been sent.');
      setStep(2);
    } catch (err) {
      setError(err.response?.data?.message || 'Request failed');
    } finally {
      setPending(false);
    }
  }

  async function submitCode(e) {
    e.preventDefault();
    setError('');
    setPending(true);
    try {
      const { data } = await authApi.post('verify-reset-code', { email, code });
      setResetToken(data.resetToken);
      setStep(3);
    } catch (err) {
      setError(err.response?.data?.message || 'Invalid code');
    } finally {
      setPending(false);
    }
  }

  async function submitPassword(e) {
    e.preventDefault();
    setError('');
    setPending(true);
    try {
      await authApi.post('reset-password', { resetToken, newPassword });
      setMessage('Password updated. You can sign in.');
      setStep(4);
    } catch (err) {
      setError(err.response?.data?.message || 'Reset failed');
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-md rounded-2xl border border-slate-800 bg-surface-900 p-8 shadow-xl">
        <h1 className="text-2xl font-semibold mb-2">Reset password</h1>
        <p className="text-sm text-slate-400 mb-6">
          Rate limits apply to protect this flow (see server logs if blocked).
        </p>

        {step === 1 && (
          <form onSubmit={submitEmail} className="space-y-4">
            <input
              className="w-full rounded-lg bg-surface-800 border border-slate-700 px-3 py-2"
              placeholder="Email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
            {error && <p className="text-sm text-red-400">{error}</p>}
            <button
              type="submit"
              disabled={pending}
              className="w-full rounded-lg bg-indigo-600 py-2 font-medium disabled:opacity-50"
            >
              Send code
            </button>
          </form>
        )}

        {step === 2 && (
          <form onSubmit={submitCode} className="space-y-4">
            <p className="text-sm text-emerald-400">{message}</p>
            <input
              className="w-full rounded-lg bg-surface-800 border border-slate-700 px-3 py-2"
              placeholder="6-digit code"
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              required
            />
            {error && <p className="text-sm text-red-400">{error}</p>}
            <button type="submit" disabled={pending} className="w-full rounded-lg bg-indigo-600 py-2">
              Verify code
            </button>
          </form>
        )}

        {step === 3 && (
          <form onSubmit={submitPassword} className="space-y-4">
            <input
              className="w-full rounded-lg bg-surface-800 border border-slate-700 px-3 py-2"
              placeholder="New password"
              type="password"
              minLength={8}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              required
            />
            {error && <p className="text-sm text-red-400">{error}</p>}
            <button type="submit" disabled={pending} className="w-full rounded-lg bg-indigo-600 py-2">
              Update password
            </button>
          </form>
        )}

        {step === 4 && (
          <p className="text-emerald-400">
            {message}{' '}
            <Link className="text-indigo-400 underline" to="/login">
              Sign in
            </Link>
          </p>
        )}

        <p className="mt-6 text-sm">
          <Link className="text-indigo-400 hover:underline" to="/login">
            Back to login
          </Link>
        </p>
      </div>
    </div>
  );
}

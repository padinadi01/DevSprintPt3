import { useState, type FormEvent } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { ApiError, getErrorMessage } from '../api/http';
import { useAuth } from '../contexts/AuthContext';
import { btnPrimary, cardClass, inputClass, labelClass } from '../components/ui';

export function LoginPage() {
  const { user, setupRequired, login } = useAuth();
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  if (user) return <Navigate to="/" replace />;
  if (setupRequired) return <Navigate to="/setup" replace />;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      await login(username, pin);
      navigate('/', { replace: true });
    } catch (loginError) {
      setError(
        loginError instanceof ApiError && loginError.status === 429
          ? loginError.message
          : getErrorMessage(loginError),
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 p-4">
      <section className={`${cardClass} w-full max-w-md p-6`}>
        <p className="text-sm font-semibold text-green-700">Warung Madura</p>
        <h1 className="mt-1 text-2xl font-semibold text-slate-900">Masuk ke Stock Manager</h1>
        <p className="mt-2 text-sm text-slate-500">Gunakan username dan PIN akunmu.</p>
        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <div>
            <label htmlFor="username" className={labelClass}>Username</label>
            <input id="username" className={inputClass} autoComplete="username" value={username}
              onChange={(event) => setUsername(event.target.value)} required maxLength={30} />
          </div>
          <div>
            <label htmlFor="pin" className={labelClass}>PIN</label>
            <input id="pin" className={inputClass} type="password" inputMode="numeric"
              autoComplete="current-password" value={pin} onChange={(event) => setPin(event.target.value)}
              required minLength={4} maxLength={12} />
          </div>
          {error && <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
          <button className={`${btnPrimary} w-full`} type="submit" disabled={submitting}>
            {submitting ? 'Memeriksa...' : 'Masuk'}
          </button>
        </form>
      </section>
    </main>
  );
}

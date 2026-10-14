import { useState, type FormEvent } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { getErrorMessage } from '../api/http';
import { useAuth } from '../contexts/AuthContext';
import { btnPrimary, cardClass, inputClass, labelClass } from '../components/ui';

export function SetupPage() {
  const { user, setupRequired, setupOwner } = useAuth();
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [pin, setPin] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  if (user) return <Navigate to="/" replace />;
  if (!setupRequired) return <Navigate to="/login" replace />;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    if (pin !== confirmation) {
      setError('PIN dan konfirmasi PIN tidak sama.');
      return;
    }
    setSubmitting(true);
    try {
      await setupOwner(username, displayName, pin);
      navigate('/', { replace: true });
    } catch (setupError) {
      setError(getErrorMessage(setupError));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 p-4">
      <section className={`${cardClass} w-full max-w-md p-6`}>
        <p className="text-sm font-semibold text-green-700">Setup pertama kali</p>
        <h1 className="mt-1 text-2xl font-semibold text-slate-900">Buat akun Pemilik</h1>
        <p className="mt-2 text-sm text-slate-500">
          PIN disimpan dalam bentuk hash. Akun ini menjadi satu-satunya Pemilik utama.
        </p>
        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <div>
            <label htmlFor="displayName" className={labelClass}>Nama</label>
            <input id="displayName" className={inputClass} autoComplete="name" value={displayName}
              onChange={(event) => setDisplayName(event.target.value)} required maxLength={80} />
          </div>
          <div>
            <label htmlFor="username" className={labelClass}>Username unik</label>
            <input id="username" className={inputClass} autoComplete="username" value={username}
              onChange={(event) => setUsername(event.target.value)} required minLength={3} maxLength={30} />
          </div>
          <div>
            <label htmlFor="pin" className={labelClass}>PIN (4–12 angka)</label>
            <input id="pin" className={inputClass} type="password" inputMode="numeric"
              autoComplete="new-password" value={pin} onChange={(event) => setPin(event.target.value)}
              required minLength={4} maxLength={12} pattern="[0-9]{4,12}" />
          </div>
          <div>
            <label htmlFor="pin-confirm" className={labelClass}>Ulangi PIN</label>
            <input id="pin-confirm" className={inputClass} type="password" inputMode="numeric"
              autoComplete="new-password" value={confirmation}
              onChange={(event) => setConfirmation(event.target.value)} required minLength={4} maxLength={12} />
          </div>
          {error && <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
          <button className={`${btnPrimary} w-full`} type="submit" disabled={submitting}>
            {submitting ? 'Membuat akun...' : 'Buat akun dan masuk'}
          </button>
        </form>
      </section>
    </main>
  );
}

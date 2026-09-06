import { useCallback, useEffect, useState } from 'react';
import Login from '../pages/Login.jsx';
import { checkSession, logout as endSession } from '../utils/auth.js';

/**
 * Protegge l'area riservata. Lo stato di autenticazione è deciso dal server
 * (`GET /api/auth/session`), non da localStorage.
 * `children` è una render-prop che riceve `{ logout }`.
 */
export default function ProtectedRoute({ children }) {
  const [status, setStatus] = useState('checking'); // 'checking' | 'authed' | 'guest'

  useEffect(() => {
    let active = true;
    checkSession().then((ok) => {
      if (active) setStatus(ok ? 'authed' : 'guest');
    });
    return () => {
      active = false;
    };
  }, []);

  const logout = useCallback(async () => {
    await endSession();
    setStatus('guest');
  }, []);

  if (status === 'checking') {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-cream px-4">
        <p className="text-sm font-medium text-brown-soft">Verifica dell’accesso in corso…</p>
      </div>
    );
  }

  if (status === 'guest') {
    return <Login onSuccess={() => setStatus('authed')} />;
  }

  return children({ logout });
}

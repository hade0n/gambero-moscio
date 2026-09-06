import { useCallback, useEffect, useState } from 'react';
import Login from '../pages/Login.jsx';
import { checkSession, logout as endSession } from '../utils/auth.js';

/**
 * Protegge l'area riservata. Lo stato di autenticazione (e quale dei due
 * account è collegato) è deciso dal server (`GET /api/auth/session`).
 * `children` è una render-prop che riceve `{ logout, user }`.
 */
export default function ProtectedRoute({ children }) {
  const [status, setStatus] = useState('checking'); // 'checking' | 'authed' | 'guest'
  const [user, setUser] = useState(null);

  useEffect(() => {
    let active = true;
    checkSession().then(({ authenticated, user: sessionUser }) => {
      if (!active) return;
      setUser(sessionUser);
      setStatus(authenticated ? 'authed' : 'guest');
    });
    return () => {
      active = false;
    };
  }, []);

  const logout = useCallback(async () => {
    await endSession();
    setUser(null);
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
    return (
      <Login
        onSuccess={(loggedUser) => {
          setUser(loggedUser);
          setStatus('authed');
        }}
      />
    );
  }

  return children({ logout, user });
}

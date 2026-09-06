import { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import Icon from '../components/Icon.jsx';
import Field, { controlClasses } from '../components/Field.jsx';
import { CREDENTIALS_ERROR, login } from '../utils/auth.js';

/** Schermata di accesso all'area riservata. */
export default function Login({ onSuccess }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const usernameRef = useRef(null);

  async function handleSubmit(event) {
    event.preventDefault();
    setError('');
    setBusy(true);
    const result = await login(username, password);
    setBusy(false);
    if (result.ok) {
      onSuccess(result.user);
    } else {
      setError(result.error || CREDENTIALS_ERROR);
      usernameRef.current?.focus();
    }
  }

  return (
    <div className="min-h-dvh bg-cream">
      <header className="bg-cream/95">
        <div className="mx-auto flex h-24 max-w-content items-center justify-center px-4 md:h-28 md:justify-start md:px-6">
          <Link
            to="/"
            className="press flex min-h-[44px] items-center"
            aria-label="Gambero Moscio - Recensioni Locali — vai alla homepage"
          >
            <img
              src="/logo.svg"
              alt="Gambero Moscio - Recensioni Locali"
              width="785"
              height="288"
              className="h-16 w-auto sm:h-20 md:h-24"
            />
          </Link>
        </div>
      </header>

      <main className="mx-auto flex max-w-md flex-col px-4 py-10 md:py-16">
        <h1 className="font-display text-2xl font-bold">Area riservata</h1>
        <p className="mt-1 text-sm text-brown-soft">
          Accedi per gestire i locali e le recensioni.
        </p>

        <form
          onSubmit={handleSubmit}
          noValidate
          className="surface mt-6 space-y-5 rounded-3xl p-5 sm:p-6"
        >
          <Field label="Username" required>
            {({ id }) => (
              <input
                ref={usernameRef}
                id={id}
                name="username"
                type="text"
                autoComplete="username"
                autoCapitalize="none"
                spellCheck="false"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className={controlClasses(false)}
              />
            )}
          </Field>

          <Field label="Password" required>
            {({ id }) => (
              <div className="relative">
                <input
                  id={id}
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className={`${controlClasses(false)} pr-12`}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? 'Nascondi la password' : 'Mostra la password'}
                  aria-pressed={showPassword}
                  className="press absolute inset-y-0 right-0 flex w-12 items-center justify-center text-brown-soft hover:text-brown"
                >
                  <Icon name={showPassword ? 'eyeOff' : 'eye'} size={20} />
                </button>
              </div>
            )}
          </Field>

          {error && (
            <p
              role="alert"
              className="flex items-center gap-2 rounded-xl border border-danger/40 bg-danger/10 px-3.5 py-2.5 text-sm font-semibold text-danger"
            >
              <Icon name="alert" size={16} />
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={busy}
            className="btn btn-primary w-full"
          >
            {busy ? 'Accesso in corso…' : 'Accedi'}
          </button>
        </form>

        <Link
          to="/"
          className="mt-6 inline-flex items-center gap-1.5 self-start text-sm font-semibold text-brown-soft transition-colors hover:text-terracotta"
        >
          Torna alla homepage
        </Link>
      </main>
    </div>
  );
}

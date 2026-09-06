/**
 * Client di autenticazione — SOLO frontend.
 *
 * Non contiene credenziali. La verifica di username/password, la validazione
 * della sessione e l'autorizzazione delle operazioni amministrative avvengono
 * lato server nelle Vercel Functions in `api/`. Qui si fanno solo chiamate
 * HTTP; la fonte autorevole dello stato di accesso è sempre il server.
 */

export const CREDENTIALS_ERROR = 'Username o password non corretti.';

async function request(url, { method = 'GET', body } = {}) {
  const res = await fetch(url, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
    credentials: 'same-origin',
  });
  let data = {};
  try {
    data = await res.json();
  } catch {
    /* risposta senza corpo JSON */
  }
  return { res, data };
}

/** Invia le credenziali all'endpoint server-side di login. Ritorna anche lo `user` autenticato. */
export async function login(username, password) {
  try {
    const { res, data } = await request('/api/auth/login', {
      method: 'POST',
      body: { username, password },
    });
    if (res.ok) return { ok: true, user: data.user ?? null };
    return { ok: false, error: data.error || CREDENTIALS_ERROR };
  } catch {
    return { ok: false, error: 'Non è stato possibile contattare il server. Riprova.' };
  }
}

/** Chiede al server di invalidare la sessione. */
export async function logout() {
  try {
    await request('/api/auth/logout', { method: 'POST' });
  } catch {
    /* anche in caso di errore di rete il client torna allo stato "non autenticato" */
  }
}

/**
 * Verifica lato server se esiste una sessione valida.
 * @returns {Promise<{authenticated: boolean, user: string|null}>}
 */
export async function checkSession() {
  try {
    const { res, data } = await request('/api/auth/session');
    if (res.ok && data.authenticated) return { authenticated: true, user: data.user ?? null };
    return { authenticated: false, user: null };
  } catch {
    return { authenticated: false, user: null };
  }
}

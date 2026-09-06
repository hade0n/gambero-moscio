import {
  checkCredentials,
  createSessionToken,
  readJsonBody,
  sessionCookieHeader,
} from '../../lib/session.js';

/**
 * POST /api/auth/login
 * Riceve { username, password }, li confronta con le Environment Variables
 * lato server e, se corretti, imposta un cookie di sessione HttpOnly.
 * Le credenziali non vengono mai registrate nei log.
 */
export default function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Metodo non consentito.' });
  }

  const { username, password } = readJsonBody(req);

  if (!checkCredentials(username, password)) {
    return res.status(401).json({ error: 'Username o password non corretti.' });
  }

  const token = createSessionToken();
  res.setHeader('Set-Cookie', sessionCookieHeader(req, token));
  return res.status(200).json({ ok: true });
}

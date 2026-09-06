import {
  checkCredentials,
  createSessionToken,
  readJsonBody,
  sessionCookieHeader,
} from '../../lib/session.js';

/**
 * POST /api/auth/login
 * Riceve { username, password }, li confronta con le Environment Variables
 * lato server (account `ilenia` / `salvatore`) e, se corretti, imposta un
 * cookie di sessione HttpOnly. Le credenziali non vengono mai registrate nei log.
 */
export default function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Metodo non consentito.' });
  }

  const { username, password } = readJsonBody(req);
  const user = checkCredentials(username, password);

  if (!user) {
    return res.status(401).json({ error: 'Username o password non corretti.' });
  }

  const token = createSessionToken(user);
  res.setHeader('Set-Cookie', sessionCookieHeader(req, token));
  return res.status(200).json({ ok: true, user });
}

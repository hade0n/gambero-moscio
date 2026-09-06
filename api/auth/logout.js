import { clearCookieHeader } from '../../lib/session.js';

/**
 * POST /api/auth/logout
 * Invalida la sessione rimuovendo il cookie HttpOnly.
 */
export default function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Metodo non consentito.' });
  }

  res.setHeader('Set-Cookie', clearCookieHeader(req));
  return res.status(200).json({ ok: true });
}

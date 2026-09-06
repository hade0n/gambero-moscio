import { getSession } from '../../lib/session.js';

/**
 * GET /api/auth/session
 * Fonte autorevole dello stato di autenticazione: il frontend la interroga
 * per decidere se mostrare il Backend o il Login, e quale dei due account
 * (`ilenia` / `salvatore`) è collegato.
 */
export default function handler(req, res) {
  const session = getSession(req);
  return res.status(200).json({
    authenticated: Boolean(session),
    user: session?.user ?? null,
  });
}

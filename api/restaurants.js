import { getSession } from '../lib/session.js';

const WRITE_METHODS = ['POST', 'PUT', 'PATCH', 'DELETE'];

/**
 * /api/restaurants — gate di autorizzazione per le operazioni amministrative.
 *
 * PNDR conserva i dati dei ristoranti in localStorage (nessun database).
 * Questo endpoint NON persiste nulla: verifica che chi tenta un
 * CREATE / UPDATE / DELETE possieda una sessione server-side valida.
 * Il frontend scrive in localStorage solo dopo una risposta 200 da qui,
 * così un utente non autenticato non può modificare i dati chiamando
 * direttamente le API.
 */
export default function handler(req, res) {
  if (!WRITE_METHODS.includes(req.method)) {
    res.setHeader('Allow', WRITE_METHODS.join(', '));
    return res.status(405).json({ error: 'Metodo non consentito.' });
  }

  if (!getSession(req)) {
    return res.status(401).json({ error: 'Sessione non valida. Effettua di nuovo l’accesso.' });
  }

  return res.status(200).json({ ok: true });
}

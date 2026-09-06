import { getSession, readJsonBody } from '../lib/session.js';
import { BlobNotConfiguredError, mutateDoc, readDoc } from '../lib/blob-store.js';
import {
  createId,
  normalizeRestaurant,
  pickPlaceFields,
  placeKey,
} from '../src/utils/model.js';
import { isReviewer } from '../src/config/users.js';

/**
 * /api/restaurants — accesso server-side all'archivio unico su Vercel Blob.
 *
 * GET    (pubblico)  → { version, updatedAt, restaurants }
 * POST   (sessione)  → { op: 'createPlace', data }          crea un locale
 * PUT    (sessione)  → { op: 'updatePlace', id, data }      aggiorna i dati condivisi
 *                   → { op: 'saveReview', id, review }      crea/sostituisce la
 *                                                            recensione dell'utente
 *                                                            AUTENTICATO (mai dal body)
 * DELETE (sessione)  → { id }                               elimina l'intero locale
 *
 * Il token del Blob non arriva mai al client.
 */
export default async function handler(req, res) {
  try {
    if (req.method === 'GET') {
      const doc = await readDoc();
      res.setHeader('Cache-Control', 'no-store');
      return res.status(200).json(doc);
    }

    const session = getSession(req);
    if (!session) {
      return res.status(401).json({ error: 'Sessione non valida. Effettua di nuovo l’accesso.' });
    }

    const body = readJsonBody(req);

    if (req.method === 'POST') {
      if (body.op !== 'createPlace') {
        return res.status(400).json({ error: 'Operazione non valida.' });
      }
      const candidate = normalizeRestaurant({
        ...pickPlaceFields(body.data || {}),
        id: createId(),
        reviews: {},
      });
      if (!candidate) {
        return res.status(400).json({ error: 'I dati del locale non sono completi.' });
      }
      let conflictId = null;
      const doc = await mutateDoc((restaurants) => {
        const existing = restaurants.find((r) => placeKey(r) === placeKey(candidate));
        if (existing) {
          conflictId = existing.id;
          return restaurants; // nessuna modifica
        }
        return [candidate, ...restaurants];
      });
      if (conflictId) {
        return res.status(409).json({
          error: 'Esiste già un locale con questo nome, città e provincia.',
          existingId: conflictId,
        });
      }
      return res.status(200).json(doc);
    }

    if (req.method === 'PUT') {
      const id = String(body.id || '');
      if (!id) return res.status(400).json({ error: 'ID locale mancante.' });

      if (body.op === 'updatePlace') {
        let found = false;
        const doc = await mutateDoc((restaurants) =>
          restaurants.map((r) => {
            if (r.id !== id) return r;
            found = true;
            return normalizeRestaurant({
              ...r,
              ...pickPlaceFields(body.data || {}),
              reviews: r.reviews, // recensioni intatte
              id,
            });
          }),
        );
        if (!found) return res.status(404).json({ error: 'Locale non trovato.' });
        return res.status(200).json(doc);
      }

      if (body.op === 'saveReview') {
        const user = session.user;
        if (!isReviewer(user)) {
          return res.status(403).json({ error: 'Utente non abilitato alle recensioni.' });
        }
        let found = false;
        const doc = await mutateDoc((restaurants) =>
          restaurants.map((r) => {
            if (r.id !== id) return r;
            found = true;
            return normalizeRestaurant({
              ...r,
              reviews: {
                ...r.reviews,
                // solo la propria recensione: quella dell'altro non viene toccata
                [user]: { ratings: body.review?.ratings, review: body.review?.review },
              },
              id,
            });
          }),
        );
        if (!found) return res.status(404).json({ error: 'Locale non trovato.' });
        return res.status(200).json(doc);
      }

      return res.status(400).json({ error: 'Operazione non valida.' });
    }

    if (req.method === 'DELETE') {
      const id = String(body.id || req.query?.id || '');
      if (!id) return res.status(400).json({ error: 'ID locale mancante.' });
      let found = false;
      const doc = await mutateDoc((restaurants) => {
        const next = restaurants.filter((r) => r.id !== id);
        found = next.length !== restaurants.length;
        return found ? next : restaurants;
      });
      if (!found) return res.status(404).json({ error: 'Locale non trovato.' });
      return res.status(200).json(doc);
    }

    res.setHeader('Allow', 'GET, POST, PUT, DELETE');
    return res.status(405).json({ error: 'Metodo non consentito.' });
  } catch (err) {
    if (err instanceof BlobNotConfiguredError) {
      return res.status(503).json({ error: err.message });
    }
    return res.status(500).json({
      error: err?.message || 'Errore imprevisto nell’accesso all’archivio.',
    });
  }
}

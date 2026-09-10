import { getSession, readJsonBody } from '../lib/session.js';
import {
  DbNotConfiguredError,
  createPlace,
  deletePlace,
  readCollection,
  saveReview,
  updateSharedFields,
} from '../lib/db.js';
import { pickPlaceFields, placeKey } from '../src/utils/model.js';
import { isReviewer } from '../src/config/users.js';

/**
 * /api/restaurants — accesso server-side all'archivio su Supabase (tabella
 * `places`, vedi lib/db.js).
 *
 * GET    (pubblico)  → { version, updatedAt, signature, restaurants }
 * POST   (sessione)  → { op: 'createPlace', data }
 * PUT    (sessione)  → { op: 'updatePlace', id, data }
 *                   → { op: 'saveReview', id, review }   (utente dalla SESSIONE)
 * DELETE (sessione)  → { id }
 */
export default async function handler(req, res) {
  try {
    if (req.method === 'GET') {
      const doc = await readCollection();
      res.setHeader('Cache-Control', 'no-store');
      console.log(
        `[restaurants] GET version=${doc.version} sig=${doc.signature} count=${doc.restaurants.length}`,
      );
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
      const fields = pickPlaceFields(body.data || {});

      // Controllo duplicati sul dataset corrente (autorevole via list()).
      const current = await readCollection();
      const wanted = placeKey(fields);
      const existing = current.restaurants.find((r) => placeKey(r) === wanted);
      if (existing) {
        return res.status(409).json({
          error: 'Esiste già un locale con questo nome, città e provincia.',
          existingId: existing.id,
        });
      }

      const doc = await createPlace({ ...fields, reviews: {} });
      console.log(
        `[restaurants] POST createPlace version=${doc.version} count=${doc.restaurants.length}`,
      );
      return res.status(200).json(doc);
    }

    if (req.method === 'PUT') {
      const id = String(body.id || '');
      if (!id) return res.status(400).json({ error: 'ID locale mancante.' });

      if (body.op === 'updatePlace') {
        const result = await updateSharedFields(id, pickPlaceFields(body.data || {}));
        if (result.notFound) return res.status(404).json({ error: 'Locale non trovato.' });
        console.log(
          `[restaurants] PUT updatePlace id=${id} version=${result.collection.version} count=${result.collection.restaurants.length}`,
        );
        return res.status(200).json(result.collection);
      }

      if (body.op === 'saveReview') {
        const user = session.user;
        if (!isReviewer(user)) {
          return res.status(403).json({ error: 'Utente non abilitato alle recensioni.' });
        }
        const result = await saveReview(id, user, body.review);
        if (result.notFound) return res.status(404).json({ error: 'Locale non trovato.' });
        console.log(
          `[restaurants] PUT saveReview id=${id} reviewer=${user} version=${result.collection.version} count=${result.collection.restaurants.length}`,
        );
        return res.status(200).json(result.collection);
      }

      return res.status(400).json({ error: 'Operazione non valida.' });
    }

    if (req.method === 'DELETE') {
      const id = String(body.id || req.query?.id || '');
      if (!id) return res.status(400).json({ error: 'ID locale mancante.' });
      const result = await deletePlace(id);
      if (result.notFound) return res.status(404).json({ error: 'Locale non trovato.' });
      console.log(
        `[restaurants] DELETE id=${id} version=${result.collection.version} count=${result.collection.restaurants.length}`,
      );
      return res.status(200).json(result.collection);
    }

    res.setHeader('Allow', 'GET, POST, PUT, DELETE');
    return res.status(405).json({ error: 'Metodo non consentito.' });
  } catch (err) {
    if (err instanceof DbNotConfiguredError) {
      return res.status(503).json({ error: err.message });
    }
    console.error('[restaurants] ERROR', err?.message || err);
    return res.status(500).json({
      error: err?.message || 'Errore imprevisto nell’accesso all’archivio.',
    });
  }
}

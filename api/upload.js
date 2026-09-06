import { put } from '@vercel/blob';
import { getSession, readJsonBody } from '../lib/session.js';
import { BlobNotConfiguredError } from '../lib/blob-store.js';

const FOLDERS = { place: 'restaurants', dish: 'dishes' };
const EXT = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif' };

/**
 * POST /api/upload  (sessione richiesta)
 * Body JSON: { image: "data:image/...;base64,...", kind: "place" | "dish" }
 * Carica l'immagine su Vercel Blob e restituisce { url }.
 * L'immagine arriva già ridimensionata dal client; nel JSON dei locali si
 * salvano solo gli URL, mai il Base64.
 */
export default async function handler(req, res) {
  try {
    if (req.method !== 'POST') {
      res.setHeader('Allow', 'POST');
      return res.status(405).json({ error: 'Metodo non consentito.' });
    }
    if (!getSession(req)) {
      return res.status(401).json({ error: 'Sessione non valida. Effettua di nuovo l’accesso.' });
    }

    const token = process.env.BLOB_READ_WRITE_TOKEN;
    if (!token) throw new BlobNotConfiguredError();

    const { image, kind } = readJsonBody(req);
    const folder = FOLDERS[kind] || FOLDERS.dish;

    const match = /^data:(image\/[a-zA-Z.+-]+);base64,(.+)$/s.exec(String(image || ''));
    if (!match) {
      return res.status(400).json({ error: 'Immagine non valida.' });
    }
    const contentType = match[1];
    const ext = EXT[contentType] || 'jpg';
    const buffer = Buffer.from(match[2], 'base64');
    if (buffer.length === 0 || buffer.length > 8 * 1024 * 1024) {
      return res.status(400).json({ error: 'Immagine vuota o troppo grande.' });
    }

    const name = `${folder}/${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}.${ext}`;
    const result = await put(name, buffer, {
      access: 'public',
      contentType,
      addRandomSuffix: false,
      token,
    });

    return res.status(200).json({ url: result.url });
  } catch (err) {
    if (err instanceof BlobNotConfiguredError) {
      return res.status(503).json({ error: err.message });
    }
    return res.status(500).json({ error: err?.message || 'Caricamento immagine non riuscito.' });
  }
}

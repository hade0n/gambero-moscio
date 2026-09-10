import { createClient } from '@supabase/supabase-js';
import { getSession, readJsonBody } from '../lib/session.js';
import { DbNotConfiguredError } from '../lib/db.js';

/**
 * POST /api/upload  (sessione richiesta)
 * Body JSON: { image: "data:image/...;base64,...", kind: "place" | "dish" }
 * Carica l'immagine su Supabase Storage (bucket pubblico `locali`) e restituisce
 * { url }. L'immagine arriva già ridimensionata dal client; nel JSON dei locali
 * si salvano solo gli URL, mai il Base64.
 */

const BUCKET = 'locali';
const FOLDERS = { place: 'restaurants', dish: 'dishes' };
const EXT = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif' };

let client = null;
function storage() {
  if (client) return client;
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new DbNotConfiguredError();
  client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  return client;
}

export default async function handler(req, res) {
  try {
    if (req.method !== 'POST') {
      res.setHeader('Allow', 'POST');
      return res.status(405).json({ error: 'Metodo non consentito.' });
    }
    if (!getSession(req)) {
      return res.status(401).json({ error: 'Sessione non valida. Effettua di nuovo l’accesso.' });
    }

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

    const path = `${folder}/${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
    const sb = storage();
    const { error } = await sb.storage
      .from(BUCKET)
      .upload(path, buffer, { contentType, upsert: false });
    if (error) throw new Error(error.message);

    const { data } = sb.storage.from(BUCKET).getPublicUrl(path);
    return res.status(200).json({ url: data.publicUrl });
  } catch (err) {
    if (err instanceof DbNotConfiguredError) {
      return res.status(503).json({ error: err.message });
    }
    return res.status(500).json({ error: err?.message || 'Caricamento immagine non riuscito.' });
  }
}

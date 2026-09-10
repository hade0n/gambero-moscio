/**
 * Archivio centrale su **Supabase** (Postgres) — codice SERVER-SIDE.
 * Sostituisce `lib/blob-store.js` (Vercel Blob).
 *
 * Tabella unica `places`:
 *   id text pk · name · category · town · province · image_url ·
 *   dish_images jsonb · reviews jsonb ({ilenia?,salvatore?}) · updated_at timestamptz
 *
 * Postgres è coerente: niente CDN, niente ETag/retry, niente cache in memoria,
 * niente manifest. L'elenco è un `SELECT`. Le due recensioni dello stesso locale
 * si scrivono con read-modify-write + compare-and-swap su `updated_at` (una
 * ritentata): Ilenia e Salvatore non si sovrascrivono mai.
 *
 * `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` solo lato server (mai nel bundle).
 */
import { createClient } from '@supabase/supabase-js';
import { createHash } from 'node:crypto';
import {
  createId,
  normalizeRestaurant,
} from '../src/utils/model.js';

const TABLE = 'places';
const CAS_RETRIES = 3;

export class DbNotConfiguredError extends Error {
  constructor() {
    super('Archivio non configurato (SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY mancanti).');
    this.name = 'DbNotConfiguredError';
  }
}

let client = null;
function db() {
  if (client) return client;
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new DbNotConfiguredError();
  client = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return client;
}

const nowIso = () => new Date().toISOString();

/** riga Postgres → record grezzo per `normalizeRestaurant` */
function rowToRaw(row) {
  return {
    id: row.id,
    name: row.name,
    category: row.category,
    town: row.town,
    province: row.province,
    imageUrl: typeof row.image_url === 'string' ? row.image_url : '',
    dishImages: Array.isArray(row.dish_images) ? row.dish_images : [],
    reviews: row.reviews && typeof row.reviews === 'object' ? row.reviews : {},
  };
}

/** record canonico (da `normalizeRestaurant`) → colonne persistite (solo input,
 *  gli aggregati si ricalcolano alla lettura). */
function rawToRow(doc, { touch = true } = {}) {
  const row = {
    id: doc.id,
    name: doc.name,
    category: doc.category,
    town: doc.town,
    province: doc.province,
    image_url: doc.imageUrl || null,
    dish_images: Array.isArray(doc.dishImages) ? doc.dishImages : [],
    reviews: doc.reviews && typeof doc.reviews === 'object' ? doc.reviews : {},
  };
  if (touch) row.updated_at = nowIso();
  return row;
}

function signatureOf(rows) {
  const basis = rows
    .map((r) => `${r.id}@${r.updated_at}`)
    .sort()
    .join('|');
  return createHash('sha1').update(basis).digest('hex').slice(0, 16);
}

async function fetchRows() {
  const { data, error } = await db()
    .from(TABLE)
    .select('id,name,category,town,province,image_url,dish_images,reviews,updated_at');
  if (error) throw new Error(`Lettura archivio fallita: ${error.message}`);
  return data || [];
}

/**
 * Elenco completo dei locali.
 * @returns {{ version:number, updatedAt:string|null, signature:string, restaurants:object[] }}
 */
export async function readCollection() {
  const rows = await fetchRows();
  const restaurants = rows.map((row) => normalizeRestaurant(rowToRaw(row))).filter(Boolean);
  const updatedAt = rows.reduce(
    (mx, r) => (r.updated_at && (!mx || r.updated_at > mx) ? r.updated_at : mx),
    null,
  );
  return {
    version: rows.length,
    updatedAt,
    signature: signatureOf(rows),
    restaurants,
  };
}

async function readRow(id) {
  const { data, error } = await db()
    .from(TABLE)
    .select('id,name,category,town,province,image_url,dish_images,reviews,updated_at')
    .eq('id', id)
    .maybeSingle();
  if (error) throw new Error(`Lettura del locale fallita: ${error.message}`);
  return data || null;
}

/** Crea un nuovo locale. */
export async function createPlace(record) {
  const id = typeof record.id === 'string' && record.id ? record.id : createId();
  const doc = normalizeRestaurant({ ...record, id });
  if (!doc) throw new Error('I dati del locale non sono completi.');

  const { error } = await db().from(TABLE).insert(rawToRow(doc));
  if (error) {
    if (error.code === '23505') {
      // id o chiave nome+città+provincia collidenti (raro: l'API fa già il
      // controllo duplicati). Rigenera l'id una volta.
      const retry = normalizeRestaurant({ ...record, id: createId() });
      const res2 = await db().from(TABLE).insert(rawToRow(retry));
      if (res2.error) {
        if (res2.error.code === '23505') {
          throw new Error('Esiste già un locale con questo nome, città e provincia.');
        }
        throw new Error(`Creazione locale fallita: ${res2.error.message}`);
      }
    } else {
      throw new Error(`Creazione locale fallita: ${error.message}`);
    }
  }
  return readCollection();
}

/** Aggiorna SOLO i dati condivisi. Le recensioni restano intatte.
 *  read-modify-write con compare-and-swap su updated_at. */
export async function updateSharedFields(id, fields) {
  for (let attempt = 0; attempt < CAS_RETRIES; attempt += 1) {
    // eslint-disable-next-line no-await-in-loop
    const row = await readRow(id);
    if (!row) return { notFound: true };

    const current = rowToRaw(row);
    const next = normalizeRestaurant({ ...current, ...fields, reviews: current.reviews, id });
    if (!next) throw new Error('I dati del locale non sono completi.');

    // eslint-disable-next-line no-await-in-loop
    const { data, error } = await db()
      .from(TABLE)
      .update(rawToRow(next))
      .eq('id', id)
      .eq('updated_at', row.updated_at)
      .select('id');
    if (error) throw new Error(`Salvataggio fallito: ${error.message}`);
    if (data && data.length > 0) return { collection: await readCollection() };
    // 0 righe: qualcuno ha scritto nel frattempo → rileggi e riprova
  }
  throw new Error('Impossibile salvare: modifiche concorrenti sullo stesso locale.');
}

/** Crea/sostituisce la recensione di UN utente. Non tocca quella dell'altro. */
export async function saveReview(id, user, review) {
  for (let attempt = 0; attempt < CAS_RETRIES; attempt += 1) {
    // eslint-disable-next-line no-await-in-loop
    const row = await readRow(id);
    if (!row) return { notFound: true };

    const current = rowToRaw(row);
    const next = normalizeRestaurant({
      ...current,
      reviews: {
        ...current.reviews,
        [user]: { ratings: review?.ratings, review: review?.review },
      },
      id,
    });
    if (!next) throw new Error('I dati del locale non sono completi.');

    // eslint-disable-next-line no-await-in-loop
    const { data, error } = await db()
      .from(TABLE)
      .update(rawToRow(next))
      .eq('id', id)
      .eq('updated_at', row.updated_at)
      .select('id');
    if (error) throw new Error(`Salvataggio recensione fallito: ${error.message}`);
    if (data && data.length > 0) return { collection: await readCollection() };
  }
  throw new Error('Impossibile salvare la recensione: riprova tra qualche istante.');
}

/** Elimina l'intero locale. */
export async function deletePlace(id) {
  const { data, error } = await db().from(TABLE).delete().eq('id', id).select('id');
  if (error) throw new Error(`Eliminazione fallita: ${error.message}`);
  if (!data || data.length === 0) return { notFound: true };
  return { collection: await readCollection() };
}

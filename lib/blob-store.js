/**
 * Archivio centrale su Vercel Blob — codice SERVER-SIDE.
 *
 * ARCHITETTURA (v3): un blob per locale.
 *   places/<id>.json   → un singolo locale (dati condivisi + reviews.{ilenia,salvatore})
 *   manifest.json      → { version, updatedAt, migrated }  (contatore/indizio, non autorevole)
 *
 * PERCHÉ NON UN UNICO restaurants.json
 * Le URL pubbliche del Blob passano da una CDN con TTL ~60s che **ignora la
 * query string** per la cache: dopo un `put()` che sovrascrive lo stesso
 * pathname, per ~60s una GET può restituire ANCORA il corpo precedente. Con un
 * unico documento questo produceva perdita di dati: una mutazione leggeva una
 * copia vecchia e riscriveva senza i locali aggiunti nel frattempo
 * (create A, poi create B → A spariva).
 *
 * Con un blob per locale:
 *  - l'ELENCO dei locali è dato da `list('places/')`, che colpisce l'API (non la
 *    CDN) ed è coerente: un locale appena creato compare subito e non può
 *    "sparire" se non con una `del()` esplicita;
 *  - creare due locali in parallelo NON è più una corsa: sono pathname diversi;
 *  - una modifica tocca solo il blob di QUEL locale; la finestra di staleness
 *    riguarda al più il testo di quella singola recensione, mai l'elenco;
 *  - due scritture sullo stesso locale (i due utenti insieme) sono protette da
 *    `ifMatch` sull'ETag + rilettura garantita fresca (confronto ETag testa/corpo).
 *
 * Il token `BLOB_READ_WRITE_TOKEN` è usato solo qui, mai nel bundle client.
 */
import {
  BlobNotFoundError,
  BlobPreconditionFailedError,
  del,
  head,
  list,
  put,
} from '@vercel/blob';
import { createHash } from 'node:crypto';
import legacySeed from '../src/data/restaurants.json' with { type: 'json' };
import {
  createId,
  extractRestaurants,
  normalizeCollection,
  normalizeRestaurant,
} from '../src/utils/model.js';

const PLACES_PREFIX = 'places/';
const MANIFEST_PATH = 'manifest.json';
const LEGACY_PATH = 'restaurants.json';
const READ_RETRIES = 8;

// Copia in memoria dell'ultima scrittura per locale (valida a caldo per
// l'istanza serverless): evita la finestra di staleness CDN sulle modifiche
// sequenziali fatte dalla stessa istanza.
const lastWrite = new Map(); // id -> { doc, etag }

export class BlobNotConfiguredError extends Error {
  constructor() {
    super('Archivio non configurato (BLOB_READ_WRITE_TOKEN mancante).');
    this.name = 'BlobNotConfiguredError';
  }
}

function requireToken() {
  const token = process.env.BLOB_READ_WRITE_TOKEN;
  if (!token) throw new BlobNotConfiguredError();
  return token;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const normEtag = (v) => (v || '').replace(/^W\//, '').replace(/"/g, '');
const placePath = (id) => `${PLACES_PREFIX}${id}.json`;

function isNotFound(err) {
  return (
    err instanceof BlobNotFoundError ||
    err?.status === 404 ||
    /not\s*found|does not exist|no such/i.test(err?.message || '')
  );
}

function isConflict(err) {
  return (
    err instanceof BlobPreconditionFailedError ||
    err?.status === 409 ||
    err?.status === 412 ||
    /conditional request|conflicting operation|precondition/i.test(err?.message || '')
  );
}

async function putJson(pathname, data, { ifMatch, allowOverwrite = true } = {}) {
  const token = requireToken();
  const opts = {
    access: 'public',
    contentType: 'application/json',
    addRandomSuffix: false,
    allowOverwrite,
    cacheControlMaxAge: 0,
    token,
  };
  if (ifMatch) opts.ifMatch = ifMatch;
  return put(pathname, JSON.stringify(data), opts);
}

/**
 * Legge un JSON dal Blob in modo GARANTITO fresco: `head()` (API, non CDN) dà
 * l'ETag autorevole; poi si scarica il corpo finché l'ETag della risposta
 * coincide con quello di `head()`. Se dopo i tentativi la CDN è ancora vecchia
 * si lancia (meglio fallire che scrivere dati vecchi). `null` se non esiste.
 */
async function readJsonFresh(pathname) {
  const token = requireToken();
  let meta;
  try {
    meta = await head(pathname, { token });
  } catch (err) {
    if (isNotFound(err)) return null;
    throw err;
  }

  for (let i = 0; i < READ_RETRIES; i += 1) {
    const res = await fetch(`${meta.url}?r=${Date.now()}-${i}`, {
      headers: { authorization: `Bearer ${token}`, 'cache-control': 'no-cache' },
      cache: 'no-store',
    });
    if (res.status === 404) return null;
    if (!res.ok) throw new Error(`Lettura archivio fallita (HTTP ${res.status}).`);

    const bodyEtag = normEtag(res.headers.get('etag'));
    let raw;
    try {
      raw = await res.json();
    } catch {
      throw new Error('Archivio dati corrotto (JSON non valido).');
    }
    if (!bodyEtag || bodyEtag === normEtag(meta.etag)) {
      return { raw, etag: meta.etag };
    }
    // CDN non ancora aggiornata: attesa breve e rilettura dei metadati.
    await sleep(180 + i * 120);
    try {
      meta = await head(pathname, { token });
    } catch (err) {
      if (isNotFound(err)) return null;
      throw err;
    }
  }
  throw new Error('Archivio momentaneamente non sincronizzato. Riprova tra qualche istante.');
}

/** Lettura leggera (per la GET pubblica): una copia leggermente vecchia del
 *  singolo locale è innocua, l'elenco resta autorevole via `list()`. */
async function readJsonBestEffort(url) {
  const token = requireToken();
  for (let i = 0; i < 3; i += 1) {
    try {
      const res = await fetch(`${url}?r=${Date.now()}-${i}`, {
        headers: { authorization: `Bearer ${token}` },
        cache: 'no-store',
      });
      if (res.status === 404) return null;
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.json();
    } catch (err) {
      if (i === 2) throw err;
      await sleep(150);
    }
  }
  return null;
}

async function listPlaceBlobs() {
  const token = requireToken();
  const out = [];
  let cursor;
  do {
    // eslint-disable-next-line no-await-in-loop
    const page = await list({ prefix: PLACES_PREFIX, limit: 1000, cursor, token });
    for (const b of page.blobs) {
      if (b.pathname.startsWith(PLACES_PREFIX) && b.pathname.endsWith('.json')) out.push(b);
    }
    cursor = page.cursor;
  } while (cursor);
  return out;
}

function signatureOf(placeBlobs) {
  const basis = placeBlobs
    .map((b) => {
      const up = b.uploadedAt instanceof Date ? b.uploadedAt.toISOString() : String(b.uploadedAt);
      return `${b.pathname}@${up}#${b.size}`;
    })
    .sort()
    .join('|');
  return createHash('sha1').update(basis).digest('hex').slice(0, 16);
}

async function readManifest() {
  const token = requireToken();
  try {
    const meta = await head(MANIFEST_PATH, { token });
    const res = await fetch(`${meta.url}?r=${Date.now()}`, {
      headers: { authorization: `Bearer ${token}` },
      cache: 'no-store',
    });
    if (!res.ok) return { version: 0, updatedAt: null, migrated: false };
    const raw = await res.json();
    return {
      version: Number.isFinite(raw?.version) ? raw.version : 0,
      updatedAt: typeof raw?.updatedAt === 'string' ? raw.updatedAt : null,
      migrated: raw?.migrated === true,
    };
  } catch (err) {
    if (isNotFound(err)) return { version: 0, updatedAt: null, migrated: false };
    return { version: 0, updatedAt: null, migrated: false };
  }
}

/** Aggiorna il contatore. Best-effort: un fallimento qui non fa fallire la
 *  mutazione (l'elenco autorevole è comunque `list()`). */
async function bumpManifest(patch = {}) {
  try {
    const cur = await readManifest();
    await putJson(MANIFEST_PATH, {
      version: (cur.version || 0) + 1,
      updatedAt: new Date().toISOString(),
      migrated: cur.migrated || patch.migrated === true,
    });
  } catch {
    /* ignora: il contatore è solo un indizio per il polling */
  }
}

/**
 * Migrazione una tantum dal vecchio documento unico `restaurants.json` (o dal
 * seed) verso `places/<id>.json`. Non tocca il documento legacy: resta come
 * copia di sicurezza. Ritorna gli id migrati.
 */
async function migrateIfNeeded() {
  const token = requireToken();
  const manifest = await readManifest();
  if (manifest.migrated) return [];

  // Sorgente: il vecchio documento unico se presente, altrimenti il seed.
  let source = [];
  const legacyMeta = await head(LEGACY_PATH, { token }).catch((err) => {
    if (isNotFound(err)) return null;
    throw err;
  });
  if (legacyMeta) {
    const legacy = await readJsonBestEffort(legacyMeta.url).catch(() => null);
    const fromLegacy = extractRestaurants(legacy || {});
    if (fromLegacy.length) source = fromLegacy;
  }
  if (source.length === 0) source = extractRestaurants(legacySeed);

  const records = normalizeCollection(source);
  for (const rec of records) {
    // eslint-disable-next-line no-await-in-loop
    await putJson(placePath(rec.id), rec, { allowOverwrite: true });
  }
  await bumpManifest({ migrated: true });
  return records.map((r) => r.id);
}

/**
 * Elenco completo dei locali. Fonte autorevole: `list('places/')` (API, coerente).
 * @param {Record<string, object>} [overrides] mappa id→documento appena scritto
 *   da usare al posto della lettura CDN (che potrebbe essere ancora vecchia).
 * @returns {{ version:number, updatedAt:string|null, signature:string, restaurants:object[] }}
 */
export async function readCollection(overrides = null) {
  requireToken();

  let placeBlobs = await listPlaceBlobs();
  if (placeBlobs.length === 0) {
    await migrateIfNeeded();
    placeBlobs = await listPlaceBlobs();
  }

  const seen = new Set();
  const restaurants = await Promise.all(
    placeBlobs.map(async (b) => {
      const id = b.pathname.slice(PLACES_PREFIX.length, -'.json'.length);
      seen.add(id);
      if (overrides && overrides[id]) return overrides[id];
      const known = lastWrite.get(id);
      // Se l'ETag dell'elenco (API, coerente) combacia con quello dell'ultima
      // scrittura di questa istanza, la nostra copia in memoria È la versione
      // corrente: nessun bisogno di leggere dalla CDN (che può essere vecchia).
      if (known && normEtag(known.etag) && normEtag(known.etag) === normEtag(b.etag)) {
        return known.doc;
      }
      const raw = await readJsonBestEffort(b.url);
      if (raw == null) {
        // corpo momentaneamente irraggiungibile: usa l'ultima copia nota se c'è,
        // altrimenti fai fallire la GET (meglio che un elenco monco).
        if (known?.doc) return known.doc;
        throw new Error('Lettura di un locale non riuscita. Riprova.');
      }
      return normalizeRestaurant(raw);
    }),
  );

  // Un locale appena creato che l'API `list()` non riporta ancora (raro):
  // aggiungilo comunque dall'override.
  if (overrides) {
    for (const [id, doc] of Object.entries(overrides)) {
      if (!seen.has(id) && doc) restaurants.push(doc);
    }
  }

  const manifest = await readManifest();
  const maxUp = placeBlobs.reduce((mx, b) => {
    const t = new Date(b.uploadedAt).getTime();
    return Number.isFinite(t) && t > mx ? t : mx;
  }, 0);

  return {
    // Contatore informativo (dal manifest, aggiornato solo dalle mutazioni). Il
    // client usa `signature` per decidere se applicare un cambiamento.
    version: manifest.version || 0,
    updatedAt: maxUp ? new Date(maxUp).toISOString() : manifest.updatedAt,
    signature: signatureOf(placeBlobs),
    restaurants: restaurants.filter(Boolean),
  };
}

/** Lettura fresca di UN locale (per le modifiche). null se non esiste. */
async function readPlace(id) {
  const cached = lastWrite.get(id);
  const token = requireToken();
  let meta;
  try {
    meta = await head(placePath(id), { token });
  } catch (err) {
    if (isNotFound(err)) return null;
    throw err;
  }
  if (cached && normEtag(cached.etag) === normEtag(meta.etag)) {
    return { doc: cached.doc, etag: meta.etag };
  }
  const fresh = await readJsonFresh(placePath(id));
  if (!fresh) return null;
  const doc = normalizeRestaurant(fresh.raw);
  return { doc, etag: fresh.etag };
}

function recordWrite(id, doc, result) {
  lastWrite.set(id, { doc, etag: result?.etag ?? null });
}

/** Crea un nuovo locale (pathname nuovo: nessuna corsa con altre creazioni). */
export async function createPlace(record) {
  requireToken();
  const id = typeof record.id === 'string' && record.id ? record.id : createId();
  const doc = normalizeRestaurant({ ...record, id });
  if (!doc) throw new Error('I dati del locale non sono completi.');

  let result;
  try {
    result = await putJson(placePath(id), doc, { allowOverwrite: false });
  } catch (err) {
    if (isConflict(err) || /already exists/i.test(err?.message || '')) {
      // id collidente (praticamente impossibile): rigenera una volta.
      const retryId = createId();
      const retryDoc = normalizeRestaurant({ ...record, id: retryId });
      result = await putJson(placePath(retryId), retryDoc, { allowOverwrite: false });
      recordWrite(retryId, retryDoc, result);
      await bumpManifest();
      return readCollection({ [retryId]: retryDoc });
    }
    throw err;
  }
  recordWrite(id, doc, result);
  await bumpManifest();
  return readCollection({ [id]: doc });
}

/** Aggiorna SOLO i dati condivisi di un locale. Le recensioni restano intatte. */
export async function updateSharedFields(id, fields) {
  requireToken();
  for (let attempt = 0; attempt < 4; attempt += 1) {
    // eslint-disable-next-line no-await-in-loop
    const current = await readPlace(id);
    if (!current) return { notFound: true };
    const next = normalizeRestaurant({ ...current.doc, ...fields, reviews: current.doc.reviews, id });
    try {
      // eslint-disable-next-line no-await-in-loop
      const result = await putJson(placePath(id), next, { ifMatch: current.etag || undefined });
      recordWrite(id, next, result);
      // eslint-disable-next-line no-await-in-loop
      await bumpManifest();
      return { collection: await readCollection({ [id]: next }) };
    } catch (err) {
      if (isConflict(err)) {
        lastWrite.delete(id);
        continue;
      }
      throw err;
    }
  }
  throw new Error('Impossibile salvare: modifiche concorrenti sullo stesso locale.');
}

/** Crea/sostituisce la recensione di UN utente. Non tocca quella dell'altro. */
export async function saveReview(id, user, review) {
  requireToken();
  for (let attempt = 0; attempt < 4; attempt += 1) {
    // eslint-disable-next-line no-await-in-loop
    const current = await readPlace(id);
    if (!current) return { notFound: true };
    const next = normalizeRestaurant({
      ...current.doc,
      reviews: {
        ...current.doc.reviews,
        [user]: { ratings: review?.ratings, review: review?.review },
      },
      id,
    });
    try {
      // eslint-disable-next-line no-await-in-loop
      const result = await putJson(placePath(id), next, { ifMatch: current.etag || undefined });
      recordWrite(id, next, result);
      // eslint-disable-next-line no-await-in-loop
      await bumpManifest();
      return { collection: await readCollection({ [id]: next }) };
    } catch (err) {
      if (isConflict(err)) {
        lastWrite.delete(id);
        continue;
      }
      throw err;
    }
  }
  throw new Error('Impossibile salvare la recensione: riprova tra qualche istante.');
}

/** Elimina l'intero locale. */
export async function deletePlace(id) {
  const token = requireToken();
  const meta = await head(placePath(id), { token }).catch((err) => {
    if (isNotFound(err)) return null;
    throw err;
  });
  if (!meta) return { notFound: true };
  await del(meta.url, { token });
  lastWrite.delete(id);
  await bumpManifest();
  return { collection: await readCollection() };
}

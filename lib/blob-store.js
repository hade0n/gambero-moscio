/**
 * Archivio centrale su Vercel Blob — codice SERVER-SIDE.
 *
 * Unico documento persistente: `restaurants.json` nel Blob del progetto.
 * Struttura: { version, updatedAt, restaurants: [...] }.
 *
 * Il token `BLOB_READ_WRITE_TOKEN` è usato solo qui (mai nel bundle client).
 * Il seed `src/data/restaurants.json` viene caricato **solo** se il documento
 * non esiste ancora nel Blob; se esiste già, non viene mai sovrascritto.
 */
import { list, put } from '@vercel/blob';
import seedDoc from '../src/data/restaurants.json' with { type: 'json' };
import { extractRestaurants, normalizeCollection } from '../src/utils/model.js';

const BLOB_PATH = 'restaurants.json';

// Cache dell'URL del blob per il ciclo di vita dell'istanza della function.
let cachedBlobUrl = null;

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

function makeDoc(restaurants, previousVersion = 0) {
  return {
    version: previousVersion + 1,
    updatedAt: new Date().toISOString(),
    restaurants: normalizeCollection(restaurants),
  };
}

/** Scrive il documento nel Blob (pathname stabile, sovrascrittura). */
async function writeDoc(doc) {
  const token = requireToken();
  const result = await put(BLOB_PATH, JSON.stringify(doc), {
    access: 'public',
    contentType: 'application/json',
    addRandomSuffix: false,
    allowOverwrite: true,
    cacheControlMaxAge: 0,
    token,
  });
  cachedBlobUrl = result.url;
  return doc;
}

/** Trova l'URL del blob `restaurants.json`, oppure null se non esiste. */
async function findBlobUrl() {
  if (cachedBlobUrl) return cachedBlobUrl;
  const token = requireToken();
  const { blobs } = await list({ prefix: BLOB_PATH, limit: 100, token });
  const found = blobs.find((b) => b.pathname === BLOB_PATH);
  cachedBlobUrl = found?.url ?? null;
  return cachedBlobUrl;
}

/**
 * Legge il documento corrente dal Blob. Se non esiste ancora, lo inizializza
 * dal seed locale (una sola volta). Ritorna { version, updatedAt, restaurants }.
 */
export async function readDoc() {
  requireToken();
  const url = await findBlobUrl();

  if (!url) {
    // Inizializzazione: nessun documento nel Blob → seed.
    const seeded = makeDoc(extractRestaurants(seedDoc), 0);
    seeded.version = 1;
    return writeDoc(seeded);
  }

  // Cache-buster: evita di leggere una versione CDN stale subito dopo una scrittura.
  const res = await fetch(`${url}?v=${Date.now()}`, { cache: 'no-store' });
  if (!res.ok) throw new Error(`Lettura archivio fallita (HTTP ${res.status}).`);

  let raw;
  try {
    raw = await res.json();
  } catch {
    throw new Error('Archivio dati corrotto (JSON non valido).');
  }

  return {
    version: Number.isFinite(raw?.version) ? raw.version : 1,
    updatedAt: typeof raw?.updatedAt === 'string' ? raw.updatedAt : null,
    restaurants: normalizeCollection(extractRestaurants(raw)),
  };
}

/**
 * Read-modify-write: legge il documento, applica `mutate(restaurants)` che deve
 * restituire il nuovo array, scrive e ritorna il nuovo documento.
 * La finestra di corsa è ridotta al minimo (lettura fresca + modifica mirata).
 */
export async function mutateDoc(mutate) {
  const current = await readDoc();
  const nextRestaurants = mutate(current.restaurants, current);
  if (nextRestaurants === current.restaurants) return current; // nessuna modifica
  return writeDoc(makeDoc(nextRestaurants, current.version));
}

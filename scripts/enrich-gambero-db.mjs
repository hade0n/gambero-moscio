#!/usr/bin/env node
/**
 * Arricchimento del database della Ruota del Gambero Moscio.
 *
 *   node scripts/enrich-gambero-db.mjs            → completa solo i campi mancanti
 *   node scripts/enrich-gambero-db.mjs --refresh  → ricontrolla TUTTI i locali
 *   node scripts/enrich-gambero-db.mjs --dry      → non scrive, mostra solo il report
 *
 * Per ogni locale, tramite le API UFFICIALI di Google Places (chiave in
 * `GOOGLE_MAPS_API_KEY`, mai nel frontend), recupera: placeId, indirizzo,
 * coordinate, telefono, rating/numero recensioni Google, riferimento della prima
 * foto, sito. Non sovrascrive dati validi già presenti (salvo --refresh) e non
 * inventa nulla: se un dato non c'è, resta `null`.
 *
 * NON tocca `rank` né l'ordine dei locali. Al termine stampa un report di copertura.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_PATH = path.join(__dirname, '..', 'src', 'data', 'gamberoDiscovery.json');
const REGION = 'Campania';
const KEY = process.env.GOOGLE_MAPS_API_KEY || '';
const REFRESH = process.argv.includes('--refresh');
const DRY = process.argv.includes('--dry');
const DELAY_MS = 220;

const FIELD_ORDER = [
  'id', 'category', 'province', 'city', 'name', 'rating', 'googleRating',
  'userRatingsTotal', 'rank', 'placeId', 'address', 'lat', 'lng', 'phone',
  'website', 'photoReference', 'photoUrl', 'description',
];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function orderPlace(p) {
  const out = {};
  for (const k of FIELD_ORDER) if (p[k] !== undefined) out[k] = p[k];
  for (const k of Object.keys(p)) if (!(k in out)) out[k] = p[k];
  return out;
}

const canon = (s) =>
  String(s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[^a-z0-9 ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

/** overlap di token fra due nomi (0..1) */
function nameScore(a, b) {
  const ta = new Set(canon(a).split(' ').filter((w) => w.length > 2));
  const tb = new Set(canon(b).split(' ').filter((w) => w.length > 2));
  if (ta.size === 0 || tb.size === 0) return 0;
  let hit = 0;
  for (const w of ta) if (tb.has(w)) hit += 1;
  return hit / Math.min(ta.size, tb.size);
}

async function gget(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const json = await res.json();
  if (json.status && !['OK', 'ZERO_RESULTS'].includes(json.status)) {
    throw new Error(`${json.status}${json.error_message ? ` — ${json.error_message}` : ''}`);
  }
  return json;
}

async function findPlace(place) {
  const q = encodeURIComponent([place.name, place.address, place.city, REGION].filter(Boolean).join(' '));
  const url = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${q}&region=it&language=it&key=${KEY}`;
  const { results = [] } = await gget(url);
  if (results.length === 0) return { candidate: null, ambiguous: false };

  const top = results[0];
  const score = nameScore(place.name, top.name);
  const addr = canon(top.formatted_address);
  const cityOk = !place.city || addr.includes(canon(place.city));
  // match sicuro: nome coerente e stessa città
  if (score >= 0.5 && cityOk) return { candidate: top, ambiguous: false };
  // secondo risultato che combacia meglio?
  const better = results.find(
    (r) => nameScore(place.name, r.name) >= 0.6 && canon(r.formatted_address).includes(canon(place.city || '')),
  );
  if (better) return { candidate: better, ambiguous: false };
  return { candidate: top, ambiguous: true };
}

async function details(placeId) {
  const fields = [
    'name', 'formatted_address', 'geometry/location', 'international_phone_number',
    'formatted_phone_number', 'rating', 'user_ratings_total', 'website', 'photos', 'place_id',
  ].join(',');
  const url = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&fields=${fields}&language=it&region=it&key=${KEY}`;
  const { result } = await gget(url);
  return result || null;
}

function needsWork(p) {
  if (REFRESH) return true;
  return (
    !p.placeId || p.lat == null || p.lng == null || !p.address ||
    !p.phone || !p.photoReference || p.userRatingsTotal == null
  );
}

function fill(p, d, top) {
  const set = (k, v) => {
    if (v == null || v === '') return;
    if (REFRESH || p[k] == null || p[k] === '') p[k] = v;
  };
  set('placeId', d.place_id || top?.place_id);
  set('address', d.formatted_address || top?.formatted_address);
  if (d.geometry?.location) {
    set('lat', Number(d.geometry.location.lat));
    set('lng', Number(d.geometry.location.lng));
  }
  set('phone', d.formatted_phone_number || d.international_phone_number);
  set('website', d.website);
  set('photoReference', d.photos?.[0]?.photo_reference);
  if (typeof d.rating === 'number') {
    set('googleRating', d.rating); // /5, come da Google
    // il nostro `rating` è /10: lo compiliamo solo se assente
    if (p.rating == null) p.rating = Math.round(d.rating * 2 * 10) / 10;
  }
  if (typeof d.user_ratings_total === 'number') set('userRatingsTotal', d.user_ratings_total);
}

function coverage(places) {
  const n = places.length;
  const withPhoto = places.filter((p) => p.photoUrl || p.photoReference).length;
  const withPhone = places.filter((p) => p.phone).length;
  const withCoords = places.filter((p) => p.lat != null && p.lng != null).length;
  const withId = places.filter((p) => p.placeId).length;
  return { n, withPhoto, withPhone, withCoords, withId };
}

function dedupCheck(places) {
  const seen = new Map();
  const dups = [];
  for (const p of places) {
    if (!p.placeId) continue;
    const key = `${p.category}::${p.placeId}`;
    if (seen.has(key)) dups.push({ a: seen.get(key), b: p.id, placeId: p.placeId, category: p.category });
    else seen.set(key, p.id);
  }
  return dups;
}

async function main() {
  const db = JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));
  const places = db.places || [];
  console.log(`\n${'─'.repeat(48)}\nGAMBERO DATABASE ENRICHMENT${REFRESH ? '  (--refresh)' : ''}${DRY ? '  (--dry)' : ''}\n${'─'.repeat(48)}`);
  console.log(`File: ${path.relative(process.cwd(), DB_PATH)}  ·  locali: ${places.length}`);

  if (!KEY) {
    const c = coverage(places);
    console.log('\n⚠  GOOGLE_MAPS_API_KEY non impostata: nessun recupero eseguito.');
    console.log('   Esegui:  GOOGLE_MAPS_API_KEY=xxx npm run enrich:gambero\n');
    console.log(`Copertura attuale:`);
    console.log(`  Foto presenti:     ${c.withPhoto}/${c.n}   (mancanti ${c.n - c.withPhoto})`);
    console.log(`  Telefoni presenti: ${c.withPhone}/${c.n}   (mancanti ${c.n - c.withPhone})`);
    console.log(`  Coordinate:        ${c.withCoords}/${c.n}`);
    console.log(`  placeId:           ${c.withId}/${c.n}`);
    console.log(`${'─'.repeat(48)}\n`);
    return;
  }

  let ok = 0, photoMiss = 0, phoneMiss = 0, ambiguous = 0, apiErr = 0, skipped = 0;
  const problems = [];

  for (let i = 0; i < places.length; i += 1) {
    const p = places[i];
    const tag = `[${String(i + 1).padStart(3)}/${places.length}] ${p.name}`.padEnd(56, '.');

    if (!needsWork(p)) {
      skipped += 1;
      console.log(`${tag} già completo`);
      continue;
    }

    try {
      const { candidate, ambiguous: amb } = await findPlace(p);
      if (!candidate) {
        apiErr += 1;
        problems.push(`${p.id}: nessun risultato Google`);
        console.log(`${tag} NESSUN RISULTATO`);
        await sleep(DELAY_MS);
        continue;
      }
      if (amb) {
        ambiguous += 1;
        problems.push(`${p.id}: match ambiguo → "${candidate.name}" (${candidate.formatted_address})`);
        console.log(`${tag} MATCH AMBIGUO (saltato)`);
        await sleep(DELAY_MS);
        continue;
      }
      const d = await details(candidate.place_id);
      if (!d) throw new Error('details vuoti');
      fill(p, d, candidate);

      const noPhoto = !p.photoUrl && !p.photoReference;
      const noPhone = !p.phone;
      if (noPhoto) photoMiss += 1;
      if (noPhone) phoneMiss += 1;
      console.log(`${tag} ${noPhoto ? 'FOTO MANCANTE' : noPhone ? 'TELEFONO MANCANTE' : 'OK'}`);
      ok += 1;
    } catch (err) {
      apiErr += 1;
      problems.push(`${p.id}: ${err.message}`);
      console.log(`${tag} ERRORE API (${err.message})`);
    }
    await sleep(DELAY_MS);
  }

  db.places = places.map(orderPlace);
  db.updatedAt = new Date().toISOString().slice(0, 10);
  if (!DRY) {
    fs.writeFileSync(DB_PATH, `${JSON.stringify(db, null, 2)}\n`);
  }

  const dups = dedupCheck(places);
  const c = coverage(places);
  console.log(`\n${'─'.repeat(48)}\nGAMBERO DATABASE ENRICHMENT — REPORT\n${'─'.repeat(48)}`);
  console.log(`Locali analizzati:   ${places.length}`);
  console.log(`Aggiornati:          ${ok}`);
  console.log(`Già completi:        ${skipped}`);
  console.log(`Match ambigui:       ${ambiguous}`);
  console.log(`Errori API:          ${apiErr}`);
  console.log(`Foto presenti:       ${c.withPhoto}/${c.n}   (mancanti ${c.n - c.withPhoto})`);
  console.log(`Telefoni presenti:   ${c.withPhone}/${c.n}   (mancanti ${c.n - c.withPhone})`);
  console.log(`Coordinate presenti: ${c.withCoords}/${c.n}`);
  console.log(`placeId presenti:    ${c.withId}/${c.n}`);
  console.log(`Duplicati placeId:   ${dups.length}`);
  if (dups.length) dups.forEach((d) => console.log(`  ⚠ ${d.category}: ${d.a} == ${d.b} (${d.placeId})`));
  if (problems.length) {
    console.log(`\nLocali da rivedere:`);
    problems.forEach((x) => console.log(`  • ${x}`));
  }
  console.log(`${'─'.repeat(48)}`);
  console.log(DRY ? 'Modalità --dry: file NON modificato.\n' : `File aggiornato: ${path.relative(process.cwd(), DB_PATH)}\n`);
}

main().catch((err) => {
  console.error('\nERRORE FATALE:', err.message, '\n');
  process.exit(1);
});

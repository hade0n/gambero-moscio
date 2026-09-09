#!/usr/bin/env node
/**
 * Completa indirizzo e coordinate del database discovery con OpenStreetMap
 * Nominatim, senza chiavi API. Il match è prudente: se nome/città non sono
 * coerenti, il record viene saltato e non si scrive nulla.
 *
 *   npm run geocode:gambero
 *   npm run geocode:gambero -- --refresh
 *   npm run geocode:gambero -- --dry
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dbPath = path.join(root, 'src', 'data', 'gamberoDiscovery.json');
const refresh = process.argv.includes('--refresh');
const dry = process.argv.includes('--dry');
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const userAgent = 'gambero-moscio-discovery/1.0 (https://github.com/hade0n/gambero-moscio)';
const stopWords = new Set(['ristorante', 'trattoria', 'pizzeria', 'osteria', 'agriturismo', 'braceria', 'paninoteca', 'antica', 'da', 'di', 'del', 'della', 'dei', 'la', 'il', 'lo', 'e']);

const canon = (value) =>
  String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[^a-z0-9 ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

function tokens(value) {
  return canon(value)
    .split(' ')
    .filter((token) => token.length > 2 && !stopWords.has(token));
}

function nameScore(place, result) {
  const wanted = new Set(tokens(place.name));
  const candidate = new Set(tokens(`${result.name || ''} ${result.display_name || ''}`));
  if (wanted.size === 0 || candidate.size === 0) return 0;
  let hits = 0;
  for (const token of wanted) if (candidate.has(token)) hits += 1;
  return hits / wanted.size;
}

function hasLocation(place) {
  return Number.isFinite(Number(place.lat)) && Number.isFinite(Number(place.lng)) && place.address;
}

function addressLine(address = {}) {
  const street = [address.road || address.pedestrian || address.footway || address.residential, address.house_number]
    .filter(Boolean)
    .join(', ');
  const locality = address.city || address.town || address.village || address.municipality;
  return [street, locality, address.postcode].filter(Boolean).join(' · ') || null;
}

async function lookup(place) {
  const query = [place.name, place.city, 'Campania', 'Italia'].filter(Boolean).join(', ');
  const url = new URL('https://nominatim.openstreetmap.org/search');
  url.searchParams.set('q', query);
  url.searchParams.set('format', 'jsonv2');
  url.searchParams.set('limit', '5');
  url.searchParams.set('addressdetails', '1');
  const response = await fetch(url, { headers: { 'User-Agent': userAgent, Accept: 'application/json' } });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const results = await response.json();
  const targetCity = canon(place.city);
  const candidate = results.find((result) => {
    const score = nameScore(place, result);
    const localityFields = [
      result.address?.city,
      result.address?.town,
      result.address?.village,
      result.address?.municipality,
      result.address?.hamlet,
      result.address?.suburb,
    ].map(canon);
    // Non basta che "Napoli" compaia nella provincia: il comune/frazione deve
    // combaciare davvero con quello del record discovery.
    return score >= 0.55 && (!targetCity || localityFields.includes(targetCity));
  });
  return candidate || null;
}

const db = JSON.parse(fs.readFileSync(dbPath, 'utf8'));
let updated = 0;
let skipped = 0;
let unmatched = 0;
let failed = 0;
const unresolved = [];

for (let index = 0; index < db.places.length; index += 1) {
  const place = db.places[index];
  if (!refresh && hasLocation(place)) {
    skipped += 1;
    continue;
  }

  try {
    const result = await lookup(place);
    if (!result) {
      unmatched += 1;
      unresolved.push(`${place.id}: nessun match geografico sicuro`);
      console.log(`[${index + 1}/${db.places.length}] ${place.name} — MATCH NON SICURO`);
    } else {
      const lat = Number(result.lat);
      const lng = Number(result.lon);
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) throw new Error('coordinate non valide');
      place.lat = lat;
      place.lng = lng;
      place.address = addressLine(result.address) || place.address || null;
      place.sources = {
        ...(place.sources || {}),
        location: {
          provider: 'OpenStreetMap Nominatim',
          url: `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lng}#map=19/${lat}/${lng}`,
          verifiedAt: new Date().toISOString().slice(0, 10),
        },
      };
      updated += 1;
      console.log(`[${index + 1}/${db.places.length}] ${place.name} — OK`);
    }
  } catch (error) {
    failed += 1;
    unresolved.push(`${place.id}: ${error.message}`);
    console.log(`[${index + 1}/${db.places.length}] ${place.name} — ERRORE (${error.message})`);
  }
  // Limite dichiarato da Nominatim: massimo una richiesta al secondo.
  await delay(1100);
}

if (!dry) {
  db.updatedAt = new Date().toISOString().slice(0, 10);
  fs.writeFileSync(dbPath, `${JSON.stringify(db, null, 2)}\n`);
}

console.log(`\nGeocoding: aggiornati ${updated}, già completi ${skipped}, non sicuri ${unmatched}, errori ${failed}.`);
if (unresolved.length) console.log(unresolved.map((item) => `- ${item}`).join('\n'));

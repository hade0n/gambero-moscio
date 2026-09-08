/**
 * Database di **discovery del Gambero** — sorgente separata dalle recensioni PNDR.
 *
 * Contiene i migliori locali reali della Campania per tipologia (fino a 25 per
 * categoria, ordinati per `rank`). Il Gambero può quindi scegliere anche locali
 * NON ancora presenti nel database delle recensioni.
 *
 * `lat/lng/phone/photoUrl/website/address/reviewCount` sono predisposti a `null`
 * (da popolare da una sorgente ufficiale, mai inventati). `mapsUrl` /
 * `directionsUrl` sono deep-link di ricerca Google Maps generati da nome+città:
 * link validi, non dati scrapati.
 */
import raw from '../data/gamberoDiscovery.json';
import { isValidCategory } from '../config/categories.js';
import { sample } from './random.js';

const REGION = typeof raw?.region === 'string' ? raw.region : 'Campania';
const MAX_PER_CATEGORY = 25;

function mapsSearchUrl(name, city) {
  const q = encodeURIComponent([name, city, REGION].filter(Boolean).join(', '));
  return `https://www.google.com/maps/search/?api=1&query=${q}`;
}

function mapsDirectionsUrl(name, city, province) {
  const q = encodeURIComponent([name, city, province, REGION].filter(Boolean).join(', '));
  return `https://www.google.com/maps/dir/?api=1&destination=${q}`;
}

/** Porta un record grezzo alla forma canonica usata dalla UI. Null se inutilizzabile. */
function normalizePlace(entry) {
  if (!entry || typeof entry !== 'object') return null;
  const name = String(entry.name || '').trim();
  const category = isValidCategory(entry.category) ? entry.category : null;
  if (!name || !category) return null;

  const city = String(entry.city || '').trim() || null;
  const province = String(entry.province || '').trim().toUpperCase().slice(0, 2) || null;
  const ratingNum = Number(entry.rating);
  const rating = Number.isFinite(ratingNum) ? Math.min(10, Math.max(0, ratingNum)) : null;

  return {
    id: String(entry.id || '').trim() || `disc-${name.toLowerCase().replace(/\s+/g, '-')}`,
    name,
    category,
    region: REGION,
    province,
    city,
    rank: Number.isFinite(Number(entry.rank)) ? Number(entry.rank) : null,
    rating,
    description: String(entry.description || '').trim() || null,
    // predisposti — nessun dato inventato
    address: entry.address ?? null,
    lat: Number.isFinite(Number(entry.lat)) ? Number(entry.lat) : null,
    lng: Number.isFinite(Number(entry.lng)) ? Number(entry.lng) : null,
    reviewCount: Number.isFinite(Number(entry.reviewCount)) ? Number(entry.reviewCount) : null,
    phone: entry.phone ?? null,
    website: entry.website ?? null,
    photoUrl: entry.photoUrl ?? null,
    mapsUrl: entry.mapsUrl ?? mapsSearchUrl(name, city),
    directionsUrl: entry.directionsUrl ?? mapsDirectionsUrl(name, city, province),
    source: 'gambero-discovery',
  };
}

const ALL_PLACES = (Array.isArray(raw?.places) ? raw.places : [])
  .map(normalizePlace)
  .filter(Boolean);

// Deduplica per id, poi raggruppa per categoria mantenendo l'ordine di `rank`.
const BY_CATEGORY = new Map();
{
  const seen = new Set();
  for (const p of ALL_PLACES) {
    if (seen.has(p.id)) continue;
    seen.add(p.id);
    if (!BY_CATEGORY.has(p.category)) BY_CATEGORY.set(p.category, []);
    BY_CATEGORY.get(p.category).push(p);
  }
  for (const list of BY_CATEGORY.values()) {
    list.sort((a, b) => (a.rank ?? 999) - (b.rank ?? 999));
    // tieni al massimo i primi 25
    if (list.length > MAX_PER_CATEGORY) list.length = MAX_PER_CATEGORY;
  }
}

/** Tipologie realmente selezionabili: quelle con almeno un locale. */
export function getDiscoveryTypes() {
  return [...BY_CATEGORY.entries()]
    .filter(([, list]) => list.length > 0)
    .map(([category, list]) => ({ id: category, label: category, count: list.length }))
    .sort((a, b) => a.label.localeCompare(b.label, 'it'));
}

/** Top locali di una categoria (già ordinati per rank, max 25). */
export function getTopPlaces(category) {
  return (BY_CATEGORY.get(category) || []).slice();
}

/**
 * Pipeline: da una categoria estrae fino a 6 candidati a caso tra i top 25.
 * L'estrazione è uniforme e NON tiene conto del rank.
 */
export function drawCandidates(category, count = 6) {
  const top = getTopPlaces(category);
  return sample(top, count);
}

export const DISCOVERY_REGION = REGION;
export const DISCOVERY_COUNT = ALL_PLACES.length;

/* ------------------------------------------------------------------ *
 * Matching col database delle RECENSIONI PNDR (unica fonte di verità)
 * ------------------------------------------------------------------ */

const NAME_LEAD =
  /^(ristorante|trattoria|pizzeria|osteria|hosteria|antica|paninoteca|agriturismo|braceria|friggitoria|locanda|bottega|tenuta|fattoria)\s+/i;

/** Nome ridotto a una forma confrontabile: senza accenti, senza parola-categoria
 *  iniziale, senza tutto ciò che segue un trattino («– Franco Pepe», «- Napoli»),
 *  senza punteggiatura. */
function canonName(value) {
  return String(value || '')
    .toLowerCase()
    .normalize('NFD') // scompone gli accenti; le combining mark cadono col filtro sotto
    .split(/\s[–—-]\s|\s[–—-]|[–—]/)[0]
    .replace(NAME_LEAD, '')
    .replace(/[^a-z0-9 ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function canonPlace(value) {
  return String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[^a-z0-9 ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Cerca il locale nel database delle recensioni (`restaurants` dal
 * RestaurantsContext). Ordine: id/placeId espliciti → nome+città normalizzati →
 * nome contenuto + stessa provincia. Ritorna il record PNDR o `null`.
 */
export function findPndrMatch(place, restaurants) {
  if (!place || !Array.isArray(restaurants) || restaurants.length === 0) return null;

  // 1) identificatori espliciti se presenti su entrambi i lati
  const pid = place.placeId || place.googlePlaceId || null;
  if (pid) {
    const byId = restaurants.find((r) => r.placeId === pid || r.googlePlaceId === pid);
    if (byId) return byId;
  }

  const dName = canonName(place.name);
  const dCity = canonPlace(place.city);
  const dProv = String(place.province || '').toUpperCase();
  if (!dName) return null;

  // 2) nome + città combaciano
  let match = restaurants.find(
    (r) => canonName(r.name) === dName && (!dCity || canonPlace(r.town) === dCity),
  );
  if (match) return match;

  // 3) un nome contiene l'altro (≥ 4 caratteri) e stessa città o provincia
  match = restaurants.find((r) => {
    const rName = canonName(r.name);
    if (rName.length < 4 || dName.length < 4) return false;
    const nameHit = rName === dName || rName.includes(dName) || dName.includes(rName);
    if (!nameHit) return false;
    const sameCity = dCity && canonPlace(r.town) === dCity;
    const sameProv = dProv && String(r.province || '').toUpperCase() === dProv;
    return sameCity || sameProv;
  });
  return match || null;
}

/** Normalizza un numero italiano per `tel:` (prefisso +39, senza spazi). */
export function telHref(phone) {
  if (!phone) return null;
  let digits = String(phone).replace(/[^\d+]/g, '');
  if (digits.startsWith('+')) return `tel:${digits}`;
  digits = digits.replace(/^00/, '');
  if (digits.startsWith('39')) return `tel:+${digits}`;
  return `tel:+39${digits}`;
}

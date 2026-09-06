/**
 * Modello dati puro di Gambero Moscio - Recensioni Locali.
 *
 * Nessun accesso a `localStorage`, a Vercel Blob o alla rete: solo funzioni
 * pure di normalizzazione/validazione. Usato sia dal client
 * (`RestaurantsContext`) sia dal server (`lib/blob-store.js`, `api/`).
 *
 * Un locale = dati condivisi + `reviews.{ilenia,salvatore}` indipendenti
 * (ciascuna può essere assente). Gli aggregati (`ratings`, `rankingScore`,
 * `reviewCount`) sono derivati dalle recensioni presenti.
 */
import { isValidCategory } from '../config/categories.js';
import { REVIEWER_KEYS } from '../config/users.js';
import {
  RATING_KEYS,
  aggregateReviews,
  calculateRankingScore,
  clampRating,
  normalizeRatings,
} from './ratings.js';

/** Normalizza spazi e ritagli di un testo semplice. */
export function cleanText(value) {
  return String(value ?? '')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Genera un id stabile per un nuovo locale. */
export function createId() {
  const rand = Math.random().toString(36).slice(2, 8);
  return `restaurant-${Date.now().toString(36)}${rand}`;
}

/** Chiave per il controllo duplicati: nome + città + provincia, normalizzati. */
export function placeKey(raw) {
  return [cleanText(raw?.name), cleanText(raw?.town), cleanText(raw?.province)]
    .join('|')
    .toLowerCase();
}

/**
 * Normalizza una singola recensione (voti + testo). Ritorna null se la
 * recensione non ha contenuto (né testo né voti > 0).
 */
function normalizeReview(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const ratings = normalizeRatings(raw.ratings && typeof raw.ratings === 'object' ? raw.ratings : {});
  const review = cleanText(raw.review);
  const hasContent = review.length > 0 || RATING_KEYS.some((k) => clampRating(ratings[k]) > 0);
  if (!hasContent) return null;
  return { ratings, review, rankingScore: calculateRankingScore(ratings) };
}

function normalizeImageList(value) {
  return Array.isArray(value)
    ? value
        .filter((src) => typeof src === 'string')
        .map((src) => src.trim())
        .filter((src) => src.startsWith('data:image/') || /^https?:\/\//i.test(src))
    : [];
}

/**
 * Riporta un record grezzo alla forma canonica di Restaurant.
 * Gestisce il formato legacy (record piatto `ratings`/`review` senza `reviews`):
 * quella recensione diventa `reviews.ilenia`. Ritorna null se inutilizzabile.
 */
export function normalizeRestaurant(raw) {
  if (!raw || typeof raw !== 'object') return null;

  const name = cleanText(raw.name);
  const town = cleanText(raw.town);
  if (!name || !town) return null;

  const category = isValidCategory(raw.category) ? raw.category : 'Trattoria';
  const province = cleanText(raw.province).toUpperCase().slice(0, 2) || '—';

  const rawReviews =
    raw.reviews && typeof raw.reviews === 'object'
      ? raw.reviews
      : raw.ratings || raw.review
        ? { ilenia: { ratings: raw.ratings, review: raw.review } }
        : {};

  const reviews = {};
  REVIEWER_KEYS.forEach((key) => {
    const r = normalizeReview(rawReviews[key]);
    if (r) reviews[key] = r;
  });

  const { ratings, rankingScore, reviewCount } = aggregateReviews(Object.values(reviews));

  return {
    id: typeof raw.id === 'string' && raw.id ? raw.id : createId(),
    name,
    category,
    town,
    province,
    imageUrl: typeof raw.imageUrl === 'string' ? raw.imageUrl.trim() : '',
    dishImages: normalizeImageList(raw.dishImages),
    reviews,
    // aggregati derivati (non modificabili a mano)
    ratings,
    rankingScore,
    reviewCount,
  };
}

/** Normalizza una collezione (scarta i record non validi). */
export function normalizeCollection(list) {
  if (!Array.isArray(list)) return [];
  return list.map(normalizeRestaurant).filter(Boolean);
}

/** Estrae l'array `restaurants` da un documento o da un array grezzo (compat seed). */
export function extractRestaurants(doc) {
  if (Array.isArray(doc)) return doc;
  if (doc && Array.isArray(doc.restaurants)) return doc.restaurants;
  return [];
}

/** Campi condivisi del locale (non appartengono alle singole recensioni). */
export const PLACE_FIELDS = ['name', 'category', 'town', 'province', 'imageUrl', 'dishImages'];

export function pickPlaceFields(data) {
  const out = {};
  PLACE_FIELDS.forEach((k) => {
    if (data && data[k] !== undefined) out[k] = data[k];
  });
  return out;
}

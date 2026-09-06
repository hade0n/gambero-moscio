import seed from '../data/restaurants.json';
import { isValidCategory } from '../config/categories.js';
import { calculateRankingScore, normalizeRatings } from './ratings.js';

export const STORAGE_KEY = 'pndr_restaurants';

/** Normalizza spazi e ritagli di un testo semplice. */
function cleanText(value) {
  return String(value ?? '')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Genera un id stabile per un nuovo locale. */
export function createId() {
  const rand = Math.random().toString(36).slice(2, 8);
  return `restaurant-${Date.now().toString(36)}${rand}`;
}

/**
 * Riporta un record grezzo alla forma canonica di Restaurant.
 * Ritorna null se i campi minimi non sono utilizzabili.
 */
export function normalizeRestaurant(raw) {
  if (!raw || typeof raw !== 'object') return null;

  const name = cleanText(raw.name);
  const town = cleanText(raw.town);
  if (!name || !town) return null;

  const category = isValidCategory(raw.category) ? raw.category : 'Trattoria';
  const province = cleanText(raw.province).toUpperCase().slice(0, 2) || '—';

  const rawRatings = raw.ratings && typeof raw.ratings === 'object' ? raw.ratings : {};
  const ratings = normalizeRatings(rawRatings); // gestisce anche i dati legacy
  const rankingScore = calculateRankingScore(ratings);

  // Galleria foto dei piatti: semplice array di immagini (data URL o http).
  const dishImages = Array.isArray(raw.dishImages)
    ? raw.dishImages
        .filter((src) => typeof src === 'string')
        .map((src) => src.trim())
        .filter((src) => src.startsWith('data:image/') || /^https?:\/\//i.test(src))
    : [];

  return {
    id: typeof raw.id === 'string' && raw.id ? raw.id : createId(),
    name,
    category,
    town,
    province,
    ratings,
    rankingScore,
    review: cleanText(raw.review),
    imageUrl: typeof raw.imageUrl === 'string' ? raw.imageUrl.trim() : '',
    dishImages,
  };
}

function normalizeList(list) {
  if (!Array.isArray(list)) return null;
  const cleaned = list.map(normalizeRestaurant).filter(Boolean);
  return cleaned;
}

/** Carica i locali: da localStorage se validi, altrimenti dal seed (che viene salvato). */
export function loadRestaurants() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = normalizeList(JSON.parse(raw));
      if (parsed && parsed.length > 0) {
        // Riscrive sempre in forma normalizzata: migra i dati legacy
        // (solo food/service/price) al nuovo formato a 8 categorie.
        const serialized = JSON.stringify(parsed);
        if (serialized !== raw) {
          try {
            localStorage.setItem(STORAGE_KEY, serialized);
          } catch {
            /* riscrittura non riuscita: si prosegue con i dati normalizzati in memoria */
          }
        }
        return parsed;
      }
    }
  } catch {
    // blob illeggibile o storage non disponibile: si ricade sul seed
  }

  const initial = normalizeList(seed) ?? [];
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(initial));
  } catch {
    /* salvataggio seed non riuscito: si prosegue comunque in memoria */
  }
  return initial;
}

/**
 * Persiste la collezione. Propaga un Error leggibile se lo spazio è esaurito,
 * così i chiamanti possono mostrare un messaggio e non aggiornare lo stato.
 */
export function saveRestaurants(list) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
  } catch (err) {
    const isQuota =
      err instanceof DOMException &&
      (err.name === 'QuotaExceededError' || err.name === 'NS_ERROR_DOM_QUOTA_REACHED');
    throw new Error(
      isQuota
        ? "Non è stato possibile salvare. L'immagine potrebbe essere troppo grande."
        : 'Non è stato possibile salvare i dati sul dispositivo.',
    );
  }
}

/** Rilegge la collezione dal valore corrente di localStorage (per la sync fra tab). */
export function readRestaurantsFromStorage() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed = normalizeList(JSON.parse(raw));
    return parsed ?? [];
  } catch {
    return [];
  }
}

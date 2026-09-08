/**
 * Sistema di valutazione gastronomica multidimensionale di PNDR.
 *
 * Tutta la logica matematica del rating vive in questo file.
 * I componenti UI non contengono formule: chiamano queste utility.
 *
 * Internamente complesso, esternamente semplice: l'utente vede solo `overall`
 * (reso a schermo in Gamberi Mosci, vedi `ratingUtils.js` / `ShrimpRating`),
 * il sistema mantiene `rankingScore` ad alta precisione per la classifica.
 */

/** Le 8 categorie indipendenti, nell'ordine di visualizzazione. */
export const RATING_CATEGORIES = [
  {
    key: 'location',
    label: 'Location',
    description: 'Posizione, ambiente, atmosfera, cura degli spazi e identità del locale.',
  },
  {
    key: 'menu',
    label: 'Menu',
    description: 'Varietà, chiarezza, originalità e coerenza della proposta.',
  },
  {
    key: 'ingredients',
    label: 'Materie prime',
    description: 'Qualità, freschezza, selezione dei prodotti e stagionalità.',
  },
  {
    key: 'food',
    label: 'Cibo',
    description: 'Gusto, cottura, equilibrio, tecnica e consistenza dei piatti.',
  },
  {
    key: 'presentation',
    label: 'Presentazione',
    description: 'Impiattamento e cura visiva, senza penalizzare la semplicità voluta.',
  },
  {
    key: 'service',
    label: 'Servizio',
    description: 'Cortesia, attenzione, professionalità, tempi e disponibilità.',
  },
  {
    key: 'price',
    label: 'Qualità / Prezzo',
    description: 'Rapporto tra ciò che si riceve e ciò che si paga, non il prezzo assoluto.',
  },
  {
    key: 'experience',
    label: 'Esperienza',
    description: 'Piacere, coerenza e memorabilità dell’esperienza nel suo insieme.',
  },
];

export const RATING_KEYS = RATING_CATEGORIES.map((c) => c.key);

/** Pesi del sistema (somma = 1). Unica fonte: non duplicare altrove. */
export const RATING_WEIGHTS = {
  location: 0.075,
  menu: 0.1,
  ingredients: 0.15,
  food: 0.25,
  presentation: 0.075,
  service: 0.1,
  price: 0.1,
  experience: 0.15,
};

/* --------------------------------------------------------------------------
 * Helper numerici
 * ------------------------------------------------------------------------ */

/** Converte un valore in numero finito, altrimenti 0. */
function toNumber(value) {
  const n = typeof value === 'string' ? parseFloat(value.replace(',', '.')) : Number(value);
  return Number.isFinite(n) ? n : 0;
}

/** Limita un voto in 0–10. Scarta NaN / Infinity. */
export function clampRating(value) {
  const n = toNumber(value);
  if (n < 0) return 0;
  if (n > 10) return 10;
  return n;
}

/** Arrotonda a 1 cifra decimale (step 0.1). */
export function roundToStep(value) {
  return Math.round(toNumber(value) * 10) / 10;
}

/** Formatta un voto con una cifra decimale fissa (8 -> "8.0"). */
export function formatRating(value) {
  return toNumber(value).toFixed(1);
}

/** true se un locale usa il vecchio formato (solo food/service/price). */
export function isLegacyRatings(raw) {
  if (!raw || typeof raw !== 'object') return false;
  const hasOld = ['food', 'service', 'price'].every((k) => Number.isFinite(toNumber(raw[k])));
  const missingNew = ['location', 'menu', 'ingredients', 'presentation', 'experience'].some(
    (k) => !Number.isFinite(Number(raw[k])),
  );
  return hasOld && missingNew;
}

/**
 * Deriva in modo deterministico (nessuna casualità) le 8 categorie da un
 * vecchio record con solo food/service/price.
 */
function fromLegacy(raw) {
  const food = clampRating(raw.food);
  const service = clampRating(raw.service);
  const price = clampRating(raw.price);
  return {
    location: roundToStep(service),
    menu: roundToStep((food + service) / 2),
    ingredients: roundToStep(food),
    food: roundToStep(food),
    presentation: roundToStep(food),
    service: roundToStep(service),
    price: roundToStep(price),
    experience: roundToStep((food + service + price) / 3),
  };
}

/**
 * Normalizza le 8 categorie di un record (gestendo anche i dati legacy) e
 * calcola `overall` + `rankingScore`.
 * @returns {{location:number,menu:number,ingredients:number,food:number,presentation:number,service:number,price:number,experience:number,overall:number}}
 */
export function normalizeRatings(raw) {
  const source = isLegacyRatings(raw) ? fromLegacy(raw) : raw || {};
  const ratings = {};
  RATING_KEYS.forEach((key) => {
    ratings[key] = roundToStep(clampRating(source[key]));
  });
  const rankingScore = calculateRankingScore(ratings);
  ratings.overall = Math.round(rankingScore * 10) / 10;
  return ratings;
}

/* --------------------------------------------------------------------------
 * Componenti del punteggio
 * ------------------------------------------------------------------------ */

/** Punteggio base: media ponderata delle 8 categorie. */
export function calculateBaseScore(ratings) {
  return RATING_KEYS.reduce((sum, key) => sum + clampRating(ratings[key]) * RATING_WEIGHTS[key], 0);
}

/**
 * Correttivo di coerenza: premia un profilo omogeneo, penalizza forti
 * squilibri. Limitato per non ribaltare un locale nettamente migliore.
 */
export function calculateConsistencyAdjustment(ratings) {
  const values = RATING_KEYS.map((key) => clampRating(ratings[key]));
  const spread = Math.max(...values) - Math.min(...values);
  if (spread <= 0.5) return 0.15;
  if (spread <= 1.0) return 0.1;
  if (spread <= 1.5) return 0.05;
  if (spread <= 2.0) return 0;
  if (spread <= 3.0) return -0.05;
  if (spread <= 4.0) return -0.1;
  return -0.2;
}

/** Bonus di specializzazione gastronomica (solo il livello più alto). */
export function calculateCulinaryBonus(ratings) {
  const culinaryScore =
    clampRating(ratings.ingredients) * 0.35 +
    clampRating(ratings.food) * 0.45 +
    clampRating(ratings.menu) * 0.2;
  if (culinaryScore >= 9.5) return 0.25;
  if (culinaryScore >= 9.0) return 0.15;
  return 0;
}

/** Bonus di eccellenza: +0.03 per categoria ≥ 9.5, massimo +0.15. */
export function calculateExcellenceBonus(ratings) {
  const excellent = RATING_KEYS.filter((key) => clampRating(ratings[key]) >= 9.5).length;
  return Math.min(0.15, excellent * 0.03);
}

/**
 * Penalità per punteggi molto bassi: per ogni categoria si applica solo la
 * fascia più bassa raggiunta. Totale massimo -0.40. Restituisce un valore
 * positivo (la magnitudo) che il ranking sottrae.
 */
export function calculateLowRatingPenalty(ratings) {
  let penalty = 0;
  RATING_KEYS.forEach((key) => {
    const v = clampRating(ratings[key]);
    if (v < 3.0) penalty += 0.2;
    else if (v < 4.0) penalty += 0.1;
    else if (v < 5.0) penalty += 0.05;
  });
  return Math.min(0.4, penalty);
}

/**
 * Ranking score finale ad alta precisione (0–10).
 * base + coerenza + gastronomia + eccellenza − penalità.
 */
export function calculateRankingScore(ratings) {
  const score =
    calculateBaseScore(ratings) +
    calculateConsistencyAdjustment(ratings) +
    calculateCulinaryBonus(ratings) +
    calculateExcellenceBonus(ratings) -
    calculateLowRatingPenalty(ratings);
  return Math.min(10, Math.max(0, score));
}

/** Voto pubblico: ranking score arrotondato a 1 cifra decimale. */
export function calculateOverall(ratings) {
  return Math.round(calculateRankingScore(ratings) * 10) / 10;
}

/**
 * Aggregato di un locale con più recensioni indipendenti: media per categoria
 * dei voti delle recensioni presenti, poi `overall` e `rankingScore` calcolati
 * col sistema esistente. Con una sola recensione l'aggregato coincide con essa.
 * @param {Array<{ratings:object}>} reviews recensioni presenti (0, 1 o 2)
 */
export function aggregateReviews(reviews) {
  const present = (reviews || []).filter((r) => r && r.ratings);
  const ratings = {};

  if (present.length === 0) {
    RATING_KEYS.forEach((key) => {
      ratings[key] = 0;
    });
    ratings.overall = 0;
    return { ratings, rankingScore: 0, reviewCount: 0 };
  }

  RATING_KEYS.forEach((key) => {
    const sum = present.reduce((acc, r) => acc + clampRating(r.ratings[key]), 0);
    ratings[key] = roundToStep(sum / present.length);
  });
  const rankingScore = calculateRankingScore(ratings);
  ratings.overall = Math.round(rankingScore * 10) / 10;
  return { ratings, rankingScore, reviewCount: present.length };
}

/**
 * Confronto deterministico per la classifica: rankingScore desc, poi la
 * catena di tie-break (food, ingredients, experience, service, price, nome).
 */
export function compareByRanking(a, b) {
  const sa = typeof a.rankingScore === 'number' ? a.rankingScore : calculateRankingScore(a.ratings);
  const sb = typeof b.rankingScore === 'number' ? b.rankingScore : calculateRankingScore(b.ratings);

  if (Math.abs(sa - sb) >= 0.01) return sb - sa;

  const chain = ['food', 'ingredients', 'experience', 'service', 'price'];
  for (const key of chain) {
    const diff = clampRating(b.ratings?.[key]) - clampRating(a.ratings?.[key]);
    if (Math.abs(diff) >= 1e-9) return diff;
  }
  return String(a.name).localeCompare(String(b.name), 'it');
}

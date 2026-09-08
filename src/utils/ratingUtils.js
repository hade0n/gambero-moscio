/**
 * Sistema di valutazione proprietario PNDR — i "Gamberi Mosci".
 *
 * Su PNDR non si danno stelle: si danno **Gamberi Mosci**. La scala numerica
 * resta identica (0.0–10.0, precisione al decimo e oltre): cambia solo la
 * rappresentazione. 5 gamberi in tutto, ognuno vale 2.0 punti; il quinto (o
 * quello parziale) si riempie in modo **continuo e proporzionale** al voto,
 * non a scatti di 0.5.
 *
 * Tutta la matematica del rating VISIVO vive qui. Il calcolo del punteggio
 * (`ratings.js`) non viene toccato: questo file legge solo il valore finale.
 */

export const SHRIMP_COUNT = 5;
export const POINTS_PER_SHRIMP = 2; // 5 gamberi × 2 = 10

/** Riporta il voto entro 0–10 senza alterare i decimali. */
function clampScore(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  if (n <= 0) return 0;
  if (n >= 10) return 10;
  return n;
}

/**
 * Stato visivo dei 5 gamberi per un dato voto.
 *
 * @param {number} rating  voto 0.0–10.0 (qualsiasi numero di decimali)
 * @returns {{
 *   value: number,            // il voto normalizzato 0–10 (decimali intatti)
 *   fills: number[],          // riempimento % (0–100, 1 decimale) di ciascun gambero
 *   fullShrimps: number,      // gamberi pieni al 100%
 *   partialIndex: number,     // indice del gambero parzialmente pieno (-1 se nessuno)
 *   partialPercentage: number,// riempimento % del gambero parziale (0 se nessuno)
 *   emptyShrimps: number,     // gamberi completamente vuoti
 * }}
 *
 * Esempi:
 *  8.0  → fills [100,100,100,100,0]     full 4, partial -1/0
 *  8.1  → fills [100,100,100,100,5]     full 4, partial 4 → 5%
 *  8.5  → fills [100,100,100,100,25]    full 4, partial 4 → 25%
 *  8.37 → fills [100,100,100,100,18.5]  full 4, partial 4 → 18.5%
 *  9.0  → fills [100,100,100,100,50]
 *  7.3  → fills [100,100,100,65,0]      full 3, partial 3 → 65%
 * 10.0  → fills [100,100,100,100,100]   full 5, partial -1/0  (mai un sesto gambero)
 *  0.0  → fills [0,0,0,0,0]             empty 5
 */
export function getShrimpRatingState(rating) {
  const value = clampScore(rating);

  const fills = [];
  for (let i = 0; i < SHRIMP_COUNT; i += 1) {
    const lowerBound = i * POINTS_PER_SHRIMP; // 0, 2, 4, 6, 8
    const fraction = (value - lowerBound) / POINTS_PER_SHRIMP; // quota di questo gambero
    const clamped = Math.min(1, Math.max(0, fraction));
    // Normalizza il floating point: 1 decimale di percentuale, niente 24.99999997.
    fills.push(Math.round(clamped * 1000) / 10);
  }

  const fullShrimps = fills.filter((f) => f >= 100).length;
  const partialIndex = fills.findIndex((f) => f > 0 && f < 100);
  const partialPercentage = partialIndex === -1 ? 0 : fills[partialIndex];
  const emptyShrimps = fills.filter((f) => f <= 0).length;

  return { value, fills, fullShrimps, partialIndex, partialPercentage, emptyShrimps };
}

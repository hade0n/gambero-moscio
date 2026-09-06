/**
 * Fonte unica delle categorie PNDR.
 * Nessun altro file deve ridefinire questa lista o la logica di filtro.
 */

export const ALL = 'Tutti';

export const CATEGORIES = [
  'Trattoria',
  'Pizzeria',
  'Ristorante Carne',
  'Ristorante Pesce',
  'Osteria',
  'Paninoteca',
  'Agriturismo',
  'Street Food',
];

/** Categorie mostrate nel filtro della homepage, con "Tutti" in testa. */
export const FILTER_CATEGORIES = [ALL, ...CATEGORIES];

/** true se la categoria è valida per un locale (esclude "Tutti"). */
export function isValidCategory(value) {
  return CATEGORIES.includes(value);
}

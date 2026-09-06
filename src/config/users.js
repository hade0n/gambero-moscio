/**
 * I due recensori di Gambero Moscio - Recensioni Locali.
 * Una coppia che recensisce insieme i locali che visita: ogni locale può
 * contenere al massimo una recensione per ciascuno dei due.
 * Fonte unica: chiavi usate nel modello dati (`restaurant.reviews[key]`),
 * nelle pill del dettaglio e nello stato del backend.
 */

export const REVIEWERS = [
  { key: 'ilenia', label: 'Ilenia' },
  { key: 'salvatore', label: 'Salvatore' },
];

export const REVIEWER_KEYS = REVIEWERS.map((r) => r.key);

/** Etichetta leggibile per una chiave recensore. */
export function reviewerLabel(key) {
  return REVIEWERS.find((r) => r.key === key)?.label ?? key;
}

/** true se la chiave è un recensore valido. */
export function isReviewer(key) {
  return REVIEWER_KEYS.includes(key);
}

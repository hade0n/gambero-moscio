/**
 * Motion language unico di Gambero Moscio.
 *
 * Sensazione: soft, quick, tactile, editorial, natural.
 * Solo `transform` e `opacity`. Poche easing coerenti, durate brevi.
 * `prefers-reduced-motion` è gestito a monte da <MotionConfig reducedMotion="user">
 * in main.jsx: Framer Motion azzera automaticamente translate/scale/opacity.
 * Per gli effetti non-Framer usare `useReducedMotion()` dove serve.
 */

// Durate (secondi, come vuole Framer Motion)
export const DUR = {
  fast: 0.14, // feedback tattile, cambi di stato piccoli
  base: 0.2, // standard: reveal, transizioni di lista
  modal: 0.28, // enter/exit di modali e sheet
  slow: 0.42, // reveal narrativi (es. risultato della Ruota)
};

// Easing (cubic-bezier). `out` deriva da --ease-pndr del progetto.
export const EASE = {
  out: [0.2, 0.7, 0.2, 1], // entrate / standard
  in: [0.4, 0, 1, 1], // uscite, più rapide
  inOut: [0.65, 0, 0.35, 1], // cambi di layout
};

const enter = (duration, ease = EASE.out) => ({ duration, ease });
const leave = (duration = DUR.fast, ease = EASE.in) => ({ duration, ease });

/** Solo opacità — backdrop, dissolvenze funzionali. */
export const fade = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: enter(DUR.base) },
  exit: { opacity: 0, transition: leave() },
};

/** Opacità + piccolo scorrimento verticale — reveal editoriale. */
export const fadeUp = {
  hidden: { opacity: 0, y: 12 },
  visible: { opacity: 1, y: 0, transition: enter(DUR.base) },
  exit: { opacity: 0, y: 6, transition: leave() },
};

/** Comparsa morbida di una superficie (dialog centrato, card risultato). */
export const scaleIn = {
  hidden: { opacity: 0, scale: 0.98, y: 8 },
  visible: { opacity: 1, scale: 1, y: 0, transition: enter(DUR.modal) },
  exit: { opacity: 0, scale: 0.985, y: 6, transition: leave(0.18) },
};

/** Sheet ancorato in basso su mobile: scorrimento contenuto, non slide piena. */
export const sheet = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0, transition: enter(DUR.modal) },
  exit: { opacity: 0, y: 12, transition: leave(0.18) },
};

/**
 * Reveal per elemento di una lista, da usare con `whileInView` così la coda
 * non cresce con il numero di elementi (una lista di 30 card non fa 30 delay).
 */
export const listItem = {
  hidden: { opacity: 0, y: 14 },
  visible: { opacity: 1, y: 0, transition: enter(DUR.base) },
};

/** Viewport condiviso per i reveal on-scroll. */
export const inViewOnce = { once: true, margin: '0px 0px -8% 0px' };

/** Micro-feedback tattile standard (scala minima, niente effetto giocattolo). */
export const tap = { scale: 0.97 };
export const tapSubtle = { scale: 0.985 };

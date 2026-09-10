import { useEffect } from 'react';
import { animate, motion, useMotionValue, useReducedMotion, useTransform } from 'framer-motion';
import { formatRating } from '../utils/ratings.js';
import { EASE } from '../lib/motion.js';

/**
 * Numero che sale progressivamente da 0 al valore finale (una decimale), come
 * il riempimento di una barra di caricamento. Solo `opacity`/testo, nessun
 * layout shift (il chiamante tiene `tabular`). Con `prefers-reduced-motion`
 * mostra subito il valore finale.
 *
 * @param {number} value    valore finale 0–10
 * @param {number} [duration=0.85]
 * @param {number} [delay=0]
 * @param {string} [className]
 */
export default function AnimatedNumber({ value, duration = 0.85, delay = 0, className = '' }) {
  const reduce = useReducedMotion();
  const mv = useMotionValue(reduce ? value : 0);
  const text = useTransform(mv, (v) => formatRating(v));

  useEffect(() => {
    if (reduce) {
      mv.set(value);
      return undefined;
    }
    mv.set(0);
    const controls = animate(mv, value, { duration, delay, ease: EASE.out });
    return controls.stop;
  }, [value, duration, delay, reduce, mv]);

  return <motion.span className={className}>{text}</motion.span>;
}

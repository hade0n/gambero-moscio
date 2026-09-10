import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import AnimatedNumber from './AnimatedNumber.jsx';
import { RATING_CATEGORIES } from '../utils/ratings.js';
import { EASE } from '../lib/motion.js';

const FILL_MS = 0.85;

/** Dettaglio delle 8 categorie con valore numerico e barra proporzionale (0–10).
 *  Barra e numero si riempiono insieme, progressivamente, come un caricamento.
 *  Il via è dato da `useEffect` (non dall'`initial` di mount di Framer): così
 *  parte anche alla prima apertura del modal, dove l'`AnimatePresence` con
 *  `initial={false}` sopprimerebbe l'animazione di mount. */
export default function RatingBreakdown({ ratings }) {
  const [play, setPlay] = useState(false);
  useEffect(() => {
    const id = requestAnimationFrame(() => setPlay(true));
    return () => cancelAnimationFrame(id);
  }, []);

  return (
    <dl className="space-y-2.5">
      {RATING_CATEGORIES.map(({ key, label }, i) => {
        const value = Math.max(0, Math.min(10, Number(ratings?.[key]) || 0));
        const delay = i * 0.04;
        return (
          <div
            key={key}
            className="grid grid-cols-[7rem_1fr_2.25rem] items-center gap-3 sm:grid-cols-[9rem_1fr_2.5rem]"
          >
            <dt className="text-sm font-medium text-brown-soft">{label}</dt>
            <div className="h-2 overflow-hidden rounded-full bg-brown/10" role="presentation">
              <motion.div
                className="h-full w-full origin-left bg-green"
                initial={false}
                animate={{ scaleX: play ? value / 10 : 0 }}
                transition={{ duration: FILL_MS, ease: EASE.out, delay }}
              />
            </div>
            <dd className="tabular text-right text-sm font-bold text-brown">
              <AnimatedNumber value={value} duration={FILL_MS} delay={delay} />
            </dd>
          </div>
        );
      })}
    </dl>
  );
}

import { motion } from 'framer-motion';
import { RATING_CATEGORIES, formatRating } from '../utils/ratings.js';
import { DUR, EASE } from '../lib/motion.js';

/** Dettaglio delle 8 categorie con valore numerico e barra proporzionale (0–10). */
export default function RatingBreakdown({ ratings }) {
  return (
    <dl className="space-y-2.5">
      {RATING_CATEGORIES.map(({ key, label }, i) => {
        const value = Math.max(0, Math.min(10, Number(ratings?.[key]) || 0));
        return (
          <div
            key={key}
            className="grid grid-cols-[7rem_1fr_2.25rem] items-center gap-3 sm:grid-cols-[9rem_1fr_2.5rem]"
          >
            <dt className="text-sm font-medium text-brown-soft">{label}</dt>
            <div className="h-2 overflow-hidden rounded-full bg-brown/10" role="presentation">
              <motion.div
                className="h-full rounded-full bg-green"
                initial={{ width: 0 }}
                animate={{ width: `${(value / 10) * 100}%` }}
                transition={{ duration: DUR.base, ease: EASE.out, delay: i * 0.03 }}
              />
            </div>
            <dd className="tabular text-right text-sm font-bold text-brown">{formatRating(value)}</dd>
          </div>
        );
      })}
    </dl>
  );
}

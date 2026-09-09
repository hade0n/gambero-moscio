import { motion } from 'framer-motion';
import Icon from './Icon.jsx';
import ReviewStatus from './ReviewStatus.jsx';
import { listItem } from '../lib/motion.js';
import { reviewerLabel } from '../config/users.js';

/**
 * Elenco dei locali per scrivere/modificare la propria recensione.
 * Mostra chi ha già recensito; il pulsante di riga scrive una nuova recensione
 * dell'utente corrente oppure ne modifica una già esistente.
 */
export default function ReviewPicker({ restaurants, user, onPick }) {
  const label = reviewerLabel(user);

  if (restaurants.length === 0) {
    return (
      <p className="rounded-2xl border border-dashed bg-cream/60 px-4 py-8 text-center text-sm text-brown-soft">
        Non c’è ancora nessun locale. Crea prima un locale con «+ Crea locale».
      </p>
    );
  }

  return (
    <ul className="space-y-3">
      {restaurants.map((r, i) => {
        const alreadyMine = Boolean(r.reviews?.[user]);
        return (
          <motion.li
            key={r.id}
            className="surface p-4"
            variants={listItem}
            initial="hidden"
            animate="visible"
            transition={{ delay: Math.min(i, 6) * 0.03 }}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h3 className="truncate font-display text-base font-semibold">{r.name}</h3>
                <p className="mt-0.5 truncate text-sm text-brown-soft">
                  {r.town} ({r.province}) · {r.category}
                </p>
              </div>
              <ReviewStatus reviews={r.reviews} />
            </div>
            <div className="mt-3 flex justify-end border-t border-brown/8 pt-3">
              <button
                type="button"
                onClick={() => onPick(r)}
                className="btn btn-primary btn-sm"
              >
                <Icon name={alreadyMine ? 'edit' : 'plus'} size={16} className="shrink-0" />
                {alreadyMine ? `Modifica la recensione di ${label}` : `Scrivi la recensione di ${label}`}
              </button>
            </div>
          </motion.li>
        );
      })}
    </ul>
  );
}

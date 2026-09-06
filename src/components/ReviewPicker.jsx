import Icon from './Icon.jsx';
import ReviewStatus from './ReviewStatus.jsx';
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
      {restaurants.map((r) => {
        const alreadyMine = Boolean(r.reviews?.[user]);
        return (
          <li key={r.id} className="rounded-2xl border bg-cream-soft p-4">
            <h3 className="text-base font-semibold">{r.name}</h3>
            <p className="mt-0.5 text-sm text-brown-soft">
              {r.town} ({r.province}) · {r.category}
            </p>
            <ReviewStatus reviews={r.reviews} className="mt-2" />
            <div className="mt-3 flex justify-end">
              <button
                type="button"
                onClick={() => onPick(r)}
                className="btn btn-primary btn-sm"
              >
                <Icon name={alreadyMine ? 'edit' : 'plus'} size={16} />
                {alreadyMine
                  ? `Modifica la recensione di ${label}`
                  : `Scrivi la recensione di ${label}`}
              </button>
            </div>
          </li>
        );
      })}
    </ul>
  );
}

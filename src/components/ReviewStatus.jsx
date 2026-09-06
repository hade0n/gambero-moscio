import Icon from './Icon.jsx';
import { REVIEWERS } from '../config/users.js';

/**
 * Mostra quali dei due recensori hanno già recensito un locale.
 * `reviews` è l'oggetto `restaurant.reviews`.
 */
export default function ReviewStatus({ reviews, className = '' }) {
  return (
    <ul className={`flex flex-wrap gap-x-4 gap-y-1 text-sm ${className}`}>
      {REVIEWERS.map(({ key, label }) => {
        const done = Boolean(reviews?.[key]);
        return (
          <li key={key} className="flex items-center gap-1.5">
            <span className={done ? 'font-semibold text-brown' : 'text-brown-soft'}>{label}</span>
            {done ? (
              <span className="flex items-center gap-0.5 font-semibold text-green-deep">
                <Icon name="check" size={15} />
                <span className="sr-only">ha recensito</span>
              </span>
            ) : (
              <span className="text-brown-soft/70" aria-label="non ha ancora recensito">
                —
              </span>
            )}
          </li>
        );
      })}
    </ul>
  );
}

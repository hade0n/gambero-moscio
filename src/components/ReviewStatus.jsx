import Icon from './Icon.jsx';
import { cn } from '../lib/cn.js';
import { REVIEWERS } from '../config/users.js';

/**
 * Mostra quali dei due recensori hanno già recensito un locale, come coppia di
 * badge: pieno verde quando la recensione c'è, sobrio quando manca.
 * `reviews` è l'oggetto `restaurant.reviews`.
 */
export default function ReviewStatus({ reviews, className = '' }) {
  return (
    <ul className={cn('flex flex-wrap gap-2 text-sm', className)}>
      {REVIEWERS.map(({ key, label }) => {
        const done = Boolean(reviews?.[key]);
        return (
          <li key={key}>
            <span
              className={cn(
                'inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold',
                done
                  ? 'bg-green-deep/12 text-green-deep'
                  : 'border border-brown/15 text-brown-soft',
              )}
            >
              {done ? (
                <Icon name="check" size={13} className="shrink-0" />
              ) : (
                <span aria-hidden="true" className="text-brown-soft/60">
                  —
                </span>
              )}
              {label}
              <span className="sr-only">{done ? ' ha recensito' : ' non ha ancora recensito'}</span>
            </span>
          </li>
        );
      })}
    </ul>
  );
}

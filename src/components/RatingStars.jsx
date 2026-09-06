import Icon from './Icon.jsx';
import { formatRating } from '../utils/ratings.js';

/**
 * Stelle di valutazione su scala 0–10 (5 stelle, ognuna vale 2 punti),
 * con riempimento parziale per i valori decimali.
 * Le stelle sono un supporto grafico: il valore numerico resta in Warm Brown
 * ed è la fonte di verità per il contrasto.
 */
export default function RatingStars({ value = 0, size = 18, showValue = true, className = '' }) {
  const safe = Math.max(0, Math.min(10, Number(value) || 0));
  const percent = (safe / 10) * 100;

  return (
    <span className={`inline-flex items-center gap-2 ${className}`}>
      <span
        className="relative inline-block leading-none"
        role="img"
        aria-label={`Valutazione ${formatRating(safe)} su 10`}
      >
        <span className="flex text-brown/20" aria-hidden="true">
          {[0, 1, 2, 3, 4].map((i) => (
            <Icon key={i} name="star" size={size} />
          ))}
        </span>
        <span
          className="absolute inset-0 flex overflow-hidden text-rating"
          style={{ width: `${percent}%` }}
          aria-hidden="true"
        >
          {[0, 1, 2, 3, 4].map((i) => (
            <Icon key={i} name="star" size={size} className="shrink-0" />
          ))}
        </span>
      </span>
      {showValue && (
        <span className="tabular text-sm font-bold text-brown">{formatRating(safe)}</span>
      )}
    </span>
  );
}

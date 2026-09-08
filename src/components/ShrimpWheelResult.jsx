import { useState } from 'react';
import Icon from './Icon.jsx';
import ShrimpRating from './ShrimpRating.jsx';
import { WHEEL_RESPIN, WHEEL_VIEW } from '../config/wheelMessages.js';

/** Estratto breve da una recensione già presente (mai testo inventato). */
function excerptOf(restaurant) {
  const text =
    restaurant.reviews?.ilenia?.review || restaurant.reviews?.salvatore?.review || '';
  if (!text) return '';
  return text.length > 170 ? `${text.slice(0, 169).trimEnd()}…` : text;
}

/**
 * Card del risultato della Ruota. Riusa il linguaggio visivo delle card del sito
 * e il componente `ShrimpRating` per il voto. Nessuna stella.
 */
export default function ShrimpWheelResult({ result, onView, onRespin, className = '' }) {
  const r = result.restaurant;
  const [imgError, setImgError] = useState(false);
  const excerpt = excerptOf(r);

  return (
    <div className={`wheel-result-in surface p-5 sm:p-6 ${className}`}>
      <div className="flex items-center gap-2">
        <img src="/shrimp.svg" alt="" aria-hidden="true" className="h-6 w-6 select-none" />
        <p className="text-xs font-bold uppercase tracking-[0.14em] text-terracotta">
          {result.eyebrow}
        </p>
      </div>

      <h3 className="mt-2 font-display text-2xl font-bold leading-snug">{r.name}</h3>

      <div className="mt-2">
        <ShrimpRating rating={r.ratings.overall} size="md" valueClassName="text-lg" />
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1.5">
        <span className="inline-flex items-center rounded-full border border-green/30 bg-green/10 px-2.5 py-0.5 text-[0.7rem] font-semibold uppercase tracking-wide text-green-deep">
          {r.category}
        </span>
        <span className="flex items-center gap-1 text-sm font-medium text-brown-soft">
          <Icon name="pin" size={15} />
          {r.town} ({r.province})
        </span>
      </div>

      {r.imageUrl && !imgError && (
        <img
          src={r.imageUrl}
          alt={`Ambiente di ${r.name}`}
          loading="lazy"
          onError={() => setImgError(true)}
          className="mt-4 aspect-[16/9] w-full rounded-xl border object-cover"
        />
      )}

      {excerpt && <p className="mt-4 text-[0.95rem] leading-relaxed text-brown">{excerpt}</p>}

      <p className="mt-4 text-sm font-semibold text-brown-soft">{result.message}</p>

      <div className="mt-5 flex flex-col gap-3 sm:flex-row">
        <button type="button" onClick={() => onView(r)} className="btn btn-primary sm:flex-1">
          {WHEEL_VIEW}
        </button>
        <button
          type="button"
          onClick={onRespin}
          className="btn btn-secondary sm:flex-none sm:px-5"
        >
          {WHEEL_RESPIN}
        </button>
      </div>
    </div>
  );
}

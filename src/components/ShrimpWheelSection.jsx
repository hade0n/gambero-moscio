import { useMemo } from 'react';
import ShrimpWheel from './ShrimpWheel.jsx';
import ShrimpWheelResult from './ShrimpWheelResult.jsx';
import { useShrimpWheel } from '../hooks/useShrimpWheel.js';
import { formatRating } from '../utils/ratings.js';
import {
  EMPTY_HEADLINE,
  EMPTY_SUBHEAD,
  WHEEL_CTA,
  WHEEL_CTA_LOADING,
  WHEEL_CTA_SPINNING,
  WHEEL_HEADLINE,
  WHEEL_KICKER,
  WHEEL_SUBHEAD,
} from '../config/wheelMessages.js';

/**
 * Sezione homepage «Ruota del Gambero Moscio».
 *
 * Usa i locali GIÀ filtrati dalla homepage (`restaurants`), quindi rispetta
 * automaticamente il filtro categoria e ogni operazione CRUD. Nessuna seconda
 * fonte dati, nessuna logica di filtro duplicata qui.
 *
 * @param {object[]} restaurants   locali eleggibili (già filtrati/ordinati)
 * @param {'loading'|'ready'|'error'} contextStatus stato del RestaurantsContext
 * @param {string|null} categoryLabel  categoria attiva (null = nessun filtro)
 * @param {(place:object)=>void} onViewPlace  apre il dettaglio del locale
 */
export default function ShrimpWheelSection({
  restaurants,
  contextStatus,
  categoryLabel,
  onViewPlace,
}) {
  const eligible = Array.isArray(restaurants) ? restaurants : [];
  const wheel = useShrimpWheel(eligible);

  const loading = contextStatus === 'loading';
  const isEmpty = contextStatus === 'ready' && wheel.status === 'empty';

  const headline = isEmpty ? EMPTY_HEADLINE : WHEEL_HEADLINE;
  const subhead = isEmpty ? EMPTY_SUBHEAD : WHEEL_SUBHEAD;

  const countLine = useMemo(() => {
    if (loading || wheel.count === 0) return null;
    const noun = wheel.count === 1 ? 'locale' : 'locali';
    return categoryLabel
      ? `Il Gambero sta scegliendo tra ${wheel.count} ${noun} · ${categoryLabel}`
      : `Il Gambero sta scegliendo tra ${wheel.count} ${noun}`;
  }, [loading, wheel.count, categoryLabel]);

  const ctaDisabled = loading || wheel.count === 0 || wheel.isSpinning;
  const ctaLabel = loading
    ? WHEEL_CTA_LOADING
    : wheel.isSpinning
      ? WHEEL_CTA_SPINNING
      : WHEEL_CTA;

  const liveText = wheel.isSpinning
    ? 'Il Gambero sta scegliendo tra i locali.'
    : wheel.result
      ? `Il Gambero ha scelto ${wheel.result.restaurant.name}. ${wheel.result.restaurant.category}, ${wheel.result.restaurant.town}. Valutazione ${formatRating(
          wheel.result.restaurant.ratings.overall,
        )} su 10.`
      : '';

  // In errore la homepage mostra già il proprio stato: qui non aggiungiamo nulla.
  if (contextStatus === 'error') return null;

  return (
    <section aria-labelledby="shrimp-wheel-heading" className="border-b bg-cream-soft/70">
      <div className="mx-auto max-w-content px-3 py-9 md:px-6 md:py-14">
        <div className="flex flex-col items-center gap-8 text-center md:flex-row md:gap-12 md:text-left lg:gap-16">
          <div className="md:flex-1">
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-terracotta">
              {WHEEL_KICKER}
            </p>
            <h2
              id="shrimp-wheel-heading"
              className="mt-2 font-display text-[1.7rem] font-bold leading-[1.08] sm:text-4xl"
            >
              {headline}
            </h2>
            <p className="mx-auto mt-3 max-w-md text-base text-brown-soft sm:text-lg md:mx-0">
              {subhead}
            </p>
            {countLine && <p className="mt-4 text-sm font-medium text-brown-soft">{countLine}</p>}
          </div>

          <div className="flex w-full max-w-sm flex-col items-center gap-6 md:w-auto md:shrink-0">
            <ShrimpWheel
              restaurants={loading ? [] : eligible}
              rotation={wheel.rotation}
              spinning={wheel.isSpinning}
              durationMs={wheel.spinDurationMs}
            />
            <button
              type="button"
              onClick={wheel.spin}
              disabled={ctaDisabled}
              className="btn btn-primary w-full text-[0.95rem] uppercase tracking-wide sm:text-base md:h-14 md:text-lg"
            >
              {ctaLabel}
            </button>
          </div>
        </div>

        <p className="sr-only" role="status" aria-live="polite">
          {liveText}
        </p>

        {wheel.result && (
          <ShrimpWheelResult
            result={wheel.result}
            onView={onViewPlace}
            onRespin={wheel.reset}
            className="mx-auto mt-9 max-w-2xl"
          />
        )}
      </div>
    </section>
  );
}

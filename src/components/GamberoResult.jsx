import Icon from './Icon.jsx';
import ShrimpRating from './ShrimpRating.jsx';
import { telHref } from '../utils/discovery.js';
import { reviewerLabel, REVIEWER_KEYS } from '../config/users.js';
import {
  ACTION_LOCATION,
  ACTION_RESPIN,
  BADGE_ALREADY_REVIEWED,
} from '../config/wheelMessages.js';

/**
 * Card del risultato della Ruota del Gambero.
 *
 * - La FOTO è quella reale del locale: dal database recensioni PNDR
 *   (`pndrMatch.imageUrl`) se il locale è già recensito, altrimenti dal
 *   database discovery (`place.photoUrl`). Il Gambero NON viene mai usato come
 *   immagine del locale: se non c'è foto, la sezione immagine è omessa.
 * - Se il locale è già nel database recensioni PNDR (match robusto in
 *   `discovery.js`) la card lo dichiara con un badge e mostra i voti di
 *   Salvatore, Ilenia e del pubblico presi da quel database.
 */
export default function GamberoResult({ result, pndrMatch, onRespin, className = '' }) {
  const p = result.place;
  const reviewed = Boolean(pndrMatch);

  const name = reviewed ? pndrMatch.name : p.name;
  const category = reviewed ? pndrMatch.category : p.category;
  const city = reviewed ? pndrMatch.town : p.city;
  const province = reviewed ? pndrMatch.province : p.province;
  const photo = (reviewed && pndrMatch.imageUrl) || p.photoUrl || null;
  const phone = p.phone || null;
  const tel = telHref(phone);

  return (
    <div className={`wheel-result-in surface overflow-hidden ${className}`}>
      {photo && (
        <img
          src={photo}
          alt={`Il locale ${name}`}
          loading="lazy"
          className="aspect-[16/9] w-full object-cover"
        />
      )}

      <div className="p-5 sm:p-6">
        <div className="flex flex-wrap items-center gap-2">
          <img src="/shrimp.svg" alt="" aria-hidden="true" className="h-6 w-6 select-none" />
          {reviewed ? (
            <span
              className="inline-flex items-center rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wide text-brown"
              style={{ backgroundColor: '#E58A1F' }}
            >
              {BADGE_ALREADY_REVIEWED}
            </span>
          ) : (
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-terracotta">
              {result.eyebrow}
            </p>
          )}
        </div>

        <h3 className="mt-2 font-display text-2xl font-bold leading-snug">{name}</h3>

        {reviewed ? (
          <dl className="mt-3 space-y-1.5">
            {REVIEWER_KEYS.map((key) => {
              const rv = pndrMatch.reviews?.[key];
              if (!rv) return null;
              return (
                <div key={key} className="flex items-center gap-3">
                  <dt className="w-20 shrink-0 text-sm font-semibold text-brown-soft">
                    {reviewerLabel(key)}
                  </dt>
                  <dd>
                    <ShrimpRating rating={rv.ratings.overall} size="sm" />
                  </dd>
                </div>
              );
            })}
            {pndrMatch.reviewCount > 0 && (
              <div className="flex items-center gap-3">
                <dt className="w-20 shrink-0 text-sm font-semibold text-brown-soft">Pubblico</dt>
                <dd>
                  <ShrimpRating rating={pndrMatch.ratings.overall} size="sm" />
                </dd>
              </div>
            )}
          </dl>
        ) : (
          <div className="mt-2">
            {p.rating != null ? (
              <ShrimpRating rating={p.rating} size="md" valueClassName="text-lg" />
            ) : (
              <span className="inline-flex items-center rounded-full border border-brown/15 bg-cream px-3 py-1 text-xs font-semibold text-brown-soft">
                Selezione del Gambero{p.rank ? ` · #${p.rank}` : ''}
              </span>
            )}
          </div>
        )}

        <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1.5">
          <span className="inline-flex items-center rounded-full border border-green/30 bg-green/10 px-2.5 py-0.5 text-[0.7rem] font-semibold uppercase tracking-wide text-green-deep">
            {category}
          </span>
          {city && (
            <span className="flex items-center gap-1 text-sm font-medium text-brown-soft">
              <Icon name="pin" size={15} />
              {city}
              {province ? ` (${province})` : ''}
            </span>
          )}
        </div>

        {p.description && (
          <p className="mt-4 text-[0.95rem] leading-relaxed text-brown">{p.description}</p>
        )}

        <p className="mt-4 text-sm font-semibold text-brown-soft">{result.message}</p>

        <div className="mt-5 flex flex-col gap-3">
          <div className="flex flex-col gap-3 sm:flex-row">
            {tel && (
              <a href={tel} className="btn btn-primary sm:flex-1">
                Chiama {phone}
              </a>
            )}
            <a
              href={p.mapsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className={`btn ${tel ? 'btn-secondary' : 'btn-primary'} sm:flex-1`}
            >
              <Icon name="pin" size={16} />
              {ACTION_LOCATION}
            </a>
          </div>
          <button
            type="button"
            onClick={onRespin}
            className="btn btn-secondary btn-sm self-start sm:self-auto sm:px-5"
          >
            {ACTION_RESPIN}
          </button>
        </div>
      </div>
    </div>
  );
}

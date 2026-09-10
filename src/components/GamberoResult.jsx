import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import Icon from './Icon.jsx';
import ShrimpRating from './ShrimpRating.jsx';
import { cn } from '../lib/cn.js';
import { scaleIn } from '../lib/motion.js';
import { getPlacePhotoUrl, telHref } from '../utils/discovery.js';
import { reviewerLabel, REVIEWER_KEYS } from '../config/users.js';
import { ACTION_LOCATION, ACTION_RESPIN, BADGE_ALREADY_REVIEWED } from '../config/wheelMessages.js';

/**
 * Card del risultato della Ruota del Gambero.
 *
 * FOTO: sempre quella reale del locale, con questa priorità —
 *   1. `pndrMatch.imageUrl` (dal database recensioni PNDR, se il locale è già recensito)
 *   2. `place.photoUrl` (dal database discovery, se popolato)
 *   3. `/api/place-photo?ref=` (solo con un riferimento foto già verificato nel database)
 * Se nessuna è disponibile si mostra un placeholder editoriale — MAI il Gambero come
 * se fosse la foto del locale.
 *
 * Se il locale è già nel database recensioni PNDR (match robusto in `discovery.js`) la
 * card lo dichiara con un badge e mostra i voti di Ilenia, Salvatore e del pubblico.
 */
export default function GamberoResult({ result, pndrMatch, onRespin, className = '' }) {
  const p = result.place;
  const reviewed = Boolean(pndrMatch);

  const name = reviewed ? pndrMatch.name : p.name;
  const category = reviewed ? pndrMatch.category : p.category;
  const city = reviewed ? pndrMatch.town : p.city;
  const province = reviewed ? pndrMatch.province : p.province;
  const phone = p.phone || null;
  const tel = telHref(phone);

  const photoCandidates = useMemo(() => {
    const list = [];
    if (reviewed && pndrMatch.imageUrl) list.push(pndrMatch.imageUrl); // foto reale dal DB recensioni
    const discPhoto = getPlacePhotoUrl(p); // foto reale del locale (discovery / Google Places proxy)
    if (discPhoto) list.push(discPhoto);
    return list;
  }, [reviewed, pndrMatch, p]);

  const [imgIdx, setImgIdx] = useState(0);
  // Un risultato nuovo deve sempre ripartire dalla sua prima foto. Senza questo
  // reset, il fallback usato dal locale precedente poteva nascondere una foto
  // valida del locale appena estratto.
  useEffect(() => {
    setImgIdx(0);
  }, [p.id, pndrMatch?.id]);
  const photoSrc = photoCandidates[imgIdx] || null;

  return (
    <motion.div
      variants={scaleIn}
      initial="hidden"
      animate="visible"
      className={cn('surface overflow-hidden', className)}
    >
      <div className="relative aspect-[16/9] w-full bg-cream">
        {photoSrc ? (
          <img
            src={photoSrc}
            alt={`Il locale ${name}`}
            loading="lazy"
            onError={() => setImgIdx((i) => i + 1)}
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full w-full flex-col items-center justify-center gap-1 bg-cream-soft text-brown-soft">
            <Icon name="pin" size={24} />
            <span className="text-sm font-semibold">{category}</span>
            <span className="text-xs">
              {city ? `${city}${province ? ` (${province})` : ''}` : 'Campania'}
            </span>
          </div>
        )}
      </div>

      <div className="p-5 sm:p-6">
        <div className="flex flex-wrap items-center gap-2">
          <img src="/shrimp.svg" alt="" aria-hidden="true" className="h-6 w-6 select-none" />
          {reviewed ? (
            <span className="inline-flex items-center rounded-full bg-rating px-3 py-1 text-xs font-bold uppercase tracking-wide text-brown">
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
          <span className="inline-flex items-center rounded-full bg-green/10 px-2.5 py-1 text-[0.68rem] font-bold uppercase tracking-wide text-green-deep">
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
          {tel && (
            <a href={tel} className="btn btn-primary w-full">
              Chiama {phone}
            </a>
          )}
          <a
            href={p.mapsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className={`btn w-full ${tel ? 'btn-secondary' : 'btn-primary'}`}
          >
            <Icon name="pin" size={16} />
            {ACTION_LOCATION}
          </a>
          <button type="button" onClick={onRespin} className="btn btn-secondary w-full">
            {ACTION_RESPIN}
          </button>
        </div>
      </div>
    </motion.div>
  );
}

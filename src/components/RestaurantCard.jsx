import { useState } from 'react';
import { motion } from 'framer-motion';
import Icon from './Icon.jsx';
import ShrimpRating from './ShrimpRating.jsx';
import { cn } from '../lib/cn.js';
import { tapSubtle } from '../lib/motion.js';

/** Segnaposto grafico quando manca l'immagine o non è caricabile. */
function ImageFallback() {
  return (
    <div className="flex h-full w-full items-center justify-center bg-apricot/15 text-terracotta">
      <Icon name="bowl" size={36} />
    </div>
  );
}

/**
 * Scheda locale: immagine grande, posizione in classifica, nome, luogo,
 * categoria, voto. Le prime tre posizioni hanno un badge pieno più marcato,
 * le altre un badge sobrio — la gerarchia si legge subito senza podio kitsch.
 * Tutta la card è un unico target interattivo.
 */
export default function RestaurantCard({ restaurant, position, onOpen }) {
  const { name, category, town, province, ratings, imageUrl } = restaurant;
  const [imgError, setImgError] = useState(false);
  const isTop = position <= 3;

  return (
    <motion.button
      type="button"
      onClick={() => onOpen(restaurant)}
      whileTap={tapSubtle}
      className="group flex h-full w-full flex-col overflow-hidden rounded-2xl border border-brown/10 bg-cream-soft text-left shadow-sm transition-shadow duration-200 ease-pndr hover:shadow-md"
      aria-label={`Apri la recensione di ${name}, ${town} (${province}). Voto complessivo ${ratings.overall} su 10`}
    >
      <div className="relative aspect-[3/2] w-full overflow-hidden bg-cream">
        {imageUrl && !imgError ? (
          <img
            src={imageUrl}
            alt={`Ambiente di ${name}`}
            loading="lazy"
            onError={() => setImgError(true)}
            className="h-full w-full object-cover transition-transform duration-[400ms] ease-pndr group-hover:scale-[1.03] motion-reduce:transition-none motion-reduce:group-hover:scale-100"
          />
        ) : (
          <ImageFallback />
        )}

        <span
          className={cn(
            'absolute left-3 top-3 inline-flex items-center justify-center rounded-full font-bold tabular shadow-sm',
            isTop
              ? 'min-w-[2.1rem] bg-terracotta-deep px-2 py-1 text-sm text-white ring-2 ring-cream-soft/70'
              : 'min-w-[1.9rem] bg-brown/72 px-2 py-0.5 text-xs text-cream-soft backdrop-blur-[1px]',
          )}
        >
          #{position}
        </span>
      </div>

      <div className="flex flex-1 flex-col gap-2 p-4 sm:p-5">
        <span className="inline-flex w-fit items-center rounded-full bg-green/10 px-2 py-0.5 text-[0.68rem] font-semibold uppercase tracking-wide text-green-deep">
          {category}
        </span>
        <h3 className="font-display text-lg font-semibold leading-snug sm:text-xl">{name}</h3>
        <p className="flex items-center gap-1 text-sm text-brown-soft">
          <Icon name="pin" size={14} className="shrink-0" />
          <span className="truncate">
            {town} <span className="text-brown-soft/70">({province})</span>
          </span>
        </p>
        <div className="mt-auto border-t border-brown/8 pt-3">
          <ShrimpRating rating={ratings.overall} size="md" valueClassName="text-lg" decorative />
        </div>
      </div>
    </motion.button>
  );
}

import { useState } from 'react';
import Icon from './Icon.jsx';
import RatingStars from './RatingStars.jsx';

/** Segnaposto grafico quando manca l'immagine o non è caricabile. */
function ImageFallback() {
  return (
    <div className="flex h-full w-full items-center justify-center bg-apricot/15 text-terracotta">
      <Icon name="bowl" size={40} />
    </div>
  );
}

/**
 * Scheda locale: posizione in classifica, foto, nome, città (provincia),
 * badge categoria, voto complessivo. Tutta la card è interattiva.
 */
export default function RestaurantCard({ restaurant, position, onOpen }) {
  const { name, category, town, province, ratings, imageUrl } = restaurant;
  const [imgError, setImgError] = useState(false);

  return (
    <article className="h-full">
      <button
        type="button"
        onClick={() => onOpen(restaurant)}
        className="flex h-full w-full flex-col overflow-hidden rounded-[18px] border border-brown/10 bg-cream-soft text-left shadow-sm transition-colors duration-150 ease-pndr active:bg-cream motion-reduce:transition-none"
        aria-label={`Apri la recensione di ${name}, ${town} (${province}). Voto complessivo ${ratings.overall} su 10`}
      >
        <div className="relative aspect-[4/3] w-full overflow-hidden bg-cream">
          {imageUrl && !imgError ? (
            <img
              src={imageUrl}
              alt={`Ambiente di ${name}`}
              loading="lazy"
              onError={() => setImgError(true)}
              className="h-full w-full object-cover"
            />
          ) : (
            <ImageFallback />
          )}
          <span className="absolute left-3 top-3 inline-flex min-w-[2rem] items-center justify-center rounded-full bg-terracotta-deep px-2 py-1 text-sm font-bold text-white shadow-sm">
            #{position}
          </span>
        </div>

        <div className="flex flex-1 flex-col gap-2.5 p-5 sm:p-6">
          <span className="inline-flex w-fit items-center rounded-full border border-green/30 bg-green/10 px-2.5 py-0.5 text-[0.7rem] font-semibold uppercase tracking-wide text-green-deep">
            {category}
          </span>
          <h3 className="font-display text-xl font-semibold leading-snug">{name}</h3>
          <p className="flex items-center gap-1 text-sm font-medium text-brown-soft">
            <Icon name="pin" size={15} />
            {town} ({province})
          </p>
          <div className="mt-auto pt-2.5">
            <RatingStars value={ratings.overall} size={20} valueClassName="text-lg" />
          </div>
        </div>
      </button>
    </article>
  );
}

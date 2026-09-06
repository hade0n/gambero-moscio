import { useState } from 'react';
import Modal from './Modal.jsx';
import Icon from './Icon.jsx';
import RatingStars from './RatingStars.jsx';
import RatingBreakdown from './RatingBreakdown.jsx';
import Lightbox from './Lightbox.jsx';

/** Dettaglio completo del locale in modale responsive. */
export default function RestaurantModal({ restaurant, open, onClose }) {
  const [imgError, setImgError] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(null);

  if (!restaurant) return null;

  const { name, category, town, province, ratings, review, imageUrl } = restaurant;
  const dishImages = Array.isArray(restaurant.dishImages) ? restaurant.dishImages : [];

  return (
    <>
      <Modal open={open} onClose={onClose} title={name} size="lg">
        <div className="space-y-5">
          <div className="overflow-hidden rounded-2xl border bg-cream">
            {imageUrl && !imgError ? (
              <img
                src={imageUrl}
                alt={`Ambiente di ${name}`}
                className="aspect-[16/9] w-full object-cover"
                onError={() => setImgError(true)}
              />
            ) : (
              <div className="flex aspect-[16/9] w-full items-center justify-center bg-apricot/15 text-terracotta">
                <Icon name="bowl" size={44} />
              </div>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            <span className="inline-flex items-center rounded-full border border-green/30 bg-green/10 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-green-deep">
              {category}
            </span>
            <p className="flex items-center gap-1.5 text-sm font-medium text-brown-soft">
              <Icon name="pin" size={16} />
              {town} ({province})
            </p>
          </div>

          <div>
            <h3 className="mb-2 text-base font-semibold">La nostra valutazione</h3>
            <div className="mb-4 flex items-center gap-3 rounded-2xl border bg-cream px-4 py-3">
              <span className="text-sm font-semibold text-brown-soft">Voto complessivo</span>
              <RatingStars value={ratings.overall} size={20} />
            </div>
            <RatingBreakdown ratings={ratings} />
          </div>

          {review && (
            <div>
              <h3 className="mb-1.5 text-base font-semibold">La recensione</h3>
              <p className="text-[1.0625rem] leading-relaxed text-brown">{review}</p>
            </div>
          )}

          {dishImages.length > 0 && (
            <div>
              <h3 className="mb-2 text-base font-semibold">Foto dei piatti</h3>
              <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {dishImages.map((src, index) => (
                  <li key={`${index}-${src.slice(-16)}`}>
                    <button
                      type="button"
                      onClick={() => setLightboxIndex(index)}
                      className="press group block w-full overflow-hidden rounded-2xl border bg-cream"
                      aria-label={`Apri la foto ${index + 1} di ${dishImages.length} a schermo intero`}
                    >
                      <img
                        src={src}
                        alt={`Piatto servito da ${name} ${index + 1}`}
                        loading="lazy"
                        className="aspect-square w-full object-cover transition-transform duration-300 group-hover:scale-[1.04]"
                      />
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </Modal>

      {lightboxIndex !== null && (
        <Lightbox
          images={dishImages}
          index={lightboxIndex}
          onNavigate={setLightboxIndex}
          onClose={() => setLightboxIndex(null)}
        />
      )}
    </>
  );
}

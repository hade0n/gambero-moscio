import { useEffect, useId, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import Modal from './Modal.jsx';
import Icon from './Icon.jsx';
import ShrimpRating from './ShrimpRating.jsx';
import RatingBreakdown from './RatingBreakdown.jsx';
import Lightbox from './Lightbox.jsx';
import { cn } from '../lib/cn.js';
import { fade } from '../lib/motion.js';
import { REVIEWER_KEYS, reviewerLabel } from '../config/users.js';

/** Dettaglio del locale: dati condivisi + fino a due recensioni indipendenti. */
export default function RestaurantModal({ restaurant, open, onClose }) {
  const [imgError, setImgError] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(null);
  // null = usa il default (sempre Ilenia quando presente).
  const [selectedReviewer, setSelectedReviewer] = useState(null);
  const tabId = useId();

  // Cambiando locale (o riaprendo) si riparte SEMPRE dal default.
  useEffect(() => {
    setSelectedReviewer(null);
    setImgError(false);
    setLightboxIndex(null);
  }, [restaurant?.id, open]);

  if (!restaurant) return null;

  const { name, category, town, province, imageUrl } = restaurant;
  const dishImages = Array.isArray(restaurant.dishImages) ? restaurant.dishImages : [];

  const available = REVIEWER_KEYS.filter((key) => restaurant.reviews?.[key]);
  const activeKey = available.includes(selectedReviewer) ? selectedReviewer : available[0] ?? null;
  const activeReview = activeKey ? restaurant.reviews[activeKey] : null;
  const hasPills = available.length > 1;

  const hero = (
    <div className="relative aspect-[16/10] w-full bg-cream sm:aspect-[16/9]">
      {imageUrl && !imgError ? (
        <img
          src={imageUrl}
          alt={`Ambiente di ${name}`}
          className="h-full w-full object-cover"
          onError={() => setImgError(true)}
        />
      ) : (
        <div className="flex h-full w-full items-center justify-center bg-apricot/15 text-terracotta">
          <Icon name="bowl" size={44} />
        </div>
      )}
      {/* velo in alto: stacca il pulsante di chiusura dalla foto */}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-16 bg-gradient-to-b from-brown/35 to-transparent" />
      {/* velo in basso per staccare il contenuto dall'immagine */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-cream-soft to-transparent" />
    </div>
  );

  return (
    <>
      <Modal open={open} onClose={onClose} title={name} size="lg" hero={hero}>
        <div className="space-y-5">
          <div>
            <h2 className="font-display text-2xl font-bold leading-tight">{name}</h2>
            <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1.5">
              <span className="inline-flex items-center rounded-full bg-green/10 px-2.5 py-0.5 text-[0.7rem] font-semibold uppercase tracking-wide text-green-deep">
                {category}
              </span>
              <p className="flex items-center gap-1.5 text-sm text-brown-soft">
                <Icon name="pin" size={15} className="shrink-0" />
                {town} ({province})
              </p>
            </div>
          </div>

          {activeReview ? (
            <div>
              {hasPills && (
                <div
                  role="tablist"
                  aria-label="Scegli la recensione"
                  className="mb-4 flex w-full rounded-full border border-brown/12 bg-cream p-1"
                >
                  {available.map((key) => {
                    const isActive = key === activeKey;
                    return (
                      <button
                        key={key}
                        id={`${tabId}-tab-${key}`}
                        type="button"
                        role="tab"
                        aria-selected={isActive}
                        aria-controls={`${tabId}-panel`}
                        tabIndex={isActive ? 0 : -1}
                        onClick={() => setSelectedReviewer(key)}
                        className={cn(
                          'press relative flex-1 inline-flex min-h-[40px] items-center justify-center rounded-full px-4 text-sm transition-colors',
                          isActive ? 'text-white' : 'text-brown-soft hover:text-brown',
                        )}
                      >
                        {isActive && (
                          <motion.span
                            layoutId={`${tabId}-review-active`}
                            className="absolute inset-0 rounded-full bg-green-deep shadow-sm"
                            transition={{ type: 'spring', stiffness: 480, damping: 40, mass: 0.6 }}
                          />
                        )}
                        <span
                          className={cn('relative z-10 whitespace-nowrap', isActive && 'font-bold')}
                        >
                          {reviewerLabel(key)}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}

              <AnimatePresence mode="wait" initial={false}>
                <motion.div
                  key={activeKey}
                  id={`${tabId}-panel`}
                  role={hasPills ? 'tabpanel' : undefined}
                  aria-labelledby={hasPills ? `${tabId}-tab-${activeKey}` : undefined}
                  variants={fade}
                  initial="hidden"
                  animate="visible"
                  exit="exit"
                >
                  <h3 className="mb-2 text-base font-semibold">
                    La valutazione di {reviewerLabel(activeKey)}
                  </h3>
                  <div className="mb-4 flex flex-wrap items-center gap-x-3 gap-y-2 rounded-2xl border bg-cream px-4 py-3">
                    <span className="text-sm font-semibold text-brown-soft">Voto complessivo</span>
                    <ShrimpRating
                      rating={activeReview.ratings.overall}
                      size="md"
                      valueClassName="text-lg"
                      animateValue
                    />
                  </div>
                  <RatingBreakdown ratings={activeReview.ratings} />

                  {activeReview.review && (
                    <p className="mt-4 text-[1.0625rem] leading-relaxed text-brown">
                      {activeReview.review}
                    </p>
                  )}
                </motion.div>
              </AnimatePresence>
            </div>
          ) : (
            <p className="rounded-2xl border border-dashed bg-cream/60 px-4 py-6 text-center text-sm text-brown-soft">
              Nessuna recensione disponibile.
            </p>
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
                        className="aspect-square w-full object-cover transition-transform duration-300 ease-pndr group-hover:scale-[1.04] motion-reduce:transition-none motion-reduce:group-hover:scale-100"
                      />
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </Modal>

      <Lightbox
        images={dishImages}
        index={lightboxIndex ?? 0}
        open={lightboxIndex !== null}
        onNavigate={setLightboxIndex}
        onClose={() => setLightboxIndex(null)}
      />
    </>
  );
}

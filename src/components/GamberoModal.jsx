import { useCallback, useEffect, useId, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import IconButton from './IconButton.jsx';
import GamberoWheel from './GamberoWheel.jsx';
import GamberoResult from './GamberoResult.jsx';
import { fade, fadeUp } from '../lib/motion.js';
import { useGamberoWheel } from '../hooks/useGamberoWheel.js';
import { useRestaurants } from '../hooks/useRestaurants.js';
import { findPndrMatch } from '../utils/discovery.js';
import { formatRating } from '../utils/ratings.js';
import {
  CTA_SPINNING,
  CTA_START,
  HEADLINE_EMPTY,
  HEADLINE_IDLE,
  HEADLINE_PLACE_SPIN,
  HEADLINE_RESULT,
  HEADLINE_TYPE_REVEAL,
  HEADLINE_TYPE_SPIN,
  SUBHEAD_EMPTY,
  SUBHEAD_IDLE,
  WHEEL_KICKER,
} from '../config/wheelMessages.js';

const FOCUSABLE =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

export default function GamberoModal({ open, onClose, triggerRef }) {
  const dialogRef = useRef(null);
  const fallbackTriggerRef = useRef(null);
  const closeRef = useRef(null);
  const headingId = `gambero-modal-${useId()}`;

  const wheel = useGamberoWheel({ active: open });
  const { restaurants } = useRestaurants();

  // scroll lock + focus iniziale / ripristino, mentre la Ruota è aperta
  useEffect(() => {
    if (!open) return undefined;
    fallbackTriggerRef.current = document.activeElement;
    const { overflow } = document.body.style;
    document.body.style.overflow = 'hidden';
    const raf = requestAnimationFrame(() => closeRef.current?.focus());
    return () => {
      cancelAnimationFrame(raf);
      document.body.style.overflow = overflow;
      const t = triggerRef?.current || fallbackTriggerRef.current;
      if (t && typeof t.focus === 'function') t.focus();
    };
  }, [open, triggerRef]);

  const handleKeyDown = useCallback(
    (event) => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        onClose();
        return;
      }
      if (event.key !== 'Tab') return;
      const nodes = dialogRef.current?.querySelectorAll(FOCUSABLE);
      if (!nodes || nodes.length === 0) {
        event.preventDefault();
        return;
      }
      const list = Array.from(nodes).filter((el) => el.offsetParent !== null);
      const first = list[0];
      const last = list[list.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first?.focus();
      }
    },
    [onClose],
  );

  const pndrMatch = useMemo(() => {
    if (wheel.phase !== 'result' || !wheel.result) return null;
    return findPndrMatch(wheel.result.place, restaurants);
  }, [wheel.phase, wheel.result, restaurants]);

  const { phase } = wheel;
  const showTypeWheel = phase === 'idle' || phase === 'type-spin' || phase === 'type-reveal';
  const showPlaceWheel = phase === 'place-spin';
  const showWheel = showTypeWheel || showPlaceWheel;
  const wheelItems = showPlaceWheel
    ? wheel.candidates.map((place) => ({ id: place.id, label: place.name }))
    : wheel.types;
  const selectedOptionId = phase === 'type-reveal' ? wheel.pickedType : null;

  const headline =
    phase === 'empty'
      ? HEADLINE_EMPTY
      : phase === 'type-spin'
        ? HEADLINE_TYPE_SPIN
        : phase === 'type-reveal'
          ? `${wheel.pickedType}. ${HEADLINE_TYPE_REVEAL}`
          : phase === 'place-spin'
            ? HEADLINE_PLACE_SPIN
            : phase === 'result'
              ? HEADLINE_RESULT
              : HEADLINE_IDLE;

  const subhead = phase === 'empty' ? SUBHEAD_EMPTY : phase === 'idle' ? SUBHEAD_IDLE : null;

  const countLine =
    phase === 'idle' && wheel.types.length > 0
      ? `Il Gambero sceglie tra ${wheel.types.length} tipologie e i locali selezionati della Campania.`
      : phase === 'type-reveal' || phase === 'place-spin'
        ? `${wheel.candidates.length} locali sono entrati nella sfida.`
        : null;

  const liveText =
    phase === 'type-spin'
      ? 'Il Gambero sta scegliendo la tipologia.'
      : phase === 'type-reveal'
        ? `Tipologia scelta: ${wheel.pickedType}. Ora sceglie il locale.`
        : phase === 'place-spin'
          ? 'Il Gambero sta scegliendo il locale.'
          : phase === 'result' && wheel.result
            ? `Il Gambero ha scelto ${wheel.result.place.name}, ${wheel.result.place.category}${
                wheel.result.place.city ? `, ${wheel.result.place.city}` : ''
              }${
                wheel.result.place.rating != null
                  ? `. Valutazione ${formatRating(wheel.result.place.rating)} su 10`
                  : ''
              }.`
            : '';

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          key="gambero"
          className="fixed inset-0 z-[110] overflow-y-auto bg-cream"
          variants={fade}
          initial="hidden"
          animate="visible"
          exit="exit"
          onKeyDown={handleKeyDown}
        >
          <motion.div
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby={headingId}
            variants={fadeUp}
            initial="hidden"
            animate="visible"
            className="mx-auto flex min-h-dvh max-w-content flex-col px-4 pb-12 pt-4 md:px-6"
          >
        <div className="flex items-center justify-between">
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-terracotta">
            {WHEEL_KICKER}
          </p>
          <IconButton
            ref={closeRef}
            icon="close"
            label="Chiudi la Ruota del Gambero"
            size="md"
            iconSize={24}
            onClick={onClose}
            className="-mr-2"
          />
        </div>

        <div className="mx-auto flex w-full max-w-4xl flex-1 flex-col items-center justify-center py-6 text-center">
          <ol className="mb-6 flex items-center justify-center gap-3 text-xs font-bold uppercase tracking-[0.1em] text-brown-soft sm:gap-5">
            <li className="flex items-center gap-2 text-brown">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-terracotta-deep text-[0.68rem] text-white">1</span>
              Cosa mangiare
            </li>
            <li className="h-px w-6 bg-brown/20 sm:w-10" aria-hidden="true" />
            <li className={`flex items-center gap-2 ${showPlaceWheel || phase === 'result' ? 'text-brown' : ''}`}>
              <span className={`flex h-6 w-6 items-center justify-center rounded-full text-[0.68rem] ${showPlaceWheel || phase === 'result' ? 'bg-terracotta-deep text-white' : 'bg-brown/10 text-brown-soft'}`}>2</span>
              Dove andare
            </li>
          </ol>
          <h2
            id={headingId}
            className="font-display text-[1.9rem] font-bold leading-[1.05] sm:text-4xl"
          >
            <AnimatePresence mode="wait" initial={false}>
              <motion.span
                key={phase}
                variants={fade}
                initial="hidden"
                animate="visible"
                exit="exit"
                className="block"
              >
                {headline}
              </motion.span>
            </AnimatePresence>
          </h2>
          {subhead && <p className="mt-3 text-base text-brown-soft sm:text-lg">{subhead}</p>}
          {countLine && <p className="mt-3 text-sm font-medium text-brown-soft">{countLine}</p>}
          {phase === 'type-reveal' || phase === 'place-spin' || phase === 'type-spin' ? (
            <p className="mt-2 text-sm font-semibold text-brown-soft">{wheel.statusMessage}</p>
          ) : null}

          {showWheel && (
            <div className="mt-8 w-full">
              <GamberoWheel
                items={wheelItems}
                rotation={showPlaceWheel ? wheel.placeRotation : wheel.typeRotation}
                spinning={wheel.isSpinning}
                durationMs={wheel.spinDurationMs}
                highlightTop={Boolean(selectedOptionId)}
                ariaLabel={
                  showPlaceWheel
                    ? `Ruota con ${wheel.candidates.length} locali`
                    : `Ruota con ${wheel.types.length} tipologie`
                }
              />
            </div>
          )}

          {phase === 'idle' && (
            <button
              type="button"
              onClick={wheel.start}
              disabled={wheel.types.length === 0}
              className="btn btn-primary mt-8 w-full max-w-xs text-[0.95rem] uppercase tracking-wide sm:text-base md:h-14 md:text-lg"
            >
              {CTA_START}
            </button>
          )}

          {wheel.isSpinning && (
            <button
              type="button"
              disabled
              className="btn btn-primary mt-8 w-full max-w-xs text-[0.95rem] uppercase tracking-wide sm:text-base md:h-14 md:text-lg"
            >
              {CTA_SPINNING}
            </button>
          )}

          {phase === 'empty' && (
            <button type="button" onClick={onClose} className="btn btn-secondary mt-8">
              Chiudi
            </button>
          )}

          {phase === 'result' && wheel.result && (
            <GamberoResult
              result={wheel.result}
              pndrMatch={pndrMatch}
              onRespin={wheel.respin}
              className="mt-7 w-full text-left"
            />
          )}

          <p className="sr-only" role="status" aria-live="polite">
            {liveText}
          </p>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}

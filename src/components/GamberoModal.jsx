import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import Icon from './Icon.jsx';
import GamberoWheel from './GamberoWheel.jsx';
import GamberoResult from './GamberoResult.jsx';
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
const EXIT_MS = 200;

export default function GamberoModal({ open, onClose, triggerRef }) {
  const dialogRef = useRef(null);
  const fallbackTriggerRef = useRef(null);
  const closeRef = useRef(null);
  const headingId = `gambero-modal-${useId()}`;

  const [mounted, setMounted] = useState(open);
  const [shown, setShown] = useState(false);

  const wheel = useGamberoWheel({ active: open });
  const { restaurants } = useRestaurants();

  // montaggio + tick di transizione
  useEffect(() => {
    if (open) {
      fallbackTriggerRef.current = document.activeElement;
      setMounted(true);
      const raf = requestAnimationFrame(() => setShown(true));
      return () => cancelAnimationFrame(raf);
    }
    setShown(false);
    const timer = setTimeout(() => setMounted(false), EXIT_MS);
    return () => clearTimeout(timer);
  }, [open]);

  // scroll lock + focus iniziale / ripristino
  useEffect(() => {
    if (!open || !mounted) return undefined;
    const { overflow } = document.body.style;
    document.body.style.overflow = 'hidden';
    const raf = requestAnimationFrame(() => closeRef.current?.focus());
    return () => {
      cancelAnimationFrame(raf);
      document.body.style.overflow = overflow;
      const t = triggerRef?.current || fallbackTriggerRef.current;
      if (t && typeof t.focus === 'function') t.focus();
    };
  }, [open, mounted, triggerRef]);

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

  if (!mounted) return null;

  const { phase } = wheel;
  const showTypeWheel = phase === 'idle' || phase === 'type-spin' || phase === 'type-reveal';
  const showPlaceWheel = phase === 'place-spin';
  const showWheel = showTypeWheel || showPlaceWheel;

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
      ? `Il Gambero sceglie tra ${wheel.types.length} tipologie e i migliori locali della Campania.`
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
    <div
      className={`fixed inset-0 z-[110] overflow-y-auto bg-cream transition-opacity duration-200 ${
        shown ? 'opacity-100' : 'opacity-0'
      }`}
      onKeyDown={handleKeyDown}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={headingId}
        className={`mx-auto flex min-h-dvh max-w-content flex-col px-4 pb-12 pt-4 transition-transform duration-200 ease-pndr md:px-6 ${
          shown ? 'translate-y-0' : 'translate-y-2'
        }`}
      >
        <div className="flex items-center justify-between">
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-terracotta">
            {WHEEL_KICKER}
          </p>
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            aria-label="Chiudi la Ruota del Gambero"
            className="press -mr-2 flex h-11 w-11 items-center justify-center rounded-full text-brown-soft hover:bg-brown/5 hover:text-brown"
          >
            <Icon name="close" size={24} />
          </button>
        </div>

        <div className="mx-auto flex w-full max-w-xl flex-1 flex-col items-center justify-center py-6 text-center">
          <h2
            id={headingId}
            className="font-display text-[1.9rem] font-bold leading-[1.05] sm:text-4xl"
          >
            {headline}
          </h2>
          {subhead && <p className="mt-3 text-base text-brown-soft sm:text-lg">{subhead}</p>}
          {countLine && <p className="mt-3 text-sm font-medium text-brown-soft">{countLine}</p>}
          {phase === 'type-reveal' || phase === 'place-spin' || phase === 'type-spin' ? (
            <p className="mt-2 text-sm font-semibold text-brown-soft">{wheel.statusMessage}</p>
          ) : null}

          {showWheel && (
            <div className="mt-7 w-full">
              <GamberoWheel
                items={showPlaceWheel ? wheel.candidates.map((p) => ({ id: p.id, label: p.name })) : wheel.types}
                rotation={showPlaceWheel ? wheel.placeRotation : wheel.typeRotation}
                spinning={wheel.isSpinning}
                durationMs={wheel.spinDurationMs}
                multilineLabels={showTypeWheel}
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
      </div>
    </div>,
    document.body,
  );
}

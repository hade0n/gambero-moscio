import { useCallback, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import IconButton from './IconButton.jsx';
import { fade } from '../lib/motion.js';

/**
 * Foto a schermo intero con navigazione precedente/successiva.
 * Chiusura con X / click esterno / ESC. Frecce ← → e swipe orizzontale per
 * scorrere. Focus gestito, scroll di fondo bloccato. ESC intercettato in
 * fase di cattura: la lightbox si chiude prima della modale sottostante.
 */
export default function Lightbox({ images, index, open, onClose, onNavigate }) {
  return createPortal(
    <AnimatePresence>
      {open && (
        <LightboxShell
          key="lightbox"
          images={images}
          index={index}
          onClose={onClose}
          onNavigate={onNavigate}
        />
      )}
    </AnimatePresence>,
    document.body,
  );
}

function LightboxShell({ images, index, onClose, onNavigate }) {
  const closeRef = useRef(null);
  const triggerRef = useRef(null);

  const count = images.length;
  const canNavigate = count > 1;

  const go = useCallback(
    (delta) => {
      if (!canNavigate) return;
      onNavigate((index + delta + count) % count);
    },
    [canNavigate, count, index, onNavigate],
  );

  useEffect(() => {
    triggerRef.current = document.activeElement;
    const { overflow } = document.body.style;
    document.body.style.overflow = 'hidden';
    const raf = requestAnimationFrame(() => closeRef.current?.focus());

    function onKey(event) {
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        onClose();
      } else if (event.key === 'ArrowRight') {
        go(1);
      } else if (event.key === 'ArrowLeft') {
        go(-1);
      }
    }
    document.addEventListener('keydown', onKey, true);

    return () => {
      cancelAnimationFrame(raf);
      document.removeEventListener('keydown', onKey, true);
      document.body.style.overflow = overflow;
      const trigger = triggerRef.current;
      if (trigger && typeof trigger.focus === 'function') trigger.focus();
    };
  }, [go, onClose]);

  return (
    <motion.div
      className="fixed inset-0 z-[120] flex items-center justify-center bg-brown/85"
      style={{
        padding: 'max(0.75rem, env(safe-area-inset-top)) max(0.75rem, env(safe-area-inset-right)) max(0.75rem, env(safe-area-inset-bottom)) max(0.75rem, env(safe-area-inset-left))',
      }}
      variants={fade}
      initial="hidden"
      animate="visible"
      exit="exit"
      role="dialog"
      aria-modal="true"
      aria-label={`Foto ${index + 1} di ${count}`}
    >
      <button
        type="button"
        aria-label="Chiudi"
        tabIndex={-1}
        className="absolute inset-0 h-full w-full cursor-default"
        onClick={onClose}
      />

      <AnimatePresence mode="wait" initial={false}>
        <motion.img
          key={index}
          src={images[index]}
          alt={`Foto di un piatto ${index + 1}`}
          variants={fade}
          initial="hidden"
          animate="visible"
          exit="exit"
          drag={canNavigate ? 'x' : false}
          dragConstraints={{ left: 0, right: 0 }}
          dragElastic={0.18}
          onDragEnd={(_, info) => {
            if (info.offset.x < -64) go(1);
            else if (info.offset.x > 64) go(-1);
          }}
          className="relative max-h-[84dvh] max-w-full touch-pan-y select-none rounded-2xl object-contain shadow-lg"
        />
      </AnimatePresence>

      <IconButton
        ref={closeRef}
        icon="close"
        label="Chiudi"
        size="md"
        variant="solid"
        onClick={onClose}
        className="absolute right-3 top-3 sm:right-5 sm:top-5"
      />

      {canNavigate && (
        <>
          <IconButton
            icon="chevronLeft"
            label="Foto precedente"
            size="lg"
            variant="solid"
            onClick={() => go(-1)}
            className="absolute left-2 top-[calc(50%-24px)] sm:left-4"
          />
          <IconButton
            icon="chevronRight"
            label="Foto successiva"
            size="lg"
            variant="solid"
            onClick={() => go(1)}
            className="absolute right-2 top-[calc(50%-24px)] sm:right-4"
          />
          <span className="absolute bottom-4 left-1/2 -translate-x-1/2 rounded-full bg-cream-soft/92 px-3 py-1 text-sm font-semibold tabular text-brown shadow-sm backdrop-blur-sm">
            {index + 1} / {count}
          </span>
        </>
      )}
    </motion.div>
  );
}

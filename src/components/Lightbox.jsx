import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import Icon from './Icon.jsx';

/**
 * Visualizzazione ingrandita di una foto, con navigazione precedente/successiva.
 * Chiusura con X, click esterno, ESC. Frecce ← → per scorrere. Focus gestito.
 */
export default function Lightbox({ images, index, onClose, onNavigate }) {
  const closeRef = useRef(null);
  const triggerRef = useRef(null);
  const [shown, setShown] = useState(false);

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
    const raf = requestAnimationFrame(() => {
      setShown(true);
      closeRef.current?.focus();
    });

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
    // Capture phase: la lightbox gestisce ESC prima della modale sottostante.
    document.addEventListener('keydown', onKey, true);

    return () => {
      cancelAnimationFrame(raf);
      document.removeEventListener('keydown', onKey, true);
      document.body.style.overflow = overflow;
      const trigger = triggerRef.current;
      if (trigger && typeof trigger.focus === 'function') trigger.focus();
    };
  }, [go, onClose]);

  return createPortal(
    <div
      className={`fixed inset-0 z-[120] flex items-center justify-center bg-brown/85 p-3 transition-opacity duration-200 sm:p-6 ${
        shown ? 'opacity-100' : 'opacity-0'
      }`}
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

      <img
        key={index}
        src={images[index]}
        alt={`Foto di un piatto ${index + 1}`}
        className="reveal-in relative max-h-[86dvh] max-w-full rounded-2xl object-contain shadow-lg"
      />

      <button
        ref={closeRef}
        type="button"
        onClick={onClose}
        aria-label="Chiudi"
        className="press absolute right-3 top-3 flex h-11 w-11 items-center justify-center rounded-full bg-cream-soft text-brown hover:bg-cream sm:right-6 sm:top-6"
      >
        <Icon name="close" size={22} />
      </button>

      {canNavigate && (
        <>
          <button
            type="button"
            onClick={() => go(-1)}
            aria-label="Foto precedente"
            className="press absolute left-2 top-1/2 flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full bg-cream-soft text-brown hover:bg-cream sm:left-5"
          >
            <span className="rotate-180">
              <Icon name="chevronRight" size={24} />
            </span>
          </button>
          <button
            type="button"
            onClick={() => go(1)}
            aria-label="Foto successiva"
            className="press absolute right-2 top-1/2 flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full bg-cream-soft text-brown hover:bg-cream sm:right-5"
          >
            <Icon name="chevronRight" size={24} />
          </button>
          <span className="absolute bottom-4 left-1/2 -translate-x-1/2 rounded-full bg-cream-soft px-3 py-1 text-sm font-semibold text-brown tabular">
            {index + 1} / {count}
          </span>
        </>
      )}
    </div>,
    document.body,
  );
}

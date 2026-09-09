import { useCallback, useEffect, useId, useRef } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import IconButton from './IconButton.jsx';
import { cn } from '../lib/cn.js';
import { fade, sheet } from '../lib/motion.js';

const FOCUSABLE =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Modale base: portal su body, backdrop, focus trap, ESC, click esterno,
 * blocco dello scroll di fondo. Enter/exit via `AnimatePresence`.
 * Su mobile è uno sheet ancorato in basso, da md è centrata.
 *
 * - `title`      testo dell'intestazione (obbligatorio per a11y).
 * - `hero`       se presente, contenuto a tutta larghezza in cima all'area
 *                scorrevole; l'header testuale diventa sr-only.
 * - Il pulsante di chiusura è ancorato al pannello (sempre visibile durante
 *   lo scroll).
 */
export default function Modal({
  open,
  onClose,
  title,
  children,
  labelledBy,
  size = 'md',
  hero,
  initialFocusRef,
}) {
  const autoId = useId();
  const headingId = labelledBy || `modal-title-${autoId}`;

  return createPortal(
    <AnimatePresence>
      {open && (
        <ModalShell
          key="modal"
          onClose={onClose}
          title={title}
          headingId={headingId}
          size={size}
          hero={hero}
          initialFocusRef={initialFocusRef}
        >
          {children}
        </ModalShell>
      )}
    </AnimatePresence>,
    document.body,
  );
}

function ModalShell({ onClose, title, headingId, size, hero, initialFocusRef, children }) {
  const dialogRef = useRef(null);
  const triggerRef = useRef(null);

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
      const list = Array.from(nodes).filter(
        (n) => n.offsetParent !== null || n === document.activeElement,
      );
      const first = list[0];
      const last = list[list.length - 1];

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    },
    [onClose],
  );

  // Focus trap + blocco scroll + ripristino focus al trigger alla chiusura.
  useEffect(() => {
    triggerRef.current = document.activeElement;
    const { overflow } = document.body.style;
    document.body.style.overflow = 'hidden';

    const focusTarget =
      initialFocusRef?.current || dialogRef.current?.querySelector(FOCUSABLE) || dialogRef.current;
    const raf = requestAnimationFrame(() => focusTarget?.focus?.());

    return () => {
      cancelAnimationFrame(raf);
      document.body.style.overflow = overflow;
      const trigger = triggerRef.current;
      if (trigger && typeof trigger.focus === 'function') trigger.focus();
    };
  }, [initialFocusRef]);

  const width = { sm: 'md:max-w-md', md: 'md:max-w-xl', lg: 'md:max-w-3xl' }[size];

  return (
    <div
      className="fixed inset-0 z-[100] flex items-end justify-center md:items-center"
      onKeyDown={handleKeyDown}
    >
      <motion.button
        type="button"
        aria-label="Chiudi"
        tabIndex={-1}
        variants={fade}
        initial="hidden"
        animate="visible"
        exit="exit"
        className="absolute inset-0 h-full w-full cursor-default bg-brown/45"
        onClick={onClose}
      />
      <motion.div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={headingId}
        variants={sheet}
        initial="hidden"
        animate="visible"
        exit="exit"
        className={cn(
          'relative flex max-h-[92dvh] w-full flex-col overflow-hidden rounded-t-3xl bg-cream-soft shadow-lg md:max-h-[88dvh] md:rounded-3xl',
          width,
        )}
      >
        <IconButton
          icon="close"
          label="Chiudi"
          size="md"
          variant="solid"
          onClick={onClose}
          className="absolute right-3 top-3 z-30"
        />

        {hero ? (
          <h2 id={headingId} className="sr-only">
            {title}
          </h2>
        ) : (
          <div className="flex items-start border-b px-5 py-4 pr-16 md:px-6">
            <h2 id={headingId} className="text-xl font-semibold">
              {title}
            </h2>
          </div>
        )}

        <div className="overflow-y-auto overscroll-contain">
          {hero && <div className="w-full">{hero}</div>}
          <div className="px-5 py-5 md:px-6">{children}</div>
        </div>
      </motion.div>
    </div>
  );
}

import { useCallback, useEffect, useId, useRef } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, animate, motion, useMotionValue, useTransform } from 'framer-motion';
import IconButton from './IconButton.jsx';
import { cn } from '../lib/cn.js';
import { DUR, EASE } from '../lib/motion.js';

const FOCUSABLE =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

const isPhone = () =>
  typeof window !== 'undefined' &&
  typeof window.matchMedia === 'function' &&
  window.matchMedia('(max-width: 767px)').matches;

const viewportH = () => (typeof window !== 'undefined' ? window.innerHeight : 800);

/**
 * Modale base: portal su body, backdrop, focus trap, ESC, click esterno,
 * blocco dello scroll di fondo.
 *
 * Enter / drag / exit passano tutti da UNA motion value `y` (il pannello si
 * traduce, niente conflitti né doppi frame). Su mobile è uno sheet ancorato in
 * basso con:
 *  - stecchetta di trascinamento in alto (stile iOS), la X resta solo da `md`;
 *  - pull-to-dismiss: se il contenuto è già in cima e si trascina il dito verso
 *    il basso, lo sheet segue (con `preventDefault` dal primo pixel, così non
 *    sbuca il rimbalzo bianco) e oltre soglia scivola via e si chiude.
 * Verso l'alto o più in basso resta un normale scroll.
 *
 * - `title` intestazione (obbligatoria per a11y).
 * - `hero`  contenuto a tutta larghezza in cima; l'header testuale è sr-only.
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
  const scrollRef = useRef(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const closingRef = useRef(false);

  const travel = useRef(viewportH()).current;
  const y = useMotionValue(travel);
  const backdropOpacity = useTransform(y, [0, travel], [1, 0]);

  const dismiss = useCallback(() => {
    if (closingRef.current) return;
    closingRef.current = true;
    animate(y, travel, { duration: 0.22, ease: EASE.in }).then(() => onCloseRef.current());
  }, [y, travel]);

  // Entrata: singolo scivolamento dal basso.
  useEffect(() => {
    const controls = animate(y, 0, { duration: DUR.modal, ease: EASE.out });
    return controls.stop;
  }, [y]);

  const handleKeyDown = useCallback(
    (event) => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        dismiss();
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
    [dismiss],
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

  // Pull-to-dismiss: gesto touch nativo sull'area scorrevole.
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return undefined;

    let startY = 0;
    let mode = null; // null | 'pull' | 'scroll'

    const onTouchStart = (e) => {
      startY = e.touches[0].clientY;
      mode = null;
    };
    const onTouchMove = (e) => {
      if (mode === 'scroll') return;
      const dy = e.touches[0].clientY - startY;
      if (mode === null) {
        if (dy > 0 && el.scrollTop <= 0 && isPhone()) {
          mode = 'pull';
        } else if (Math.abs(dy) > 6) {
          mode = 'scroll';
          return;
        } else {
          return;
        }
      }
      // pull: blocca il rimbalzo nativo dal primo pixel e trascina lo sheet
      e.preventDefault();
      y.set(Math.max(0, dy) * 0.6);
    };
    const onTouchEnd = (e) => {
      if (mode !== 'pull') {
        mode = null;
        return;
      }
      mode = null;
      const dy = (e.changedTouches[0]?.clientY ?? startY) - startY;
      if (dy > 90) dismiss();
      else animate(y, 0, { type: 'spring', stiffness: 500, damping: 40 });
    };

    el.addEventListener('touchstart', onTouchStart, { passive: true });
    el.addEventListener('touchmove', onTouchMove, { passive: false });
    el.addEventListener('touchend', onTouchEnd);
    el.addEventListener('touchcancel', onTouchEnd);
    return () => {
      el.removeEventListener('touchstart', onTouchStart);
      el.removeEventListener('touchmove', onTouchMove);
      el.removeEventListener('touchend', onTouchEnd);
      el.removeEventListener('touchcancel', onTouchEnd);
    };
  }, [y, dismiss]);

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
        style={{ opacity: backdropOpacity }}
        className="absolute inset-0 h-full w-full cursor-default bg-brown/45"
        onClick={dismiss}
      />
      <motion.div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={headingId}
        style={{ y, willChange: 'transform' }}
        className={cn(
          'relative flex max-h-[92dvh] w-full flex-col overflow-hidden rounded-t-3xl bg-cream-soft shadow-lg md:max-h-[88dvh] md:rounded-3xl',
          width,
        )}
      >
        {/* stecchetta di trascinamento (solo mobile) */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute left-1/2 top-[7px] z-40 h-1 w-9 -translate-x-1/2 rounded-full bg-white/70 shadow-[0_0_0_1px_rgba(58,42,34,0.10)] md:hidden"
        />

        {/* X: solo da desktop (su mobile si chiude trascinando o toccando fuori) */}
        <IconButton
          icon="close"
          label="Chiudi"
          size="md"
          variant="solid"
          onClick={dismiss}
          className="absolute right-3 top-3 z-30 hidden md:inline-flex"
        />

        {hero ? (
          <h2 id={headingId} className="sr-only">
            {title}
          </h2>
        ) : (
          <div className="flex items-start border-b px-5 py-4 pr-6 pt-6 md:px-6 md:pr-16 md:pt-4">
            <h2 id={headingId} className="text-xl font-semibold">
              {title}
            </h2>
          </div>
        )}

        <div ref={scrollRef} className="overscroll-none overflow-y-auto">
          {hero && <div className="w-full">{hero}</div>}
          <div className="px-5 py-5 md:px-6">{children}</div>
        </div>
      </motion.div>
    </div>
  );
}

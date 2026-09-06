import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import Icon from './Icon.jsx';

const FOCUSABLE =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

const EXIT_MS = 200;

/**
 * Modale base: portal su body, backdrop, focus trap, ESC, click esterno,
 * blocco dello scroll di fondo. Enter/exit con opacity + transform.
 * Su mobile è quasi a schermo intero (sheet ancorato in basso), da md è
 * centrata con larghezza massima.
 */
export default function Modal({
  open,
  onClose,
  title,
  children,
  labelledBy,
  size = 'md',
  initialFocusRef,
}) {
  const dialogRef = useRef(null);
  const triggerRef = useRef(null);
  const autoId = useId();
  const headingId = labelledBy || `modal-title-${autoId}`;

  const [mounted, setMounted] = useState(open);
  const [shown, setShown] = useState(false);

  // Gestione montaggio + tick di transizione per enter/exit simmetrici.
  useEffect(() => {
    if (open) {
      setMounted(true);
      const raf = requestAnimationFrame(() => setShown(true));
      return () => cancelAnimationFrame(raf);
    }
    setShown(false);
    const timer = setTimeout(() => setMounted(false), EXIT_MS);
    return () => clearTimeout(timer);
  }, [open]);

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

  // Focus trap + blocco scroll: attivi solo mentre la modale è realmente aperta.
  useEffect(() => {
    if (!open || !mounted) return undefined;

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
  }, [open, mounted, initialFocusRef]);

  if (!mounted) return null;

  const width = {
    sm: 'md:max-w-md',
    md: 'md:max-w-xl',
    lg: 'md:max-w-3xl',
  }[size];

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-end justify-center md:items-center"
      onKeyDown={handleKeyDown}
    >
      <button
        type="button"
        aria-label="Chiudi"
        tabIndex={-1}
        className={`absolute inset-0 h-full w-full cursor-default bg-brown/45 transition-opacity duration-150 ${
          shown ? 'opacity-100' : 'opacity-0'
        }`}
        onClick={onClose}
      />
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={headingId}
        className={`relative flex max-h-[92dvh] w-full flex-col overflow-hidden rounded-t-3xl bg-cream-soft shadow-lg transition duration-150 ease-pndr md:max-h-[88dvh] md:rounded-3xl ${width} ${
          shown
            ? 'translate-y-0 opacity-100 md:scale-100'
            : 'translate-y-2 opacity-0 md:translate-y-0 md:scale-[0.99]'
        }`}
      >
        <div className="flex items-start justify-between gap-3 border-b px-5 py-4 md:px-6">
          <h2 id={headingId} className="text-xl font-semibold">
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Chiudi"
            className="press -m-2 flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-brown-soft hover:bg-brown/5 hover:text-brown"
          >
            <Icon name="close" size={22} />
          </button>
        </div>
        <div className="overflow-y-auto px-5 py-5 md:px-6">{children}</div>
      </div>
    </div>,
    document.body,
  );
}

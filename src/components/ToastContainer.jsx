import { createPortal } from 'react-dom';
import { useToast } from '../context/ToastContext.jsx';
import Toast from './Toast.jsx';

/** Area dei toast: in basso su mobile, in alto a destra da sm. Non ruba il focus. */
export default function ToastContainer() {
  const { toasts, dismiss } = useToast();
  if (toasts.length === 0) return null;

  return createPortal(
    <div
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 bottom-4 z-[110] mx-auto flex w-full max-w-sm flex-col gap-2 px-4 sm:inset-x-auto sm:right-4 sm:bottom-auto sm:top-4 sm:mx-0"
    >
      {toasts.map((toast) => (
        <Toast key={toast.id} toast={toast} onDismiss={dismiss} />
      ))}
    </div>,
    document.body,
  );
}

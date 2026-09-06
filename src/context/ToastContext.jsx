import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';

const ToastContext = createContext(null);

const AUTO_DISMISS_MS = 4000;

/** Provider dei toast: feedback leggeri, non invasivi, coerenti con la palette. */
export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const timers = useRef(new Map());

  const remove = useCallback((id) => {
    setToasts((list) => list.filter((t) => t.id !== id));
    const timer = timers.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timers.current.delete(id);
    }
  }, []);

  // Uscita in due fasi: marca il toast come "leaving" per l'animazione, poi rimuove.
  const dismiss = useCallback(
    (id) => {
      setToasts((list) => list.map((t) => (t.id === id ? { ...t, leaving: true } : t)));
      const timer = timers.current.get(id);
      if (timer) clearTimeout(timer);
      timers.current.set(id, setTimeout(() => remove(id), 180));
    },
    [remove],
  );

  const notify = useCallback(
    (message, tone = 'success') => {
      const id = `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      setToasts((list) => [...list, { id, message, tone }]);
      const timer = setTimeout(() => dismiss(id), AUTO_DISMISS_MS);
      timers.current.set(id, timer);
      return id;
    },
    [dismiss],
  );

  const value = useMemo(
    () => ({
      toasts,
      dismiss,
      notify,
      success: (m) => notify(m, 'success'),
      error: (m) => notify(m, 'error'),
    }),
    [toasts, dismiss, notify],
  );

  return <ToastContext.Provider value={value}>{children}</ToastContext.Provider>;
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast deve essere usato dentro <ToastProvider>.');
  return ctx;
}

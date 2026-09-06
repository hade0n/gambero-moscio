import { useId } from 'react';

/**
 * Wrapper DRY per i campi form: label visibile, controllo, testo di aiuto,
 * messaggio di errore collegato con aria-describedby / role="alert".
 * Passare una render-prop `children({ id, describedBy, invalid })`.
 */
export default function Field({ label, required, hint, error, children }) {
  const id = useId();
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [hintId, errorId].filter(Boolean).join(' ') || undefined;

  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-sm font-semibold text-brown">
        {label}
        {required && (
          <span className="text-danger" aria-hidden="true">
            {' '}
            *
          </span>
        )}
      </label>
      {children({ id, describedBy, invalid: Boolean(error), required })}
      {hint && !error && (
        <p id={hintId} className="mt-1 text-xs text-brown-soft">
          {hint}
        </p>
      )}
      {error && (
        <p id={errorId} role="alert" className="mt-1 flex items-center gap-1 text-xs font-semibold text-danger">
          {error}
        </p>
      )}
    </div>
  );
}

/** Classi condivise per input/select/textarea (PNDR Material), con stato di errore. */
export function controlClasses(invalid) {
  return `field-control${invalid ? ' is-invalid' : ''}`;
}

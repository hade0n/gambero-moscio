import { useId, useRef, useState } from 'react';
import { controlClasses } from './Field.jsx';
import ShrimpRating from './ShrimpRating.jsx';
import { cn } from '../lib/cn.js';
import {
  RATING_CATEGORIES,
  RATING_KEYS,
  calculateOverall,
  calculateRankingScore,
} from '../utils/ratings.js';

const EMPTY = {
  review: '',
  ...Object.fromEntries(RATING_KEYS.map((k) => [k, ''])),
};

function toFormState(initialReview) {
  if (!initialReview) return { ...EMPTY };
  return {
    review: initialReview.review ?? '',
    ...Object.fromEntries(
      RATING_KEYS.map((k) => [k, initialReview.ratings?.[k] != null ? String(initialReview.ratings[k]) : '']),
    ),
  };
}

function parseRating(value) {
  return parseFloat(String(value).replace(',', '.'));
}

function ratingError(raw, label) {
  const n = parseRating(raw);
  if (String(raw).trim() === '' || Number.isNaN(n) || !Number.isFinite(n))
    return `Indica il voto per ${label.toLowerCase()}.`;
  if (n < 0 || n > 10) return `Il voto per ${label.toLowerCase()} deve essere tra 0 e 10.`;
  return undefined;
}

function validate(values) {
  const errors = {};
  RATING_CATEGORIES.forEach(({ key, label }) => {
    const err = ratingError(values[key], label);
    if (err) errors[key] = err;
  });
  if (values.review.trim().length < 20)
    errors.review = 'Scrivi una recensione un po’ più estesa (almeno 20 caratteri).';
  return errors;
}

/** Riga compatta per un singolo voto: label + descrizione a sinistra, campo a destra. */
function RatingRow({ field, value, error, onChange, onBlur }) {
  const id = useId();
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;
  return (
    <div className="py-3">
      <div className="flex items-start gap-3">
        <label htmlFor={id} className="min-w-0 flex-1">
          <span className="text-sm font-semibold text-brown">
            {field.label}
            <span className="text-danger" aria-hidden="true">
              {' '}
              *
            </span>
          </span>
          {field.description && (
            <span id={hintId} className="mt-0.5 block text-xs leading-snug text-brown-soft">
              {field.description}
            </span>
          )}
        </label>
        <input
          id={id}
          name={field.key}
          type="number"
          min="0"
          max="10"
          step="0.1"
          inputMode="decimal"
          value={value}
          onChange={(e) => onChange(field.key, e.target.value)}
          onBlur={() => onBlur(field.key)}
          aria-describedby={cn(field.description && hintId, error && errorId) || undefined}
          aria-invalid={Boolean(error)}
          aria-required="true"
          className={cn(controlClasses(Boolean(error)), 'tabular w-[4.75rem] shrink-0 px-2 text-center')}
          placeholder="0.0"
        />
      </div>
      {error && (
        <p id={errorId} role="alert" className="mt-1 text-xs font-semibold text-danger">
          {error}
        </p>
      )}
    </div>
  );
}

/**
 * Form della singola RECENSIONE (8 voti + testo) di un utente su un locale
 * esistente. Voto complessivo e punteggio classifica ricalcolati in tempo reale.
 */
export default function ReviewForm({ placeName, reviewerLabel, initialReview, onSubmit, onCancel }) {
  const [values, setValues] = useState(() => toFormState(initialReview));
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');
  const formRef = useRef(null);
  const reviewId = useId();

  const liveRatings = Object.fromEntries(RATING_KEYS.map((k) => [k, parseRating(values[k]) || 0]));
  const overall = calculateOverall(liveRatings);
  const rankingScore = calculateRankingScore(liveRatings);

  function setField(key, value) {
    setValues((v) => ({ ...v, [key]: value }));
  }

  function handleBlur(key) {
    setErrors((prev) => ({ ...prev, [key]: validate(values)[key] }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setFormError('');
    const nextErrors = validate(values);
    setErrors(nextErrors);
    const firstInvalid = Object.keys(nextErrors)[0];
    if (firstInvalid) {
      formRef.current?.querySelector(`[name="${firstInvalid}"]`)?.focus();
      return;
    }

    const payload = {
      review: values.review.trim(),
      ratings: Object.fromEntries(RATING_KEYS.map((k) => [k, parseRating(values[k])])),
    };

    setSubmitting(true);
    try {
      await onSubmit(payload);
    } catch (err) {
      setFormError(err.message || 'Non è stato possibile salvare. Riprova.');
    } finally {
      setSubmitting(false);
    }
  }

  const reviewInvalid = Boolean(errors.review);

  return (
    <form ref={formRef} onSubmit={handleSubmit} noValidate className="space-y-6">
      <p className="text-sm text-brown-soft">
        Recensione di <span className="font-semibold text-brown">{reviewerLabel}</span> su{' '}
        <span className="font-semibold text-brown">{placeName}</span>.
        {initialReview ? ' Stai modificando la tua recensione.' : ''}
      </p>

      <fieldset>
        <legend className="font-display text-base font-semibold text-brown">La tua valutazione</legend>
        <p className="mt-0.5 text-xs text-brown-soft">
          Otto categorie indipendenti, da 0.0 a 10.0 (passo 0.1). Tutte obbligatorie.
        </p>

        <div className="mt-2 divide-y divide-brown/10 sm:grid sm:grid-cols-2 sm:gap-x-6 sm:divide-y-0">
          {RATING_CATEGORIES.map((field) => (
            <div key={field.key} className="sm:border-b sm:border-brown/10">
              <RatingRow
                field={field}
                value={values[field.key]}
                error={errors[field.key]}
                onChange={setField}
                onBlur={handleBlur}
              />
            </div>
          ))}
        </div>

        <div className="mt-4 rounded-2xl border bg-cream px-4 py-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-sm font-semibold text-brown-soft">Voto complessivo</span>
            <ShrimpRating rating={overall} size="sm" valueClassName="text-lg" />
          </div>
          <div className="mt-2 flex items-center justify-between border-t border-brown/10 pt-2">
            <span className="text-xs font-semibold uppercase tracking-wide text-brown-soft">
              Punteggio classifica
            </span>
            <span className="tabular text-sm font-semibold text-green-deep">
              {rankingScore.toFixed(4)}
            </span>
          </div>
        </div>
      </fieldset>

      <div>
        <label
          htmlFor={reviewId}
          className="mb-1.5 block text-sm font-semibold text-brown"
        >
          La tua recensione
          <span className="text-danger" aria-hidden="true">
            {' '}
            *
          </span>
        </label>
        <textarea
          id={reviewId}
          name="review"
          rows={6}
          value={values.review}
          onChange={(e) => setField('review', e.target.value)}
          onBlur={() => handleBlur('review')}
          aria-describedby={cn(`${reviewId}-hint`, reviewInvalid && `${reviewId}-error`) || undefined}
          aria-invalid={reviewInvalid}
          aria-required="true"
          className={cn(controlClasses(reviewInvalid), 'min-h-[8rem] resize-y')}
          placeholder="La cucina, il servizio, l’ambiente, il rapporto qualità-prezzo…"
        />
        {reviewInvalid ? (
          <p id={`${reviewId}-error`} role="alert" className="mt-1 text-xs font-semibold text-danger">
            {errors.review}
          </p>
        ) : (
          <p id={`${reviewId}-hint`} className="mt-1 text-xs text-brown-soft">
            Racconta l’esperienza in modo semplice e sincero.
          </p>
        )}
      </div>

      {formError && (
        <p
          role="alert"
          className="rounded-lg border border-danger/40 bg-danger/10 px-3 py-2 text-sm font-semibold text-danger"
        >
          {formError}
        </p>
      )}

      <div className="sticky bottom-0 -mx-5 flex flex-col-reverse gap-3 border-t bg-cream-soft px-5 pb-1 pt-4 sm:static sm:mx-0 sm:flex-row sm:justify-end sm:bg-transparent sm:px-0">
        <button type="button" onClick={onCancel} className="btn btn-secondary">
          Annulla
        </button>
        <button type="submit" disabled={submitting} className="btn btn-primary">
          {submitting ? 'Salvataggio…' : 'Salva recensione'}
        </button>
      </div>
    </form>
  );
}

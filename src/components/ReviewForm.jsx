import { useRef, useState } from 'react';
import Field, { controlClasses } from './Field.jsx';
import ShrimpRating from './ShrimpRating.jsx';
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

/**
 * Form della singola RECENSIONE (8 voti + testo) di un utente su un locale
 * esistente. Voto complessivo e punteggio classifica ricalcolati in tempo reale.
 * Se `initialReview` è passato, si sta modificando la propria recensione.
 */
export default function ReviewForm({ placeName, reviewerLabel, initialReview, onSubmit, onCancel }) {
  const [values, setValues] = useState(() => toFormState(initialReview));
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');
  const formRef = useRef(null);

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

  return (
    <form ref={formRef} onSubmit={handleSubmit} noValidate className="space-y-5">
      <p className="rounded-xl border bg-cream px-4 py-3 text-sm text-brown-soft">
        Recensione di <span className="font-semibold text-brown">{reviewerLabel}</span> su{' '}
        <span className="font-semibold text-brown">{placeName}</span>.
        {initialReview ? ' Stai modificando la tua recensione.' : ''}
      </p>

      <fieldset className="rounded-2xl border bg-cream/60 p-4 sm:p-5">
        <legend className="px-1 font-display text-base font-semibold text-brown">
          La tua valutazione
        </legend>
        <p className="mb-3 px-1 text-xs text-brown-soft">
          Otto categorie indipendenti, da 0.0 a 10.0 (passo 0.1). Sono tutte obbligatorie.
        </p>

        <div className="grid gap-4 sm:grid-cols-2">
          {RATING_CATEGORIES.map(({ key, label, description }) => (
            <Field key={key} label={label} required error={errors[key]} hint={description}>
              {({ id, describedBy, invalid }) => (
                <input
                  id={id}
                  name={key}
                  type="number"
                  min="0"
                  max="10"
                  step="0.1"
                  inputMode="decimal"
                  value={values[key]}
                  onChange={(e) => setField(key, e.target.value)}
                  onBlur={() => handleBlur(key)}
                  aria-describedby={describedBy}
                  aria-invalid={invalid}
                  aria-required="true"
                  className={`${controlClasses(invalid)} tabular`}
                  placeholder="0.0"
                />
              )}
            </Field>
          ))}
        </div>

        <div className="mt-4 space-y-2 rounded-xl border bg-white px-4 py-3 shadow-xs">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-sm font-semibold text-brown-soft">Voto complessivo</span>
            <ShrimpRating rating={overall} size="sm" valueClassName="text-lg" />
          </div>
          <div className="flex items-center justify-between border-t pt-2">
            <span className="text-xs font-semibold uppercase tracking-wide text-brown-soft">
              Punteggio classifica
            </span>
            <span className="tabular text-sm font-semibold text-green-deep">
              {rankingScore.toFixed(4)}
            </span>
          </div>
          <p className="text-xs text-brown-soft">
            Il voto pubblico deriva dal punteggio classifica: pesi differenti per categoria, più
            coerenza, qualità gastronomica, eccellenza e penalità dei punti deboli.
          </p>
        </div>
      </fieldset>

      <Field
        label="La tua recensione"
        required
        error={errors.review}
        hint="Racconta l’esperienza in modo semplice e sincero."
      >
        {({ id, describedBy, invalid }) => (
          <textarea
            id={id}
            name="review"
            rows={6}
            value={values.review}
            onChange={(e) => setField('review', e.target.value)}
            onBlur={() => handleBlur('review')}
            aria-describedby={describedBy}
            aria-invalid={invalid}
            aria-required="true"
            className={`${controlClasses(invalid)} min-h-[8rem] resize-y`}
            placeholder="La cucina, il servizio, l’ambiente, il rapporto qualità-prezzo…"
          />
        )}
      </Field>

      {formError && (
        <p
          role="alert"
          className="rounded-lg border border-danger/40 bg-danger/10 px-3 py-2 text-sm font-semibold text-danger"
        >
          {formError}
        </p>
      )}

      <div className="flex flex-col-reverse gap-3 border-t pt-4 sm:flex-row sm:justify-end">
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

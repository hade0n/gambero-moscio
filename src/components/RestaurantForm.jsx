import { useRef, useState } from 'react';
import Field, { controlClasses } from './Field.jsx';
import Icon from './Icon.jsx';
import { CATEGORIES } from '../config/categories.js';
import {
  RATING_CATEGORIES,
  RATING_KEYS,
  calculateOverall,
  calculateRankingScore,
  formatRating,
} from '../utils/ratings.js';
import { isValidImageUrl, resizeImageFile, resizeImageFiles } from '../utils/image.js';

const EMPTY = {
  name: '',
  category: '',
  town: '',
  province: '',
  review: '',
  imageUrl: '',
  imageData: '',
  dishImages: [],
  ...Object.fromEntries(RATING_KEYS.map((k) => [k, ''])),
};

/** Prepara i valori iniziali (per la modifica) mantenendoli come stringhe nel form. */
function toFormState(initial) {
  if (!initial) return { ...EMPTY };
  const isData = typeof initial.imageUrl === 'string' && initial.imageUrl.startsWith('data:');
  const ratingValues = Object.fromEntries(
    RATING_KEYS.map((k) => [k, initial.ratings?.[k] != null ? String(initial.ratings[k]) : '']),
  );
  return {
    name: initial.name ?? '',
    category: initial.category ?? '',
    town: initial.town ?? '',
    province: initial.province ?? '',
    review: initial.review ?? '',
    imageUrl: isData ? '' : initial.imageUrl ?? '',
    imageData: isData ? initial.imageUrl : '',
    dishImages: Array.isArray(initial.dishImages) ? [...initial.dishImages] : [],
    ...ratingValues,
  };
}

function parseRating(value) {
  return parseFloat(String(value).replace(',', '.'));
}

/** Un valore rating è valido se numero finito in 0–10. */
function ratingError(raw, label) {
  const n = parseRating(raw);
  if (String(raw).trim() === '' || Number.isNaN(n) || !Number.isFinite(n))
    return `Indica il voto per ${label.toLowerCase()}.`;
  if (n < 0 || n > 10) return `Il voto per ${label.toLowerCase()} deve essere tra 0 e 10.`;
  return undefined;
}

function validate(values) {
  const errors = {};

  if (values.name.trim().length < 2) errors.name = 'Inserisci il nome del locale (almeno 2 caratteri).';
  if (!CATEGORIES.includes(values.category)) errors.category = 'Scegli una categoria dall’elenco.';
  if (values.town.trim().length < 2) errors.town = 'Inserisci la città del locale.';
  if (!/^[A-Za-z]{2}$/.test(values.province.trim()))
    errors.province = 'La provincia va indicata con due lettere (es. FI).';

  RATING_CATEGORIES.forEach(({ key, label }) => {
    const err = ratingError(values[key], label);
    if (err) errors[key] = err;
  });

  if (values.review.trim().length < 20)
    errors.review = 'Scrivi una recensione un po’ più estesa (almeno 20 caratteri).';

  if (!isValidImageUrl(values.imageUrl))
    errors.imageUrl = 'Inserisci un indirizzo immagine che inizi con http:// o https://';

  return errors;
}

/**
 * Form create/update mobile-first. Voto complessivo e punteggio classifica
 * ricalcolati in tempo reale a ogni modifica di una delle 8 categorie.
 * onSubmit(payload) può essere asincrono e lanciare: l'errore resta nel form.
 */
export default function RestaurantForm({ initial, onSubmit, onCancel }) {
  const [values, setValues] = useState(() => toFormState(initial));
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [imageBusy, setImageBusy] = useState(false);
  const [imageError, setImageError] = useState('');
  const [formError, setFormError] = useState('');
  const [dishBusy, setDishBusy] = useState(false);
  const [dishError, setDishError] = useState('');
  const formRef = useRef(null);
  const fileInputRef = useRef(null);
  const dishInputRef = useRef(null);

  // Ricalcolo a ogni render: dipende solo dai valori correnti degli 8 campi.
  const liveRatings = Object.fromEntries(
    RATING_KEYS.map((k) => [k, parseRating(values[k]) || 0]),
  );
  const overall = calculateOverall(liveRatings);
  const rankingScore = calculateRankingScore(liveRatings);

  const preview = values.imageData || values.imageUrl.trim();

  function setField(key, value) {
    setValues((v) => ({ ...v, [key]: value }));
  }

  function handleBlur(key) {
    setErrors((prev) => {
      const next = validate(values);
      return { ...prev, [key]: next[key] };
    });
  }

  async function handleFile(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    setImageError('');
    setImageBusy(true);
    try {
      const dataUrl = await resizeImageFile(file);
      setValues((v) => ({ ...v, imageData: dataUrl, imageUrl: '' }));
    } catch (err) {
      setImageError(err.message || 'Non è stato possibile elaborare questa immagine.');
    } finally {
      setImageBusy(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }

  function removeImage() {
    setValues((v) => ({ ...v, imageData: '', imageUrl: '' }));
    setImageError('');
  }

  async function handleDishFiles(event) {
    const files = event.target.files;
    if (!files || files.length === 0) return;
    setDishError('');
    setDishBusy(true);
    try {
      const { images, errors } = await resizeImageFiles(files);
      if (images.length) setValues((v) => ({ ...v, dishImages: [...v.dishImages, ...images] }));
      if (errors.length) setDishError(`Alcune foto non sono state aggiunte. ${errors[0]}`);
    } finally {
      setDishBusy(false);
      if (dishInputRef.current) dishInputRef.current.value = '';
    }
  }

  function removeDishImage(index) {
    setValues((v) => ({ ...v, dishImages: v.dishImages.filter((_, i) => i !== index) }));
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
      name: values.name.trim(),
      category: values.category,
      town: values.town.trim(),
      province: values.province.trim().toUpperCase(),
      review: values.review.trim(),
      imageUrl: values.imageData || values.imageUrl.trim(),
      dishImages: values.dishImages,
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
      <Field label="Nome locale" required error={errors.name}>
        {({ id, describedBy, invalid }) => (
          <input
            id={id}
            name="name"
            type="text"
            value={values.name}
            onChange={(e) => setField('name', e.target.value)}
            onBlur={() => handleBlur('name')}
            aria-describedby={describedBy}
            aria-invalid={invalid}
            aria-required="true"
            className={controlClasses(invalid)}
            placeholder="Es. La Vecchia Osteria"
          />
        )}
      </Field>

      <Field label="Categoria" required error={errors.category}>
        {({ id, describedBy, invalid }) => (
          <select
            id={id}
            name="category"
            value={values.category}
            onChange={(e) => setField('category', e.target.value)}
            onBlur={() => handleBlur('category')}
            aria-describedby={describedBy}
            aria-invalid={invalid}
            aria-required="true"
            className={controlClasses(invalid)}
          >
            <option value="">Scegli una categoria</option>
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        )}
      </Field>

      <div className="grid gap-5 sm:grid-cols-[1fr_7rem]">
        <Field label="Città" required error={errors.town}>
          {({ id, describedBy, invalid }) => (
            <input
              id={id}
              name="town"
              type="text"
              value={values.town}
              onChange={(e) => setField('town', e.target.value)}
              onBlur={() => handleBlur('town')}
              aria-describedby={describedBy}
              aria-invalid={invalid}
              aria-required="true"
              className={controlClasses(invalid)}
              placeholder="Es. Firenze"
            />
          )}
        </Field>
        <Field label="Provincia" required error={errors.province}>
          {({ id, describedBy, invalid }) => (
            <input
              id={id}
              name="province"
              type="text"
              maxLength={2}
              value={values.province}
              onChange={(e) => setField('province', e.target.value.toUpperCase())}
              onBlur={() => handleBlur('province')}
              aria-describedby={describedBy}
              aria-invalid={invalid}
              aria-required="true"
              className={`${controlClasses(invalid)} uppercase`}
              placeholder="FI"
            />
          )}
        </Field>
      </div>

      <fieldset className="rounded-2xl border bg-cream/60 p-4 sm:p-5">
        <legend className="px-1 font-display text-base font-semibold text-brown">
          Valutazione del locale
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
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold text-brown-soft">Voto complessivo</span>
            <span className="flex items-center gap-2">
              <Icon name="star" size={20} className="text-rating" />
              <span key={formatRating(overall)} className="reveal-in tabular text-lg font-bold text-brown">
                {formatRating(overall)}
              </span>
            </span>
          </div>
          <div className="flex items-center justify-between border-t pt-2">
            <span className="text-xs font-semibold uppercase tracking-wide text-brown-soft">
              Punteggio classifica
            </span>
            <span
              key={rankingScore.toFixed(4)}
              className="reveal-in tabular text-sm font-semibold text-green-deep"
            >
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
        label="Recensione"
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

      <div className="space-y-3">
        <span className="block text-sm font-semibold text-brown">Foto del locale</span>

        {preview ? (
          <div className="overflow-hidden rounded-2xl border bg-cream">
            <img
              src={preview}
              alt="Anteprima della foto del locale"
              className="aspect-[16/9] w-full object-cover"
            />
            <div className="flex justify-end border-t bg-white p-2">
              <button
                type="button"
                onClick={removeImage}
                className="press inline-flex min-h-[40px] items-center gap-1.5 rounded-lg px-3 text-sm font-semibold text-danger hover:bg-danger/10"
              >
                <Icon name="trash" size={16} />
                Rimuovi immagine
              </button>
            </div>
          </div>
        ) : (
          <label
            className={`flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border border-dashed bg-cream/60 px-4 py-8 text-center text-sm font-medium text-brown-soft transition-colors hover:border-terracotta hover:text-terracotta ${
              imageBusy ? 'pointer-events-none opacity-70' : ''
            }`}
          >
            <Icon name="upload" size={24} />
            {imageBusy ? 'Elaborazione immagine…' : 'Carica una foto dal dispositivo'}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="sr-only"
              onChange={handleFile}
              disabled={imageBusy}
            />
          </label>
        )}

        {imageError && (
          <p role="alert" className="text-xs font-semibold text-danger">
            {imageError}
          </p>
        )}

        <Field
          label="Oppure indirizzo immagine (URL)"
          error={errors.imageUrl}
          hint="Alternativa al caricamento: incolla un link a un’immagine."
        >
          {({ id, describedBy, invalid }) => (
            <input
              id={id}
              name="imageUrl"
              type="url"
              value={values.imageUrl}
              onChange={(e) => setField('imageUrl', e.target.value)}
              onBlur={() => handleBlur('imageUrl')}
              aria-describedby={describedBy}
              aria-invalid={invalid}
              className={controlClasses(invalid)}
              placeholder="https://…"
              disabled={Boolean(values.imageData)}
            />
          )}
        </Field>
      </div>

      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-sm font-semibold text-brown">Foto dei piatti</span>
          <label
            className={`btn btn-outline btn-sm cursor-pointer ${
              dishBusy ? 'pointer-events-none opacity-70' : ''
            }`}
          >
            <Icon name="plus" size={16} />
            {dishBusy ? 'Elaborazione…' : 'Aggiungi foto'}
            <input
              ref={dishInputRef}
              type="file"
              accept="image/*"
              multiple
              className="sr-only"
              onChange={handleDishFiles}
              disabled={dishBusy}
            />
          </label>
        </div>

        {values.dishImages.length > 0 ? (
          <ul className="grid grid-cols-3 gap-2.5 sm:grid-cols-4">
            {values.dishImages.map((src, index) => (
              <li key={`${index}-${src.slice(-16)}`} className="reveal-in group relative">
                <img
                  src={src}
                  alt={`Foto di un piatto ${index + 1}`}
                  className="aspect-square w-full rounded-xl border object-cover"
                />
                <button
                  type="button"
                  onClick={() => removeDishImage(index)}
                  aria-label={`Rimuovi la foto ${index + 1}`}
                  className="press absolute right-1 top-1 flex h-8 w-8 items-center justify-center rounded-full bg-brown/70 text-white hover:bg-danger"
                >
                  <Icon name="close" size={15} />
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="rounded-xl border border-dashed bg-cream/60 px-4 py-6 text-center text-sm text-brown-soft">
            Nessuna foto dei piatti. Puoi caricarne una o più dal dispositivo.
          </p>
        )}

        {dishError && (
          <p role="alert" className="text-xs font-semibold text-danger">
            {dishError}
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

      <div className="flex flex-col-reverse gap-3 border-t pt-4 sm:flex-row sm:justify-end">
        <button type="button" onClick={onCancel} className="btn btn-secondary">
          Annulla
        </button>
        <button type="submit" disabled={submitting || imageBusy || dishBusy} className="btn btn-primary">
          {submitting ? 'Salvataggio…' : 'Salva'}
        </button>
      </div>
    </form>
  );
}

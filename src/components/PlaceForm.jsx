import { useRef, useState } from 'react';
import Field, { controlClasses } from './Field.jsx';
import Icon from './Icon.jsx';
import { CATEGORIES } from '../config/categories.js';
import { resizeImageFile, resizeImageFiles } from '../utils/image.js';

const EMPTY = {
  name: '',
  category: '',
  town: '',
  province: '',
  imageUrl: '',
  imageData: '',
  dishImages: [],
};

function toFormState(initial) {
  if (!initial) return { ...EMPTY };
  const isData = typeof initial.imageUrl === 'string' && initial.imageUrl.startsWith('data:');
  return {
    name: initial.name ?? '',
    category: initial.category ?? '',
    town: initial.town ?? '',
    province: initial.province ?? '',
    imageUrl: isData ? '' : initial.imageUrl ?? '',
    imageData: isData ? initial.imageUrl : '',
    dishImages: Array.isArray(initial.dishImages) ? [...initial.dishImages] : [],
  };
}

function validate(values) {
  const errors = {};
  if (values.name.trim().length < 2) errors.name = 'Inserisci il nome del locale (almeno 2 caratteri).';
  if (!CATEGORIES.includes(values.category)) errors.category = 'Scegli una categoria dall’elenco.';
  if (values.town.trim().length < 2) errors.town = 'Inserisci la città del locale.';
  if (!/^[A-Za-z]{2}$/.test(values.province.trim()))
    errors.province = 'La provincia va indicata con due lettere (es. FI).';
  return errors;
}

/**
 * Form dei DATI CONDIVISI del locale: nome, categoria, città, provincia, foto
 * del locale e foto dei piatti. Nessun voto e nessun testo di recensione:
 * le recensioni si scrivono separatamente con `ReviewForm`.
 */
export default function PlaceForm({ initial, onSubmit, onCancel }) {
  const [values, setValues] = useState(() => toFormState(initial));
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [imageBusy, setImageBusy] = useState(false);
  const [imageError, setImageError] = useState('');
  const [dishBusy, setDishBusy] = useState(false);
  const [dishError, setDishError] = useState('');
  const [formError, setFormError] = useState('');
  const formRef = useRef(null);
  const fileInputRef = useRef(null);
  const dishInputRef = useRef(null);

  const preview = values.imageData || values.imageUrl.trim();

  function setField(key, value) {
    setValues((v) => ({ ...v, [key]: value }));
  }

  function handleBlur(key) {
    setErrors((prev) => ({ ...prev, [key]: validate(values)[key] }));
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
      const { images, errors: fileErrors } = await resizeImageFiles(files);
      if (images.length) setValues((v) => ({ ...v, dishImages: [...v.dishImages, ...images] }));
      if (fileErrors.length) setDishError(`Alcune foto non sono state aggiunte. ${fileErrors[0]}`);
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
      imageUrl: values.imageData || values.imageUrl.trim(),
      dishImages: values.dishImages,
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
            placeholder="Es. Pizzeria Mario"
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
              placeholder="Es. Napoli"
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
              placeholder="NA"
            />
          )}
        </Field>
      </div>

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
          {submitting ? 'Salvataggio…' : 'Salva locale'}
        </button>
      </div>
    </form>
  );
}

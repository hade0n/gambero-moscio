const MAX_WIDTH = 1200;
const JPEG_QUALITY = 0.8;

/**
 * Legge un file immagine, lo ridimensiona (larghezza massima ~1200px,
 * aspect-ratio invariato) e restituisce un data URL JPEG.
 */
export function resizeImageFile(file, { maxWidth = MAX_WIDTH, quality = JPEG_QUALITY } = {}) {
  return new Promise((resolve, reject) => {
    if (!file || !file.type || !file.type.startsWith('image/')) {
      reject(new Error('Il file selezionato non è un’immagine.'));
      return;
    }

    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Non è stato possibile leggere il file.'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('Non è stato possibile aprire questa immagine.'));
      img.onload = () => {
        try {
          const scale = img.width > maxWidth ? maxWidth / img.width : 1;
          const width = Math.round(img.width * scale);
          const height = Math.round(img.height * scale);

          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, width, height);

          resolve(canvas.toDataURL('image/jpeg', quality));
        } catch {
          reject(new Error('Non è stato possibile elaborare questa immagine.'));
        }
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

/**
 * Elabora più file immagine (selezione multipla) riusando `resizeImageFile`.
 * I file non validi vengono saltati e i loro messaggi raccolti in `errors`.
 * @returns {Promise<{ images: string[], errors: string[] }>}
 */
export async function resizeImageFiles(files, options) {
  const list = Array.from(files || []);
  const results = await Promise.allSettled(list.map((file) => resizeImageFile(file, options)));
  const images = [];
  const errors = [];
  results.forEach((res, i) => {
    if (res.status === 'fulfilled') images.push(res.value);
    else errors.push(`${list[i]?.name || 'Immagine'}: ${res.reason?.message || 'non elaborabile.'}`);
  });
  return { images, errors };
}

/** Validazione leggera di un URL immagine inserito a mano. */
export function isValidImageUrl(value) {
  const v = String(value ?? '').trim();
  if (!v) return true; // campo opzionale
  return /^https?:\/\/.+/i.test(v) || v.startsWith('data:image/');
}

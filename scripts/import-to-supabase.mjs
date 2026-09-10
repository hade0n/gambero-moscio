/**
 * Import una-tantum dei dati esportati dal Vercel Blob dentro Supabase.
 *
 *   node scripts/import-to-supabase.mjs [cartella-export]     (default: ./_blob-export)
 *
 * Per ogni `_blob-export/places/<id>.json`:
 *   - ri-carica l'immagine principale e le foto piatti (se erano su
 *     *.blob.vercel-storage.com e il file è nell'export) su Supabase Storage,
 *     riscrivendo gli URL;
 *   - fa `upsert` della riga nella tabella `places`.
 *
 * Legge `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` da .env.local / .env / ambiente.
 * Re-eseguibile (upsert su `id`).
 */
import { createClient } from '@supabase/supabase-js';
import { readdir, readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { extname, join, resolve } from 'node:path';

const BUCKET = 'locali';
const CT = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
};

async function loadEnv() {
  for (const file of ['.env.local', '.env']) {
    if (!existsSync(file)) continue;
    // eslint-disable-next-line no-await-in-loop
    const text = await readFile(file, 'utf8');
    for (const line of text.split(/\r?\n/)) {
      const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(line);
      if (m && process.env[m[1]] === undefined) {
        process.env[m[1]] = m[2].replace(/^['"]|['"]$/g, '');
      }
    }
  }
}

function localFileForUrl(dir, url) {
  try {
    const u = new URL(url);
    if (!u.hostname.endsWith('.blob.vercel-storage.com')) return null;
    const rel = decodeURIComponent(u.pathname.replace(/^\/+/, ''));
    const p = join(dir, rel);
    return existsSync(p) ? { p, rel } : null;
  } catch {
    return null;
  }
}

async function reupload(sb, dir, url, cache) {
  if (!url || typeof url !== 'string') return url;
  if (cache.has(url)) return cache.get(url);
  const found = localFileForUrl(dir, url);
  if (!found) {
    cache.set(url, url); // URL esterna o file non nell'export: lascia com'è
    return url;
  }
  const buf = await readFile(found.p);
  const { error } = await sb.storage.from(BUCKET).upload(found.rel, buf, {
    contentType: CT[extname(found.p).toLowerCase()] || 'image/jpeg',
    upsert: true,
  });
  if (error && !/exists/i.test(error.message)) {
    throw new Error(`upload ${found.rel}: ${error.message}`);
  }
  const { data } = sb.storage.from(BUCKET).getPublicUrl(found.rel);
  cache.set(url, data.publicUrl);
  return data.publicUrl;
}

async function main() {
  await loadEnv();
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error('SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY mancanti (mettili in .env.local).');
    process.exit(1);
  }

  const dir = resolve(process.argv[2] || '_blob-export');
  const placesDir = join(dir, 'places');
  if (!existsSync(placesDir)) {
    console.error(`Manca ${placesDir}. Esegui prima l'export (npm run export:blob o dashboard).`);
    process.exit(1);
  }

  const sb = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const files = (await readdir(placesDir)).filter((f) => f.toLowerCase().endsWith('.json'));
  console.log(`${files.length} locali da importare da ${dir}\n`);

  const cache = new Map();
  let rows = 0;
  let imgs = 0;
  let errs = 0;

  for (const f of files) {
    try {
      // eslint-disable-next-line no-await-in-loop
      const rec = JSON.parse(await readFile(join(placesDir, f), 'utf8'));
      if (!rec?.id || !rec?.name) throw new Error('record senza id/name');

      // eslint-disable-next-line no-await-in-loop
      const imageUrl = await reupload(sb, dir, rec.imageUrl || null, cache);
      if (imageUrl && imageUrl !== rec.imageUrl) imgs += 1;

      const dishImages = [];
      for (const d of Array.isArray(rec.dishImages) ? rec.dishImages : []) {
        // eslint-disable-next-line no-await-in-loop
        const nu = await reupload(sb, dir, d, cache);
        if (nu !== d) imgs += 1;
        dishImages.push(nu);
      }

      const reviews =
        rec.reviews && typeof rec.reviews === 'object'
          ? rec.reviews
          : rec.ratings || rec.review
            ? { ilenia: { ratings: rec.ratings, review: rec.review } }
            : {};

      const row = {
        id: rec.id,
        name: rec.name,
        category: rec.category,
        town: rec.town,
        province: rec.province,
        image_url: imageUrl || null,
        dish_images: dishImages,
        reviews,
      };

      // eslint-disable-next-line no-await-in-loop
      const { error } = await sb.from('places').upsert(row, { onConflict: 'id' });
      if (error) throw new Error(error.message);
      rows += 1;
      console.log(`  ✓ ${rec.name} (${rec.town})`);
    } catch (e) {
      errs += 1;
      console.log(`  ✗ ${f} — ${e.message}`);
    }
  }

  console.log(`\nFatto: ${rows} locali, ${imgs} immagini ricaricate, ${errs} errori.`);
  if (errs > 0) process.exit(2);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

#!/usr/bin/env node
/**
 * Scarica la foto reale del locale dalla sua PAGINA UFFICIALE: legge il meta
 * una foto esplicitamente verificata e salva il file in
 * `public/gambero/<id>.<ext>`. Non usa più automaticamente `og:image`: quelle
 * immagini possono essere un logo, un badge o un banner e non una foto del
 * locale. Ogni URL qui sotto è una foto controllata a vista del locale indicato.
 *
 * L'elenco `PHOTO_OVERRIDES` è curato a mano: id del locale → immagine + fonte.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB = path.join(__dirname, '..', 'src', 'data', 'gamberoDiscovery.json');
const OUT = path.join(__dirname, '..', 'public', 'gambero');
const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36';
const REFRESH = process.argv.includes('--refresh');

const PHOTO_OVERRIDES = {
  // Ogni entry contiene una URL diretta a un'immagine reale, verificata a vista,
  // e la pagina che ne documenta la provenienza.
  'rp-da-gemma-sa': {
    image: 'https://trattoria.trattoriadagemma.com/wp-content/uploads/2021/09/g-5.jpg',
    source: 'https://trattoria.trattoriadagemma.com/',
  },
  'rp-don-alfonso-na': {
    image: 'https://cdn.blastness.biz/media/763/top/thumbs/full/DA1890-L-1600-12.jpg',
    source: 'https://www.donalfonso.com/',
  },
};

fs.mkdirSync(OUT, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function run() {
  const db = JSON.parse(fs.readFileSync(DB, 'utf8'));
  const byId = new Map(db.places.map((p) => [p.id, p]));
  let got = 0;
  let miss = 0;

  for (const [id, entry] of Object.entries(PHOTO_OVERRIDES)) {
    const place = byId.get(id);
    if (!place) {
      console.log(`?  ${id} — non nel DB`);
      continue;
    }
    const already = fs.readdirSync(OUT).find((f) => f.startsWith(`${id}.`));
    if (already && !REFRESH) {
      place.photoUrl = `/gambero/${already}`;
      console.log(`•  ${place.name} — già presente (${already})`);
      continue;
    }
    try {
      const img = await fetch(entry.image, { headers: { 'User-Agent': UA, Referer: entry.source }, redirect: 'follow' });
      if (!img.ok) throw new Error(`immagine HTTP ${img.status}`);
      const buf = Buffer.from(await img.arrayBuffer());
      const s = buf.subarray(0, 4);
      const ext =
        s[0] === 0xff && s[1] === 0xd8 ? 'jpg'
        : s[0] === 0x89 && s[1] === 0x50 ? 'png'
        : s.toString('latin1') === 'RIFF' ? 'webp'
        : null;
      if (!ext || buf.length < 8000) throw new Error(`non è una foto valida (${buf.length}b)`);

      const name = `${id}.${ext}`;
      fs.writeFileSync(path.join(OUT, name), buf);
      place.photoUrl = `/gambero/${name}`;
      place.sources = { ...(place.sources || {}), photo: entry.source };
      got += 1;
      console.log(`✓  ${place.name} → ${name} (${Math.round(buf.length / 1024)}kb)`);
    } catch (err) {
      miss += 1;
      console.log(`✗  ${place.name} — ${err.message}`);
    }
    await sleep(800);
  }

  fs.writeFileSync(DB, `${JSON.stringify(db, null, 2)}\n`);
  const withPhoto = db.places.filter((p) => p.photoUrl).length;
  console.log(`\n─ Foto verificate: ${got} scaricate, ${miss} non riuscite. Totale foto nel DB: ${withPhoto}/${db.places.length}\n`);
}

run();

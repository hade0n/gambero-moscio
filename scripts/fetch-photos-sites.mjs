#!/usr/bin/env node
/**
 * Scarica la foto reale del locale dalla sua PAGINA UFFICIALE: legge il meta
 * `og:image` (o `twitter:image`, o la prima immagine grande) e salva il file in
 * `public/gambero/<id>.<ext>`. Solo siti ufficiali noti — nessuno scraping di
 * Google/aggregatori. Non tocca i file già presenti.
 *
 * L'elenco `SITES` è curato a mano: id del locale → URL della pagina ufficiale.
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

const SITES = {
  'rp-torre-saracino-na': 'https://torredelsaracino.it/',
  'pz-diego-vitagliano-na': 'https://diegovitagliano.it/',
  'pz-la-notizia-na': 'https://www.pizzarialanotizia.com/pizzeria-la-notizia-94/',
  'rp-la-caravella-sa': 'https://www.ristorantelacaravella.com/',
  'rp-la-sponda-sa': 'https://sirenuse.it/en/la-sponda-restaurant/',
  'rp-rossellinis-sa': 'https://www.palazzoavino.com/en/dining/rossellinis/',
  'rp-lo-scoglio-na': 'https://www.hotelloscoglio.com/en/restaurant',
  'rp-da-gemma-sa': 'https://trattoria.trattoriadagemma.com/',
  'ag-seliano-sa': 'https://www.agriturismoseliano.it/',
  'os-tandem-na': 'https://www.tandemnapoli.it/tandem-via-paladino/',
  'tr-da-carmela-na': 'https://www.osteriadacarmela.it/en/',
  'pz-pepe-in-grani-ce': 'https://www.pepeingrani.it/ospitalita/',
  'rp-don-alfonso-na': 'https://www.donalfonso.com/',
  'ag-i-moresani-sa': 'https://www.imoresani.com/',
  'ag-le-querce-sa': 'https://www.lequerce.net/',
  'rp-president-na': 'https://www.ristorantepresident.it/',
  'pz-tre-santi-na': 'https://www.concettinaaitresanti.it/',
  'sf-isabella-de-cham-na': 'https://www.isabelladecham.it/',
};

fs.mkdirSync(OUT, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function extractImage(html, base) {
  const patterns = [
    /<meta[^>]+property=["']og:image(?::secure_url)?["'][^>]+content=["']([^"']+)["']/i,
    /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i,
    /<meta[^>]+name=["']twitter:image["'][^>]+content=["']([^"']+)["']/i,
    /<link[^>]+rel=["']image_src["'][^>]+href=["']([^"']+)["']/i,
  ];
  for (const re of patterns) {
    const m = html.match(re);
    if (m && m[1]) {
      try {
        return new URL(m[1], base).href;
      } catch {
        /* ignore */
      }
    }
  }
  return null;
}

async function run() {
  const db = JSON.parse(fs.readFileSync(DB, 'utf8'));
  const byId = new Map(db.places.map((p) => [p.id, p]));
  let got = 0;
  let miss = 0;

  for (const [id, url] of Object.entries(SITES)) {
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
      const page = await fetch(url, { headers: { 'User-Agent': UA }, redirect: 'follow' });
      if (!page.ok) throw new Error(`pagina HTTP ${page.status}`);
      const html = await page.text();
      const imgUrl = extractImage(html, page.url);
      if (!imgUrl) throw new Error('nessun og:image');

      const img = await fetch(imgUrl, { headers: { 'User-Agent': UA, Referer: url }, redirect: 'follow' });
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
  console.log(`\n─ Siti ufficiali: ${got} scaricate, ${miss} non riuscite. Totale foto nel DB: ${withPhoto}/${db.places.length}\n`);
}

run();

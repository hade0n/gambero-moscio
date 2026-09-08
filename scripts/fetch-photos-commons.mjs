#!/usr/bin/env node
/**
 * Cerca su Wikimedia Commons una foto REALE per ogni locale del database e la
 * scarica in `public/gambero/<id>.jpg`. Match prudente: il titolo del file deve
 * contenere abbastanza token del nome del locale (o del nome + città). Nessun
 * download se il match non è convincente — meglio un placeholder che una foto
 * di un altro posto.
 *
 *   node scripts/fetch-photos-commons.mjs           → solo i locali senza foto
 *   node scripts/fetch-photos-commons.mjs --refresh → riprova tutti
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB = path.join(__dirname, '..', 'src', 'data', 'gamberoDiscovery.json');
const OUT = path.join(__dirname, '..', 'public', 'gambero');
const UA = 'gambero-moscio/1.0 (https://github.com/hade0n/gambero-moscio; fcazzato2001@gmail.com)';
const REFRESH = process.argv.includes('--refresh');
const WIDTH = 900;

fs.mkdirSync(OUT, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const STOP = new Set(['di', 'da', 'de', 'del', 'della', 'dei', 'e', 'il', 'la', 'lo', 'a', 'ai', 'al', '1890', '1959', '1916', '1953', '1947', 'dal', 'con', 'the', 'san', 'santa']);

const tokens = (s) =>
  String(s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[^a-z0-9 ]+/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 2 && !STOP.has(w));

async function commonsSearch(query) {
  const url = `https://commons.wikimedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(
    query,
  )}&srnamespace=6&srlimit=8&format=json&origin=*`;
  const r = await fetch(url, { headers: { 'User-Agent': UA } });
  if (!r.ok) throw new Error(`search HTTP ${r.status}`);
  const d = await r.json();
  return (d.query?.search || []).map((s) => s.title);
}

function pickFile(titles, place) {
  const want = tokens(place.name);
  const wantCity = tokens(place.city).join(' ');
  for (const title of titles) {
    const file = title.replace(/^File:/, '');
    if (!/\.(jpe?g|png)$/i.test(file)) continue;
    const ft = new Set(tokens(file));
    const hit = want.filter((w) => ft.has(w)).length;
    const cityHit = wantCity && tokens(file).join(' ').includes(wantCity);
    // richiede almeno 2 token del nome, oppure 1 token forte + città
    if (hit >= 2 || (hit >= 1 && cityHit)) return file;
  }
  return null;
}

async function download(file, id) {
  const src = `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(file)}?width=${WIDTH}`;
  const r = await fetch(src, { headers: { 'User-Agent': UA }, redirect: 'follow' });
  if (!r.ok) throw new Error(`file HTTP ${r.status}`);
  const buf = Buffer.from(await r.arrayBuffer());
  const sig = buf.subarray(0, 4);
  const isJpg = sig[0] === 0xff && sig[1] === 0xd8;
  const isPng = sig[0] === 0x89 && sig[1] === 0x50;
  if (buf.length < 6000 || (!isJpg && !isPng)) throw new Error(`non è un'immagine (${buf.length}b)`);
  const ext = isPng ? 'png' : 'jpg';
  const name = `${id}.${ext}`;
  fs.writeFileSync(path.join(OUT, name), buf);
  return { name, kb: Math.round(buf.length / 1024) };
}

const db = JSON.parse(fs.readFileSync(DB, 'utf8'));
let got = 0;
let miss = 0;

for (const p of db.places) {
  const already = fs.readdirSync(OUT).find((f) => f.startsWith(`${p.id}.`));
  if (already && !REFRESH) {
    p.photoUrl = `/gambero/${already}`;
    continue;
  }
  try {
    let titles = await commonsSearch(`${p.name} ${p.city}`);
    let file = pickFile(titles, p);
    if (!file) {
      await sleep(700);
      titles = await commonsSearch(p.name);
      file = pickFile(titles, p);
    }
    if (!file) {
      miss += 1;
      console.log(`✗  ${p.name}  — nessuna foto attendibile`);
      await sleep(900);
      continue;
    }
    const { name, kb } = await download(file, p.id);
    p.photoUrl = `/gambero/${name}`;
    got += 1;
    console.log(`✓  ${p.name}  → ${name} (${kb}kb)  [${file}]`);
  } catch (err) {
    miss += 1;
    console.log(`✗  ${p.name}  — ${err.message}`);
  }
  await sleep(1100);
}

fs.writeFileSync(DB, `${JSON.stringify(db, null, 2)}\n`);
const withPhoto = db.places.filter((x) => x.photoUrl).length;
console.log(`\n─ Commons: ${got} scaricate, ${miss} senza risultato. Totale foto nel DB: ${withPhoto}/${db.places.length}\n`);

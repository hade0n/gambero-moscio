/**
 * Export una-tantum dell'archivio Vercel Blob in una cartella locale.
 *
 *   node scripts/export-blob.mjs [cartella]        (default: ./_blob-export)
 *
 * Legge `BLOB_READ_WRITE_TOKEN` da .env.local / .env / ambiente.
 * Scarica: places/*.json, manifest.json, restaurants/*, dishes/*.
 * Se il Blob risponde 403 (quota esaurita) usa il Browser del dashboard Vercel.
 */
import { list } from '@vercel/blob';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { existsSync } from 'node:fs';

async function loadEnvLocal() {
  for (const file of ['.env.local', '.env']) {
    if (!existsSync(file)) continue;
    const text = await readFile(file, 'utf8');
    for (const line of text.split(/\r?\n/)) {
      const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(line);
      if (m && process.env[m[1]] === undefined) {
        process.env[m[1]] = m[2].replace(/^['"]|['"]$/g, '');
      }
    }
  }
}

async function main() {
  await loadEnvLocal();
  const token = process.env.BLOB_READ_WRITE_TOKEN;
  if (!token) {
    console.error('BLOB_READ_WRITE_TOKEN mancante (mettilo in .env.local).');
    process.exit(1);
  }

  const outDir = resolve(process.argv[2] || '_blob-export');
  console.log(`Export → ${outDir}`);

  const prefixes = ['places/', 'restaurants/', 'dishes/', 'manifest.json'];
  const seen = new Map(); // pathname -> url

  for (const prefix of prefixes) {
    let cursor;
    do {
      // eslint-disable-next-line no-await-in-loop
      const page = await list({ prefix, limit: 1000, cursor, token }).catch((err) => {
        console.error(`list('${prefix}') → ${err?.status || ''} ${err?.message || err}`);
        return null;
      });
      if (!page) break;
      for (const b of page.blobs) seen.set(b.pathname, b.downloadUrl || b.url);
      cursor = page.cursor;
    } while (cursor);
  }

  if (seen.size === 0) {
    console.error('\nNessun blob elencabile. Probabile blocco quota: usa il tab "Browser" del dashboard Vercel.');
    process.exit(2);
  }

  console.log(`${seen.size} file da scaricare…`);
  let ok = 0;
  let fail = 0;
  for (const [pathname, url] of seen) {
    const dest = join(outDir, pathname);
    // eslint-disable-next-line no-await-in-loop
    await mkdir(dirname(dest), { recursive: true });
    try {
      // eslint-disable-next-line no-await-in-loop
      const res = await fetch(`${url}?export=${Date.now()}`, {
        headers: { authorization: `Bearer ${token}` },
        cache: 'no-store',
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      // eslint-disable-next-line no-await-in-loop
      const buf = Buffer.from(await res.arrayBuffer());
      // eslint-disable-next-line no-await-in-loop
      await writeFile(dest, buf);
      ok += 1;
      process.stdout.write(`  ✓ ${pathname} (${buf.length} B)\n`);
    } catch (err) {
      fail += 1;
      process.stdout.write(`  ✗ ${pathname} — ${err.message}\n`);
    }
  }

  console.log(`\nFatto: ${ok} ok, ${fail} falliti in ${outDir}`);
  if (fail > 0) {
    console.log('I file falliti scaricali a mano dal Browser del dashboard Vercel.');
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

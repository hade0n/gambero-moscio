#!/usr/bin/env node
/**
 * Audit ripetibile del database discovery della Ruota del Gambero.
 *
 * Verifica quantità/rank per tipologia, copertura dei campi, file foto locali e
 * duplicati. Non modifica mai il database.
 *
 *   npm run audit:gambero
 *   npm run audit:gambero -- --json
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dbPath = path.join(root, 'src', 'data', 'gamberoDiscovery.json');
const imageDir = path.join(root, 'public', 'gambero');
const asJson = process.argv.includes('--json');
const db = JSON.parse(fs.readFileSync(dbPath, 'utf8'));
const places = Array.isArray(db.places) ? db.places : [];
const fields = ['phone', 'address', 'latLng', 'placeId', 'photoUrl', 'website', 'description', 'sources'];

const has = (value) => value !== null && value !== undefined && value !== '';
const count = (list, field) =>
  list.filter((place) =>
    field === 'latLng' ? Number.isFinite(Number(place.lat)) && Number.isFinite(Number(place.lng)) : has(place[field]),
  ).length;

function duplicates(key) {
  const grouped = new Map();
  for (const place of places) {
    if (!has(place[key])) continue;
    const current = grouped.get(place[key]) || [];
    current.push(place.id);
    grouped.set(place[key], current);
  }
  return [...grouped.entries()]
    .filter(([, ids]) => ids.length > 1)
    .map(([value, ids]) => ({ value, ids }));
}

function localPhotoProblems() {
  return places.flatMap((place) => {
    if (!place.photoUrl?.startsWith('/gambero/')) return [];
    const file = path.join(imageDir, path.basename(place.photoUrl));
    return fs.existsSync(file) ? [] : [{ id: place.id, photoUrl: place.photoUrl }];
  });
}

function categoryReport(category) {
  const list = places.filter((place) => place.category === category).sort((a, b) => a.rank - b.rank);
  const ranks = list.map((place) => Number(place.rank)).filter(Number.isFinite);
  const expected = Array.from({ length: list.length }, (_, index) => index + 1);
  const missingRanks = expected.filter((rank) => !ranks.includes(rank));
  const duplicateRanks = [...new Set(ranks.filter((rank, index) => ranks.indexOf(rank) !== index))];

  return {
    category,
    total: list.length,
    target: 25,
    missingToTarget: Math.max(0, 25 - list.length),
    ranksConsecutive: missingRanks.length === 0 && duplicateRanks.length === 0,
    missingRanks,
    duplicateRanks,
    coverage: Object.fromEntries(fields.map((field) => [field, count(list, field)])),
  };
}

const categories = [...new Set(places.map((place) => place.category).filter(Boolean))].sort();
const report = {
  generatedAt: new Date().toISOString(),
  total: places.length,
  categories: categories.map(categoryReport),
  duplicates: { ids: duplicates('id'), placeIds: duplicates('placeId') },
  missingLocalPhotoFiles: localPhotoProblems(),
  globalCoverage: Object.fromEntries(fields.map((field) => [field, count(places, field)])),
};

if (asJson) {
  console.log(JSON.stringify(report, null, 2));
  process.exit(0);
}

console.log('\nGAMBERO DISCOVERY — AUDIT');
console.log(`Locali: ${report.total}`);
console.log(`Foto: ${report.globalCoverage.photoUrl}/${report.total} · Telefoni: ${report.globalCoverage.phone}/${report.total} · Indirizzi: ${report.globalCoverage.address}/${report.total} · Coordinate: ${report.globalCoverage.latLng}/${report.total}`);
for (const item of report.categories) {
  console.log(`\n${item.category}: ${item.total}/${item.target} locali · ne mancano ${item.missingToTarget}`);
  console.log(`  rank consecutivi: ${item.ranksConsecutive ? 'sì' : 'NO'} · foto ${item.coverage.photoUrl}/${item.total} · telefoni ${item.coverage.phone}/${item.total} · indirizzi ${item.coverage.address}/${item.total} · coordinate ${item.coverage.latLng}/${item.total}`);
}
console.log(`\nDuplicati id: ${report.duplicates.ids.length} · duplicati placeId: ${report.duplicates.placeIds.length} · file foto mancanti: ${report.missingLocalPhotoFiles.length}\n`);

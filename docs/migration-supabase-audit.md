# Migrazione persistenza: Vercel Blob → Supabase

> Audit di cosa cambia per spostare i dati (e le immagini) da **Vercel Blob** a
> **Supabase** (Postgres + Storage), restando su **Vercel per hosting + funzioni**.
> Nessuna riga di codice ancora scritta: questo documento serve a decidere e a
> pianificare.

---

## 1. Superficie da toccare — inventario

`@vercel/blob` è importato in **esattamente 2 file**:

| File | Ruolo | Destino |
|---|---|---|
| `lib/blob-store.js` | tutta la persistenza dei locali (CRUD + concorrenza + migrazione) | **riscritto** → `lib/db.js` (Supabase) |
| `api/upload.js` | upload immagini su Blob (`restaurants/`, `dishes/`) | **modificato** → Supabase Storage |

Tutto il resto del backend **non dipende dal Blob**:

| Area | Stato |
|---|---|
| `lib/session.js`, `api/auth/{login,logout,session}.js` | **invariato** — auth = cookie HMAC firmato, nessun DB, nessun servizio esterno. Supabase Auth NON serve. |
| `api/place-photo.js` | **invariato** — proxy Google Places, non c'entra col Blob |
| `vercel.json` | **invariato** — il rewrite già esclude `/api` |
| `src/utils/api.js` | **invariato** — URL degli endpoint e forma delle risposte identici |
| `src/utils/model.js` (`normalizeRestaurant`, `pickPlaceFields`, `placeKey`, `createId`, `extractRestaurants`, `normalizeCollection`) | **riusato tal quale** dal nuovo `lib/db.js` |
| `src/context/RestaurantsContext.jsx` | **quasi invariato** — solo `POLL_INTERVAL` da alzare (vedi §5) |
| Tutti i componenti / pagine / hook, routing, `ratings.js`, `ratingUtils.js` | **invariato** — consumano il context, non sanno da dove arrivano i dati |
| Ruota del Gambero + `src/data/gamberoDiscovery.json` | **invariato** — dataset separato, non è nel Blob |

### Cosa SPARISCE con Postgres

Tutta la complessità in `lib/blob-store.js` che esiste solo per aggirare la CDN del Blob:

- **un blob per locale** (`places/<id>.json`) → **una tabella `places`**, `list()` non serve più
- `readJsonFresh()` con retry `head()`/corpo sull'ETag → un `SELECT`
- `lastWrite` (cache in memoria per istanza serverless) → non serve, Postgres è coerente
- `manifest.json` (contatore non autorevole) → una colonna `updated_at` reale
- `ifMatch` + loop di retry su conflitto (fino a 4 tentativi) → update di riga; per le recensioni dei due utenti (vedi §3) **il conflitto sparisce del tutto**
- migrazione una-tantum dal seed → non serve (import una-tantum via script, §6)

Stima: `lib/blob-store.js` passa da ~380 righe a ~120.

---

## 2. Dipendenze

```diff
- "@vercel/blob": "^2.8.0"
+ "@supabase/supabase-js": "^2.x"
```

Unica dipendenza runtime cambiata. `@supabase/supabase-js` gira senza problemi nelle
funzioni serverless di Vercel (fa solo `fetch` verso l'endpoint REST/Storage di Supabase).

---

## 3. Schema Postgres

### Opzione A — una tabella, `reviews` come JSONB *(consigliata)*

```sql
create table places (
  id           text primary key,
  name         text        not null,
  category     text        not null,
  town         text        not null,
  province     text        not null,
  image_url    text,
  dish_images  jsonb       not null default '[]'::jsonb,
  reviews      jsonb       not null default '{}'::jsonb,  -- { ilenia:{ratings,review}, salvatore:{...} }
  updated_at   timestamptz not null default now()
);

-- dedup nome+città+provincia (come oggi placeKey())
create unique index places_key_uniq
  on places (lower(trim(name)), lower(trim(town)), lower(trim(province)));
```

- Mappa **1:1** con l'attuale `places/<id>.json` → `normalizeRestaurant` funziona identico, riscrittura API minima.
- Concorrenza dei due recensori: si scrive **solo la chiave dell'utente** in modo atomico:
  ```sql
  update places
     set reviews = jsonb_set(coalesce(reviews,'{}'), array[$user], $reviewJson::jsonb, true),
         updated_at = now()
   where id = $id;
  ```
  Ilenia e Salvatore toccano chiavi diverse dello stesso JSONB nella stessa
  `UPDATE` atomica → **nessuna corsa**, niente `ifMatch`, niente retry.
- Dati condivisi: `update places set name=$1, category=$2, ... , updated_at=now() where id=$id` (non tocca `reviews`).

### Opzione B — `places` + tabella `reviews`

```sql
create table places  (id text primary key, name text, category text, town text, province text,
                       image_url text, dish_images jsonb default '[]', updated_at timestamptz default now());
create table reviews (place_id text references places(id) on delete cascade,
                      reviewer text check (reviewer in ('ilenia','salvatore')),
                      ratings jsonb, body text, updated_at timestamptz default now(),
                      primary key (place_id, reviewer));
```

- Relazionale "pulito", concorrenza perfetta (righe diverse).
- **Più codice**: la GET deve fare join + ricomporre la forma che si aspettano `model.js` e il client. Più churn per zero vantaggi pratici (siamo a 2 recensori fissi).

**→ Si va con l'Opzione A** salvo tua preferenza diversa.

### `signature` per il polling

Oggi è un hash di `list()`. Con Postgres si calcola nella funzione dopo il `SELECT`:
`md5( count(*) || '|' || max(updated_at) )`. Cheap, coerente, stesso contratto verso il client.

---

## 4. Immagini → Supabase Storage

- Bucket **pubblico** `locali` (o due: `restaurants`, `dishes`). Cartelle interne `place/` e `dish/` (riuso della mappa `FOLDERS` di `api/upload.js`).
- `api/upload.js`: `put()` del Blob →
  ```js
  const { data, error } = await supabase.storage.from('locali')
    .upload(`${folder}/${name}`, buffer, { contentType, upsert: false });
  const { data: pub } = supabase.storage.from('locali').getPublicUrl(data.path);
  return res.json({ url: pub.publicUrl });
  ```
  **Stessa risposta `{ url }`** → `src/utils/api.js` e `PlaceForm` invariati.
- **URL vecchie**: dopo la migrazione i record contengono ancora URL
  `*.blob.vercel-storage.com` (Blob a quota esaurita → immagini rotte). Lo script di
  import (§6) **ri-carica le immagini su Supabase e riscrive `image_url` / `dish_images`**.
- **Banda**: Supabase free = 5 GB/mese condivisi. Le letture dati ora sono minuscole
  (una query, pochi KB); il rischio resta il **transfer immagini**. Le foto sono poche
  e curate → dovrebbe stare. Se non basta: immagini su **Cloudflare R2** (10 GB, egress
  gratis), stesso `api/upload.js` con l'SDK S3 di R2. Da valutare a consumi reali.

---

## 5. Polling / consumi

`RestaurantsContext.jsx`: `POLL_INTERVAL = 12000` → **`30000`–`60000`**.
Già ora il polling è in pausa su `document.hidden` e fa refetch al `focus`. Alzare
l'intervallo taglia le richieste 3–5×; con Postgres ogni giro costa una query da pochi KB.
Nessun bisogno di Supabase Realtime (websocket) per questo caso d'uso.

---

## 6. Piano di migrazione dati

1. **Export dal Blob** (lo fai tu): Vercel → Storage → store Blob → **Browser** →
   scarica tutti i `places/*.json`, il `manifest.json` e le cartelle `restaurants/` e
   `dishes/` in una cartella locale (es. `./_blob-export/`).
   *(In alternativa `scripts/export-blob.mjs` via SDK — ma se le read sono bloccate dalla
   quota darà 403 anche lui; il dashboard è il metodo affidabile.)*
2. **Crea il progetto Supabase**, esegui lo schema SQL (§3), crea il bucket (§4).
3. `scripts/import-to-supabase.mjs` (lo scrivo io): per ogni `places/*.json` esportato →
   ri-carica l'immagine principale e le foto piatti su Storage → riscrive gli URL →
   `upsert` della riga in `places`.
4. Verifica: `select count(*) from places` = numero locali atteso; apri l'app in preview
   con le nuove env e controlla 2–3 schede + una recensione.
5. Su Vercel: sostituisci le env (§7), redeploy. Rimuovi `BLOB_READ_WRITE_TOKEN`.

Rollback: finché non cancelli lo store Blob, basta rimettere le env vecchie e
ridable `lib/blob-store.js` (resta in git history).

---

## 7. Variabili d'ambiente

```diff
  ILENIA_PASSWORD=
  SALVATORE_PASSWORD=
- BLOB_READ_WRITE_TOKEN=
+ SUPABASE_URL=
+ SUPABASE_SERVICE_ROLE_KEY=        # SOLO server, mai VITE_*, mai nel bundle
  GOOGLE_MAPS_API_KEY=              # invariata, opzionale (Ruota)
```

- `vite.config.js`: in `loadEnv` aggiungi il prefisso `'SUPABASE_'` (e togli `'BLOB_'`).
- La `service_role` key bypassa la Row Level Security: sta **solo** nelle funzioni `api/`,
  come oggi il token del Blob. RLS sulle tabelle: si può lasciare attiva e negare tutto
  al ruolo `anon` (il client non parla mai con Supabase, solo le funzioni).

---

## 8. Elenco file — checklist implementazione

| File | Azione | Rischio |
|---|---|---|
| `package.json` + lock | `- @vercel/blob`, `+ @supabase/supabase-js` | basso |
| `lib/db.js` (nuovo, sostituisce `lib/blob-store.js`) | client Supabase; `readCollection` = SELECT + signature; `createPlace` / `updateSharedFields` / `saveReview` / `deletePlace` = SQL. `DbNotConfiguredError`. | **alto** (cuore) |
| `api/restaurants.js` | import `../lib/db.js`; logica e contratto HTTP **identici** | medio |
| `api/upload.js` | `put` Blob → `supabase.storage...upload` + `getPublicUrl`; risposta `{ url }` identica | medio |
| `vite.config.js` | `loadEnv` prefissi: `+ 'SUPABASE_'` | basso |
| `.env.example` | vedi §7 | basso |
| `src/context/RestaurantsContext.jsx` | `POLL_INTERVAL` 12000 → 45000 | basso |
| `CLAUDE.md` | nuova sezione override "Persistenza su Supabase" al posto di quella sul Blob | doc |
| `scripts/import-to-supabase.mjs` (nuovo) | import una-tantum dati + immagini | tooling |
| `scripts/export-blob.mjs` (nuovo, opzionale) | export via SDK se il Blob risponde ancora | tooling |
| `docs/` | questo file + runbook | doc |

### File che NON cambiano (verificato)

`lib/session.js`, `api/auth/*`, `api/place-photo.js`, `src/utils/api.js`,
`src/utils/model.js`, `src/utils/auth.js`, `vercel.json`, tutti i componenti/pagine/hook,
`ratings.js`, `ratingUtils.js`, `src/data/*`, `public/*`, la Ruota del Gambero.

---

## 9. Decisioni aperte per te

1. **Schema**: Opzione A (JSONB `reviews`, consigliata) o B (tabella `reviews`)?
2. **Immagini**: Supabase Storage (come da tua scelta) — ok partire così e valutare R2 solo se il transfer stringe?
3. **Polling**: 45s va bene? (oppure lo tolgo del tutto e tieni solo il refetch al focus)
4. **Realtime**: no (resta polling). Confermi?

## 10. Cosa mi serve da te per partire

- Progetto Supabase creato → `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY`
- Schema SQL (te lo do io) eseguito + bucket creato
- La cartella con l'export del Blob (per lo script di import)
- Le due env aggiunte su Vercel **e** in `.env.local`

---

## 11. Stato — migrazione completata (produzione)

- ✅ Codice migrato e in `main` (commit `1ebf376`). `lib/blob-store.js` rimosso, `lib/db.js` attivo.
- ✅ Supabase: tabella `places` + indice unico + RLS creati; bucket `locali` (public) creato.
- ✅ Vercel: `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` su Production; redeploy fatto.
- ✅ Produzione verificata: `GET /api/restaurants` → `200 {restaurants: []}` (Supabase connesso,
  tabella vuota). `auth/session`, gate 401 su POST/upload: ok.
- ⏳ **Da fare a mano:**
  - smoke test del percorso di scrittura (login → crea locale + foto → recensione);
  - `SUPABASE_SERVICE_ROLE_KEY` in `.env.local` (l'`URL` è già stato aggiunto);
  - le due env anche su **Preview** su Vercel (ora solo Production);
  - **recupero dei ~2 locali** dal Blob (rinviato: al reset quota, `export-blob.mjs` +
    `import-to-supabase.mjs`);
  - pulizia (dopo il recupero): rimuovere env `BLOB_*` da Vercel, eliminare lo store Blob,
    togliere `@vercel/blob` (devDep) + `scripts/export-blob.mjs`.
- ⚠️ **Non eliminare lo store Blob** finché i locali non sono recuperati: contiene l'unica
  copia dei dati.

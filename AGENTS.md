# PNDR Project Guidelines

> Documento di riferimento principale per lo sviluppo di **Gambero Moscio - Recensioni Locali**
> (il nome del progetto è cambiato nel tempo: il resto del documento può ancora citare
> nomi precedenti nei testi descrittivi, ma il nome visibile all'utente è quello nuovo).
> Ogni componente, pagina, stile o logica va verificato contro questo file **prima** di essere implementato.
> Le decisioni di design seguono il brief del prodotto e i principi della skill **UI/UX Pro Max**.

---

## Aggiornamento — Gambero Moscio - Recensioni Locali (override)

Questa sezione **sostituisce** le parti in conflitto più avanti nel documento.

### Nome
- Nome visibile ovunque (header, `<title>`, meta, login, backend, branding): **Gambero Moscio - Recensioni Locali** (nome ufficiale visualizzato esattamente così).
- Logo: `public/logo.svg` aggiornato (fornito dal committente), usato come `<img>` in `Header`/`Login` e come favicon.

### Due account (una coppia che recensisce insieme)
- Account: `ilenia` / `salvatore`. Password **solo** in Environment Variables server-side:
  `ILENIA_PASSWORD`, `SALVATORE_PASSWORD` (+ opzionale `AUTH_SECRET`). Nessun `ADMIN_*`.
  Gli username non sono segreti: vivono in `src/config/users.js` (fonte unica: `REVIEWERS`).
- `POST /api/auth/login` → `{ ok, user }`; `GET /api/auth/session` → `{ authenticated, user }`.
  Il token di sessione porta `user`. `ProtectedRoute` passa `{ logout, user }` ai figli.
- `.env.example`: solo `ILENIA_PASSWORD=` e `SALVATORE_PASSWORD=` (senza valori).

### Modello dati — un locale, fino a due recensioni indipendenti
```jsonc
{
  "id": "...", "name": "...", "category": "...", "town": "...", "province": "..",
  "imageUrl": "...", "dishImages": [],           // dati CONDIVISI del locale
  "reviews": {                                   // 0, 1 o 2 recensioni indipendenti
    "ilenia":    { "ratings": { …8 + overall }, "review": "…", "rankingScore": 8.7 },
    "salvatore": { … }
  },
  "ratings": { …8 + overall },  "rankingScore": …,  "reviewCount": 0|1|2  // AGGREGATI (derivati)
}
```
- L'aggregato = media per categoria delle recensioni presenti → `calculateRankingScore` /
  `calculateOverall` esistenti (`aggregateReviews()` in `ratings.js`). Con una sola recensione
  l'aggregato coincide con essa. Nessun campo modificabile a mano.
- `normalizeRestaurant` migra i dati legacy (record piatto con `ratings`/`review`) in
  `reviews.ilenia` (l'unico account precedente).
- **Nessun duplicato del locale**: il locale si crea una sola volta; le recensioni si
  aggiungono sullo stesso `id`.

### Context (`useRestaurants()`)
`restaurants`, `createPlace(data)` (solo dati condivisi, nessuna recensione automatica),
`updatePlace(id, data)` (solo dati condivisi, recensioni intatte),
`saveReview(id, user, {ratings, review})` (crea/sostituisce la recensione di **quell'utente**),
`deleteRestaurant(id)` (elimina l'intero locale), `getRestaurant`, `compareByRanking`.

### Backend — due azioni separate
- `+ Crea locale` → `PlaceForm` (nome/categoria/città/provincia + foto locale + foto piatti).
- `Scrivi recensione` → `ReviewPicker` (elenco locali con stato «Ilenia ✓ / Salvatore —»,
  bottone per l'utente corrente: *Scrivi* / *Modifica la recensione di …*) → `ReviewForm`
  (8 voti + testo). Ilenia modifica solo la propria, Salvatore solo la propria.
- `RestaurantListAdmin`: elenco locali con stato recensioni (`ReviewStatus`), azioni
  `Modifica locale` / `Elimina` (elimina l'intero locale, con conferma).
- Componenti nuovi: `PlaceForm.jsx`, `ReviewForm.jsx`, `ReviewPicker.jsx`, `ReviewStatus.jsx`.
  `RestaurantForm.jsx` **rimosso**.

### Dettaglio pubblico (`RestaurantModal`)
- Pill dinamiche `Recensione Ilenia` / `Recensione Salvatore`, mostrate **solo** per le
  recensioni presenti (una sola presente → nessuna pill, si mostra direttamente quella;
  nessuna → «Nessuna recensione disponibile.»). La pill selezionata cambia voti e testo.
- Heading: «La valutazione di {nome}».

### Homepage
- In classifica compaiono solo i locali con `reviewCount > 0`. Ordinamento invariato
  (`compareByRanking` sull'aggregato).

Restano invariati: palette, PNDR Material, animazioni, galleria/lightbox foto piatti,
sistema di voti (`ratings.js`), routing, tono di voce, requisiti Vercel.

---

## Aggiornamento — Persistenza su Vercel Blob (override)

Questa sezione **sostituisce** *localStorage Architecture*, *Image Upload* (parte storage) e
ogni riferimento più avanti a «`localStorage` è il database» / «nessun backend server».
La persistenza **non** è più nel browser: c'è un **archivio centrale unico** su
**Vercel Blob**, condiviso da tutti i dispositivi. Ilenia e Salvatore vedono gli stessi dati
da qualsiasi browser.

### Dipendenze
- Unica dipendenza aggiunta: **`@vercel/blob`**. Nessun Redis/KV/Upstash/Supabase/Firebase/
  Mongo/Postgres/MySQL o altro servizio di database.

### Segreto
- `BLOB_READ_WRITE_TOKEN`: **solo lato server** (`process.env`), mai `VITE_*`, mai nel bundle
  client / props / `localStorage` / JSON pubblici. In `.env.example` è presente come
  `BLOB_READ_WRITE_TOKEN=` senza valore. `.env.local` e varianti restano git-ignored.
- Su Vercel il token viene iniettato automaticamente collegando lo Store Blob al progetto.

### Layout su Blob — un blob per locale (v3)
- `places/<id>.json` → un singolo locale (`{ id, name, category, town, province, imageUrl,
  dishImages, reviews:{ilenia?,salvatore?}, …aggregati }`).
- `manifest.json` → `{ version, updatedAt, migrated }` — contatore informativo, **non** la
  fonte autorevole (può restare indietro per la cache CDN, il client non ci si affida).
- **Perché non un unico `restaurants.json`**: le URL pubbliche del Blob passano da una CDN
  con TTL ~60s che **ignora la query string**. Con un documento unico sovrascritto, per ~60s
  una GET poteva restituire la copia precedente → una mutazione leggeva dati vecchi e
  riscriveva perdendo i locali aggiunti nel frattempo (create A, poi create B → A spariva;
  «l'amica crea il locale, ricarica e non lo vede»). Con un blob per locale l'**elenco** è
  dato da `list('places/')`, che colpisce l'API (non la CDN) ed è coerente: un locale creato
  compare subito e non può sparire senza `del()` esplicita; due creazioni in parallelo non
  sono più una corsa (pathname diversi).
- `src/data/restaurants.json` resta **solo come seed**. Alla prima lettura, se non esistono
  `places/*` e non c'è `manifest.migrated`, si **migra una tantum** dal vecchio
  `restaurants.json` (o dal seed) a `places/<id>.json`; il documento legacy non viene toccato
  (resta come copia).

### API — `/api/restaurants` (intermediario sottile verso il Blob, non un database)
| Metodo | Accesso | Body | Effetto |
|---|---|---|---|
| `GET` | pubblico | — | `{ version, updatedAt, signature, restaurants }` — `restaurants` da `list('places/')` + lettura di ogni blob |
| `POST` | sessione | `{ op: 'createPlace', data }` | scrive `places/<newid>.json` (`allowOverwrite:false`); **controllo duplicati** `name`+`town`+`province` (case-insensitive, spazi normalizzati) → se esiste `409 { error, existingId }` |
| `PUT` | sessione | `{ op: 'updatePlace', id, data }` | legge quel solo blob (lettura garantita fresca) → aggiorna **solo** i campi condivisi → `put(ifMatch)`; recensioni intatte |
| `PUT` | sessione | `{ op: 'saveReview', id, review }` | come sopra ma tocca **solo** `reviews[<utente di sessione>]` (mai un `username` dal body) |
| `DELETE` | sessione | `{ id }` | `del('places/<id>.json')` |
- **Lettura fresca per le mutazioni**: `head()` (API, non CDN) dà l'ETag autorevole; il corpo
  si riscarica finché l'ETag della risposta coincide con quello di `head()` (se la CDN resta
  vecchia oltre qualche secondo si risponde con un errore «riprova», **mai** si scrive sopra
  dati vecchi). Una copia in memoria per l'istanza serverless evita del tutto la finestra di
  staleness sulle modifiche sequenziali.
- **Concorrenza**: scrittura del singolo blob con `ifMatch` sull'ETag; su conflitto
  (`BlobPreconditionFailedError` / «conflicting operation») si rilegge fresco e si ritenta
  (fino a 4 volte). Modificare `reviews.ilenia` non tocca mai `reviews.salvatore`.
- Errori: Blob non configurato / token mancante → `503`; JSON corrotto / archivio non
  sincronizzato / errore di lettura-scrittura → `500` con messaggio comprensibile. Mai un
  finto «Nessun locale presente».
- `lib/blob-store.js` (server-only): `readCollection`, `createPlace`, `updateSharedFields`,
  `saveReview`, `deletePlace`, `BlobNotConfiguredError`, migrazione una tantum.

### Immagini → Blob
- `/api/upload` (POST, sessione): riceve `{ image: dataURL, kind: 'place' | 'dish' }`,
  decodifica il Base64 e fa `put()` in cartella `restaurants/` o `dishes/`, ritorna `{ url }`.
- Nel JSON dei locali si salvano **solo URL** (`imageUrl`, `dishImages: string[]`), mai il
  Base64. `PlaceForm` carica le immagini su Blob al submit e assembla gli URL; gli URL http
  già presenti restano invariati. UX invariata: upload multiplo, anteprime, rimozione,
  galleria, lightbox. Nessun sistema di gestione dei piatti.
- `src/utils/image.js` continua a ridimensionare lato client (max ~1200px, JPEG 0.8) e a
  restituire data URL; l'upload avviene subito dopo, nel form.

### Client — `RestaurantsContext` è l'unico punto di sincronizzazione
- `src/utils/api.js`: `getCollection()`, `sendMutation(method, body)` (lancia `ApiError` con
  `status`/`data` su 401/409/503/500), `uploadImage(dataUrl, kind)`.
- All'avvio: `GET /api/restaurants` → stato `status: 'loading' | 'ready' | 'error'`
  (`error` con messaggio). Loading ≠ lista vuota ≠ errore: tre stati distinti in Home e Backend.
- Mutazioni (`createPlace`, `updatePlace`, `saveReview(id, reviewData)` — **senza** parametro
  utente —, `deleteRestaurant`) passano dall'API e **sostituiscono** lo stato col documento
  restituito dal server (autorevole). Nessun `window.location.reload()`.
- **Polling** ogni ~12s: `GET /api/restaurants`, confronta `signature` (hash dell'elenco
  lato server, che deriva da `list()` → coerente) e applica **solo se è cambiata**; in pausa
  quando `document.hidden`, refetch immediato al ritorno in focus. Una risposta di polling
  «tornata» durante una mutazione viene **scartata** (contatore `mutationSeq`): una modifica
  appena fatta non può essere sovrascritta da una lettura partita prima.
- **Niente `localStorage`** come database: nessuna chiave `pndr_restaurants`, nessun listener
  `storage`. Nessuna cache locale che possa sovrascrivere i dati del server.
- Dopo create/mutate, lista backend / picker / conteggi / classifica / medie si aggiornano
  subito (stato React), senza reload.

### Invariato
Due account (`ilenia` / `salvatore`) con credenziali in Environment Variables, sistema a due
recensioni, pill del dettaglio, classifica, calcolo dei voti (`ratings.js`), UI del backend,
nome, logo, palette, layout, componenti, animazioni, responsive, routing, tono di voce.

---

## Aggiornamento — Rating in Gamberi Mosci (override)

Questa sezione **sostituisce** ogni riferimento più avanti a «stelle» / `RatingStars` /
`★ overall` come rappresentazione del voto.

**Su PNDR non si danno stelle: si danno Gamberi Mosci.** È il sistema di valutazione
proprietario dell'app. Il calcolo del punteggio (`ratings.js`) **non cambia**: cambia solo
come il voto finale viene disegnato.

- **Scala**: 5 gamberi, ognuno vale **2.0 punti** su 10 (1 gambero = 2.0, non 1.0). La
  scala numerica resta `0.0–10.0`, precisione al decimo e oltre. Il numero è sempre visibile
  accanto ai gamberi e ha gerarchia leggermente superiore (è la fonte precisa).
- **Riempimento continuo**: il gambero parziale si riempie in proporzione esatta al voto,
  non a scatti di 0.5. `8.0` → quinto gambero vuoto; `8.1` → 5% del quinto; `8.5` → 25%;
  `9.0` → 50%; `8.37` → 18.5%; `10.0` → 5 gamberi pieni (mai un sesto).
- **Asset unico**: `public/shrimp.svg` (il "gambero moscio" ufficiale, PNG in wrapper SVG).
  Nessuna emoji, nessun gambero ricostruito in CSS, nessuna icona generica. Lo stato "vuoto"
  è lo stesso asset attenuato (`opacity` + `saturate` ridotta); il parziale è l'asset pieno
  ritagliato con `clip-path: inset(0 <100−pct>% 0 0)` sopra quello vuoto.
- **Architettura centralizzata**:
  - `src/utils/ratingUtils.js` → `getShrimpRatingState(rating)` = tutta la matematica
    voto→gamberi (`SHRIMP_COUNT`, `POINTS_PER_SHRIMP`, normalizzazione floating point).
    Nessun componente duplica questa logica.
  - `src/components/ShrimpRating.jsx` → unico componente visivo. Props: `rating`,
    `size` (`'sm'|'md'|'lg'` o numero px), `showValue`, `className`, `valueClassName`,
    `ariaLabel`, `decorative` (blocco `aria-hidden` quando il contenitore già annuncia il voto).
  - Usato ovunque compaia il voto: card classifica, dettaglio (`RestaurantModal`), lista
    admin (`RestaurantListAdmin`), anteprima "Voto complessivo" del `ReviewForm`.
- **Accessibilità**: `role="img"` + `aria-label="Valutazione 8.5 su 10"`; le singole immagini
  sono `alt=""` `aria-hidden` (nessun testo duplicato).
- **Input**: gli 8 voti nel `ReviewForm` restano **input numerici** `0.0–10.0` step `0.1`.
  Il modello dati non cambia: `reviews.<utente>.ratings` resta numerico. Le recensioni
  esistenti mostrano automaticamente i Gamberi Mosci.
- `RatingStars.jsx` **rimosso**; l'icona `star` **rimossa** da `Icon.jsx`. `RatingBreakdown`
  (dettaglio per-categoria a barre) resta invariato: non usava stelle.
- Colore del riempimento: l'asset mantiene il proprio arancione (coerente col logo). Nessun
  gradiente/glow/3D. Il token `--pndr-rating` resta per eventuali indicatori numerici.

---

## Aggiornamento — Il Gambero Moscio Food Picker (feature)

Accesso da un **pulsante nella navbar** («Il Gambero», `Header.jsx`) che apre un **modal
full-screen** (`GamberoModal.jsx`). **Non** c'è nessuna ruota permanente in homepage. È
l'unica parte dell'app con tono **ironico / colloquiale / qualche parolaccia leggera** —
sempre riferito all'indecisione, mai a persone o attività.

### Pipeline (due ruote)
`idle → type-spin → type-reveal → place-spin → result` (`useGamberoWheel.js`)
1. **Ruota delle tipologie** — segmenti = categorie con almeno un locale nel database
   discovery. Il Gambero sceglie *cosa* mangiare.
2. **Interstiziale** — «{tipologia}. Ok, ora troviamo DOVE.» + estrazione dei candidati.
3. **Ruota dei locali** — dai **top 25** della tipologia si estraggono a caso **fino a 6**
   candidati (Fisher–Yates, `random.js`), poi la ruota ne sceglie **1**. Uniforme: il `rank`
   non conta.
4. **Risultato** — `GamberoResult.jsx`.

### Database discovery — SEPARATO dalle recensioni PNDR
- `src/data/gamberoDiscovery.json` + `src/utils/discovery.js`. Locali **reali** della
  Campania per tipologia (region come campo, struttura estensibile ad altre regioni).
  Il Gambero può quindi proporre locali **non presenti** nel database delle recensioni.
- Campi: `id`, `name`, `category` (una delle `CATEGORIES`), `region`, `province`, `city`,
  `rating` (0–10 indicativo, `null` se non verificabile), `rank`, `description`, `phone`
  (numero reale da fonti ufficiali dove reperito, `null` altrimenti),
  `mapsUrl` / `directionsUrl` (deep-link Google Maps: per coordinata se `lat`/`lng` presenti,
  altrimenti ricerca per nome+città), `lat/lng/photoUrl/website/address/reviewCount`
  **predisposti a `null`** (da popolare da una sorgente ufficiale, **mai inventati**).
- **Foto reali**: priorità nel client `pndrMatch.imageUrl` → `getPlacePhotoUrl(place)` →
  placeholder editoriale (mai il Gambero come foto del locale). `getPlacePhotoUrl(place)`
  (in `discovery.js`) restituisce: `place.photoUrl` se presente (foto scaricata in
  `public/gambero/<id>.<ext>` da sorgenti pubbliche) → altrimenti il proxy
  `api/place-photo.js` verso Google Places (`?ref=<photoReference>` o `?name=&city=`), che
  senza `GOOGLE_MAPS_API_KEY` risponde `204` e la card cade sul placeholder.
- **Foto scaricate senza chiave** (`public/gambero/`): `scripts/fetch-photos-commons.mjs`
  (Wikimedia Commons, match prudente per token del nome/città) e
  `scripts/fetch-photos-sites.mjs` (og:image dal sito ufficiale, elenco `SITES` curato a
  mano). Entrambi scrivono `photoUrl` nel DB e vanno **verificati a vista** uno per uno:
  loghi, banner promozionali e foto di altri locali si scartano (regola: una foto sbagliata
  è peggio di una mancante). Copertura onesta attuale: 5/70 (da Michele, Sorbillo, Starita,
  Torre del Saracino, Vannulo); il resto richiede `GOOGLE_MAPS_API_KEY` + `enrich:gambero`.
- **Arricchimento del database**: `scripts/enrich-gambero-db.mjs` (`npm run enrich:gambero`,
  `-- --refresh`, `-- --dry`). Per ogni locale interroga Google Places (Text Search →
  Details), valida il match (nome + città, segnala gli ambigui), riempie SOLO i campi
  mancanti (`placeId`, `address`, `lat`/`lng`, `phone`, `googleRating`, `userRatingsTotal`,
  `photoReference`, `website`) senza toccare `rank`/ordine, controlla i duplicati per
  `placeId`, e stampa un report di copertura. Senza chiave stampa solo il report.
  Richiede `GOOGLE_MAPS_API_KEY` in ambiente (mai nel frontend).
- `getDiscoveryTypes()`, `getTopPlaces(cat)` (max 25, ordinati per rank), `drawCandidates(cat, 6)`.

### Il Gambero — selettore rotante centrale
`public/shrimp.svg` sta **al centro** della ruota e **ruota** come un ago di bussola: il muso
punta verso il segmento vincente. Segmenti **fissi**, disegnati in senso orario da ore 12.
Angolo: `rotation ≡ (i+0.5)·(360/n) (mod 360)` + 4–6 giri + scarto `< ±0.25·seg` (non cambia
il vincitore). `SHRIMP_NOSE_DEG` orienta solo il disegno dell'asset, non il calcolo. Le
rotazioni non si azzerano mai (nessun salto). Verificato: 5200/5200 spin (indice = segmento
sotto il muso) + 400 pipeline complete.

### Modal
`role="dialog"` + `aria-modal`, ESC, scroll-lock del body, focus iniziale sulla X e
ripristino sul pulsante navbar (`triggerRef`), pulizia di timer/animazioni alla chiusura
(anche durante lo spin). `aria-live="polite"` annuncia tipologia e locale scelto.

### Risultato
`ShrimpRating` (niente stelle) se `rating` presente, altrimenti chip «Selezione del Gambero
· #rank». Foto reale se `photoUrl`, altrimenti fallback col Gambero. «Vedi la recensione»
(apre il `RestaurantModal` esistente) **solo** se il locale ha un corrispondente nel
database PNDR (match per nome+città); altrimenti «Apri su Google Maps» + «Portami lì»
(navigatore) + eventuale «Chiama». «Fallo girare di nuovo» riavvia dalla tipologia.

### Random / motion
`crypto.getRandomValues` con rejection sampling (fallback `Math.random`). Spin ~4.6s
`cubic-bezier`, CTA `disabled` durante lo spin. `prefers-reduced-motion` → animazione
azzerata dal blocco globale in `index.css`, risultato quasi immediato (funzione sempre
disponibile). Nessun suono, nessun coriandolo, nessuna estetica da casinò.

### File
`src/hooks/useGamberoWheel.js`, `src/components/GamberoWheel.jsx` / `GamberoResult.jsx` /
`GamberoModal.jsx`, `src/utils/discovery.js` + `random.js`, `src/data/gamberoDiscovery.json`,
`api/place-photo.js`, copy in `src/config/wheelMessages.js`. Pulsante (icona `wheel`) e modal
in `Header.jsx`. Keyframe `wheel-result-in` in `src/index.css`. Env opzionale:
`GOOGLE_MAPS_API_KEY` (in `.env.example` e nei prefissi `loadEnv` di `vite.config.js`).

---

## Project Overview

PNDR è una piattaforma web per consultare recensioni di locali e ristoranti.

- **Nome:** PNDR
- **Sottotitolo:** Recensioni per gente non da ristorante
- **Parte pubblica:** homepage con filtro categorie, classifica automatica, schede locale, dettaglio.
- **Parte riservata:** area amministrativa (`/backend`) con login e CRUD completo delle recensioni.
- **Persistenza:** archivio centrale su **Vercel Blob**, un blob per locale
  (`places/<id>.json`), condiviso fra tutti i dispositivi, letto/scritto via
  `/api/restaurants` (vedi *Aggiornamento — Persistenza su Vercel Blob*).
  `src/data/restaurants.json` è solo il seed iniziale.
- **Deployment target:** Vercel (SPA statica).

Criterio di completamento: **l'app deve funzionare davvero** (visitare → filtrare → consultare → dettaglio; login → create → update → delete con persistenza al refresh). `npm run build` deve terminare senza errori.

---

## Product Identity

Sensazioni da comunicare: autenticità, semplicità, fiducia, calore, qualità, genuinità, immediatezza, familiarità.

Riferimenti visivi: carta calda, luce del sole, terracotta, ingredienti freschi, tavole apparecchiate, cucina mediterranea, prodotti naturali, convivialità.

**Non deve sembrare:** un'app aziendale verde, una SaaS generica, una dashboard fredda, un'estetica fast food, un prodotto neon/futuristico, qualcosa di "rustico".

**Deve sembrare:** un prodotto editoriale e gastronomico contemporaneo, caldo, curato, umano.

Il logo ufficiale è `public/logo.svg` (fornito dal committente): lockup con ramo d'ulivo verde, wordmark "PNDR" in terracotta e sottotitolo in marrone caldo su panna. È usato così com'è in `Header` e `Login` (viewBox ritagliato al contenuto) e come favicon. Non ricostruire il logo a mano.

---

## Tone of Voice

Caldo. Accogliente. Genuino. Umano. Semplice.

**NESSUNA IRONIA.** Vietati: battute, sarcasmo, meme, copy umoristico, microcopy "simpatico".

Vale per: titoli, sottotitoli, CTA, errori, empty state, toast, login, backend, conferme, placeholder, messaggi di successo.

Esempi approvati:
- Empty home: `Non sono ancora presenti locali recensiti.`
- Filtro senza risultati: `Nessun locale trovato per questa categoria.`
- Empty backend: `Non sono ancora presenti recensioni.`
- Errore login: `Username o password non corretti.`
- Toast: `Locale salvato` · `Recensione aggiornata` · `Recensione eliminata`
- Conferma delete: `Eliminare questa recensione?` / `La recensione verrà rimossa definitivamente.`

Lingua: italiano. Niente maiuscole urlate, niente punti esclamativi multipli.

---

## UI/UX Principles

Priorità operative (da UI/UX Pro Max, in ordine):

1. **Accessibilità (critica):** contrasto ≥ 4.5:1 sul testo, focus visibili, `aria-label` sui controlli icona, `alt` sulle immagini, navigazione da tastiera, ESC per le modali.
2. **Touch & interazione (critica):** target interattivi ≥ 48×48px, spaziatura ≥ 8px tra target, feedback entro 100ms, mai solo hover.
3. **Performance:** immagini `loading="lazy"`, dimensioni/aspect-ratio riservati per evitare layout shift, bundle contenuto.
4. **Coerenza di stile:** stessa identità su tutte le pagine, icone SVG (mai emoji strutturali), un solo set di icone.
5. **Layout & responsive:** mobile-first, breakpoint sistematici, nessuno scroll orizzontale di pagina.
6. **Tipografia & colore:** base 16px, line-height 1.5–1.75, token semantici (mai hex grezzi nei componenti).
7. **Animazioni:** brevi, con significato (causa→effetto), `prefers-reduced-motion` rispettato.
8. **Form & feedback:** label visibili, errore vicino al campo con `aria-describedby`, stato di submit, validazione su blur.
9. **Navigazione:** posizione corrente evidenziata, back prevedibile, deep-link per le route chiave.

Regola di arbitraggio: se UI/UX Pro Max propone una soluzione UX migliore di una puramente estetica, si sceglie la soluzione UX **mantenendo palette, tono e requisiti funzionali di questo file**.

---

## UI/UX Pro Max Rules

Regole concrete adottate dalla skill e vincolanti per questo progetto:

- **no-emoji-icons:** icone solo SVG inline (set unico, tratto coerente ~1.75px). Nessuna emoji come icona.
- **touch-target-size:** ogni pulsante/tab/chip/icona-azione ha area interattiva ≥ 48×48px (anche se il glifo è più piccolo: si estende il padding / hit area).
- **touch-spacing:** ≥ 8px tra target adiacenti.
- **color-contrast / color-accessible-pairs:** ogni coppia testo/fondo verificata ≥ 4.5:1 (vedi Color System).
- **color-not-only:** rating comunicato da numero + stella (non dal solo colore); categoria attiva da colore **+** peso/indicatore.
- **focus-states / focus-appearance:** focus ring visibile `2px` colore brand + `outline-offset: 2px`, mai `outline: none` senza sostituto.
- **form-labels / input-labels:** `<label for>` sempre presente e visibile, mai placeholder come unica label.
- **error-placement / aria-live-errors:** errore sotto il campo, `role="alert"` / `aria-live` per l'annuncio.
- **inline-validation:** validazione su `blur` e su submit, non a ogni tasto.
- **empty-states:** messaggio utile + eventuale azione, mai schermata bianca.
- **loading-buttons:** pulsante disabilitato durante operazioni asincrone (upload immagine), con indicazione.
- **modal-escape / escape-routes:** ogni modale ha X, ESC, click esterno; focus gestito (trap + restore).
- **duration-timing / excessive-motion:** transizioni 150–250ms, max 1–2 elementi animati per vista.
- **reduced-motion:** `@media (prefers-reduced-motion: reduce)` azzera transizioni/animazioni non essenziali.
- **mobile-first / horizontal-scroll:** si progetta a 360px e si scala verso l'alto; nessuno scroll orizzontale di pagina (solo il filtro categorie scrolla in orizzontale, in modo intenzionale).
- **image-dimension / lazy-load-below-fold:** immagini con `aspect-ratio` e `loading="lazy"`.
- **nav-state-active:** categoria/route attiva sempre evidenziata.
- **confirmation-dialogs / undo-support:** conferma prima di eliminare; nessuna eliminazione al primo click.
- **security (UI):** mai `dangerouslySetInnerHTML`; le recensioni sono testo semplice.

---

## Color System

Palette ufficiale PNDR (unica; sono ammesse solo variazioni di luminosità/opacità derivate).
**Vietato reintrodurre** Forest Green `#2D4A3E` o Warm Olive `#6B8E23`.

| Token | Hex | Nome | Uso |
|---|---|---|---|
| `--pndr-cream` | `#FFF3E2` | Warm Cream | **Background dominante**, superfici estese |
| `--pndr-cream-soft` | `#FFF9F1` | Soft Cream | Card, modali, sezioni, superfici secondarie |
| `--pndr-terracotta` | `#D96B32` | Terracotta Orange | **Brand principale**: bordi attivi, icone brand, heading accento, stati attivi, dettagli grafici |
| `--pndr-terracotta-deep` | `#BB5A20` | Terracotta Deep | Fondo delle **CTA primarie** con testo bianco (deriva dal Terracotta; garantisce contrasto AA ≈ 4.6:1 su testo bianco) |
| `--pndr-apricot` | `#E98B4A` | Warm Apricot | Hover, elementi secondari, variazioni controllate (uso moderato) |
| `--pndr-green` | `#5F8F3A` | Fresh Green | Accent: categoria attiva, badge categoria, indicatori, contrasto naturale col terracotta |
| `--pndr-green-deep` | `#385C32` | Deep Olive Green | Testo verde scuro, dettagli strutturali, varianti scure (uso moderato) |
| `--pndr-brown` | `#3A2A22` | Warm Brown | **Testo principale**, titoli, paragrafi |
| `--pndr-brown-soft` | `#6B564B` | Warm Brown Soft | Testo secondario / metadata (contrasto ≈ 6.3:1 su cream) |
| `--pndr-rating` | `#E39A2D` | Golden Orange | Riempimento stelle e indicatori di rating (elemento grafico di supporto) |
| `--pndr-border` | `rgba(58,42,34,0.12)` | — | Bordi sottili derivati dal marrone |
| `--pndr-white` | `#FFFFFF` | — | Testo su fondi terracotta/green; superfici immagine |

### Gerarchia cromatica (obbligatoria)
Panna (dominante) → Terracotta (brand) → Fresh Green (accento naturale) → Apricot / Deep Olive (supporto) → Warm Brown (testo) → Golden Orange (rating).

Il verde deve essere **visibile ma non dominante**. L'header non è mai completamente verde. L'interfaccia non diventa una UI verde.

### Coppie di contrasto verificate (AA)
- Warm Brown `#3A2A22` su Warm Cream `#FFF3E2` → ~11:1 ✅ (testo principale)
- Warm Brown Soft `#6B564B` su Warm Cream → ~6.3:1 ✅ (testo secondario)
- Bianco `#FFFFFF` su Terracotta Deep `#BB5A20` → ~4.6:1 ✅ (label CTA primaria)
- Bianco `#FFFFFF` su Fresh Green `#5F8F3A` → ~4.0:1 → usare **solo per testo ≥ 18.66px bold** o icone; per label normali su verde usare Warm Brown o Deep Olive
- Deep Olive `#385C32` su Warm Cream → ~7.5:1 ✅
- Terracotta `#D96B32` su Warm Cream → ~3.4:1 → **solo testo grande / bordi / icone**, mai body text
- Golden Orange `#E39A2D`: non usare come colore di testo su panna; è riempimento grafico. Il valore numerico del rating è sempre in Warm Brown.

### Regole d'uso
- Fondo pagina: sempre `--pndr-cream`.
- Card / modali / form: `--pndr-cream-soft` o bianco, con `--pndr-border`.
- CTA primaria: fondo `--pndr-terracotta-deep`, testo bianco, hover `--pndr-terracotta`.
- CTA secondaria: fondo trasparente, bordo `--pndr-terracotta`, testo `--pndr-terracotta` (dimensione ≥ 16px semibold — su cream è testo "grande" borderline: preferire `--pndr-brown` per label lunghe).
- Categoria attiva: fondo `--pndr-green`, testo bianco (label corta, bold) **+** peso maggiore; categoria inattiva: fondo `--pndr-cream-soft`, testo `--pndr-brown`, bordo.
- Distruttivo (Elimina): bordo/testo `#B23B2E` (rosso mattone derivato, caldo) — separato visivamente dalle azioni normali.
- Toast successo: fondo `--pndr-green-deep`, testo bianco. Toast errore: fondo `#B23B2E`, testo bianco. Icona sempre presente (non solo colore).

---

## Typography

Coppia (da UI/UX Pro Max — profilo "Restaurant / culinary / hospitality", scelta la variante più calda ed editoriale, non "luxury didone" e non rustica):

- **Display / heading:** `Fraunces` (serif contemporaneo caldo, terminali morbidi — coerente col wordmark del logo). Fallback: `Playfair Display, Georgia, serif`.
- **Body / UI:** `Karla` (grotesque umanista, caldo e molto leggibile su mobile). Fallback: `system-ui, -apple-system, Segoe UI, sans-serif`.

Caricamento: `<link>` Google Fonts in `index.html` con `preconnect` e `display=swap`.

Scala tipografica (rem, base 16px):

| Livello | Size | Weight | Font | Note |
|---|---|---|---|---|
| H1 (logo/hero) | 1.75–2.25rem | 600 | Fraunces | mobile 1.75, ≥md 2.25 |
| H2 sezione | 1.375–1.625rem | 600 | Fraunces | |
| H3 / titolo card | 1.125rem | 600 | Fraunces | |
| Body | 1rem (16px) | 400 | Karla | line-height 1.6 |
| Body large | 1.0625rem | 400 | Karla | recensione nel dettaglio |
| Metadata / caption | 0.875rem | 500 | Karla | città, provincia, `--pndr-brown-soft` |
| Label micro | 0.75rem | 600 | Karla | uppercase tracking 0.06em per badge categoria |

Regole: mai body < 16px su mobile (evita zoom iOS); caption mai < 0.75rem; line-length 60–75 caratteri su desktop; numeri di rating con `font-variant-numeric: tabular-nums`.

---

## PNDR Material Design System

Linguaggio visivo: **Material Design reinterpretato attraverso la palette e l'identità
mediterranea di PNDR**. Superfici morbide, forme arrotondate con gerarchia, elevazione
diffusa e delicata, feedback tattile. **Non** Google Material puro, non Android, non SaaS,
non glassmorphism/neumorphism/neon/3D. Palette, logica, routing, CRUD, ranking, storage e
autenticazione **restano invariati**: cambia solo come i colori e le superfici sono usati.

### Gerarchia dei border radius (token in `tailwind.config.js`)
| Token Tailwind | Valore | Uso |
|---|---|---|
| `rounded-sm` | 10px | micro elementi, badge interni |
| `rounded` / `rounded-md` | 12px | elementi piccoli |
| `rounded-lg` | 14px | input, select, textarea, pulsanti piccoli (`btn-sm`) |
| `rounded-xl` | 18px | pulsanti (`.btn`), contenitori medi |
| `rounded-2xl` | 22px | card, superfici (`.surface`), immagini nei dettagli |
| `rounded-3xl` | 28px | modali, form-card del login, empty state, gallerie importanti |
| `rounded-full` | — | chip categoria (semi-pill), badge di stato, icon-button circolari, barre rating |

Regola: morbido ma con gerarchia. Niente angoli vivi, niente "pillola ovunque".

### Elevation system (`boxShadow` in `tailwind.config.js`)
Ombre **diffuse, grande blur, poca distanza, bassa intensità, tinta calda** (rgba marrone
`58,42,34`). Mai ombre nere pesanti, mai glow.
| Livello | Token | Uso |
|---|---|---|
| 1 — resting | `shadow-xs` | superfici a riposo, chip categoria inattivi, box punteggio |
| 2 — card | `shadow-sm` | card ristorante e admin a riposo, `.surface`, CTA primaria |
| 3 — raised | `shadow-md` | card in hover, CTA primaria in hover |
| 4 — dialog | `shadow-lg` | modali, lightbox |
| emphasis | `shadow-xl` | toast |

Gerarchia di superfici: `--pndr-cream` (background) → `--pndr-cream-soft` (superfici,
card, modali) → bianco (input, box valutazione) → toast.

### Pulsanti — classi in `src/index.css` (`@layer components`)
Ogni pulsante usa `class="btn btn-<variante>"` (la classe base `btn` **deve** essere
presente: definisce layout, `min-height:48px`, `border-radius:16px`, `white-space:nowrap`,
transizione e feedback `:active scale(0.97)` + velo ripple `::after` opacity 0.1).
| Variante | Uso |
|---|---|
| `btn-primary` | CTA principale — fondo `--pndr-terracotta-deep`, testo bianco, hover `--pndr-terracotta` + `shadow-md` |
| `btn-secondary` | azione neutra — fondo `cream-soft`, bordo, testo brown |
| `btn-outline` | azione brand secondaria — bordo/testo terracotta, hover velo terracotta 10% |
| `btn-danger` | azione distruttiva confermata — fondo `--pndr-danger`, testo bianco |
| `btn-danger-outline` | azione distruttiva in lista — bordo/testo danger |
| `btn-sm` | modificatore: `min-height:44px`, padding ridotto, `rounded-lg` |
Stati: `default / hover / active (scale + velo) / focus (ring globale) / disabled (opacity .55, no pointer)`.
Le chip categoria restano `rounded-full` semi-pill (eccezione ammessa dal brief).

### Input / Select / Textarea — `.field-control` (via `controlClasses()` in `Field.jsx`)
`min-height:48px`, `rounded-lg` (14px), bordo sottile `rgba(58,42,34,.2)`, fondo bianco,
transizione di bordo/ombra. **Focus**: `border-color` terracotta + focus ring morbido
`box-shadow: 0 0 0 4px rgba(217,107,50,.16)` (variante danger per `.is-invalid`).
Label sempre visibile (`Field.jsx`), errore sotto il campo con `role="alert"`.

### Modali
`Modal.jsx`: `rounded-t-3xl` (mobile sheet) / `md:rounded-3xl`, superficie `cream-soft`,
`shadow-lg`, overlay `bg-brown/45`. Apertura non istantanea: `opacity` + `translate-y`
(+ `scale` da `md`) ~200ms `ease-pndr`; chiusura simmetrica (componente montato durante
l'uscita). `Esc`, click esterno, X, focus trap e ripristino focus invariati.

### Motion system
Solo `transform` / `opacity`, nessuna libreria. Durate 120–260ms, curva
`cubic-bezier(0.2, 0.7, 0.2, 1)` (`ease-pndr`), uscite più rapide.
- `.press` — feedback tattile su elementi cliccabili non-`.btn` (chip, icon-button, link logo).
- `.btn` — transizione + `:active` scale + velo ripple discreto (`::after`, opacity ≤ 0.1).
- `.reveal-up` — reveal progressivo delle card (stagger 45ms, cap 8), montaggio.
- `.reveal-in` — fade breve: miniature galleria, righe admin, numeri live nel form.
- Card ristorante: hover `-translate-y-1` + `shadow-md`; `active` `scale(0.985)`.
- Categorie: transizione di colore/ombra sullo stato attivo, mai brusca.
- Toast: entrata `fade + slide + scale` (`pndr-toast-in`), uscita in due fasi.
- `RatingBreakdown`: barre con `transition-[width] 500ms ease-pndr` (animano all'apertura).
- Header: `transition-shadow` sullo scroll (da `shadow-none` a `shadow-sm`), altezza fissa.

### Micro-interazioni / feedback tattile
Ripple discreto solo su `.btn` (non su ogni elemento). Su mobile il feedback touch è il
`:active` scale + velo. Nessuna animazione continua, nessun scroll-jacking, nessun effetto
spettacolare.

### Mobile touch behavior
Target interattivi ≥ 44–48px (`.btn` 48, `.btn-sm` 44, `.field-control` 48, chip 46).
Le forme arrotondate non devono generare overflow orizzontale: verificare 360 / 375 / 390 /
412 / 430 px. Modali quasi full-screen su mobile con scroll interno.

### Reduced motion
`@media (prefers-reduced-motion: reduce)` in `src/index.css`: azzera durate/ritardi di
animazioni e transizioni, disattiva il `:active scale` di `.press`. I reveal usano
`animation-fill-mode: both` → stato finale sempre visibile. Le transizioni di `width` delle
barre rating e delle card usano `motion-reduce:transition-none`.

### Regole di consistenza UI
- Un solo linguaggio: usare i token (radius/shadow) e le classi (`btn*`, `.surface`,
  `.field-control`), **mai** valori ad hoc per componente.
- Nuovi pulsanti → `btn btn-<variante>`; nuove superfici → `.surface` o `cream-soft` +
  `rounded-2xl` + `shadow-sm`; nuovi campi → `controlClasses()`.
- Palette invariata (nessun nuovo colore; mai `#2D4A3E` / `#6B8E23`).
- Ogni nuovo elemento interattivo: stati completi + `prefers-reduced-motion` + touch ≥ 44px.

---

## Mobile-First Rules

- Progettare a **360px**, poi 375 / 390 / 412 / 430, poi tablet (768) / laptop (1024) / desktop (1280+).
- Non partire dal desktop.
- Homepage: 1 colonna fino a `sm`, 2 colonne da `md`, 3 colonne da `lg`.
- Backend list: card verticali su mobile, tabella da `lg`.
- Container: `width: 100%`, `max-width: 72rem` (`max-w-6xl`), padding orizzontale `1rem` mobile / `1.5rem` da `md`.
- Filtro categorie: `overflow-x: auto`, `white-space: nowrap`, `scroll-snap` opzionale, `-webkit-overflow-scrolling: touch`, scrollbar nascosta.
- Modali: quasi full-screen su mobile (`inset-x-0 bottom-0` sheet o full con scroll interno), centrate e con `max-width` da `md`.
- Nessuno scroll orizzontale della pagina a nessun breakpoint (test 360px).
- `min-h-dvh` invece di `100vh`.
- Breakpoint = default Tailwind: `sm 640 · md 768 · lg 1024 · xl 1280`.

---

## Accessibility

- HTML `lang="it"`, un solo `<h1>` per pagina, gerarchia heading sequenziale.
- Tutti gli `<input>/<select>/<textarea>` con `<label for>` visibile; campi obbligatori con `*` e `aria-required`.
- Errori: `aria-describedby` che punta al messaggio, messaggio con `role="alert"`.
- Focus ring visibile su ogni elemento interattivo: `focus-visible:outline-2 focus-visible:outline-[--pndr-terracotta] outline-offset-2`. Mai rimuovere senza sostituto.
- Contrasto: rispettare la tabella in Color System. Nessun testo body sotto 4.5:1.
- Immagini: `alt` descrittivo (`Sala di {nome}` o `Piatto servito da {nome}`); immagini puramente decorative `alt=""`.
- Icone-azione (chiudi, modifica, elimina, logout): `aria-label` esplicito.
- Modali: `role="dialog"`, `aria-modal="true"`, `aria-labelledby`, focus trap, focus iniziale sul primo controllo / titolo, ripristino focus al trigger alla chiusura, `Esc` chiude, scroll del body bloccato.
- Filtro categorie: `role="tablist"` / pulsanti con `aria-pressed`.
- Rispettare `prefers-reduced-motion`.
- Target touch ≥ 48×48px; `type="button"` esplicito sui bottoni non-submit.
- Toast: `aria-live="polite"`, non rubano il focus, auto-dismiss 4s + pulsante chiudi.

---

## Components

Struttura in `src/components/` (un file per componente, presentazionali dove possibile):

| Componente | Responsabilità |
|---|---|
| `Header.jsx` | Logo PNDR + sottotitolo; compatto; ombra su scroll; **nessun link al backend** in pubblico; su `/backend` stato admin + Esci |
| `CategoryFilter.jsx` | Chip categorie scroll-x; `aria-pressed`; categoria attiva in verde; transizioni di stato + `.press` |
| `RestaurantCard.jsx` | Posizione, foto (lazy, aspect-ratio), nome, città (prov), badge categoria, rating overall; intera card cliccabile (`<button>` wrapper o `role=button` + key handler) |
| `RestaurantList.jsx` | Griglia responsive di card; gestisce empty/no-results |
| `ShrimpRating.jsx` | Rating in **Gamberi Mosci** (0–10, 5 gamberi × 2 pt): riempimento continuo via `clip-path` su `public/shrimp.svg`; `role="img"` + `aria-label`. Math in `src/utils/ratingUtils.js`. (Ex `RatingStars.jsx`, rimosso.) |
| `RatingBreakdown.jsx` | Le 8 categorie (`RATING_CATEGORIES`) con valore numerico + barra proporzionale; usato nel dettaglio, non nella card |
| `RestaurantModal.jsx` | Dettaglio completo in modale responsive; sezione "Foto dei piatti" (solo se presenti) che apre il `Lightbox` |
| `Lightbox.jsx` | Visualizzazione ingrandita foto piatto: X / click esterno / ESC, prev-next + frecce, contatore, focus gestito |
| `Modal.jsx` | Base: portal, backdrop, focus trap, ESC, click esterno, blocco scroll, responsive sheet, enter/exit animati |
| `EmptyState.jsx` | Icona + messaggio (+ azione opzionale); tono caldo |
| `Toast.jsx` / `ToastContainer.jsx` | Feedback leggero, palette PNDR, icona + testo, auto-dismiss |
| `BackendLayout.jsx` | Cornice area admin (header, titolo sezione, azione "+ Nuovo locale") |
| `RestaurantForm.jsx` | Form create/update mobile-first; 8 rating + overall/rankingScore live; validazione; immagine principale (file/URL) + sezione "Foto dei piatti" (file multiplo, no URL) |
| `RestaurantListAdmin.jsx` | Tabella (`lg`) / card (mobile) con azioni Modifica / Elimina (≥48px) |
| `ConfirmDeleteModal.jsx` | Conferma eliminazione (Annulla / Elimina) |
| `ProtectedRoute.jsx` | Verifica la sessione lato server (`checkSession()`); `checking` → `guest` (login) \| `authed` (dashboard) |
| `Field.jsx` (helper) | Wrapper label + input + error, per DRY nei form |
| `Icon.jsx` | Set icone SVG inline unico (close, edit, trash, plus, chevron, upload, check, alert, logout, search — nessuna `star`: il rating usa `ShrimpRating`) |

Nessuna logica di business dentro `App.jsx`.

---

## Data Architecture

Modello `Restaurant` (sistema di valutazione multidimensionale a 8 categorie):

```json
{
  "id": "restaurant-001",
  "name": "La Vecchia Osteria",
  "category": "Trattoria",
  "town": "Firenze",
  "province": "FI",
  "ratings": {
    "location": 8.2,
    "menu": 8.6,
    "ingredients": 9.2,
    "food": 9.4,
    "presentation": 7.9,
    "service": 8.5,
    "price": 8.9,
    "experience": 9.0,
    "overall": 9.1
  },
  "rankingScore": 9.0875,
  "review": "Testo recensione, solo plain text.",
  "imageUrl": "https://... oppure data:image/jpeg;base64,..."
}
```

- `id`: stringa stabile. Nuovi id: `restaurant-<timestamp><rand>`. In update l'id **non cambia mai**.
- `ratings.<8 categorie>`: numero `0–10`, step `0.1`. Tutte obbligatorie, inserite dall'amministratore. `experience` è un voto autonomo, **non** la media delle altre.
- `ratings.overall`: **voto pubblico**, derivato dal `rankingScore` (`Math.round(rankingScore * 10) / 10`). Mai inserito a mano.
- `rankingScore`: valore tecnico interno ad alta precisione (≥ 4 decimali). Usato **solo** per ordinare la classifica; non mostrato nella homepage pubblica. Può comparire nel backend come informazione tecnica.
- Ricalcolati (overall + rankingScore) a ogni create/update e in modo difensivo alla lettura.
- `review`: testo semplice; normalizzato (trim, collasso spazi), reso con `{text}` in React (mai `dangerouslySetInnerHTML`).
- `imageUrl`: URL http(s) **oppure** data URL Base64. Può mancare → placeholder grafico.
- **Seed vuoto:** `src/data/restaurants.json` è `[]`. L'app parte senza locali di esempio; il
  contenuto lo inserisce l'amministratore. `restaurant-001` qui sopra è solo un esempio di forma.

### Rating System (tutta la matematica in `src/utils/ratings.js`)

Categorie (ordine e label UI): `location` (Location), `menu` (Menu), `ingredients` (Materie prime), `food` (Cibo), `presentation` (Presentazione), `service` (Servizio), `price` (Qualità / Prezzo), `experience` (Esperienza).

Pesi — costante unica `RATING_WEIGHTS` (somma 1):
`food .25 · ingredients .15 · experience .15 · menu .10 · service .10 · price .10 · location .075 · presentation .075`.

Funzioni separate e testabili:
- `calculateBaseScore(ratings)` — media ponderata.
- `calculateConsistencyAdjustment(ratings)` — su `spread = max − min` delle 8: `≤0.5 +0.15 · ≤1.0 +0.10 · ≤1.5 +0.05 · ≤2.0 0 · ≤3.0 −0.05 · ≤4.0 −0.10 · >4.0 −0.20`.
- `calculateCulinaryBonus(ratings)` — `culinaryScore = ingredients*.35 + food*.45 + menu*.20`; `≥9.5 → +0.25`, altrimenti `≥9.0 → +0.15` (solo il livello più alto).
- `calculateExcellenceBonus(ratings)` — `+0.03` per categoria `≥ 9.5`, massimo `+0.15`.
- `calculateLowRatingPenalty(ratings)` — per categoria, solo la fascia più bassa: `<5.0 0.05 · <4.0 0.10 · <3.0 0.20`; totale massimo `0.40` (il ranking la sottrae).
- `calculateRankingScore(ratings)` — `clamp(0..10, base + consistency + culinary + excellence − lowPenalty)`.
- `calculateOverall(ratings)` — `round(rankingScore * 10) / 10`.
- `normalizeRatings(raw)` — normalizza/clampa le 8, gestisce i **dati legacy** (`{food,service,price}`) mappandoli in modo **deterministico** (nessun `Math.random`), calcola overall.
- `compareByRanking(a, b)` — ordinamento classifica deterministico: `rankingScore` desc; se `|Δ| < 0.01` catena di tie-break `food → ingredients → experience → service → price → nome (it)`.

Principio: **complesso internamente, semplice esternamente**. L'utente vede solo `★ overall`.
Nota su `calculateConsistencyAdjustment`: un profilo perfettamente omogeneo riceve il bonus massimo di coerenza previsto (`+0.15`); es. tutte le categorie a 8.5 → rankingScore 8.65 → overall 8.7.

**Fonte dati unica:** hook/contesto `useRestaurants()`. Home e Backend leggono e scrivono la **stessa** collezione. Vietate liste separate.

Categorie: fonte unica in `src/config/categories.js` (`CATEGORIES` + costante `ALL = "Tutti"`). Nessun componente hardcoda la lista o la logica di filtro.

---

## localStorage Architecture

- Chiave dati: `pndr_restaurants`.
- La **sessione admin NON è in localStorage**: è un cookie HttpOnly gestito lato server (vedi *Authentication & Security*).

Bootstrap all'avvio (`src/utils/storage.js`):

1. Leggi `localStorage["pndr_restaurants"]`.
2. `JSON.parse` in `try/catch`. Se errore o non-array o array con record non validi → dati assenti.
3. Se dati validi → usali.
4. Se assenti → importa `src/data/restaurants.json` (**seed vuoto `[]`** — l'app parte pulita, senza placeholder), normalizza, **salva** in `localStorage`, usa quello.

Ciclo di scrittura per ogni CREATE / UPDATE / DELETE:

```
React state  →  localStorage (JSON.stringify)  →  UI
```

- Il refresh non deve mai cancellare i dati.
- `saveRestaurants()` in `try/catch`: su `QuotaExceededError` non aggiorna lo stato e propaga un errore gestibile (toast: `Non è stato possibile salvare. L'immagine potrebbe essere troppo grande.`).
- Gestione dati corrotti: record non validi vengono scartati in lettura; se l'intero blob è illeggibile si ricade sul seed.
- **Sync fra tab:** `window.addEventListener("storage", ...)` sulla chiave `pndr_restaurants` → ricarica lo stato dal nuovo valore.

---

## Authentication & Security

L'autenticazione dell'area riservata è **verificata lato server** tramite Vercel Functions.
La UI React è solo il client: non conosce la password, non decide da sola se un utente è
autenticato, non autorizza le operazioni amministrative.

### Credenziali — solo Environment Variables
- Variabili **server-side**: `ADMIN_USERNAME`, `ADMIN_PASSWORD`.
  - Produzione: Vercel → Project Settings → Environment Variables.
  - Sviluppo: `.env.local` (git-ignored).
- **Vietato**: `VITE_ADMIN_*` (finirebbero nel bundle client), credenziali hardcoded nel
  frontend o in file versionati, valori reali in `.env.example` / README / commenti, `.htaccess`.
- `.env.example` contiene **solo** `ADMIN_USERNAME=` e `ADMIN_PASSWORD=` (senza valori).
- Le credenziali non vengono **mai** loggate.
- Chiave di firma della sessione: derivata da `AUTH_SECRET` se presente, altrimenti da
  `ADMIN_USERNAME` + `ADMIN_PASSWORD` (nessun valore in chiaro nel repo).

### API server-side (`api/`, Vercel Functions — nessun Express, nessuna dipendenza)
| Endpoint | Metodo | Comportamento |
|---|---|---|
| `/api/auth/login` | POST | confronta `{username,password}` con `process.env.ADMIN_*` (a tempo costante). OK → `Set-Cookie` sessione + `{ ok: true }`. KO → `401 { error: "Username o password non corretti." }` (non rivela quale campo) |
| `/api/auth/session` | GET | `{ authenticated: boolean }` — fonte autorevole per il frontend |
| `/api/auth/logout` | POST | rimuove il cookie di sessione, `{ ok: true }` |
| `/api/restaurants` | POST/PUT/PATCH/DELETE | **gate di autorizzazione** per CREATE/UPDATE/DELETE: senza sessione valida → `401`. Non persiste nulla (i dati restano in localStorage) |

Logica condivisa in `lib/session.js` (server-only, mai nel bundle): `checkCredentials`,
`createSessionToken` / `verifySessionToken` (HMAC-SHA256, `node:crypto`), helper cookie.

### Sessione
- Token opaco firmato (payload base64url + HMAC), con `exp` (8h) e `nonce` casuale → valore imprevedibile.
- Cookie `pndr_session`: `HttpOnly`, `SameSite=Lax`, `Secure` in produzione, `Max-Age` limitato,
  `Path=/`. **Non leggibile da `document.cookie`.**
- Nessun dato di sessione in `localStorage` / `sessionStorage` / React state persistente / URL.

### Frontend (`src/utils/auth.js` — nessuna credenziale)
- `login(u,p)` → `POST /api/auth/login`, ritorna `{ ok, error }`.
- `logout()` → `POST /api/auth/logout`.
- `checkSession()` → `GET /api/auth/session` → boolean.
- `authorizeAdminAction(method)` → chiama `/api/restaurants`; lancia su `401`/errore.
- `ProtectedRoute`: al mount fa `checkSession()` (stato `checking` → `authed` | `guest`);
  `guest` → `<Login>`, `authed` → dashboard. Lo stato React locale è solo UX; l'autorità è il server.
- `RestaurantsContext`: `addRestaurant` / `updateRestaurant` / `deleteRestaurant` sono `async`
  e fanno `await authorizeAdminAction(...)` **prima** di scrivere in localStorage. Su `401` la
  scrittura non avviene e l'errore risale al form / toast.

### Comportamento
- `/backend` senza sessione → schermata di **login**. Dopo login → dashboard. Dopo logout → login.
- Refresh: la sessione persiste (cookie), la dashboard resta accessibile finché il cookie è valido.
- Errore login: sempre `Username o password non corretti.`
- **Nessuna dichiarazione di "sicurezza client-side"**: verifica credenziali, validazione
  sessione e autorizzazione delle operazioni admin avvengono lato server.

### Sviluppo locale
`npm run dev` esegue le funzioni `api/` tramite un plugin Vite dedicato in `vite.config.js`
(`configureServer`), leggendo `ADMIN_*` da `.env.local` in `process.env` (mai nel client).
In alternativa `vercel dev`.

---

## CRUD Requirements

Tutto nell'area `/backend`, dopo login.

- **CREATE:** pulsante `+ Nuovo locale` (fondo `--pndr-terracotta-deep`). Apre `RestaurantForm` vuoto. Al salvataggio: `addRestaurant(data)` → nuovo `id` → `overall` calcolato → state → localStorage → toast `Locale salvato`. Il nuovo locale entra subito nella classifica pubblica.
- **READ:** `RestaurantListAdmin` elenca tutte le recensioni (tabella da `lg`, card su mobile) con nome, città (prov), categoria, rating.
- **UPDATE (obbligatorio):** ogni elemento ha `Modifica`. Apre `RestaurantForm` **precompilato** con tutti i campi. Salvataggio → `updateRestaurant(id, data)` che **aggiorna il record esistente** (stesso `id`, nessun duplicato) → `overall` ricalcolato → state → localStorage → UI → toast `Recensione aggiornata`.
- **DELETE (obbligatorio):** ogni elemento ha `Elimina`. Il primo click **non** elimina: apre `ConfirmDeleteModal` (`Eliminare questa recensione?` / `La recensione verrà rimossa definitivamente.` / `Annulla` · `Elimina`). Alla conferma → `deleteRestaurant(id)` → state → localStorage → UI → toast `Recensione eliminata`.

Hook `useRestaurants()` espone almeno: `restaurants`, `addRestaurant`, `updateRestaurant`, `deleteRestaurant`. Implementato come Context Provider a livello di app perché Home e Backend condividano **una sola istanza** della collezione.

Nel form gli 8 voti si ricalcolano **in tempo reale** in `overall` (`Voto complessivo ★ X.X`, colore `--pndr-rating`) e in `rankingScore` (`Punteggio classifica X.XXXX`, informazione tecnica visibile solo nel backend). La classifica (Home e lista admin) è ordinata con `compareByRanking`, mai su `overall` arrotondato.

---

## Image Upload

- Campo `<input type="file" accept="image/*">` + **alternativa** `<input type="url">` per URL immagine.
- Upload da file: `FileReader` → `readAsDataURL` → `<img>` in memoria → ridimensiona con `<canvas>`:
  - larghezza massima ~**1200px**, mantieni aspect-ratio;
  - export `canvas.toDataURL("image/jpeg", 0.8)`;
  - salva la stringa in `imageUrl`.
- **Preview immediata** in entrambi i casi (file o URL).
- Durante l'elaborazione: pulsante di submit disabilitato + indicazione ("Elaborazione immagine…").
- Errori: file non immagine, immagine non caricabile, `QuotaExceededError` in salvataggio → messaggio caldo vicino al campo, nessun crash.
- Utility in `src/utils/image.js` (`resizeImageFile`, `resizeImageFiles`, `isValidImageUrl`).

---

## Dish Photo Gallery

Funzionalità **semplice**: una galleria di fotografie associate al ristorante. **Non** è un
sistema di gestione dei piatti.

- Nessun nome, descrizione, prezzo, categoria, badge o CRUD del singolo piatto.
- Modello dati: campo `dishImages: string[]` sul ristorante (array di data URL Base64).
  Ristoranti senza il campo → `dishImages: []` (fallback in `normalizeRestaurant`).
- Frontend: nel dettaglio (`RestaurantModal`) sezione **"Foto dei piatti"** mostrata **solo se**
  ci sono immagini (griglia 2 col mobile / 3 col da `sm`, `aspect-square`, `object-cover`,
  radius coerente). Nessuna sezione vuota quando `dishImages` è vuoto.
- Click/tap su una miniatura → `Lightbox` responsive: immagine grande (`object-contain`,
  `max-h-[86dvh]`, nessun overflow su mobile), chiusura con X / click esterno / `Esc`,
  navigazione precedente/successiva con pulsanti e frecce `←`/`→`, contatore `n / tot`.
- La galleria è **solo fotografica**: nessun testo sovrapposto, nessun effetto 3D/glow/gradiente.

## Dish Image Upload

- Nel `RestaurantForm`, sezione **"Foto dei piatti"** con un solo controllo:
  `[+ Aggiungi foto]` → `<input type="file" accept="image/*" multiple>` (selezione multipla,
  nessun form per immagine).
- Elaborazione: `FileReader` + `readAsDataURL` → ridimensionamento `<canvas>` (larghezza max
  ~1200px, aspect-ratio invariato, JPEG qualità 0.8) via `resizeImageFiles`. I file non
  elaborabili vengono saltati con feedback (`role="alert"`), senza crash.
- Preview immediata come **miniature**; ogni miniatura ha un solo pulsante **Rimuovi** (X),
  nessuna modifica del singolo file.
- **Nessun campo URL** per le foto dei piatti (solo caricamento da dispositivo).
- Salvataggio: `dishImages[]` nel payload → `addRestaurant`/`updateRestaurant` →
  React state → `localStorage` → UI. La modifica aggiorna il ristorante esistente (stesso
  `id`), nessun duplicato. Durante il salvataggio il submit è disabilitato ("Salvataggio…"),
  poi toast `Locale salvato` / `Recensione aggiornata`. `QuotaExceededError` gestito come per
  l'immagine principale (form aperto + messaggio).

## Image Gallery UX

- Miniature: `border`, `rounded-xl`, `aspect-square`, crop controllato, hover desktop
  `group-hover:scale-[1.04]` (transizione 300ms), feedback touch via `.press`.
- Reveal leggero all'inserimento (`reveal-in`).
- Lightbox: fade del backdrop (`opacity` 200ms), `reveal-in` sull'immagine a ogni cambio
  indice, superfici `--pndr-cream-soft`, testo `--pndr-brown`. Focus iniziale sul pulsante
  chiudi, ripristino al trigger, scroll di fondo bloccato.
- Responsive verificato a 360 / 375 / 390 / 412 / 430 px + tablet + desktop: nessun overflow
  orizzontale, controlli ≥ 44px.

---

## Routing

`react-router-dom` (`createBrowserRouter` o `<BrowserRouter>`).

| Path | Pagina | Accesso |
|---|---|---|
| `/` | `Home` | pubblico |
| `/backend` | `Backend` (login se non autenticato, altrimenti dashboard) | riservato |
| `*` | redirect a `/` | — |

- Deep-link diretti a `/backend` funzionano (mostrano login se necessario).
- SPA fallback per Vercel: `vercel.json` con rewrite a `/index.html` **escluso `/api/*`**
  (`"source": "/((?!api/).*)"`), così le serverless function in `api/` restano raggiungibili.
- `/api/auth/login` · `/api/auth/session` · `/api/auth/logout` · `/api/restaurants` (vedi *Authentication & Security*).

---

## Homepage

Route `/`, pubblica. Struttura verticale:

```
Header
↓
CategoryFilter (scroll-x)
↓
Titolo "Classifica" + conteggio locali
↓
RestaurantList (card ordinate per overall DESC, con posizione)
```

- Cambio categoria: immediato, nessun reload, ri-filtra e **ri-ordina** con `compareByRanking`.
- Ordinamento sempre per `rankingScore` decrescente (non `overall`, che è arrotondato); posizioni calcolate (`#1, #2, …`), mai hardcoded. Tie-break deterministico: `rankingScore → food → ingredients → experience → service → price → nome (it)`.
- Empty: `Non sono ancora presenti locali recensiti.`
- No-results (categoria senza locali): `Nessun locale trovato per questa categoria.`

---

## Header

- Mostra `PNDR` (Fraunces, terracotta) e `Recensioni per gente non da ristorante` (Karla, `--pndr-brown-soft`).
- Mostra `public/logo.svg` (logo ufficiale) come `<img>` con `alt="PNDR — Recensioni per gente non da ristorante"`, altezza `h-10 sm:h-11`, `w-auto`; su mobile resta **compatto**, non un header alto.
- Fondo `--pndr-cream` o `--pndr-cream-soft`, bordo inferiore `--pndr-border`, eventuale dettaglio `--pndr-green` (ramo/segno) ma **mai header interamente verde**.
- Sticky in cima con ombra che si rinforza in modo **molto discreto** durante lo scroll
  (`transition-shadow`, nessun cambio di altezza → niente layout shift).
- **Nessun collegamento al backend nell'interfaccia pubblica** (niente link "Area riservata",
  "Login", "Admin", "Dashboard"). L'area riservata si raggiunge solo digitando `/backend`.
- Nel backend: a destra, stato "Area riservata" + pulsante `Esci` (≥44px, `aria-label="Esci dall'area riservata"`).

---

## Backend

- Route `/backend`. `ProtectedRoute` verifica la sessione lato server (`checkSession()`):
  stato `checking` (breve messaggio "Verifica dell'accesso in corso…") → `guest` (login) | `authed` (dashboard).
- Dopo login: dashboard con stessa identità visiva della homepage (palette PNDR, Fraunces/Karla). **Non** una dashboard SaaS fredda.
- Contenuto: intestazione sezione ("Recensioni"), pulsante `+ Nuovo locale`, `RestaurantListAdmin`.
- Empty: `Non sono ancora presenti recensioni.`
- Logout: `POST /api/auth/logout` → stato `guest` → login (nessuna sessione residua).

### Login screen
- Campi `Username` e `Password` con label visibili, `autocomplete` corretti, `type="password"` con toggle mostra/nascondi (`aria-label`).
- Submit **asincrono** (`await login()` → `POST /api/auth/login`): `busy` durante la chiamata,
  poi errore inline `Username o password non corretti.` (`role="alert"`), senza indicare quale campo.
- Nessun accenno alle credenziali reali; nessun confronto di credenziali nel frontend.
- Layout centrato, card `.surface`, coerente con il brand.

---

## Form Validation

Validare in JS (non solo vincoli HTML), su `blur` e su submit; errore vicino al campo con `role="alert"` e `aria-describedby`.

| Campo | Regola |
|---|---|
| Nome | obbligatorio, trim, ≥ 2 caratteri |
| Categoria | obbligatoria, deve appartenere a `CATEGORIES` |
| Città | obbligatoria, ≥ 2 caratteri |
| Provincia | obbligatoria, 2 lettere, normalizzata in maiuscolo (`[A-Za-z]{2}`) |
| 8 categorie di rating | tutte obbligatorie e compilate; numero finito, `≥ 0` e `≤ 10`, precisione 0.1; rifiutare `NaN`, `Infinity`, stringhe non numeriche, negativi, `> 10` |
| Recensione | obbligatoria, ≥ 20 caratteri, testo semplice |
| Immagine principale | opzionale; se URL, deve essere `http(s)://…`; se file, deve essere immagine |
| Foto dei piatti | opzionali; solo caricamento da file (multiplo), nessun URL; i file non elaborabili vengono saltati con avviso |

- Overall e rankingScore: **non** sono campi editabili; sono mostrati calcolati in tempo reale.
- Al submit con errori: focus al primo campo non valido (o a un riepilogo se più errori), nessuna scrittura su storage.
- Messaggi in tono caldo e specifici (causa + come correggere), es. `Inserisci la città del locale.`, `Il voto del cibo deve essere tra 0 e 10.`

---

## Responsive Behavior

- **Mobile (≤ sm):** 1 colonna; filtro scroll-x; azioni admin come card; modali quasi full-screen; CTA a piena larghezza.
- **Tablet (md):** griglia 2 colonne; form a 2 colonne per i campi rating; modali centrate con `max-width`.
- **Desktop (lg+):** griglia 3 colonne; backend come tabella; container `max-w-6xl` centrato.
- Identità cromatica invariata a ogni dimensione.
- Test obbligatorio a 360 / 375 / 390 / 412 / 430 px + tablet + 1280 / 1440 / 1920: nessun overflow orizzontale, target sempre ≥ 44px, testo mai < 16px nel body.
- Verificare in particolare: galleria foto, lightbox, upload multiplo, preview immagini, pulsanti, modali, card, form, categorie, toast.

---

## Animation System

Solo CSS/Tailwind, nessuna libreria. Animare **solo** `transform` e `opacity`; mai proprietà
che causano layout shift/reflow. Durate brevi (120–260ms). Definizioni in `src/index.css`.

| Elemento | Interazione |
|---|---|
| `.press` (utility) | `transition` su transform/colori/ombra + `:active` `scale(0.97)`; applicata a pulsanti, chip categoria, azioni riga, toggle, link logo |
| Card ristorante | hover desktop: `-translate-y-1` + ombra; `active` mobile: `scale(0.99)` immediato; `motion-reduce:transform-none` |
| Lista card | reveal progressivo al montaggio (`.reveal-up`, `animation-delay` a step di 45ms, cap 8 elementi) — homepage **non** lenta |
| Categorie | cambio stato attivo con transizione di colore/ombra (nessun salto brusco) |
| Modal | enter/exit simmetrici: backdrop `opacity`, dialog `opacity` + `translate-y` (+ `scale` da `md`); ~200ms; resta montata durante l'uscita |
| Toast | entrata `fade + slide + scale` (`pndr-toast-in`); uscita in due fasi (`leaving` → `pndr-toast-out` → rimozione) |
| Galleria / miniature | `.reveal-in`; hover desktop `scale(1.04)` sull'immagine; feedback touch via `.press` |
| Lightbox | fade del backdrop; `.reveal-in` sull'immagine a ogni cambio indice |
| Header | ombra che si rinforza durante lo scroll (`transition-shadow`), altezza invariata |
| Form | focus visibile (`:focus-visible` globale), bordo campo in errore, transizioni di colore su input/select/textarea |

## Motion Guidelines

- Sensazione PNDR: **morbida, calda, naturale, fluida, editoriale**. Mai futuristica,
  tecnologica, gaming, neon, giocosa. Niente animazioni spettacolari fini a sé stesse.
- Max 1–2 elementi animati per vista; niente scroll-jacking, niente blocco dello scroll,
  niente animazione di ogni singolo elemento.
- Curve preferite: `cubic-bezier(0.2, 0.7, 0.2, 1)` (ingresso), `ease-in` (uscita, più rapida).
- Ogni animazione deve esprimere una relazione causa→effetto o dare feedback; niente decorazione pura.

## Reduced Motion

`@media (prefers-reduced-motion: reduce)` in `src/index.css` azzera (≈0ms) durate e ritardi di
animazioni e transizioni, annulla `animation-delay` e il `:active scale` di `.press`.
Le animazioni di reveal usano `animation-fill-mode: both` → lo stato finale (contenuto visibile)
resta comunque applicato. Il feedback funzionale (focus, stati di errore, toast) rimane.

## UI Audit Guidelines

Dopo modifiche significative, audit dell'intera UI (non solo delle parti nuove):
header, categorie, card, ranking, dettaglio, modal, pulsanti, form, input, select, rating,
toast, login, dashboard, CRUD, upload, immagini, empty states.
Per ognuno verificare: stato `default / hover / active / focus / disabled` quando applicabile,
presenza di micro-interazione coerente, feedback per azioni con attesa ("Salvataggio…" →
toast di conferma), nessun cambio di stato brusco, rispetto di `prefers-reduced-motion`,
palette invariata (nessun nuovo colore; mai `#2D4A3E` / `#6B8E23`).

---

## Error Handling

- `localStorage` illeggibile → fallback al seed, nessun crash; log discreto solo in dev.
- `QuotaExceededError` in salvataggio → toast errore + il form resta aperto con i dati.
- Immagine non caricabile (URL rotto) → `onError` sull'`<img>` mostra placeholder, non layout rotto.
- Record corrotti → scartati in lettura con normalizzazione.
- Route sconosciuta → redirect a `/`.
- Nessun `console.log` superfluo in produzione; nessun errore React in console al percorso felice.
- Errori sempre comunicati in tono caldo, mai tecnico verso l'utente finale.

---

## Vercel Deployment

- Build tool: Vite. Output `dist/`. Preset Vercel: **Vite**.
- Serverless functions: directory `api/` (rilevata automaticamente da Vercel, runtime Node).
  Nessun server Express, nessun `.htaccess`, nessun database, nessuna dipendenza aggiunta.
- `vercel.json` — il rewrite SPA **esclude `/api`** così le funzioni non vengono catturate:
  ```json
  { "rewrites": [{ "source": "/((?!api/).*)", "destination": "/index.html" }] }
  ```
- **Environment Variables da creare su Vercel** (Project Settings → Environment Variables):
  `ADMIN_USERNAME`, `ADMIN_PASSWORD`. Opzionale `AUTH_SECRET`. Nessun valore nel repo.
- Local dev: `.env.local` (git-ignored) con le stesse variabili; `npm run dev` esegue le
  funzioni `api/` via plugin Vite.
- Deve funzionare con: `npm install`, `npm run dev`, `npm run build`, `npm run preview`
  (`npm run preview` serve solo lo statico: l'auth completa richiede `npm run dev` o Vercel).
- Asset statici in `public/` (incluso `logo.svg`).
- Nessun riferimento a percorsi assoluti di filesystem locale.

---

## Code Quality

- Codice modulare, leggibile, DRY, facilmente estendibile.
- Niente logica di business in `App.jsx`.
- Nessun codice morto, nessun `console.log` inutile, nessun `TODO` bloccante.
- Un componente = un file; nomi chiari; funzioni pure dove possibile.
- Utility isolate: `storage.js`, `ratings.js`, `auth.js`, `image.js`.
- Categorie e palette: fonte unica (config + CSS variables / Tailwind theme).
- Props tipizzate via JSDoc dove aiuta; commenti solo dove il codice non è auto-esplicativo, con densità coerente al resto del file.
- Nessuna dipendenza superflua: solo React, React DOM, React Router DOM, Vite, Tailwind, PostCSS, Autoprefixer.
- `dangerouslySetInnerHTML` vietato.

---

## Development Workflow

1. **Analisi** ambiente e brief. ✔ (Vite + React + Tailwind, Windows, deploy Vercel)
2. **UI/UX Pro Max:** design system, tipografia, palette, regole (fatto; sintetizzato in questo file).
3. **AGENTS.md** completo (questo file) — riferimento per ogni step successivo.
4. **Design system:** token colore, tipografia, spacing, radius, shadow, breakpoint, pattern componenti (sezioni sopra + `src/index.css` + `tailwind.config.js`).
5. **Architettura:** componenti / pagine / hook-context / storage / auth / dati.
6. **Implementazione** completa dell'app.
7. **CRUD:** verifica reale CREATE / READ / UPDATE / DELETE con persistenza.
8. **Responsive:** verifica 360 / 375 / 390 / 412 / 430 + tablet + desktop.
9. **Build:** `npm run build`.
10. **Fix** di ogni errore.
11. **Final review** contro AGENTS.md, UI/UX Pro Max, palette, tono, requisiti funzionali, mobile-first, Vercel, accessibilità.

Regola: non considerare "completo" ciò che non è stato implementato **e** verificato.

---

## Final QA Checklist

**Homepage**
- [ ] `/` carica; header con nuova palette; sottotitolo corretto
- [ ] filtro categorie con scroll orizzontale e swipe; categoria attiva evidente (verde + peso); il ranking si ricalcola dopo il filtro
- [ ] classifica ordinata per `rankingScore` DESC con posizioni calcolate
- [ ] card: posizione, foto lazy, nome, città (prov), badge categoria, solo `★ overall`
- [ ] click card → dettaglio "La nostra valutazione": immagine, nome, categoria, città, prov, `★ overall` + breakdown 8 categorie + recensione
- [ ] QA algoritmo: A tutto 8.5 ≈ 8.7 · B cucina top vantaggio reale · C squilibrato non primo · D completo 9.0 competitivo · E due `overall` uguali ordinati per `rankingScore` · F ranking ricalcolato dopo il filtro
- [ ] dati legacy (`{food,service,price}`) migrati alle 8 categorie in modo deterministico e ri-salvati
- [ ] empty e no-results con i testi esatti, tono non ironico

**Backend**
- [ ] `/backend` mostra login se non autenticati
- [ ] login corretto → dashboard; errato → `Username o password non corretti.`
- [ ] sessione persiste al refresh; logout → login
- [ ] CREATE: `+ Nuovo locale`, form, salva, compare in classifica
- [ ] READ: lista admin completa (tabella lg / card mobile)
- [ ] UPDATE: `Modifica` precompila, salva senza duplicare, stesso `id`, toast `Recensione aggiornata`
- [ ] DELETE: `Elimina` → conferma → rimozione → toast `Recensione eliminata`
- [ ] upload immagine con preview + ridimensionamento; URL immagine alternativo con preview
- [ ] validazione su tutti i campi, errori vicino al campo
- [ ] nessun link pubblico al backend (header pubblico pulito); `/backend` raggiungibile solo via URL

**Authentication & Security (server-side)**
- [ ] `POST /api/auth/login` credenziali corrette → `200` + cookie `pndr_session` (HttpOnly)
- [ ] credenziali errate → `401 { error: "Username o password non corretti." }`
- [ ] `GET /api/auth/session` → `authenticated: true/false` coerente con il cookie
- [ ] refresh su `/backend` con cookie valido → resta in dashboard
- [ ] `POST /api/auth/logout` → cookie rimosso, `session` torna `false`, UI → login
- [ ] `POST/PUT/DELETE /api/restaurants` senza sessione → `401`; con sessione → `200`
- [ ] create/update/delete dal frontend: bloccati se `authorizeAdminAction` fallisce (401)
- [ ] `document.cookie` non contiene `pndr_session`
- [ ] `grep -r "ilevetruli\|Mipiacegnagna01" dist/` → nessun risultato; nessun `ADMIN_` nel bundle
- [ ] `.env` / `.env.local` git-ignored; `.env.example` versionato **senza valori**
- [ ] nessun `VITE_ADMIN_*`, nessun `.htaccess`, nessuna credenziale hardcoded nel frontend

**Foto dei piatti**
- [ ] upload di una foto e di più foto contemporaneamente (`multiple`), con preview a miniature
- [ ] rimozione di una miniatura (X); nessun URL per le foto dei piatti
- [ ] salvataggio → refresh → persistenza in `dishImages[]`; update senza duplicati (stesso `id`)
- [ ] frontend: sezione "Foto dei piatti" nel dettaglio solo se presenti; nessuna sezione vuota
- [ ] click miniatura → lightbox: foto grande, X, click esterno, ESC, prev/next, contatore; nessun overflow su mobile

**Persistence**
- [ ] primo avvio: nessun locale (seed `[]`), home ed empty state puliti
- [ ] create / update / delete persistono al refresh (in `localStorage`)
- [ ] dati corrotti gestiti senza crash; dati legacy migrati
- [ ] sync fra tab via evento `storage`

**Responsive**
- [ ] 360 / 375 / 390 / 412 / 430 px + tablet + 1280 / 1440 / 1920: nessun overflow orizzontale, target ≥ 44px
- [ ] tablet: griglia 2 col; desktop: griglia 3 col + tabella backend
- [ ] galleria, lightbox, upload multiplo, preview, modali, categorie, toast verificati a tutte le misure

**Motion / micro-interazioni**
- [ ] hover / active / focus / disabled sui pulsanti (`.press`); card hover+active
- [ ] cambio categoria fluido; modal enter/exit; toast enter/exit
- [ ] reveal progressivo delle card (breve); reveal galleria; lightbox fluido
- [ ] feedback form (focus, errore) e azioni con attesa ("Salvataggio…" → toast)
- [ ] `prefers-reduced-motion`: transizioni azzerate, contenuto sempre visibile, feedback funzionale intatto
- [ ] animazioni solo `transform`/`opacity`, nessun layout shift, nessuna libreria aggiunta

**PNDR Material**
- [ ] logo ufficiale `public/logo.svg` in header e login (+ favicon); nessuna ricostruzione manuale
- [ ] radius coerenti coi token (input 14, pulsanti 18, card 22, modali 28); niente angoli vivi, niente pillola ovunque
- [ ] ogni pulsante usa `btn btn-<variante>`; stati default/hover/active/focus/disabled completi; ripple discreto solo su `.btn`
- [ ] input/select/textarea via `controlClasses()` (`.field-control`): focus ring morbido terracotta, min 48px
- [ ] superfici con `.surface` / `cream-soft` + `shadow-sm` (ombre diffuse e leggere, mai nere)
- [ ] card ristorante: superficie + ombra leggera, hover elevazione, active compressione
- [ ] modali/toast/lightbox coerenti col nuovo linguaggio; galleria con zoom morbido
- [ ] palette PNDR invariata; logica/CRUD/ranking/routing/localStorage/auth invariati

**Design**
- [ ] Warm Cream dominante; Terracotta come brand; Fresh Green come accento; Warm Brown testo; Golden Orange rating
- [ ] nessun Forest Green `#2D4A3E` / Warm Olive `#6B8E23`
- [ ] nessuna estetica SaaS fredda / neon / gradiente aggressivo / glassmorphism / neumorphism / 3D
- [ ] contrasti AA rispettati; focus visibili; `prefers-reduced-motion` gestito
- [ ] icone SVG (nessuna emoji strutturale); un solo set

**Build**
- [ ] `npm run build` senza errori
- [ ] `npm run preview` serve l'app funzionante
- [ ] nessun errore React in console sul percorso felice

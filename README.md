# Gambero Moscio - Recensioni Locali

Piattaforma web per consultare le recensioni di **Ilenia** e **Salvatore** su locali e
ristoranti: homepage pubblica con filtro per categoria e classifica automatica, area
riservata con due account. Un locale si crea **una sola volta** e può contenere **fino a due
recensioni indipendenti** (una per recensore). I dati vivono in un **archivio centrale unico
su Vercel Blob**, condiviso fra tutti i dispositivi; autenticazione server-side su Vercel
Functions.

## Stack

- React 18 + Vite 5
- React Router DOM 6
- Tailwind CSS 3
- **Vercel Blob** (`@vercel/blob`) come archivio centrale dei contenuti — un solo documento
  `restaurants.json`, letto/scritto solo lato server
- Vercel Functions (`api/`) per l'autenticazione e l'accesso all'archivio — `node:crypto` +
  `@vercel/blob`, nessun database (niente Redis/KV/Supabase/Firebase/SQL…)

Unica dipendenza npm aggiunta: `@vercel/blob`.

## Requisiti

- Node.js 18+ (testato con Node 24)
- npm 9+

## Installazione

```bash
npm install
```

## Sviluppo

```bash
npm run dev
```

Server locale su `http://localhost:5173`.

## Build

```bash
npm run build
```

Output statico in `dist/`.

## Anteprima della build

```bash
npm run preview
```

## Deployment su Vercel

1. Push del repository su GitHub.
2. Su Vercel: **New Project** → importa il repository.
3. Impostazioni rilevate automaticamente:
   - Framework preset: **Vite**
   - Build command: `npm run build`
   - Output directory: `dist`
   - Serverless functions: cartella `api/` (rilevata automaticamente)
4. `vercel.json` è già incluso: reindirizza le route a `index.html` per il routing SPA,
   **escludendo `/api/*`** (che resta servito dalle serverless function).
5. **Storage → Blob**: su Vercel crea uno Store **Blob** e collegalo al progetto
   (*Storage → Create → Blob → Connect Project*). Vercel inietta automaticamente
   `BLOB_READ_WRITE_TOKEN` nelle Environment Variables del progetto (Production + Preview).
6. Configura le altre Environment Variables (vedi sotto).

## Configurazione Vercel — Environment Variables

Su Vercel → **Project Settings → Environment Variables**, crea le **password** dei due account
(`ilenia` e `salvatore`):

```text
ILENIA_PASSWORD
SALVATORE_PASSWORD
```

Inoltre serve il token dell'archivio Blob (di norma già iniettato da Vercel al passo 5):

```text
BLOB_READ_WRITE_TOKEN
```

(opzionale: `AUTH_SECRET`, chiave per firmare i cookie di sessione; se assente viene derivata
dalle due password).

- Gli **username** (`ilenia`, `salvatore`) non sono segreti: sono valori noti dell'app.
- Le **password** reali **non** sono nel repository: vanno inserite manualmente qui.
- **Non** usare il prefisso `VITE_`: quelle variabili finirebbero nel bundle e non sarebbero segrete.
- Per lo sviluppo locale crea un file `.env.local` (già in `.gitignore`) con le stesse chiavi:

  ```text
  ILENIA_PASSWORD=...
  SALVATORE_PASSWORD=...
  BLOB_READ_WRITE_TOKEN=...
  ```

  Il valore di `BLOB_READ_WRITE_TOKEN` si ottiene con `vercel env pull .env.local` (dopo aver
  collegato lo Store Blob) oppure copiandolo da *Vercel → Storage → il tuo Blob → .env.local*.
  `npm run dev` esegue le funzioni in `api/` e legge queste variabili **solo lato server**
  (mai nel bundle client).
- Nel repository è versionato solo `.env.example`, **senza valori**.

## Struttura del progetto

```
src/
├── components/        Componenti UI (Header, CategoryFilter, RestaurantCard, Modal, form, toast…)
├── pages/             Home, Login, Backend
├── context/           RestaurantsContext (fonte dati unica, sync con l'archivio), ToastContext
├── hooks/             useRestaurants (re-export del context)
├── utils/             api.js (client archivio + upload), model.js (modello dati puro),
│                      ratings.js, auth.js (client HTTP), image.js
├── config/            categories.js, users.js (i due recensori)
├── data/              restaurants.json (seed: usato solo se il blob non esiste ancora)
├── App.jsx            Routing
├── main.jsx           Bootstrap + Provider
└── index.css          Token colore, base tipografica, utility

api/                   Vercel Functions (server-side)
├── auth/login.js      POST — verifica password (process.env.ILENIA_/SALVATORE_PASSWORD), ritorna { user }
├── auth/session.js    GET  — stato sessione { authenticated, user }
├── auth/logout.js     POST — invalida la sessione
├── restaurants.js     GET pubblico + POST/PUT/DELETE (sessione) sull'archivio Blob
└── upload.js          POST (sessione) — carica un'immagine su Blob, ritorna { url }

lib/session.js         Firma/verifica token, helper cookie (server-only)
lib/blob-store.js      Archivio su Vercel Blob, un blob per locale (server-only)
```

Documento di riferimento del design e delle regole di progetto: [`CLAUDE.md`](./CLAUDE.md).

## Persistenza (Vercel Blob)

I dati **non** vivono nel browser. Stanno su Vercel Blob, condivisi da tutti i dispositivi:
Ilenia e Salvatore vedono gli stessi locali da qualsiasi browser.

- **Un blob per locale**: `places/<id>.json`. L'elenco dei locali si ottiene da
  `list('places/')`, che interroga l'API del Blob (non la CDN) ed è **coerente**: un locale
  appena creato compare subito e non può sparire senza un'eliminazione esplicita. Due
  creazioni in parallelo non sono una corsa (pathname diversi).
  Un piccolo `manifest.json` tiene un contatore `version`/`updatedAt` (solo indicativo).
- **Perché non un unico `restaurants.json`**: le URL pubbliche del Blob passano da una CDN
  con TTL ~60 s che ignora la query string. Con un documento unico sovrascritto, per ~60 s
  una lettura poteva restituire la copia precedente → chi creava un locale, ricaricando, non
  lo vedeva, e una modifica successiva poteva riscrivere sopra dati vecchi perdendo un
  locale. Con un blob per locale il problema sparisce.
- **Solo lato server**: `BLOB_READ_WRITE_TOKEN` è usato unicamente nelle funzioni `api/`
  (`lib/blob-store.js`), mai nel bundle client.
- **`/api/restaurants`**: `GET` pubblico ritorna `{ version, updatedAt, signature,
  restaurants }`; `POST` / `PUT` / `DELETE` (con sessione) modificano un singolo blob-locale.
- **Lettura fresca per le modifiche**: `head()` (API, non CDN) dà l'ETag corrente; il corpo
  si rilegge finché combacia. Scrittura con `ifMatch` sull'ETag: se un'altra scrittura è
  arrivata prima, si rilegge e si ritenta. Toccare la recensione di Ilenia non altera mai
  quella di Salvatore.
- **Sincronizzazione fra dispositivi**: il client fa polling ogni ~12 s e confronta la
  `signature` dell'elenco (derivata da `list()`); applica solo se è cambiata, senza reload;
  in pausa quando la scheda non è visibile. Una lettura di polling che si conclude durante
  una modifica appena fatta viene scartata.
- **Seed / migrazione**: `src/data/restaurants.json` (seed vuoto) viene usato solo se non
  esistono `places/*`. Alla prima esecuzione, se è presente un vecchio `restaurants.json`
  unico, i suoi locali vengono migrati **una tantum** in `places/<id>.json` senza perdita e
  senza toccare il documento legacy.
- I record corrotti vengono scartati in lettura; i dati nel vecchio formato piatto
  (`ratings`/`review` senza `reviews`) vengono migrati a `reviews.ilenia`.
- La sessione dell'area riservata resta un cookie HttpOnly gestito dal server
  (vedi *Autenticazione*).

Le immagini vengono caricate su Blob (`/api/upload`, cartelle `restaurants/` e `dishes/`) e
nei blob-locale si salvano **solo gli URL** (`imageUrl`, `dishImages`), mai il Base64.

## Autenticazione

L'area riservata (`/backend`) è protetta da un'autenticazione **verificata lato server**
tramite Vercel Functions.

- Due account: `ilenia` e `salvatore` (una coppia che recensisce insieme). Il frontend
  **non conosce le password**: invia le credenziali a `POST /api/auth/login`, che confronta
  la password con `process.env.ILENIA_PASSWORD` / `process.env.SALVATORE_PASSWORD`
  (Environment Variables di Vercel in produzione, `.env.local` in sviluppo). Le password non
  compaiono nel bundle né nei log; la sessione ricorda **quale** dei due è collegato.
- In caso di successo il server imposta un **cookie di sessione `HttpOnly`** (firmato
  HMAC-SHA256, `Secure` in produzione, `SameSite=Lax`, scadenza 8 h, valore imprevedibile).
  Il cookie non è leggibile da JavaScript.
- Il frontend interroga `GET /api/auth/session` per sapere se mostrare il Backend o il Login:
  la fonte autorevole è il server, non `localStorage`.
- `POST /api/auth/logout` invalida la sessione.
- Le operazioni sui contenuti (CREATE / UPDATE / DELETE, recensioni, upload immagini)
  passano da `/api/restaurants` e `/api/upload`, che rispondono `401` senza sessione valida:
  un utente non autenticato non può modificare l'archivio nemmeno chiamando direttamente le
  API. La sola `GET` di `/api/restaurants` è pubblica (serve la homepage).
- Quando si scrive una recensione, **l'utente è determinato dalla sessione**, non da un
  valore inviato dal client: ciascuno può modificare solo la propria recensione.
- Messaggio di errore login (non rivela quale campo è errato): `Username o password non corretti.`

## Locali e recensioni

Tutte le operazioni sono nell'area riservata, dopo il login. Un locale = dati condivisi
(nome, categoria, città, provincia, foto) + **fino a due recensioni indipendenti**.

- **+ Crea locale** — crea il locale **una sola volta** (solo dati condivisi e foto,
  nessuna recensione automatica). Entra in classifica solo quando ha almeno una recensione.
- **Scrivi recensione** — scegli un locale esistente e inserisci/modifica **la tua**
  recensione (8 voti + testo). Ilenia modifica solo la propria, Salvatore solo la propria;
  entrambi vedono quella dell'altro. Nessun duplicato del locale.
- **Modifica locale** / **Elimina** — dall'elenco: la modifica cambia solo i dati condivisi;
  l'eliminazione (con conferma) rimuove l'intero locale con entrambe le recensioni.
- Nel dettaglio pubblico, se sono presenti entrambe le recensioni compaiono due pill
  (`Recensione Ilenia` / `Recensione Salvatore`) per passare dall'una all'altra.
- Il voto pubblico del locale è l'**aggregato** (media) delle recensioni presenti.

### Sistema di valutazione

Ogni locale è valutato su **8 categorie indipendenti** (0.0–10.0, passo 0.1):
Location, Menu, Materie prime, Cibo, Presentazione, Servizio, Qualità/Prezzo, Esperienza.

Tutta la matematica è in [`src/utils/ratings.js`](src/utils/ratings.js):

- **`rankingScore`** (valore tecnico, ≥ 4 decimali) = media ponderata delle 8 categorie
  (`RATING_WEIGHTS`) + correttivo di coerenza + bonus di qualità gastronomica + bonus di
  eccellenza − penalità per i punti deboli, limitato a 0–10.
- **`overall`** (voto pubblico) = `rankingScore` arrotondato a una cifra decimale. È l'unico
  numero mostrato in homepage (`★ 8.7`).
- La **classifica** è ordinata sul `rankingScore` ad alta precisione (con catena di tie-break
  deterministica), non sull'`overall` arrotondato: due locali con lo stesso `★ 8.7` possono
  quindi avere posizioni diverse.
- `overall` e `rankingScore` non si inseriscono a mano: sono ricalcolati in tempo reale nel
  form a ogni modifica di uno degli 8 voti.
- I dati salvati nel vecchio formato (`food`/`service`/`price`) vengono migrati alle 8
  categorie in modo deterministico al caricamento e ri-salvati nel nuovo formato.

## Foto dei piatti

Ogni ristorante ha un campo `dishImages` (array di URL di immagini su Vercel Blob), gestito
come **semplice galleria** — nessun nome, descrizione, prezzo o CRUD del singolo piatto.

- Backend: nel form del ristorante, sezione "Foto dei piatti" → `[+ Aggiungi foto]` con
  `<input type="file" accept="image/*" multiple>` (selezione multipla). Miniature con pulsante
  di rimozione. Nessun campo URL per queste foto (solo caricamento da dispositivo).
- Le immagini sono ridimensionate lato client (max ~1200px), caricate su Vercel Blob
  (cartella `dishes/`) e nel documento si salva solo l'array di URL `dishImages`.
- Frontend: nel dettaglio del ristorante compare la sezione "Foto dei piatti" **solo se** ci
  sono immagini. Click su una foto → lightbox responsive (ingrandimento, chiusura con X /
  click esterno / ESC, navigazione precedente/successiva con pulsanti e frecce).
- I ristoranti salvati senza il campo ottengono `dishImages: []` alla normalizzazione.

## Linguaggio visivo — PNDR Material

L'interfaccia usa un linguaggio ispirato a Material Design **reinterpretato con la palette e
l'identità mediterranea di PNDR**: forme più arrotondate con gerarchia (input 14px, pulsanti
18px, card 22px, modali 28px), superfici con elevazione morbida e diffusa (mai ombre nere),
pulsanti con stati completi e feedback tattile discreto, focus ring morbido sui campi.
I token vivono in `tailwind.config.js` (radius, shadow) e le classi condivise in
`src/index.css` (`btn`/`btn-*`, `.surface`, `.field-control`). Palette, logica, CRUD,
ranking, routing e autenticazione **non sono cambiati**.

Il logo ufficiale è `public/logo.svg` (usato in header, login e come favicon).

## Micro-interazioni e motion

Animazioni leggere solo con CSS/Tailwind (nessuna libreria), basate su `transform`/`opacity`:
feedback tattile sui controlli (`.press`), hover/active sulle card, reveal progressivo della
lista, enter/exit di modali e toast, lightbox e galleria, ombra dell'header sullo scroll.
Tutto rispetta `prefers-reduced-motion` (transizioni azzerate, contenuto sempre visibile).
L'identità resta calda, mediterranea, editoriale — nessun effetto neon/3D/gradiente.

## Upload immagini

Nel form del locale si carica una foto dal dispositivo: viene ridimensionata via `<canvas>`
(larghezza massima ~1200px, aspetto invariato) ed esportata in JPEG, con anteprima immediata.
Al salvataggio l'immagine viene inviata a `/api/upload`, che la carica su Vercel Blob e
restituisce un URL pubblico; nel documento `restaurants.json` si salva **solo quell'URL**
(`imageUrl` per la foto del locale, `dishImages` per le foto dei piatti). Gli URL http già
presenti in fase di modifica restano invariati. Se un upload non riesce, l'operazione viene
annullata con un messaggio e il form resta compilato.

## Accessibilità

- Contrasti verificati (AA) sulle combinazioni della palette.
- Focus visibile su ogni elemento interattivo; target touch ≥ 48×48px.
- Label sempre associate ai campi; errori annunciati (`role="alert"`).
- Modali con `role="dialog"`, focus trap, chiusura con `Esc` e click esterno.
- `prefers-reduced-motion` rispettato.

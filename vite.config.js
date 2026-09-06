import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

/**
 * Plugin di sviluppo: esegue le Vercel Functions in `api/` durante `npm run dev`
 * (Vite da solo non le eseguirebbe). In produzione le stesse funzioni girano
 * come serverless functions di Vercel: nessun server Express, nessuna dipendenza.
 * Le variabili server-side (ADMIN_USERNAME/ADMIN_PASSWORD da `.env.local`)
 * vengono messe in `process.env` solo per il processo Node, mai nel bundle client.
 */
function devApiFunctions() {
  return {
    name: 'pndr-dev-api-functions',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (!req.url || !req.url.startsWith('/api/')) return next();

        handleApi(req, res).catch(() => {
          res.statusCode = 500;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ error: 'Errore interno del server di sviluppo.' }));
        });
      });

      async function handleApi(req, res) {
        const pathname = new URL(req.url, 'http://localhost').pathname;
        const rel = pathname.replace(/^\/api\//, '').replace(/\/+$/, '');
        const fileUrl = new URL(`./api/${rel}.js`, import.meta.url);

        let mod;
        try {
          mod = await import(`${fileUrl.href}?t=${Date.now()}`);
        } catch {
          res.statusCode = 404;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ error: 'Endpoint non trovato.' }));
          return;
        }

        const raw = await new Promise((resolve) => {
          let data = '';
          req.on('data', (chunk) => (data += chunk));
          req.on('end', () => resolve(data));
          req.on('error', () => resolve(''));
        });
        if (raw) {
          try {
            req.body = JSON.parse(raw);
          } catch {
            req.body = {};
          }
        }

        res.status = (code) => {
          res.statusCode = code;
          return res;
        };
        res.json = (obj) => {
          if (!res.getHeader('Content-Type')) res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify(obj));
          return res;
        };

        await mod.default(req, res);
      }
    },
  };
}

export default defineConfig(({ mode }) => {
  // Carica solo i segreti server-side da .env / .env.local (password account, AUTH_*)
  // e li mette in process.env per le funzioni /api eseguite in dev.
  // NON entrano nel bundle client: nessun `define`, nessun prefisso VITE_.
  const env = loadEnv(mode, process.cwd(), ['ILENIA_', 'SALVATORE_', 'AUTH_']);
  for (const [key, value] of Object.entries(env)) {
    if (process.env[key] === undefined) process.env[key] = value;
  }

  return {
    plugins: [react(), devApiFunctions()],
  };
});

/**
 * GET /api/place-photo?ref=<photoReference>   (preferito — salvato dal database)
 * GET /api/place-photo?name=...&city=...       (fallback: risolve il locale al volo)
 *
 * Proxy verso Google Places: se `GOOGLE_MAPS_API_KEY` è configurata restituisce la
 * prima foto ufficiale del locale. Senza chiave → `204` e la card usa il placeholder.
 *
 * Nessuno scraping: API ufficiale. La chiave resta lato server — vengono ritrasmessi
 * i byte dell'immagine, non un URL con la key.
 */
export default async function handler(req, res) {
  try {
    const key = process.env.GOOGLE_MAPS_API_KEY;
    if (!key) {
      res.statusCode = 204;
      return res.end();
    }

    let ref = String(req.query?.ref || '').trim();

    if (!ref) {
      const name = String(req.query?.name || '').trim();
      const city = String(req.query?.city || '').trim();
      if (name.length < 2) {
        res.statusCode = 400;
        return res.end();
      }
      const query = encodeURIComponent([name, city, 'Campania'].filter(Boolean).join(' '));
      const searchUrl = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${query}&region=it&language=it&key=${key}`;
      const search = await fetch(searchUrl).then((r) => r.json());
      ref = search?.results?.[0]?.photos?.[0]?.photo_reference || '';
    }

    if (!ref) {
      res.statusCode = 204;
      return res.end();
    }

    const photoUrl = `https://maps.googleapis.com/maps/api/place/photo?maxwidth=900&photo_reference=${encodeURIComponent(
      ref,
    )}&key=${key}`;
    const img = await fetch(photoUrl);
    if (!img.ok) {
      res.statusCode = 204;
      return res.end();
    }
    const buf = Buffer.from(await img.arrayBuffer());
    res.statusCode = 200;
    res.setHeader('Content-Type', img.headers.get('content-type') || 'image/jpeg');
    res.setHeader('Cache-Control', 'public, max-age=86400, s-maxage=604800');
    return res.end(buf);
  } catch {
    res.statusCode = 204;
    return res.end();
  }
}

// app/lib/discogs.ts
// Cliente minimo para la API publica de Discogs.
// Se usa para reemplazar/corregir la estimacion de precio de la IA con datos
// reales del mercado (cuantos hay a la venta y a que precio).
//
// Docs: https://www.discogs.com/developers

const DISCOGS_BASE = 'https://api.discogs.com';

// Discogs exige un User-Agent identificable en cada request.
const USER_AGENT = 'AmigosDeLoAjenoApp/1.0';

// Token personal (Settings > Developers > Generate new token en discogs.com).
// Sin token: 25 req/min y no se puede usar price_suggestions.
// Con token: 60 req/min y price_suggestions funciona (si la cuenta tiene
// configurados los "seller settings", aunque sea sin vender nada).
const DISCOGS_TOKEN = process.env.DISCOGS_TOKEN || '';

// Traduce el codigo de estado que usa la UI a la etiqueta exacta que espera Discogs.
const CONDITION_LABELS: Record<string, string> = {
  M: 'Mint (M)',
  NM: 'Near Mint (NM or M-)',
  'VG+': 'Very Good Plus (VG+)',
  VG: 'Very Good (VG)',
  'G+': 'Good Plus (G+)',
  G: 'Good (G)',
  F: 'Fair (F)',
  P: 'Poor (P)',
};

export interface DiscogsConditionSuggestion {
  label: string;
  value: number;
  currency: string;
}

export interface DiscogsMarketData {
  found: boolean;
  releaseId?: number;
  releaseTitle?: string;
  releaseUrl?: string;
  thumbnail?: string;
  year?: string;
  format?: string;
  numForSale?: number;
  lowestPriceUSD?: number;
  conditionSuggestion?: DiscogsConditionSuggestion;
  note?: string;
}

async function discogsFetch(path: string): Promise<any> {
  const separator = path.includes('?') ? '&' : '?';
  const url = `${DISCOGS_BASE}${path}${separator}${DISCOGS_TOKEN ? `token=${DISCOGS_TOKEN}` : ''}`;

  const res = await fetch(url, {
    headers: { 'User-Agent': USER_AGENT },
    cache: 'no-store',
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Discogs respondio ${res.status}: ${text.slice(0, 200)}`);
  }
  return res.json();
}

interface SearchParams {
  artist?: string;
  album?: string;
  catalogNumber?: string;
  year?: string;
}

async function runSearch(searchParams: URLSearchParams): Promise<any[]> {
  const data = await discogsFetch(`/database/search?${searchParams.toString()}`);
  return data?.results || [];
}

async function searchDiscogsRelease(params: SearchParams): Promise<any | null> {
  const { artist, album, catalogNumber, year } = params;
  if (!artist && !album) return null;

  const query = [artist, album].filter(Boolean).join(' ').trim();
  if (!query) return null;

  // Importante: NO mandamos catalogNumber como filtro "catno" a la API de busqueda.
  // Discogs lo matchea de forma bastante estricta, y la IA suele leer el numero
  // de catalogo con datos de mas (por ej. "6095 B" incluyendo el lado del disco,
  // cuando en Discogs figura solo como "6095"). Eso hacia que la busqueda diera
  // cero resultados aunque el disco si estuviera en el catalogo. Ahora el numero
  // de catalogo se usa solo despues, de forma local, para elegir el mejor match.
  let results = await runSearch(new URLSearchParams({ type: 'release', q: query, per_page: '20' }));

  // Fallback: si artista + album combinados no encontraron nada (nombre de
  // artista traducido/localizado, typo del modelo, etc.), probamos solo con
  // el nombre del album, que suele ser mas especifico y menos propenso a variar.
  if (results.length === 0 && album) {
    results = await runSearch(new URLSearchParams({ type: 'release', q: album, per_page: '20' }));
  }

  if (results.length === 0) {
    console.warn(`Discogs: sin resultados para "${query}" (ni para "${album}" solo)`);
    return null;
  }

  const normalize = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');
  // Sacamos una posible letra de lado al final (ej. "6095b" -> "6095") para
  // comparar de forma mas tolerante a lo que leyo la IA en la foto.
  const catnoRoot = catalogNumber ? normalize(catalogNumber).replace(/[a-z]$/, '') : null;

  const withCatno = catnoRoot
    ? results.find((r) => r.catno && normalize(r.catno).startsWith(catnoRoot))
    : null;
  const withYear = year ? results.find((r) => String(r.year) === String(year)) : null;

  return withCatno || withYear || results[0];
}

async function getMarketplaceStats(releaseId: number): Promise<{ lowestPriceUSD?: number; numForSale?: number }> {
  try {
    const data = await discogsFetch(`/marketplace/stats/${releaseId}?curr_abbr=USD`);
    return {
      lowestPriceUSD: typeof data?.lowest_price?.value === 'number' ? data.lowest_price.value : undefined,
      numForSale: typeof data?.num_for_sale === 'number' ? data.num_for_sale : undefined,
    };
  } catch (error) {
    console.warn('Discogs stats: no se pudieron obtener', error instanceof Error ? error.message : error);
    return {};
  }
}

async function getPriceSuggestion(releaseId: number, condition: string): Promise<DiscogsConditionSuggestion | null> {
  // Este endpoint requiere autenticacion de usuario (token), no key+secret.
  if (!DISCOGS_TOKEN) return null;
  try {
    const data = await discogsFetch(`/marketplace/price_suggestions/${releaseId}`);
    const label = CONDITION_LABELS[condition] || CONDITION_LABELS.VG;
    const entry = data?.[label];
    if (!entry || typeof entry.value !== 'number') return null;
    return { label, value: entry.value, currency: entry.currency || 'USD' };
  } catch (error) {
    // Motivo comun: la cuenta del token no completo "seller settings" en Discogs.
    // No es un error fatal para el resto del analisis, seguimos sin este dato.
    console.warn('Discogs price_suggestions: no disponible -', error instanceof Error ? error.message : error);
    return null;
  }
}

/**
 * Busca el disco en Discogs y devuelve datos reales de mercado
 * (precio minimo publicado, cantidad a la venta y, si hay token, una
 * sugerencia de precio para el estado de conservacion indicado).
 * Nunca tira: si algo falla, devuelve { found: false, note }.
 */
export async function getDiscogsMarketData(params: SearchParams & { condition: string }): Promise<DiscogsMarketData> {
  try {
    const release = await searchDiscogsRelease(params);
    if (!release) {
      return { found: false, note: 'No se encontro este disco en el catalogo de Discogs.' };
    }

    const releaseId: number = release.id;
    const [stats, suggestion] = await Promise.all([
      getMarketplaceStats(releaseId),
      getPriceSuggestion(releaseId, params.condition),
    ]);

    return {
      found: true,
      releaseId,
      releaseTitle: release.title,
      releaseUrl: `https://www.discogs.com${release.uri || `/release/${releaseId}`}`,
      thumbnail: release.thumb || undefined,
      year: release.year ? String(release.year) : undefined,
      format: Array.isArray(release.format) ? release.format.join(', ') : undefined,
      numForSale: stats.numForSale,
      lowestPriceUSD: stats.lowestPriceUSD,
      conditionSuggestion: suggestion || undefined,
    };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('Error consultando Discogs:', message);
    return { found: false, note: 'No se pudo consultar Discogs en este momento (¿limite de requests?).' };
  }
}

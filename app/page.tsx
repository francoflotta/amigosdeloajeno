'use client';

import { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import {
  Upload, Search, X, Disc3, Loader2, Circle, LogOut,
} from 'lucide-react';

interface DiscogsConditionSuggestion {
  label: string;
  value: number;
  currency: string;
}

interface DiscogsMarketData {
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

interface ViniloResult {
  identified: boolean;
  artist?: string;
  album?: string;
  year?: string;
  country?: string;
  label?: string;
  catalogNumber?: string;
  editionNotes?: string;
  rarityNote?: string;
  estimatedValueMin?: number;
  estimatedValueMax?: number;
  valueSource?: 'discogs' | 'ia';
  discogs?: DiscogsMarketData;
  confidenceLevel?: string;
  requestedPrice?: number;
  currency?: string;
  condition?: string;
}

interface FormData {
  price: string;
  currency: string;
  condition: string;
  extraInfo: string;
}

const CURRENCY_SYMBOL: Record<string, string> = { ARS: '$', USD: 'US$', EUR: '\u20ac' };

export default function Home() {
  const router = useRouter();
  const [photos, setPhotos] = useState<File[]>([]);
  const [previewUrls, setPreviewUrls] = useState<string[]>([]);
  const [formData, setFormData] = useState<FormData>({
    price: '', currency: 'ARS', condition: 'M', extraInfo: '',
  });
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ViniloResult | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const newFiles = Array.from(e.target.files).slice(0, 4);
      setPhotos((prev) => [...prev, ...newFiles]);
      const urls = newFiles.map((file) => URL.createObjectURL(file));
      setPreviewUrls((prev) => [...prev, ...urls]);
    }
  };

  const removeImage = (index: number) => {
    setPhotos((prev) => prev.filter((_, i) => i !== index));
    setPreviewUrls((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.price || photos.length === 0) return;

    setLoading(true);
    setResult(null);

    const data = new FormData();
    photos.forEach((file) => data.append('photos', file));
    data.append('price', formData.price);
    data.append('currency', formData.currency);
    data.append('condition', formData.condition);
    data.append('extraInfo', formData.extraInfo);

    try {
      const res = await fetch('/api/analyze', { method: 'POST', body: data });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Error en el análisis');
      setResult(json);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'No se pudo conectar al servidor.';
      alert(message);
    } finally {
      setLoading(false);
    }
  };

  const startOver = () => {
    setResult(null);
    setPhotos([]);
    setPreviewUrls([]);
    setFormData((prev) => ({
      price: '', currency: prev.currency, condition: 'M', extraInfo: '',
    }));
  };

  const getVerdict = () => {
    if (!result?.estimatedValueMax || !result.requestedPrice) return null;
    const ratio = result.requestedPrice / result.estimatedValueMax;

    if (ratio > 1.5) {
      return { text: 'AMIGO DE LO AJENO', tone: 'var(--stamp-red)' };
    }
    if (ratio > 1.0) {
      return { text: 'PRECIO AJUSTADO', tone: 'var(--stamp-amber)' };
    }
    return { text: 'VALE LA PENA', tone: 'var(--stamp-green)' };
  };

  const verdict = getVerdict();
  const symbol = CURRENCY_SYMBOL[formData.currency] ?? '$';

  const handleLogout = async () => {
    await fetch('/api/logout', { method: 'POST' });
    router.replace('/login');
    router.refresh();
  };

  return (
    <main className="min-h-screen flex items-start sm:items-center justify-center p-4 sm:p-8">
      <motion.div
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: 'easeOut' }}
        className="w-full max-w-md relative"
      >
        <div className="paper-grain rounded-sm shadow-[0_20px_50px_rgba(0,0,0,0.45)] px-7 py-8 sm:px-9 sm:py-10">
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-3">
              <Disc3 className="w-7 h-7 shrink-0" style={{ color: 'var(--ink)' }} />
              <h1
                className="text-[26px] leading-tight"
                style={{ fontFamily: 'var(--font-display)', fontWeight: 700, color: 'var(--ink)' }}
              >
                Amigos de lo Ajeno
              </h1>
            </div>
            <button
              type="button"
              onClick={handleLogout}
              aria-label="Cerrar sesion"
              className="p-1.5 shrink-0 opacity-70 hover:opacity-100 transition-opacity"
              style={{ color: 'var(--ink-soft)' }}
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
          <p className="text-sm mb-7" style={{ color: 'var(--ink-soft)' }}>
            Tasador de vinilos de feria: subi las fotos y fijate si el precio pedido vale la pena.
          </p>

          {!result ? (
            <form onSubmit={handleSubmit} className="space-y-7">
              <div>
                <label className="block text-xs mb-2" style={{ color: 'var(--ink-soft)' }}>
                  Fotos del disco (portada, contratapa, etiquetas)
                </label>

                {previewUrls.length > 0 ? (
                  <div className="flex gap-2 flex-wrap mb-1">
                    {previewUrls.map((url, idx) => (
                      <div key={idx} className="relative w-[72px] h-[72px] overflow-hidden group" style={{ border: '1.5px solid var(--line)' }}>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={url} alt="Foto del vinilo" className="w-full h-full object-cover" />
                        <button
                          type="button"
                          onClick={() => removeImage(idx)}
                          aria-label="Quitar foto"
                          className="absolute top-0 right-0 p-0.5"
                          style={{ background: 'var(--vinyl)', color: 'var(--paper)' }}
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                    {previewUrls.length < 4 && (
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="w-[72px] h-[72px] flex items-center justify-center"
                        style={{ border: '1.5px dashed var(--line)', color: 'var(--ink-soft)' }}
                      >
                        <Upload className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                ) : (
                  <div
                    onClick={() => fileInputRef.current?.click()}
                    className="p-7 text-center cursor-pointer transition-colors hover:bg-black/[0.02]"
                    style={{ border: '1.5px dashed var(--line)' }}
                  >
                    <Upload className="w-6 h-6 mx-auto mb-2" style={{ color: 'var(--ink-soft)' }} />
                    <p className="text-sm" style={{ color: 'var(--ink-soft)' }}>Elegi hasta 4 fotos</p>
                  </div>
                )}
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileChange}
                  accept="image/*"
                  multiple
                  className="hidden"
                />
              </div>

              <div className="grid grid-cols-2 gap-5">
                <div>
                  <label className="block text-xs mb-1.5" style={{ color: 'var(--ink-soft)' }}>Precio pedido</label>
                  <div className="flex items-baseline gap-1">
                    <span className="text-sm" style={{ color: 'var(--ink-soft)', fontFamily: 'var(--font-data)' }}>{symbol}</span>
                    <input
                      type="number"
                      value={formData.price}
                      onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                      className="field-line w-full py-1.5 text-[15px]"
                      placeholder="0"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs mb-1.5" style={{ color: 'var(--ink-soft)' }}>Moneda</label>
                  <select
                    value={formData.currency}
                    onChange={(e) => setFormData({ ...formData, currency: e.target.value })}
                    className="field-line w-full py-1.5 text-[15px]"
                  >
                    <option value="ARS">ARS &mdash; pesos</option>
                    <option value="USD">USD &mdash; dolares</option>
                    <option value="EUR">EUR &mdash; euros</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs mb-1.5" style={{ color: 'var(--ink-soft)' }}>Estado del disco</label>
                <select
                  value={formData.condition}
                  onChange={(e) => setFormData({ ...formData, condition: e.target.value })}
                  className="field-line w-full py-1.5 text-[15px]"
                >
                  <option value="M">Mint (M) &mdash; como nuevo</option>
                  <option value="NM">Near Mint (NM)</option>
                  <option value="VG+">Very Good + (VG+)</option>
                  <option value="VG">Very Good (VG)</option>
                  <option value="G+">Good + (G+)</option>
                  <option value="G">Good (G)</option>
                  <option value="F">Fair (F)</option>
                  <option value="P">Poor (P)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs mb-1.5" style={{ color: 'var(--ink-soft)' }}>
                  Info adicional para la IA (opcional)
                </label>
                <textarea
                  value={formData.extraInfo}
                  onChange={(e) => setFormData({ ...formData, extraInfo: e.target.value })}
                  rows={3}
                  placeholder="Ej: dice 'Made in Argentina' en la etiqueta, el vendedor dijo que es de 1978, tiene un sticker de una radio..."
                  className="field-line w-full py-1.5 text-[13px] resize-none"
                  style={{ fontFamily: 'var(--font-body)' }}
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3.5 flex items-center justify-center gap-2 text-[15px] font-medium transition-transform active:scale-[0.98] disabled:opacity-60"
                style={{ background: 'var(--mustard)', color: 'var(--mustard-ink)' }}
              >
                {loading ? (
                  <>Analizando <Loader2 className="w-4 h-4 animate-spin" /></>
                ) : (
                  <>Tasar disco <Search className="w-4 h-4" /></>
                )}
              </button>
            </form>
          ) : (
            <div>
              {!result.identified ? (
                <div className="py-10 text-center text-sm" style={{ color: 'var(--ink-soft)' }}>
                  No pude identificar este disco. Subi fotos mas claras de las etiquetas y el sello.
                </div>
              ) : (
                <>
                  {verdict && (
                    <div className="flex justify-center py-4 mb-2">
                      <div
                        className="stamp-anim px-5 py-2.5"
                        style={{
                          border: '3px solid ' + verdict.tone,
                          color: verdict.tone,
                          fontFamily: 'var(--font-data)',
                          fontWeight: 500,
                          letterSpacing: '0.06em',
                          fontSize: '15px',
                          mixBlendMode: 'multiply',
                        }}
                      >
                        {verdict.text}
                      </div>
                    </div>
                  )}

                  <p className="text-center text-sm mb-1" style={{ color: 'var(--ink-soft)' }}>
                    {'Pedido ' + symbol + (result.requestedPrice?.toLocaleString('es-AR') ?? '')
                      + ' \u00b7 estimado ' + symbol
                      + (result.estimatedValueMin?.toLocaleString('es-AR') ?? '') + '\u2013'
                      + (result.estimatedValueMax?.toLocaleString('es-AR') ?? '')}
                  </p>
                  <p className="text-center text-[11px] mb-6" style={{ color: 'var(--ink-soft)', opacity: 0.75 }}>
                    {result.valueSource === 'discogs'
                      ? 'Basado en precio sugerido de Discogs para el estado indicado'
                      : 'Estimacion de la IA'}
                  </p>

                  <div className="ticket-notch pt-6 grid grid-cols-2 gap-x-4 gap-y-4 text-[13px]">
                    <div>
                      <span className="block text-xs mb-0.5" style={{ color: 'var(--ink-soft)' }}>Artista</span>
                      <span style={{ fontFamily: 'var(--font-data)' }}>{result.artist || '\u2014'}</span>
                    </div>
                    <div>
                      <span className="block text-xs mb-0.5" style={{ color: 'var(--ink-soft)' }}>Album</span>
                      <span style={{ fontFamily: 'var(--font-data)' }}>{result.album || '\u2014'}</span>
                    </div>
                    <div>
                      <span className="block text-xs mb-0.5" style={{ color: 'var(--ink-soft)' }}>Ano / pais</span>
                      <span style={{ fontFamily: 'var(--font-data)' }}>{(result.year || '\u2014') + ' \u00b7 ' + (result.country || '\u2014')}</span>
                    </div>
                    <div>
                      <span className="block text-xs mb-0.5" style={{ color: 'var(--ink-soft)' }}>Sello / catalogo</span>
                      <span style={{ fontFamily: 'var(--font-data)' }}>{(result.label || '\u2014') + (result.catalogNumber ? ' \u00b7 ' + result.catalogNumber : '')}</span>
                    </div>
                  </div>

                  {result.editionNotes && (
                    <p className="mt-5 pt-5 text-[13px]" style={{ borderTop: '1px solid var(--line)', color: 'var(--ink)' }}>
                      {result.editionNotes}
                    </p>
                  )}

                  {result.rarityNote && (
                    <p
                      className="mt-3 text-[12px] italic"
                      style={{ color: 'var(--stamp-amber)', transform: 'rotate(-1deg)' }}
                    >
                      {'Nota de rareza: ' + result.rarityNote}
                    </p>
                  )}

                  <div className="mt-5 pt-5 text-[13px]" style={{ borderTop: '1px solid var(--line)' }}>
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-xs" style={{ color: 'var(--ink-soft)' }}>Mercado en Discogs</span>
                      {result.discogs?.found && result.discogs.releaseUrl && (
                        <a
                          href={result.discogs.releaseUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="text-xs underline"
                          style={{ color: 'var(--ink-soft)' }}
                        >
                          Ver ficha
                        </a>
                      )}
                    </div>

                    {result.discogs?.found ? (
                      <div style={{ fontFamily: 'var(--font-data)' }}>
                        <p>
                          {(result.discogs.numForSale ?? 0) + ' copias a la venta'}
                          {typeof result.discogs.lowestPriceUSD === 'number'
                            && ' \u00b7 desde US$' + result.discogs.lowestPriceUSD.toFixed(2)}
                        </p>
                        {typeof result.discogs.lowestPriceUSD === 'number' && (
                          <p className="mt-0.5 italic" style={{ color: 'var(--ink-soft)', opacity: 0.8 }}>
                            {'(el listado mas barato del mundo, sin envio; no es un precio de referencia)'}
                          </p>
                        )}
                        {result.discogs.conditionSuggestion && (
                          <p className="mt-0.5" style={{ color: 'var(--ink-soft)' }}>
                            {'Sugerido para ' + result.discogs.conditionSuggestion.label + ': '
                              + result.discogs.conditionSuggestion.currency + ' '
                              + result.discogs.conditionSuggestion.value.toFixed(2)}
                          </p>
                        )}
                      </div>
                    ) : (
                      <p className="italic" style={{ color: 'var(--ink-soft)' }}>
                        {result.discogs?.note || 'Sin datos de Discogs para este disco.'}
                      </p>
                    )}
                  </div>

                  <div className="flex items-center justify-between mt-4 pt-4" style={{ borderTop: '1px solid var(--line)' }}>
                    <span className="text-xs" style={{ color: 'var(--ink-soft)' }}>Confianza del analisis</span>
                    <span className="flex items-center gap-1.5 text-xs" style={{ fontFamily: 'var(--font-data)' }}>
                      <Circle className="w-2.5 h-2.5 fill-current" style={{
                        color: result.confidenceLevel === 'ALTA' ? 'var(--stamp-green)' : result.confidenceLevel === 'MEDIA' ? 'var(--stamp-amber)' : 'var(--stamp-red)',
                      }} />
                      {result.confidenceLevel}
                    </span>
                  </div>
                </>
              )}

              <button
                onClick={startOver}
                className="w-full mt-6 text-sm underline"
                style={{ color: 'var(--ink-soft)' }}
              >
                Tasar otro disco
              </button>
            </div>
          )}
        </div>
      </motion.div>
    </main>
  );
}

// app/api/analyze/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getDiscogsMarketData } from '@/app/lib/discogs';

// Que motor de IA usar: 'groq' (nube, gratis, sirve para produccion en Vercel)
// o 'lmstudio' (local, para desarrollar en tu maquina sin gastar cuota).
const AI_PROVIDER = (process.env.AI_PROVIDER || 'groq').toLowerCase();

const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';
const GROQ_API_KEY = process.env.GROQ_API_KEY || '';
// Groq va rotando sus modelos de vision con el tiempo; si este deja de andar,
// fijate el listado actualizado en https://console.groq.com/docs/vision
const GROQ_MODEL = process.env.GROQ_MODEL || 'qwen/qwen3.6-27b';

const LMSTUDIO_URL = process.env.LMSTUDIO_URL || 'http://127.0.0.1:3231/v1/chat/completions';
const LMSTUDIO_MODEL = process.env.LMSTUDIO_MODEL || 'qwen/qwen3.5-9b';

const useGroq = AI_PROVIDER === 'groq';
const AI_ENDPOINT = useGroq ? GROQ_URL : LMSTUDIO_URL;
const MODEL_NAME = useGroq ? GROQ_MODEL : LMSTUDIO_MODEL;
const PROVIDER_LABEL = useGroq ? 'Groq' : 'LM Studio';

// Tipo de cambio USD -> ARS (actualizable)
const ARS_USD_RATE = 1500;

const PROMPT = `Eres un experto en vinilos de coleccionismo.
Analiza las fotos y responde SOLO con JSON valido sin markdown ni texto extra.

IMPORTANTE: Da valores estimados EN DOLARES estadounidenses (USD), NO en moneda local.
No inventes datos si no los ves en las fotos. Se conservador con el valor.

El formato debe ser exactamente este JSON:
{
  "identified": false,
  "artist": "",
  "album": "",
  "year": "",
  "country": "",
  "label": "",
  "catalogNumber": "",
  "editionNotes": "",
  "rarityNote": "",
  "estimatedValueMin": 0,
  "estimatedValueMax": 0,
  "confidenceLevel": "MEDIA"
}`;


export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const files = formData.getAll('photos') as File[];
    if (files.length === 0) {
      return NextResponse.json({ error: 'Por favor sube al menos una foto.' }, { status: 400 });
    }

    // Convertir archivos a base64 (data URL) para mandarlos como image_url
    const imageB64 = await Promise.all(
      files.map(async (file) => {
        const arrayBuffer = await file.arrayBuffer();
        const bytes = new Uint8Array(arrayBuffer);
        let binary = '';
        for (let i = 0; i < bytes.byteLength; i++) {
          binary += String.fromCharCode(bytes[i]);
        }
        return 'data:' + (file.type || 'image/jpeg') + ';base64,' + btoa(binary);
      }),
    );

    // Info que el usuario haya cargado a mano (numero de matriz, dato del
    // vendedor, algo que se lee en la foto pero cuesta que la IA lo capte, etc.)
    const extraInfo = ((formData.get('extraInfo') as string) || '').trim();

    const finalPrompt = extraInfo
      ? `${PROMPT}\n\nInformacion adicional que aporto la persona que subio las fotos (puede ayudarte a identificar el disco con mas precision; no la ignores, pero si contradice claramente lo que se ve en las fotos, priorizá las fotos y no la inventes como si la hubieras visto vos):\n"${extraInfo}"`
      : PROMPT;

    const jsonBody = {
      model: MODEL_NAME,
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: finalPrompt },
            ...imageB64.map((base64) => ({ type: 'image_url', image_url: { url: base64 } })),
          ],
        },
      ],
      stream: false,
      temperature: 0.1,
    };

    console.log('Enviando fotos a ' + PROVIDER_LABEL + ' (' + MODEL_NAME + ')...');

    if (useGroq && !GROQ_API_KEY) {
      return NextResponse.json(
        { error: 'Falta configurar GROQ_API_KEY en las variables de entorno del servidor.' },
        { status: 500 },
      );
    }

    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (useGroq) headers.Authorization = `Bearer ${GROQ_API_KEY}`;

    const response = await fetch(AI_ENDPOINT, {
      method: 'POST',
      headers,
      body: JSON.stringify(jsonBody),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Error ' + PROVIDER_LABEL + ':', errorText);

      if (response.status === 401) {
        throw new Error('Groq rechazo la API key (GROQ_API_KEY invalida o vencida).');
      }
      if (response.status === 429) {
        throw new Error('Se alcanzo el limite de requests de Groq (probá de nuevo en un rato).');
      }
      if (errorText.toLowerCase().includes('not found') || errorText.toLowerCase().includes('no model') || errorText.toLowerCase().includes('decommissioned')) {
        throw new Error(PROVIDER_LABEL + ' no encontro el modelo "' + MODEL_NAME + '". ' + (useGroq ? 'Puede que Groq lo haya renovado; revisa https://console.groq.com/docs/vision.' : 'Verifica que este cargado en el servidor.'));
      }
      throw new Error('Error al conectar con ' + PROVIDER_LABEL + ' (' + response.status + ')');
    }

    const data = await response.json();

    let resultJson;
    try {
      if (data.choices && Array.isArray(data.choices) && data.choices.length > 0 && typeof data.choices[0].message.content === 'string') {
        const text = data.choices[0].message.content;
        console.log('Respuesta cruda ' + PROVIDER_LABEL + ':', text.substring(0, 300));

        let resultText = text.trim();
        if (resultText.includes('```')) {
          resultText = resultText.replace(/```json|```/g, '').trim();
        }
        // Algunos modelos con "reasoning" agregan un bloque <think>...</think> antes del JSON
        resultText = resultText.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
        // Si sobra texto antes/despues del JSON, nos quedamos con lo que hay entre la primera { y la ultima }
        const start = resultText.indexOf('{');
        const end = resultText.lastIndexOf('}');
        if (start !== -1 && end !== -1) {
          resultText = resultText.slice(start, end + 1);
        }
        resultJson = JSON.parse(resultText);
      } else {
        throw new Error('Formato de respuesta invalido');
      }
    } catch (parseError) {
      console.error('Error parseando JSON de ' + PROVIDER_LABEL + ':', data);
      return NextResponse.json({
        identified: false,
        artist: 'No identificado',
        album: 'No identificado',
        confidenceLevel: 'BAJA',
      });
    }

    const condition = (formData.get('condition') as string) || 'M';

    // Investigamos el mercado real en Discogs para este disco. Si lo encontramos,
    // sus precios (mercado activo) pisan la estimacion "a ojo" de la IA.
    const discogs = resultJson.identified
      ? await getDiscogsMarketData({
          artist: resultJson.artist,
          album: resultJson.album,
          catalogNumber: resultJson.catalogNumber,
          year: resultJson.year,
          condition,
        })
      : { found: false, note: 'El disco no fue identificado por la IA, no se busco en Discogs.' };

    let valueSource: 'discogs' | 'ia' = 'ia';
    let minUSD = resultJson.estimatedValueMin || 0;
    let maxUSD = resultJson.estimatedValueMax || 0;

    // OJO: el "precio mas bajo" de Discogs (lowestPriceUSD) es el listado mas
    // barato que existe HOY en todo el mundo -- muchas veces un ejemplar muy
    // gastado, sin costo de envio. Usarlo solo no es representativo del valor
    // real (por eso antes tirabamos numeros irrisorios tipo US$4). Solo pisamos
    // la estimacion de la IA cuando tenemos la sugerencia de precio por estado
    // de conservacion (basada en historial de ventas, requiere DISCOGS_TOKEN
    // con "seller settings" cargados). El precio minimo se sigue mostrando en
    // la UI, pero solo como dato informativo del mercado, no como el valor.
    if (discogs.found && discogs.conditionSuggestion?.currency === 'USD') {
      valueSource = 'discogs';
      const suggested = discogs.conditionSuggestion.value;
      // Armamos un rango razonable alrededor del valor sugerido para ese estado.
      minUSD = Math.round(suggested * 0.85 * 100) / 100;
      maxUSD = Math.round(suggested * 1.15 * 100) / 100;
    }

    // Conversion automatica USD -> ARS (aplica tanto si el valor vino de Discogs como de la IA)
    const currency = (formData.get('currency') as string) || 'ARS';
    let finalMin, finalMax;

    if (currency === 'ARS' && maxUSD > 0) {
      finalMin = Math.round(minUSD * ARS_USD_RATE);
      finalMax = Math.round(maxUSD * ARS_USD_RATE);
    } else {
      finalMin = minUSD;
      finalMax = maxUSD;
    }

    return NextResponse.json({
      ...resultJson,
      estimatedValueMin: finalMin,
      estimatedValueMax: finalMax,
      valueSource,
      discogs,
      requestedPrice: parseFloat(formData.get('price') as string) || 0,
      currency,
      condition,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('ERROR ' + PROVIDER_LABEL + ':', message);

    if (message.includes('fetch failed') || message.includes('ECONNREFUSED')) {
      const hint = useGroq
        ? 'No se pudo conectar a Groq. Revisa tu conexion a internet.'
        : 'No se pudo conectar a LM Studio. Verifica que el servidor este corriendo (Status: Running) en ' + LMSTUDIO_URL;
      return NextResponse.json({ error: hint }, { status: 503 });
    }

    return NextResponse.json({ error: 'Error en ' + PROVIDER_LABEL + ': ' + message }, { status: 500 });
  }
}

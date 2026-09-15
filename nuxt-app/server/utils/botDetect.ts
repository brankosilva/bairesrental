// Clasificación de una request a /l/:code: ¿la abrió una persona o la
// buscó un scraper de preview?
//
// Importa más de lo que parece. El caso de uso principal es que el
// vendedor pegue el link en WhatsApp: WhatsApp pide la página para armar
// la tarjeta de preview ANTES de que el destinatario la toque. Sin filtro,
// cada link nace con una apertura fantasma y el vendedor cree que el
// cliente lo abrió cuando todavía no lo miró.
//
// Nada se descarta en silencio: lo que se marca como bot igual se guarda
// como evento con `isBot: true` y suma a `botOpens`. Si alguna vez el
// filtro se come gente real, se ve en los datos en vez de desaparecer.
import { createHash } from 'node:crypto'
import type { H3Event } from 'h3'
import type { LinkDevice } from '~/types/link'

export interface RequestClassification {
  isBot: boolean
  botName: string | null
  device: LinkDevice
  visitorHash: string
  referer: string | null
  lang: string | null
  // `true` cuando ni siquiera hay que registrar el evento (HEAD, prefetch).
  skip: boolean
}

// Ojo con dos entradas de esta lista:
//
// · `WhatsApp/` va CON la barra. El scraper se identifica como
//   "WhatsApp/2.x"; el navegador embebido de WhatsApp en Android manda un
//   User-Agent de Chrome común. Poner `WhatsApp` suelto no cambiaría nada
//   hoy, pero es la clase de patrón que después alguien "arregla" sacando
//   la barra y empieza a descontar personas reales.
//
// · `Instagram` NO está, a propósito. El navegador embebido de Instagram
//   —donde efectivamente está parada una persona— manda un UA que contiene
//   el mismo token que su scraper. Filtrar por ese token descontaría
//   justo el canal desde el que más comparten los vendedores. Al scraper
//   de Instagram lo agarra igual el chequeo de `Accept` de abajo, que no
//   pide text/html.
const BOT_PATTERNS: [RegExp, string][] = [
  [/facebookexternalhit|facebookcatalog|Facebot/i, 'facebook'],
  [/WhatsApp\//i, 'whatsapp'],
  [/Twitterbot/i, 'twitter'],
  [/Slackbot|Slack-ImgProxy/i, 'slack'],
  [/TelegramBot/i, 'telegram'],
  [/LinkedInBot/i, 'linkedin'],
  [/Discordbot/i, 'discord'],
  [/Pinterest/i, 'pinterest'],
  [/SkypeUriPreview/i, 'skype'],
  [/Embedly|Iframely/i, 'embed'],
  [/Googlebot|AdsBot-Google|Google-InspectionTool/i, 'googlebot'],
  [/bingbot|BingPreview/i, 'bingbot'],
  [/Applebot/i, 'applebot'],
  [/DuckDuckBot|YandexBot|Baiduspider|redditbot|Ahrefs|Semrush/i, 'crawler'],
  [/HeadlessChrome|Puppeteer|Playwright/i, 'headless'],
  [/python-requests|curl\/|wget|axios|node-fetch|Go-http-client|okhttp|libwww-perl/i, 'http-client'],
  // Genérico al final: sólo llega acá lo que ningún patrón anterior nombró.
  [/bot|crawl|spider|scrape|preview/i, 'generic'],
]

function detectDevice(ua: string): LinkDevice {
  if (/iPad/i.test(ua)) return 'ipad'
  if (/iPhone|iPod/i.test(ua)) return 'iphone'
  if (/Android/i.test(ua)) return 'android'
  if (!ua) return 'other'
  if (/Macintosh|Windows NT|X11|Linux/i.test(ua)) return 'desktop'
  return 'other'
}

// La IP cruda es dato personal y no hay ninguna razón para guardarla: lo
// único que se necesita es poder decir "estas dos aperturas fueron de la
// misma persona". El hash lleva la fecha, así que el mismo visitante en
// dos días distintos cuenta como dos visitantes — deliberado: un hash
// estable en el tiempo sería un identificador persistente, que es
// exactamente lo que no queremos guardar.
//
// La sal sale del entorno si está, y si no cae a una constante. Esto es
// ofuscación, no criptografía: alguien que conozca la sal y la IP puede
// reconstruir el hash. Alcanza para lo que hace (agrupar, no identificar).
const SALT = process.env.NUXT_LINK_HASH_SALT || 'br-link-visitor-v1'

function hashVisitor(code: string, ip: string, ua: string): string {
  const day = new Date().toISOString().slice(0, 10)
  return createHash('sha256').update(`${SALT}|${code}|${ip}|${ua}|${day}`).digest('hex').slice(0, 12)
}

export function classifyRequest(event: H3Event, code: string): RequestClassification {
  const headers = event.node.req.headers
  const ua = (headers['user-agent'] as string) || ''
  const accept = (headers['accept'] as string) || ''
  const referer = (headers['referer'] as string) || null
  const acceptLang = (headers['accept-language'] as string) || ''

  // x-forwarded-for puede venir como lista "cliente, proxy1, proxy2" — el
  // cliente real es el primero.
  const forwarded = (headers['x-forwarded-for'] as string) || ''
  const ip = forwarded.split(',')[0]?.trim() || event.node.req.socket?.remoteAddress || 'unknown'

  const base = {
    device: detectDevice(ua),
    visitorHash: hashVisitor(code, ip, ua),
    referer: referer ? referer.slice(0, 200) : null,
    lang: acceptLang ? acceptLang.split(',')[0]!.trim().slice(0, 16) || null : null,
  }

  // 1. HEAD nunca cuenta. Hoy Nitro ni siquiera llega acá con un HEAD
  //    (verificado: devuelve 404, un handler .get.ts no lo matchea), así
  //    que este chequeo es defensivo — si esa resolución cambia, un HEAD
  //    no puede empezar a contar como visita sin que nadie se entere.
  if (event.node.req.method === 'HEAD') {
    return { ...base, isBot: true, botName: 'head-request', skip: true }
  }

  // 2. Prefetch/prerender del navegador: la persona todavía no hizo clic.
  const secPurpose = ((headers['sec-purpose'] || headers['purpose'] || headers['x-purpose']) as string) || ''
  if (/prefetch|prerender|preview/i.test(secPurpose)) {
    return { ...base, isBot: true, botName: 'prefetch', skip: true }
  }

  // 3. Sin User-Agent no hay navegador.
  if (!ua) {
    return { ...base, isBot: true, botName: 'no-ua', skip: false }
  }

  // 4. Denylist por User-Agent.
  for (const [pattern, name] of BOT_PATTERNS) {
    if (pattern.test(ua)) {
      return { ...base, isBot: true, botName: name, skip: false }
    }
  }

  // 5. Un navegador pidiendo un documento manda `Accept: text/html,...`.
  //    Los scrapers que no se identifican mandan casi siempre `*/*`. Va
  //    último para que los casos conocidos queden etiquetados con su
  //    nombre real en vez de caer todos en un cajón genérico.
  if (!accept.includes('text/html')) {
    return { ...base, isBot: true, botName: 'non-document-request', skip: false }
  }

  return { ...base, isBot: false, botName: null, skip: false }
}

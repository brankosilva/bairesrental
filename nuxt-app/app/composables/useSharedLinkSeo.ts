import { computed } from 'vue'
import type { RentalProperty, SaleProperty } from '~/types/property'
import type { SellerProfile } from '~/types/link'

// Los <meta> de la página que comparte un vendedor (/l/:code y
// /l/:code/:propertyId).
//
// POR QUÉ EXISTE: las dos páginas declaraban sólo `title` + `robots`. Un link
// pegado en WhatsApp salía entonces como una línea de texto pelada —sin foto,
// sin descripción y, sobre todo, sin el nombre del vendedor—, que es
// exactamente lo contrario de lo que la página entera intenta hacer. El
// destinatario recién se entera de quién se lo mandó DESPUÉS de abrirlo.
//
// DOS REGLAS QUE NO SE PUEDEN ROMPER ACÁ:
//
//  1. La etiqueta del DESTINATARIO no entra en ningún meta. El link se reenvía
//     (el cliente se lo pasa a su pareja, a un grupo) y la preview la dibuja
//     quien lo recibe: "Para Juan Pérez" en el título filtraría a quién se lo
//     había mandado el vendedor. Tampoco aparece adentro de la página: es una
//     anotación interna del vendedor y el endpoint ni siquiera la manda.
//  2. `robots: noindex, nofollow` se mantiene. og:* es para los previews de
//     WhatsApp/Facebook/X, que no son buscadores y no respetan —ni les
//     corresponde— el noindex; son dos cosas distintas y las dos tienen que
//     estar.
//
// La imagen sale SIEMPRE de la portada de una publicación, nunca de la foto
// del vendedor: el derivado 1200x630 que pide WhatsApp (ver utils/ogImage.ts)
// sólo se genera para /rentals y /sales — es el INCLUDE_PATH_LIST con el que
// está instalada la extensión, ver extensions/storage-resize-images.env. Un
// avatar de 2 MB como og:image lo descarta WhatsApp y la tarjeta sale sin
// foto igual, pero encima tarda.

interface SharedLinkPayload {
  seller: SellerProfile | null
  // true cuando el endpoint no pudo resolver a una persona y dejó el genérico
  // "Tu asesor" — ver el comentario en server/api/l/[code].get.ts. En ese caso
  // el nombre no entra en ningún meta: "Propiedades de Tu asesor" pegado en un
  // WhatsApp se lee como un error, no como una identidad.
  sellerFallback?: boolean
  property: (RentalProperty & SaleProperty & { id: string }) | null
  propertyKind: 'rental' | 'sale' | null
  catalog?: { rentals: (RentalProperty & { id: string })[]; sales: (SaleProperty & { id: string })[] } | null
}

function priceLabel(p: { precio?: number; moneda?: string }): string {
  return p.precio ? `${p.moneda || 'USD'} ${Number(p.precio).toLocaleString('es-AR')}` : 'Consultar precio'
}

// Une los pedazos de la descripción en frases. Existe porque cada pedazo viene
// de un lado distinto —un armado nuestro, el cargo que tipeó el vendedor, la
// descripción de la publicación— y sólo algunos terminan en punto: un join a
// secas dejaba cosas como "Asesor Inmobiliario.. Branko lloron" a la vista en
// el preview de WhatsApp.
function sentences(...parts: (string | false | null | undefined)[]): string {
  return parts
    .filter((p): p is string => !!p && !!p.trim())
    .map((p) => p.trim().replace(/[.\s]+$/, ''))
    .join('. ')
}

export function useSharedLinkSeo(payload: () => SharedLinkPayload | null | undefined) {
  const seller = computed(() => payload()?.seller ?? null)
  const property = computed(() => payload()?.property ?? null)
  const sellerName = computed(() => (payload()?.sellerFallback ? '' : seller.value?.displayName || ''))

  // Quién comparte, en una frase. Es la mitad del valor de la preview: el
  // destinatario tiene que saber de quién es el link antes de abrirlo.
  const sharedBy = computed(() => {
    if (!sellerName.value) return ''
    return seller.value?.title ? `${sellerName.value} · ${seller.value.title}` : sellerName.value
  })

  const title = computed(() => {
    const p = property.value
    if (p?.titulo) return sellerName.value ? `${p.titulo} — ${sellerName.value}` : p.titulo
    return sellerName.value ? `Propiedades de ${sellerName.value}` : 'Propiedades'
  })

  const description = computed(() => {
    const p = property.value
    if (p) {
      // Los datos duros primero: en WhatsApp la descripción se corta a dos
      // líneas, así que barrio y precio tienen que entrar sí o sí.
      const head = [p.barrio, p.tipo, priceLabel(p)].filter(Boolean).join(' · ')
      return truncate(
        sentences(head, sharedBy.value && `Te lo comparte ${sharedBy.value}`, p.descripcion && metaText(p.descripcion)),
        200,
      )
    }
    const count = (payload()?.catalog?.rentals.length ?? 0) + (payload()?.catalog?.sales.length ?? 0)
    const head = count ? `${count} ${count === 1 ? 'propiedad disponible' : 'propiedades disponibles'}` : ''
    const bio = seller.value?.bio ? metaText(seller.value.bio) : ''
    return truncate(sentences(head, sharedBy.value && `Seleccionadas por ${sharedBy.value}`, bio), 200)
  })

  // Portada de la publicación; en un link de catálogo, la de la primera de la
  // lista — que además es una de las del vendedor, porque el endpoint las
  // ordena con ownFirst().
  const cover = computed(() => {
    const p = property.value
    if (p) return payload()?.propertyKind === 'sale' ? p.fotos?.[0] : p.imagen
    const c = payload()?.catalog
    return c?.rentals.find((r) => r.imagen)?.imagen || c?.sales.find((s) => s.fotos?.[0])?.fotos?.[0]
  })

  const og = computed(() => ogImage(cover.value))

  useSeoMeta({
    title: () => title.value,
    description: () => description.value || undefined,
    ogType: 'website',
    ogTitle: () => title.value,
    ogDescription: () => description.value || undefined,
    ogImage: () => og.value?.url,
    // Declarar medidas y mime hace que Facebook/LinkedIn dibujen la tarjeta en
    // el primer pegado, sin esperar a bajar y medir la imagen.
    ogImageWidth: () => og.value?.width,
    ogImageHeight: () => og.value?.height,
    ogImageType: () => og.value?.type,
    ogImageAlt: () => property.value?.titulo || sellerName.value || undefined,
    // Sin twitterCard, X/Slack/Discord muestran una tarjeta chica o
    // directamente ninguna, aunque los og:* estén completos.
    twitterCard: () => (og.value ? 'summary_large_image' : 'summary'),
    twitterTitle: () => title.value,
    twitterDescription: () => description.value || undefined,
    twitterImage: () => og.value?.url,
    robots: 'noindex, nofollow',
  })

  return { title, description, sharedBy }
}

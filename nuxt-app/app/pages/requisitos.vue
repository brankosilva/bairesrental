<script setup lang="ts">
import { computed } from 'vue'

// Versión web de docs/requisitos-alquiler.pdf (4 páginas: portada,
// "Presentación de perfil", "Requisitos para ingresar" y "Proceso para
// alquilar"). Hasta ahora el único acceso era el botón del hero de
// /departamentos, que abría el PDF crudo en una pestaña nueva: nada
// indexable, sin traducción al inglés y pesado de leer en el celular.
//
// El PDF sigue en /docs/requisitos-alquiler.pdf y se puede bajar desde acá:
// es el material que los vendedores mandan por WhatsApp.
//
// `rt` va junto con `tm` — tm() devuelve nodos de mensaje compilados, no
// strings, y interpolarlos directo rinde "{}" en el cliente (ver la nota
// larga en index.vue).
const { t, tm, rt, locale } = useI18n()
const localePath = useLocalePath()
// Modo vendedor (?vendor=1): sin canales de contacto directo con
// BairesRental, igual que el catálogo. Ver useVendorMode.ts.
const { isVendor, vendorLink } = useVendorMode()

const siteUrl = useSiteConfig().url.replace(/\/$/, '')

// El "| BairesRental" se concatena acá y NO va dentro del mensaje: vue-i18n
// lee el "|" como el separador de pluralización, así que un metaTitle con
// pipe salía cortado en la primera rama ("…Buenos Aires", sin la marca).
const pageTitle = computed(() => `${t('requisitos.metaTitle')} | BairesRental`)

useSeoMeta({
  title: () => pageTitle.value,
  description: () => t('requisitos.metaDescription'),
  ogType: 'website',
  ogTitle: () => pageTitle.value,
  ogDescription: () => t('requisitos.metaDescription'),
  // Sin og:image el link compartido por WhatsApp sale sin preview. Mismo
  // fallback de marca que usa el home.
  ogImage: `${siteUrl}/images/bairesrentallogoblanco.png`,
  ogImageAlt: 'BairesRental',
})

// El PDF numera el proceso de forma implícita (seis filas en orden); acá se
// numera explícito, que es lo que la lista está describiendo.
const pasos = computed(() => tm('requisitos.proceso.items') as unknown[])

const waHref = computed(() => {
  const msg = locale.value === 'en'
    ? 'Hi! I have a question about the rental requirements.'
    : 'Hola! Tengo una consulta sobre los requisitos de alquiler.'
  return `https://wa.me/5491173735757?text=${encodeURIComponent(msg)}`
})
</script>

<template>
  <main class="rq-page">
    <!-- Portada del PDF (página 1): fondo azul pleno, título en dos líneas. -->
    <section class="rq-hero">
      <div class="rq-hero-inner">
        <span class="rq-eyebrow">{{ t('requisitos.eyebrow') }}</span>
        <h1 class="rq-title">{{ t('requisitos.title') }}</h1>
        <p class="rq-sub">{{ t('requisitos.subtitle') }}</p>
        <a href="/docs/requisitos-alquiler.pdf" target="_blank" rel="noopener" class="rq-pdf-btn">
          <svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" aria-hidden="true">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" />
          </svg>
          {{ t('requisitos.pdfBtn') }}
        </a>
      </div>
    </section>

    <!-- Página 2 del PDF: chips azules sobre blanco. -->
    <section class="rq-section rq-section-light">
      <div class="rq-section-inner">
        <h2 class="rq-h2">{{ t('requisitos.perfil.title') }}</h2>
        <p class="rq-lead">{{ t('requisitos.perfil.lead') }}</p>
        <ul class="rq-list rq-list-blue">
          <li v-for="(item, i) in tm('requisitos.perfil.items')" :key="i">
            <svg class="rq-check" width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm-1.3 14.3-4-4 1.4-1.4 2.6 2.6 5.6-5.6 1.4 1.4-7 7z" />
            </svg>
            <span>{{ rt(item as never) }}</span>
          </li>
        </ul>
      </div>
    </section>

    <!-- Página 3 del PDF: chips blancos sobre negro. -->
    <section class="rq-section rq-section-dark">
      <div class="rq-section-inner">
        <h2 class="rq-h2">{{ t('requisitos.ingresar.title') }}</h2>
        <p class="rq-lead">{{ t('requisitos.ingresar.lead') }}</p>
        <ul class="rq-list rq-list-white">
          <li v-for="(item, i) in tm('requisitos.ingresar.items')" :key="i">
            <svg class="rq-check" width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm-1.3 14.3-4-4 1.4-1.4 2.6 2.6 5.6-5.6 1.4 1.4-7 7z" />
            </svg>
            <span>{{ rt(item as never) }}</span>
          </li>
        </ul>
        <p class="rq-nota">{{ t('requisitos.ingresar.nota') }}</p>
      </div>
    </section>

    <!-- Página 4 del PDF: chips blancos sobre azul, en orden. -->
    <section class="rq-section rq-section-blue">
      <div class="rq-section-inner">
        <h2 class="rq-h2">{{ t('requisitos.proceso.title') }}</h2>
        <p class="rq-lead">{{ t('requisitos.proceso.lead') }}</p>
        <ol class="rq-steps">
          <li v-for="(item, i) in pasos" :key="i">
            <span class="rq-step-num">{{ i + 1 }}</span>
            <span>{{ rt(item as never) }}</span>
          </li>
        </ol>
      </div>
    </section>

    <section class="rq-cta">
      <div class="rq-section-inner">
        <h2 class="rq-cta-title">{{ t('requisitos.cta.title') }}</h2>
        <p class="rq-lead">{{ t('requisitos.cta.sub') }}</p>
        <div class="rq-cta-btns">
          <NuxtLink :to="vendorLink(localePath('/departamentos'))" class="rq-btn rq-btn-primary">
            {{ t('requisitos.cta.catalogo') }}
          </NuxtLink>
          <a v-if="!isVendor" :href="waHref" target="_blank" rel="noopener" class="rq-btn rq-btn-wa">
            <IconWhatsapp :size="16" />
            {{ t('requisitos.cta.whatsapp') }}
          </a>
        </div>
      </div>
    </section>
  </main>
</template>

<style scoped>
/* Mismo criterio que tickets.vue: las páginas de contenido del sitio
   estático cargaban css/style.css, que ponía line-height 1.7 por encima de
   Bootstrap. Se reproduce por página. */
.rq-page {
  font-family: 'DM Sans', sans-serif;
  line-height: 1.7;
}

/* ---------- Hero (portada del PDF) ---------- */
.rq-hero {
  background: var(--azul);
  color: #fff;
  /* El nav es fixed y transparente hasta scrollear: el padding superior
     evita que el título quede debajo del logo. */
  padding: 160px 24px 88px;
  text-align: center;
}
.rq-hero-inner {
  max-width: 760px;
  margin: 0 auto;
}
.rq-eyebrow {
  display: inline-block;
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  color: rgba(255, 255, 255, 0.72);
  margin-bottom: 18px;
}
.rq-title {
  font-size: clamp(32px, 6vw, 56px);
  font-weight: 800;
  line-height: 1.1;
  letter-spacing: -0.02em;
  text-transform: uppercase;
  margin-bottom: 16px;
}
.rq-sub {
  font-size: 17px;
  color: rgba(255, 255, 255, 0.85);
  margin-bottom: 28px;
}
.rq-pdf-btn {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  font-weight: 600;
  letter-spacing: 0.04em;
  color: #fff;
  background: rgba(255, 255, 255, 0.12);
  border: 1px solid rgba(255, 255, 255, 0.35);
  padding: 10px 22px;
  border-radius: 100px;
  text-decoration: none;
  transition: background 0.2s, transform 0.15s;
}
.rq-pdf-btn:hover {
  background: rgba(255, 255, 255, 0.22);
  transform: translateY(-2px);
}

/* ---------- Secciones ---------- */
.rq-section {
  padding: 72px 24px;
}
.rq-section-inner {
  max-width: 720px;
  margin: 0 auto;
  text-align: center;
}
.rq-section-light {
  background: var(--blanco);
  color: var(--negro);
}
.rq-section-dark {
  background: var(--negro);
  color: #fff;
}
.rq-section-blue {
  background: var(--azul);
  color: #fff;
}
.rq-h2 {
  font-size: clamp(24px, 4vw, 36px);
  font-weight: 800;
  line-height: 1.15;
  letter-spacing: -0.01em;
  text-transform: uppercase;
  margin-bottom: 12px;
}
.rq-lead {
  font-size: 15.5px;
  margin: 0 auto 32px;
  max-width: 560px;
  opacity: 0.72;
}

/* ---------- Chips (las "píldoras" del PDF) ---------- */
.rq-list {
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin: 0;
  padding: 0;
}
.rq-list li {
  display: flex;
  align-items: center;
  gap: 12px;
  text-align: left;
  padding: 14px 22px;
  border-radius: 100px;
  font-size: 15px;
  font-weight: 600;
}
.rq-check {
  flex-shrink: 0;
}
.rq-list-blue li {
  background: var(--azul);
  color: #fff;
}
.rq-list-white li {
  background: #fff;
  color: var(--negro);
}
.rq-nota {
  font-size: 13px;
  opacity: 0.55;
  margin-top: 20px;
}

/* ---------- Pasos numerados ---------- */
.rq-steps {
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin: 0;
  padding: 0;
  counter-reset: paso;
}
.rq-steps li {
  display: flex;
  align-items: center;
  gap: 14px;
  text-align: left;
  background: #fff;
  color: var(--negro);
  padding: 13px 20px;
  border-radius: 100px;
  font-size: 15px;
  font-weight: 600;
}
.rq-step-num {
  flex-shrink: 0;
  width: 26px;
  height: 26px;
  border-radius: 50%;
  background: var(--azul);
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 13px;
  font-weight: 700;
}

/* ---------- Cierre ---------- */
.rq-cta {
  background: var(--gris);
  color: var(--negro);
  padding: 72px 24px;
}
.rq-cta-title {
  font-size: clamp(22px, 3.5vw, 30px);
  font-weight: 800;
  letter-spacing: -0.01em;
  margin-bottom: 12px;
}
.rq-cta-btns {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
  flex-wrap: wrap;
}
.rq-btn {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 13px 26px;
  border-radius: 100px;
  font-size: 14.5px;
  font-weight: 700;
  text-decoration: none;
  transition: background 0.2s, transform 0.15s;
}
.rq-btn:hover {
  transform: translateY(-2px);
  text-decoration: none;
}
.rq-btn-primary {
  background: var(--azul);
  color: #fff;
}
.rq-btn-primary:hover {
  background: var(--azul-dark);
  color: #fff;
}
.rq-btn-wa {
  background: var(--verde);
  color: #fff;
}
.rq-btn-wa:hover {
  background: #1fb955;
  color: #fff;
}

@media (max-width: 600px) {
  .rq-hero {
    padding: 128px 20px 64px;
  }
  .rq-section,
  .rq-cta {
    padding: 56px 20px;
  }
  .rq-list li,
  .rq-steps li {
    font-size: 14px;
    padding: 12px 18px;
  }
  .rq-btn {
    width: 100%;
    justify-content: center;
  }
}
</style>

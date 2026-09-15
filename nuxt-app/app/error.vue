<script setup lang="ts">
import { computed } from 'vue'
import type { NuxtError } from '#app'

// Página de error del sitio. Hasta ahora no existía: cualquier URL que no
// matcheara una ruta (una ficha borrada del catálogo, un link viejo mal
// tipeado, los `/departamentos.html` que alguien todavía tiene guardados y
// no están en la tabla de redirects) caía en la pantalla por defecto de
// Nuxt — fondo blanco, "Page not found" en inglés, sin nav, sin footer y
// sin ninguna salida hacia el catálogo.
//
// Nuxt monta este componente FUERA de <NuxtPage>, así que el layout no
// viene solo: hay que envolver el template en <NuxtLayout> a mano.
const props = defineProps<{ error: NuxtError }>()

const { t } = useI18n()
const localePath = useLocalePath()
const { isVendor } = useVendorMode()

const isNotFound = computed(() => Number(props.error?.statusCode) === 404)
const code = computed(() => props.error?.statusCode ?? 500)

const rentalsPath = computed(() => localePath('/departamentos'))
const salesPath = computed(() => localePath('/ventas'))
const homePath = computed(() => localePath('/'))

const waHref = computed(() => {
  const msg = t('error.waMessage')
  return `https://wa.me/5491173735757?text=${encodeURIComponent(msg)}`
})

useSeoMeta({
  title: () => `${isNotFound.value ? t('error.metaTitle') : t('error.crash.title')} | BairesRental`,
  robots: 'noindex, nofollow',
})

// Navegar con <NuxtLink> desde acá no alcanza: el estado de error vive por
// encima del router y la página seguiría mostrándose. clearError() lo limpia
// y recién ahí navega. El href real se mantiene para que el link siga siendo
// un link (abrir en pestaña nueva, copiar dirección, crawlers).
function go(path: string) {
  return clearError({ redirect: path })
}
</script>

<template>
  <NuxtLayout>
    <main class="er-page">
      <section class="er-hero">
        <div class="er-hero-inner">
          <span class="er-eyebrow">{{ isNotFound ? t('error.eyebrow') : t('error.crash.eyebrow', { code }) }}</span>

          <p class="er-code" aria-hidden="true">{{ code }}</p>

          <h1 class="er-title">{{ isNotFound ? t('error.title') : t('error.crash.title') }}</h1>
          <p class="er-lead">{{ isNotFound ? t('error.lead') : t('error.crash.lead') }}</p>
          <p class="er-hint">{{ isNotFound ? t('error.hint') : t('error.crash.hint') }}</p>

          <div class="er-actions">
            <a class="er-btn er-btn-primary" :href="rentalsPath" @click.prevent="go(rentalsPath)">
              {{ t('error.ctaRentals') }}
            </a>
            <a class="er-btn er-btn-ghost" :href="salesPath" @click.prevent="go(salesPath)">
              {{ t('error.ctaSales') }}
            </a>
          </div>

          <a class="er-home" :href="homePath" @click.prevent="go(homePath)">{{ t('error.ctaHome') }}</a>

          <!-- En modo vendedor la página no muestra ningún canal directo con
               BairesRental, igual que el catálogo. Ver useVendorMode.ts. -->
          <p v-if="!isVendor" class="er-help">
            {{ t('error.help') }}
            <a :href="waHref" target="_blank" rel="noopener">{{ t('error.helpCta') }}</a>
          </p>
        </div>
      </section>
    </main>
  </NuxtLayout>
</template>

<style scoped>
.er-page {
  font-family: 'DM Sans', sans-serif;
  line-height: 1.7;
}

.er-hero {
  background: var(--azul);
  color: #fff;
  /* El nav es fixed y transparente hasta scrollear, así que el contenido
     tiene que arrancar por debajo del logo (mismo criterio que rq-hero).
     El min-height evita que en desktop quede una franja azul corta con el
     footer pegado arriba del fold. */
  padding: 150px 24px 90px;
  min-height: 78vh;
  display: flex;
  align-items: center;
  justify-content: center;
  text-align: center;
}
.er-hero-inner {
  max-width: 660px;
  margin: 0 auto;
}
.er-eyebrow {
  display: inline-block;
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  color: rgba(255, 255, 255, 0.72);
}
.er-code {
  font-size: clamp(88px, 22vw, 168px);
  font-weight: 800;
  line-height: 0.9;
  letter-spacing: -0.04em;
  color: rgba(255, 255, 255, 0.16);
  margin: 4px 0 -6px;
  user-select: none;
}
.er-title {
  font-size: clamp(26px, 5vw, 44px);
  font-weight: 800;
  line-height: 1.12;
  letter-spacing: -0.02em;
  margin-bottom: 14px;
}
.er-lead {
  font-size: 17px;
  color: rgba(255, 255, 255, 0.85);
  margin-bottom: 6px;
}
.er-hint {
  font-size: 17px;
  font-weight: 600;
  color: #fff;
  margin-bottom: 30px;
}

.er-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  justify-content: center;
}
.er-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 13px 26px;
  border-radius: 100px;
  font-size: 14.5px;
  font-weight: 700;
  text-decoration: none;
  transition: background 0.2s, color 0.2s, transform 0.15s;
}
.er-btn-primary {
  background: #fff;
  color: var(--azul);
}
.er-btn-primary:hover {
  transform: translateY(-2px);
  color: var(--azul-dark);
}
.er-btn-ghost {
  background: rgba(255, 255, 255, 0.12);
  border: 1px solid rgba(255, 255, 255, 0.38);
  color: #fff;
}
.er-btn-ghost:hover {
  background: rgba(255, 255, 255, 0.22);
  transform: translateY(-2px);
}

.er-home {
  display: inline-block;
  margin-top: 22px;
  font-size: 13.5px;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.78);
  text-decoration: underline;
  text-underline-offset: 3px;
}
.er-home:hover {
  color: #fff;
}

.er-help {
  margin-top: 34px;
  padding-top: 22px;
  border-top: 1px solid rgba(255, 255, 255, 0.18);
  font-size: 14px;
  color: rgba(255, 255, 255, 0.72);
}
.er-help a {
  color: #fff;
  font-weight: 600;
  text-decoration: underline;
  text-underline-offset: 3px;
}

@media (max-width: 560px) {
  .er-hero {
    padding: 128px 20px 72px;
  }
  .er-btn {
    width: 100%;
  }
}
</style>

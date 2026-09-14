<script setup lang="ts">
import { ref, computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useHead } from '@unhead/vue'
import SiteLayout from '../layouts/SiteLayout.vue'
import { routeName } from '../router'
import { useLocaleLinks } from '../i18n/useLocaleLinks'
import { useCountUp } from '../composables/useCountUp'

const { t, tm } = useI18n()
const { currentLocale, hreflangLinks } = useLocaleLinks()

// M7: full marketing content port from the root index.html (see
// app/CHANGELOG.md). Only one RealEstateAgent JSON-LD block is emitted
// here — index.html actually has two near-duplicate copies in <head>,
// confirmed not reproduced (grepped the rest of app/src for
// "RealEstateAgent"/"ld+json": DepartamentoDetail.vue/VentaDetail.vue
// each emit their own unrelated Apartment/Offer block, nothing else
// duplicates this one).
useHead({
  title:
    currentLocale === 'en'
      ? 'BairesRental — Short-term rental management in Buenos Aires'
      : 'Gestión de Alquileres Temporarios en Buenos Aires | BairesRental',
  meta: [
    {
      name: 'description',
      content:
        currentLocale === 'en'
          ? 'We manage your apartment in Buenos Aires: verified guests, income in dollars, clear reports, and your property always cared for.'
          : 'Gestionamos tu departamento en Buenos Aires: huéspedes verificados, ingresos en dólares, reportes claros y tu propiedad siempre cuidada. Sin sorpresas.',
    },
  ],
  link: [{ rel: 'canonical', href: `https://www.bairesrental.com.ar${currentLocale === 'en' ? '/en' : ''}/` }, ...hreflangLinks],
  script: [
    {
      type: 'application/ld+json',
      children: JSON.stringify({
        '@context': 'https://schema.org',
        '@type': 'RealEstateAgent',
        name: 'BairesRental',
        description: 'Gestión profesional de alquileres temporarios en Buenos Aires.',
        url: 'https://www.bairesrental.com.ar',
        telephone: '+54-9-11-7373-5757',
        email: 'bairesrentalok@gmail.com',
        address: { '@type': 'PostalAddress', addressLocality: 'Buenos Aires', addressRegion: 'CABA', addressCountry: 'AR' },
        areaServed: ['Palermo', 'Recoleta', 'Belgrano', 'Almagro', 'Caballito', 'Villa Crespo'],
        sameAs: ['https://www.instagram.com/bairesrentalok/'],
      }),
    },
  ],
})

// ── Stats (count-up on scroll into view — see useCountUp.ts) ──────────
const statHuespedes = useCountUp({ target: 300 })
const statNoches = useCountUp({ target: 2500 })
const statResenas = useCountUp({ target: 150 })
const statCalificacion = useCountUp({ target: 9.6, decimals: 1 })
const statOcupacion = useCountUp({ target: 85 })

// ── Calculadora de ingresos ────────────────────────────────────────────
const noches = ref(20)
const precio = ref(45)
const calcResult = computed(() => `U$D ${(noches.value * precio.value).toLocaleString('es-AR')}`)

// ── Reviews marquee (verbatim guest reviews, real quotes in their
// original language — not translated in the original site either) ─────
const reviews = [
  { name: 'Fabio', from: 'New Jersey, EEUU', text: 'This place is a hidden gem! Great location, comfortable bed, good A/C. Very livable neighborhood!' },
  { name: 'Maira', from: 'Buenos Aires', text: 'El departamento me pareció más lindo de lo que se veía en las fotos. Me sentí como en casa.' },
  { name: 'Escobedo', from: 'Argentina', text: 'Excelente departamento, excelente ubicación. La predisposición de Branko para adaptarse a nuestros horarios.' },
  { name: 'Martin', from: 'Alemania', text: 'Excellent host and apartment in a great location, very central and close to public transport.' },
  { name: 'Fernando', from: 'Uruguay', text: 'Muy lindo el lugar, pasamos muy bien y todo se dio como esperábamos. Muy agradecidos!' },
  { name: 'Emilia', from: 'Argentina', text: 'Excelente estadía! Apartamento hermoso igual a lo que se ve en las fotos. Servicio 10/10.' },
  { name: 'Eileen', from: 'Brasil', text: 'O apartamento é lindo, a decoração mais ainda, um ambiente confortável.' },
  { name: 'Andrea', from: 'Argentina', text: 'Excelente apartamento, pequeño, funcional y cómodo. Muy recomendable!' },
  { name: 'Yamila', from: 'Mar del Plata', text: 'El departamento está muy bien ubicado. Edificio nuevo, instalaciones impecables.' },
  { name: 'Luisa', from: 'Florida, EEUU', text: 'Our host was communicative, responsive and accommodating. Great location.' },
  { name: 'María Fernanda', from: 'Colombia', text: 'El departamento es muy bonito, acogedor, organizado. Nuestra estadía fue excelente.' },
  { name: 'Carol', from: 'Colombia', text: 'Excelente departamento y con la vista al atardecer lo hizo más maravilloso aún.' },
  { name: 'Geovanni', from: 'Paraguay', text: 'Me atendieron de forma muy atenta, el edificio cuenta con gimnasio, piscina y es muy seguro.' },
  { name: 'Josefina', from: 'Argentina', text: 'Excelente servicio! Branko siempre super atenta, facilitando la comunicación. Volveríamos.' },
  { name: 'Christian', from: 'Alemania', text: 'Nice and comfortable flat in a perfect location.' },
  { name: 'Martin', from: 'Uruguay', text: 'El alojamiento fue excelente. Branko fue muy cordial e incluso nos ayudó con un problema.' },
]
const reviewsMid = Math.ceil(reviews.length / 2)
const reviewsRow1 = reviews.slice(0, reviewsMid)
const reviewsRow2 = reviews.slice(reviewsMid)

// ── Contacto: direct client-side POST to Web3Forms ──────────────────────
// M7 initially tried moving this behind a submitContactForm Cloud
// Function to get the access key off the client — confirmed that
// Web3Forms' free plan flat-out rejects server-to-server calls ("Use our
// API in client side ... Pro plan is required", verified with a direct
// curl to api.web3forms.com/submit). Web3Forms' actual security model is
// a client-side key restricted by domain in their dashboard, not secrecy
// of the key — the exact pattern the original static site already used.
// So this reverts to that, same as index.html's contact form.
const WEB3FORMS_ACCESS_KEY = '03fc5068-3ee9-4814-bb0f-7d9e889cece0'

type SubmitState = 'idle' | 'sending' | 'success' | 'error'
const submitState = ref<SubmitState>('idle')
const form = ref({
  nombre: '',
  telefono: '',
  email: '',
  barrio: '',
  ambientes: '',
  amueblado: '',
  plan: '',
  mensaje: '',
})

const submitLabel = computed(() => {
  if (submitState.value === 'sending') return t('home.contacto.sending')
  if (submitState.value === 'success') return t('home.contacto.success')
  if (submitState.value === 'error') return t('home.contacto.error')
  return t('home.contacto.submit')
})

async function handleContactSubmit() {
  submitState.value = 'sending'
  try {
    const res = await fetch('https://api.web3forms.com/submit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        access_key: WEB3FORMS_ACCESS_KEY,
        subject: 'Nueva consulta desde BairesRental',
        from_name: 'BairesRental Web',
        ...form.value,
      }),
    })
    const data = (await res.json()) as { success?: boolean }
    submitState.value = data.success ? 'success' : 'error'
  } catch (e) {
    console.error('Web3Forms submit failed', e)
    submitState.value = 'error'
  }
}
</script>

<template>
  <SiteLayout>
    <main class="br-home">
      <!-- ── HERO ─────────────────────────────────── -->
      <section class="hero" id="hero">
        <div class="hero-bg"></div>
        <div class="hero-content">
          <div class="hero-eyebrow">{{ t('home.eyebrow') }}</div>
          <h1 class="hero-title">
            <span class="line">{{ t('home.title1') }}</span>
            <span class="line accent">{{ t('home.title2') }}</span>
          </h1>
          <p class="hero-sub">{{ t('home.subtitle') }}</p>
          <div class="hero-actions">
            <router-link :to="{ name: routeName('departamentos', currentLocale) }" class="btn-primary">{{ t('home.ctaRentals') }}</router-link>
            <router-link :to="{ name: routeName('ventas', currentLocale) }" class="btn-ghost">{{ t('home.ctaSales') }}</router-link>
          </div>
        </div>
      </section>

      <!-- ── STATS INTRO + STATS ─────────────────────── -->
      <div class="stats-intro">
        <p class="stats-intro-eyebrow">{{ t('home.stats.eyebrow') }}</p>
        <h2 class="stats-intro-title">{{ t('home.stats.title1') }} <span>{{ t('home.stats.title2') }}</span></h2>
      </div>
      <section id="stats">
        <div class="stats-inner">
          <div class="stats-grid">
            <div class="stat-item" :ref="(el) => (statHuespedes.el.value = el as HTMLElement | null)">
              <div class="stat-num">{{ statHuespedes.display }}<span class="stat-suffix">+</span></div>
              <div class="stat-desc">{{ t('home.stats.huespedes') }}</div>
            </div>
            <div class="stat-item" :ref="(el) => (statNoches.el.value = el as HTMLElement | null)">
              <div class="stat-num">{{ statNoches.display }}<span class="stat-suffix">+</span></div>
              <div class="stat-desc">{{ t('home.stats.noches') }}</div>
            </div>
            <div class="stat-item" :ref="(el) => (statResenas.el.value = el as HTMLElement | null)">
              <div class="stat-num">{{ statResenas.display }}<span class="stat-suffix">+</span></div>
              <div class="stat-desc">{{ t('home.stats.resenas') }}</div>
            </div>
            <div class="stat-item" :ref="(el) => (statCalificacion.el.value = el as HTMLElement | null)">
              <div class="stat-num">{{ statCalificacion.display }}<span class="stat-suffix">/10</span></div>
              <div class="stat-desc">{{ t('home.stats.calificacion') }}</div>
            </div>
            <div class="stat-item" :ref="(el) => (statOcupacion.el.value = el as HTMLElement | null)">
              <div class="stat-num">{{ statOcupacion.display }}<span class="stat-suffix">%</span></div>
              <div class="stat-desc">{{ t('home.stats.ocupacion') }}</div>
            </div>
          </div>
        </div>
      </section>

      <!-- ── POR QUÉ ─────────────────────────────────── -->
      <section id="por-que">
        <div class="porq-header">
          <p class="section-label">{{ t('home.porQue.label') }}</p>
          <h2 class="section-title">{{ t('home.porQue.title') }}</h2>
        </div>
        <div class="features-grid">
          <div class="feature-card">
            <div class="feature-num">01</div>
            <div class="feature-title">{{ t('home.porQue.f1Title') }}</div>
            <div class="feature-desc">{{ t('home.porQue.f1Desc') }}</div>
          </div>
          <div class="feature-card">
            <div class="feature-num">02</div>
            <div class="feature-title">{{ t('home.porQue.f2Title') }}</div>
            <div class="feature-desc">{{ t('home.porQue.f2Desc') }}</div>
          </div>
          <div class="feature-card">
            <div class="feature-num">03</div>
            <div class="feature-title">{{ t('home.porQue.f3Title') }}</div>
            <div class="feature-desc">{{ t('home.porQue.f3Desc') }}</div>
          </div>
          <div class="feature-card">
            <div class="feature-num">04</div>
            <div class="feature-title">{{ t('home.porQue.f4Title') }}</div>
            <div class="feature-desc">{{ t('home.porQue.f4Desc') }}</div>
          </div>
        </div>
      </section>

      <!-- ── PLANES ─────────────────────────────────── -->
      <section id="planes">
        <div class="planes-header">
          <p class="section-label">{{ t('home.planes.label') }}</p>
          <h2 class="section-title">{{ t('home.planes.title') }}</h2>
        </div>
        <div class="planes-grid">
          <div class="plan-card">
            <div class="plan-nombre">{{ t('home.planes.plan1Name') }}</div>
            <div class="plan-precio">12%<small>{{ t('home.planes.plan1Sub') }}</small></div>
            <div class="plan-desc">{{ t('home.planes.plan1Desc') }}</div>
            <ul class="plan-items">
              <li v-for="(item, i) in tm('home.planes.plan1Items') as unknown as string[]" :key="i">{{ item }}</li>
            </ul>
            <a href="#contacto" class="plan-btn">{{ t('home.planes.btn') }}</a>
          </div>

          <div class="plan-card destacado">
            <div class="plan-destacado-badge">{{ t('home.planes.destacado') }}</div>
            <div class="plan-nombre">{{ t('home.planes.plan2Name') }}</div>
            <div class="plan-precio-row">
              <div class="plan-precio-stat">
                <span class="plan-precio-stat-num">0%</span>
                <span class="plan-precio-stat-label">{{ t('home.planes.plan2Cap1') }}</span>
              </div>
              <div class="plan-precio-stat">
                <span class="plan-precio-stat-num">15%</span>
                <span class="plan-precio-stat-label">{{ t('home.planes.plan2Cap2') }}</span>
              </div>
            </div>
            <div class="plan-desc">{{ t('home.planes.plan2Desc') }}</div>
            <ul class="plan-items">
              <li v-for="(item, i) in tm('home.planes.plan2Items') as unknown as string[]" :key="i">{{ item }}</li>
            </ul>
            <a href="#contacto" class="plan-btn">{{ t('home.planes.btn') }}</a>
          </div>

          <div class="plan-card">
            <div class="plan-nombre">{{ t('home.planes.plan3Name') }}</div>
            <div class="plan-precio">25%<small>{{ t('home.planes.plan3Sub') }}</small></div>
            <div class="plan-nota">{{ t('home.planes.plan3Nota') }}</div>
            <div class="plan-desc">{{ t('home.planes.plan3Desc') }}</div>
            <ul class="plan-items">
              <li v-for="(item, i) in tm('home.planes.plan3Items') as unknown as string[]" :key="i">{{ item }}</li>
            </ul>
            <a href="#contacto" class="plan-btn">{{ t('home.planes.btn') }}</a>
          </div>
        </div>
      </section>

      <!-- ── CALCULADORA ─────────────────────────────── -->
      <section id="calculadora">
        <div class="calc-inner">
          <p class="section-label" style="justify-content: center">{{ t('home.calculadora.label') }}</p>
          <p class="calc-title">{{ t('home.calculadora.title') }}</p>
          <p class="calc-sub">{{ t('home.calculadora.sub') }}</p>

          <div class="calc-display"><span>{{ calcResult }}</span></div>

          <div style="max-width: 480px; margin: 0 auto">
            <div class="calc-slider-label">
              <span>{{ t('home.calculadora.noches') }}: <strong>{{ noches }}</strong></span>
              <span>{{ t('home.calculadora.precio') }}: U$D <strong>{{ precio }}</strong></span>
            </div>
            <input type="range" class="calc-slider" min="5" max="28" v-model.number="noches" />
            <input type="range" class="calc-slider" min="30" max="200" step="5" v-model.number="precio" style="margin-top: 1rem" />
          </div>
          <p class="calc-notas">{{ t('home.calculadora.nota') }}</p>
        </div>
      </section>

      <!-- ── TESTIMONIOS ──────────────────────────────── -->
      <section id="testimonios">
        <div class="testi-header">
          <p class="section-label">{{ t('home.testimonios.label') }}</p>
          <h2 class="section-title">{{ t('home.testimonios.title') }}</h2>
        </div>
        <div class="testi-grid">
          <div class="testi-card">
            <p class="testi-quote">{{ t('home.testimonios.quote1') }}</p>
            <div class="testi-person">
              <div class="testi-avatar-init">VV</div>
              <div>
                <div class="testi-name">{{ t('home.testimonios.name1') }}</div>
                <div class="testi-stars">★★★★★</div>
              </div>
            </div>
          </div>
          <div class="testi-card">
            <p class="testi-quote">{{ t('home.testimonios.quote2') }}</p>
            <div class="testi-person">
              <div class="testi-avatar-init">BM</div>
              <div>
                <div class="testi-name">{{ t('home.testimonios.name2') }}</div>
                <div class="testi-stars">★★★★★</div>
              </div>
            </div>
          </div>
          <div class="testi-card">
            <p class="testi-quote">{{ t('home.testimonios.quote3') }}</p>
            <div class="testi-person">
              <div class="testi-avatar-init">BG</div>
              <div>
                <div class="testi-name">{{ t('home.testimonios.name3') }}</div>
                <div class="testi-stars">★★★★★</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <!-- ── REVIEWS MARQUEE ──────────────────────────── -->
      <section id="reviews">
        <p class="reviews-label">{{ t('home.reviews.label') }}</p>
        <div class="marquee-row">
          <div class="marquee-track">
            <div class="review-card" v-for="(r, i) in [...reviewsRow1, ...reviewsRow1]" :key="`r1-${i}`">
              <p class="review-text">{{ r.text }}</p>
              <div class="review-author">
                <div>
                  <div class="review-name">{{ r.name }}</div>
                  <div class="review-from">{{ r.from }}</div>
                </div>
              </div>
            </div>
          </div>
        </div>
        <div class="marquee-row">
          <div class="marquee-track reverse">
            <div class="review-card" v-for="(r, i) in [...reviewsRow2, ...reviewsRow2]" :key="`r2-${i}`">
              <p class="review-text">{{ r.text }}</p>
              <div class="review-author">
                <div>
                  <div class="review-name">{{ r.name }}</div>
                  <div class="review-from">{{ r.from }}</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <!-- ── AWARD ────────────────────────────────────── -->
      <section id="award">
        <div class="award-inner">
          <div class="award-eyebrow">{{ t('home.award.eyebrow') }}</div>
          <h2 class="award-title">{{ t('home.award.title') }}</h2>
          <p class="award-desc">{{ t('home.award.desc') }}</p>
          <div class="award-logos">
            <div class="award-logo-badge">{{ t('home.award.badge1') }}</div>
            <div class="award-logo-badge">{{ t('home.award.badge2') }}</div>
          </div>
        </div>
      </section>

      <!-- ── CONTACTO ─────────────────────────────────── -->
      <section id="contacto">
        <div class="contacto-inner">
          <p class="section-label">{{ t('home.contacto.label') }}</p>
          <h2 class="section-title">{{ t('home.contacto.title') }}</h2>
          <p class="contacto-sub">{{ t('home.contacto.sub') }}</p>

          <form class="contacto-form" @submit.prevent="handleContactSubmit">
            <div class="form-row">
              <div class="form-field">
                <label>{{ t('home.contacto.fNombre') }}</label>
                <input type="text" v-model="form.nombre" :placeholder="t('home.contacto.phNombre')" required />
              </div>
              <div class="form-field">
                <label>{{ t('home.contacto.fTel') }}</label>
                <input type="tel" v-model="form.telefono" placeholder="+54 11 ..." />
              </div>
            </div>
            <div class="form-field">
              <label>{{ t('home.contacto.fEmail') }}</label>
              <input type="email" v-model="form.email" placeholder="tu@email.com" required />
            </div>
            <div class="form-row">
              <div class="form-field">
                <label>{{ t('home.contacto.fBarrio') }}</label>
                <input type="text" v-model="form.barrio" :placeholder="t('home.contacto.phBarrio')" />
              </div>
              <div class="form-field">
                <label>{{ t('home.contacto.fAmb') }}</label>
                <select v-model="form.ambientes">
                  <option value="">{{ t('home.contacto.sel') }}</option>
                  <option>{{ t('home.contacto.amb1') }}</option>
                  <option>{{ t('home.contacto.amb2') }}</option>
                  <option>{{ t('home.contacto.amb3') }}</option>
                  <option>{{ t('home.contacto.amb4') }}</option>
                </select>
              </div>
            </div>
            <div class="form-row">
              <div class="form-field">
                <label>{{ t('home.contacto.fAmob') }}</label>
                <select v-model="form.amueblado">
                  <option value="">{{ t('home.contacto.sel') }}</option>
                  <option>{{ t('home.contacto.amob1') }}</option>
                  <option>{{ t('home.contacto.amob2') }}</option>
                  <option>{{ t('home.contacto.amob3') }}</option>
                </select>
              </div>
              <div class="form-field">
                <label>{{ t('home.contacto.fPlan') }}</label>
                <select v-model="form.plan">
                  <option value="">{{ t('home.contacto.selPlan') }}</option>
                  <option>Gestión Online (12%)</option>
                  <option>Gestión Mensual (15%)</option>
                  <option>Gestión Airbnb (25%)</option>
                  <option>{{ t('home.contacto.planNs') }}</option>
                </select>
              </div>
            </div>
            <div class="form-field">
              <label>{{ t('home.contacto.fMsg') }}</label>
              <textarea v-model="form.mensaje" :placeholder="t('home.contacto.phMsg')"></textarea>
            </div>
            <button
              type="submit"
              class="form-submit"
              :disabled="submitState === 'sending'"
              :style="{
                background: submitState === 'success' ? '#22c55e' : submitState === 'error' ? '#ef4444' : undefined,
              }"
            >
              {{ submitLabel }}
            </button>
          </form>
        </div>
      </section>
    </main>
  </SiteLayout>
</template>

<style scoped>
.br-home {
  --negro: #111111;
  --azul: #1a6fe8;
  --azul-dark: #1058c0;
  --verde: #25d366;
  --blanco: #ffffff;
  --gris: #f4f4f6;
  --gris2: #e8e8ec;
  --texto-gris: #6b7280;
  --radius: 16px;
  font-family: 'DM Sans', sans-serif;
}

/* ── HERO ─────────────────────────────────── */
.hero {
  position: relative;
  min-height: 90vh;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  text-align: center;
}
.hero-bg {
  position: absolute;
  inset: 0;
  z-index: 0;
  background: radial-gradient(ellipse at 40% 50%, #0d1f3c 0%, #0a0a12 70%);
}
.hero-content {
  position: relative;
  z-index: 2;
  max-width: 860px;
  padding: 7rem 2rem 5rem;
}
.hero-eyebrow {
  display: inline-block;
  font-size: 0.72rem;
  font-weight: 700;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  color: var(--azul);
  background: rgba(26, 111, 232, 0.12);
  border: 1px solid rgba(26, 111, 232, 0.3);
  padding: 0.35rem 1rem;
  border-radius: 100px;
  margin-bottom: 2rem;
}
.hero-title {
  font-size: clamp(2.7rem, 7.5vw, 6.2rem);
  font-weight: 800;
  line-height: 1;
  letter-spacing: -0.04em;
  color: var(--blanco);
  margin-bottom: 0.6rem;
}
.hero-title .line {
  display: block;
}
.hero-title .accent {
  color: var(--azul);
}
.hero-sub {
  font-size: clamp(0.85rem, 1.7vw, 0.95rem);
  color: rgba(255, 255, 255, 0.55);
  font-weight: 400;
  max-width: 460px;
  margin: 0 auto 2.5rem;
  line-height: 1.6;
}
.hero-actions {
  display: flex;
  gap: 1rem;
  justify-content: center;
  flex-wrap: wrap;
}
.btn-primary {
  background: var(--azul);
  color: #fff;
  padding: 1rem 2rem;
  border-radius: 100px;
  font-size: 0.95rem;
  font-weight: 700;
  text-decoration: none;
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  transition: background 0.2s, transform 0.15s;
  box-shadow: 0 4px 20px rgba(26, 111, 232, 0.35);
}
.btn-primary:hover {
  background: var(--azul-dark);
  color: #fff;
  transform: translateY(-2px);
}
.btn-ghost {
  background: rgba(255, 255, 255, 0.08);
  color: #fff;
  padding: 1rem 2rem;
  border-radius: 100px;
  font-size: 0.95rem;
  font-weight: 600;
  text-decoration: none;
  border: 1px solid rgba(255, 255, 255, 0.2);
  transition: background 0.2s, transform 0.15s;
}
.btn-ghost:hover {
  background: rgba(255, 255, 255, 0.15);
  color: #fff;
  transform: translateY(-2px);
}

/* ── STATS INTRO ─────────────────────────────── */
.stats-intro {
  background: var(--negro);
  padding: 5rem 2rem 0;
  text-align: center;
}
.stats-intro-eyebrow {
  font-size: 0.7rem;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  color: var(--azul);
  font-weight: 700;
  margin-bottom: 0.75rem;
}
.stats-intro-title {
  font-size: clamp(2rem, 5vw, 3.5rem);
  font-weight: 800;
  letter-spacing: -0.04em;
  color: #fff;
  line-height: 1.1;
  max-width: 600px;
  margin: 0 auto;
}
.stats-intro-title span {
  color: var(--azul);
}

/* ── STATS ───────────────────────────────────── */
#stats {
  background: var(--negro);
  padding: 6rem 2rem;
}
.stats-inner {
  max-width: 1100px;
  margin: 0 auto;
}
.stats-grid {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: 2rem;
}
@media (max-width: 900px) {
  .stats-grid {
    grid-template-columns: repeat(3, 1fr);
  }
}
@media (max-width: 560px) {
  .stats-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}
.stat-item {
  text-align: center;
}
.stat-num {
  font-size: clamp(2.5rem, 5vw, 4rem);
  font-weight: 800;
  color: #fff;
  letter-spacing: -0.04em;
  line-height: 1;
  margin-bottom: 0.4rem;
}
.stat-num .stat-suffix {
  font-size: 0.6em;
}
.stat-desc {
  font-size: 0.75rem;
  color: rgba(255, 255, 255, 0.4);
  text-transform: uppercase;
  letter-spacing: 0.1em;
  font-weight: 600;
}

/* ── POR QUÉ ─────────────────────────────────── */
#por-que {
  padding: 7rem 2rem;
  background: var(--blanco);
}
.section-label {
  font-size: 0.7rem;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  color: var(--azul);
  font-weight: 700;
  margin-bottom: 1rem;
}
.section-title {
  font-size: clamp(2rem, 4vw, 3.2rem);
  font-weight: 800;
  letter-spacing: -0.04em;
  line-height: 1.1;
  color: var(--negro);
  max-width: 640px;
}
.porq-header {
  max-width: 1100px;
  margin: 0 auto 4rem;
}
.features-grid {
  max-width: 1100px;
  margin: 0 auto;
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 1.5rem;
}
@media (max-width: 700px) {
  .features-grid {
    grid-template-columns: 1fr;
  }
}
.feature-card {
  background: var(--gris);
  border-radius: var(--radius);
  padding: 2.5rem;
  transition: transform 0.3s, box-shadow 0.3s;
}
.feature-card:hover {
  transform: translateY(-4px);
  box-shadow: 0 12px 40px rgba(0, 0, 0, 0.1);
}
.feature-card:hover .feature-num {
  color: var(--azul);
}
.feature-num {
  font-size: 4.5rem;
  font-weight: 800;
  letter-spacing: -0.05em;
  color: var(--gris2);
  line-height: 1;
  margin-bottom: 1rem;
  transition: color 0.3s;
}
.feature-title {
  font-size: 1.1rem;
  font-weight: 700;
  margin-bottom: 0.6rem;
  color: var(--negro);
}
.feature-desc {
  font-size: 0.9rem;
  color: var(--texto-gris);
  line-height: 1.6;
}

/* ── PLANES ──────────────────────────────────── */
#planes {
  padding: 7rem 2rem;
  background: var(--negro);
}
.planes-header {
  max-width: 1100px;
  margin: 0 auto 4rem;
}
.planes-header .section-title {
  color: var(--blanco);
}
.planes-grid {
  max-width: 1100px;
  margin: 0 auto;
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 1.5rem;
  align-items: stretch;
}
@media (max-width: 800px) {
  .planes-grid {
    grid-template-columns: 1fr;
  }
}
.plan-card {
  border-radius: var(--radius);
  padding: 2.5rem;
  border: 1px solid rgba(255, 255, 255, 0.08);
  background: rgba(255, 255, 255, 0.03);
  position: relative;
  display: flex;
  flex-direction: column;
}
.plan-card.destacado {
  background: var(--azul);
  border-color: var(--azul);
}
.plan-destacado-badge {
  position: absolute;
  top: 1.2rem;
  right: 1.2rem;
  font-size: 0.65rem;
  font-weight: 800;
  letter-spacing: 0.12em;
  background: rgba(255, 255, 255, 0.2);
  color: #fff;
  padding: 0.3rem 0.7rem;
  border-radius: 100px;
}
.plan-nombre {
  font-size: 0.75rem;
  font-weight: 700;
  letter-spacing: 0.15em;
  text-transform: uppercase;
  color: rgba(255, 255, 255, 0.5);
  margin-bottom: 1rem;
}
.plan-card.destacado .plan-nombre {
  color: rgba(255, 255, 255, 0.7);
}
.plan-precio {
  font-size: 3.5rem;
  font-weight: 800;
  letter-spacing: -0.04em;
  color: #fff;
  line-height: 1;
}
.plan-precio small {
  font-size: 0.9rem;
  font-weight: 500;
  opacity: 0.6;
}
.plan-precio-row {
  display: flex;
  gap: 1.75rem;
}
.plan-precio-stat {
  display: flex;
  flex-direction: column;
}
.plan-precio-stat-num {
  font-size: 2.4rem;
  font-weight: 800;
  letter-spacing: -0.03em;
  color: #fff;
  line-height: 1;
}
.plan-precio-stat-label {
  font-size: 0.68rem;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.6);
  margin-top: 0.35rem;
}
.plan-nota {
  font-size: 0.8rem;
  font-weight: 700;
  color: var(--azul);
  margin: 0 0 0.5rem;
}
.plan-desc {
  font-size: 0.82rem;
  color: rgba(255, 255, 255, 0.45);
  margin: 0.75rem 0 1.75rem;
  line-height: 1.6;
}
.plan-card.destacado .plan-desc {
  color: rgba(255, 255, 255, 0.65);
}
.plan-items {
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 0.7rem;
  margin-bottom: 2rem;
  flex: 1;
  padding: 0;
}
.plan-items li {
  font-size: 0.85rem;
  color: rgba(255, 255, 255, 0.7);
  display: flex;
  align-items: flex-start;
  gap: 0.5rem;
}
.plan-items li::before {
  content: '✓';
  color: var(--verde);
  font-weight: 700;
  flex-shrink: 0;
}
.plan-card.destacado .plan-items li {
  color: rgba(255, 255, 255, 0.9);
}
.plan-btn {
  display: block;
  text-align: center;
  background: rgba(255, 255, 255, 0.1);
  color: #fff;
  padding: 0.85rem;
  border-radius: 10px;
  font-weight: 700;
  font-size: 0.88rem;
  text-decoration: none;
  transition: background 0.2s;
}
.plan-btn:hover {
  background: rgba(255, 255, 255, 0.2);
  color: #fff;
}
.plan-card.destacado .plan-btn {
  background: rgba(0, 0, 0, 0.2);
}
.plan-card.destacado .plan-btn:hover {
  background: rgba(0, 0, 0, 0.35);
}

/* ── CALCULADORA ─────────────────────────────── */
#calculadora {
  padding: 7rem 2rem;
  background: var(--gris);
}
.calc-inner {
  max-width: 780px;
  margin: 0 auto;
  text-align: center;
}
.calc-title {
  font-size: clamp(1.5rem, 3vw, 2rem);
  font-weight: 800;
  letter-spacing: -0.03em;
  margin-bottom: 0.5rem;
  color: var(--negro);
}
.calc-display {
  font-size: clamp(3.5rem, 10vw, 7rem);
  font-weight: 800;
  letter-spacing: -0.05em;
  color: var(--azul);
  line-height: 1;
  margin: 2rem 0;
}
.calc-sub {
  font-size: 0.9rem;
  color: var(--texto-gris);
  margin-bottom: 2.5rem;
}
.calc-slider-label {
  display: flex;
  justify-content: space-between;
  font-size: 0.82rem;
  font-weight: 600;
  color: var(--texto-gris);
  margin-bottom: 0.5rem;
}
.calc-slider {
  width: 100%;
  -webkit-appearance: none;
  height: 5px;
  border-radius: 5px;
  background: var(--gris2);
  outline: none;
}
.calc-slider::-webkit-slider-thumb {
  -webkit-appearance: none;
  width: 24px;
  height: 24px;
  border-radius: 50%;
  background: var(--azul);
  cursor: pointer;
  border: 3px solid #fff;
  box-shadow: 0 2px 8px rgba(26, 111, 232, 0.4);
}
.calc-notas {
  font-size: 0.78rem;
  color: var(--texto-gris);
  margin-top: 1.5rem;
}

/* ── TESTIMONIOS ─────────────────────────────── */
#testimonios {
  padding: 7rem 2rem;
  background: var(--blanco);
}
.testi-header {
  max-width: 1100px;
  margin: 0 auto 4rem;
}
.testi-grid {
  max-width: 1100px;
  margin: 0 auto;
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 1.5rem;
}
@media (max-width: 800px) {
  .testi-grid {
    grid-template-columns: 1fr;
  }
}
.testi-card {
  background: var(--gris);
  border-radius: var(--radius);
  padding: 2rem;
}
.testi-quote {
  font-size: 0.95rem;
  line-height: 1.7;
  color: var(--negro);
  margin-bottom: 1.5rem;
  font-style: italic;
}
.testi-quote::before {
  content: '\201C';
}
.testi-quote::after {
  content: '\201D';
}
.testi-person {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}
.testi-avatar-init {
  width: 44px;
  height: 44px;
  border-radius: 50%;
  background: var(--azul);
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 700;
  font-size: 1rem;
  flex-shrink: 0;
}
.testi-name {
  font-weight: 700;
  font-size: 0.9rem;
}
.testi-stars {
  color: #f59e0b;
  font-size: 0.8rem;
}

/* ── REVIEWS MARQUEE ─────────────────────────── */
#reviews {
  padding: 5rem 0;
  background: var(--negro);
  overflow: hidden;
}
.reviews-label {
  text-align: center;
  margin-bottom: 3rem;
  font-size: 0.7rem;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  color: var(--azul);
  font-weight: 700;
}
.marquee-row {
  display: flex;
  gap: 1.25rem;
  margin-bottom: 1.25rem;
}
.marquee-track {
  display: flex;
  gap: 1.25rem;
  animation: marquee 35s linear infinite;
}
.marquee-track.reverse {
  animation-direction: reverse;
  animation-duration: 40s;
}
@keyframes marquee {
  0% {
    transform: translateX(0);
  }
  100% {
    transform: translateX(-50%);
  }
}
.review-card {
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(255, 255, 255, 0.07);
  border-radius: 14px;
  padding: 1.4rem 1.6rem;
  flex-shrink: 0;
  width: 300px;
}
.review-text {
  font-size: 0.85rem;
  color: rgba(255, 255, 255, 0.7);
  line-height: 1.6;
  margin-bottom: 1rem;
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
.review-name {
  font-size: 0.8rem;
  color: rgba(255, 255, 255, 0.5);
  font-weight: 600;
}
.review-from {
  font-size: 0.72rem;
  color: rgba(255, 255, 255, 0.3);
}

/* ── AWARD ───────────────────────────────────── */
#award {
  padding: 6rem 2rem;
  background: var(--blanco);
  text-align: center;
}
.award-inner {
  max-width: 700px;
  margin: 0 auto;
}
.award-eyebrow {
  font-size: 0.7rem;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  color: var(--azul);
  font-weight: 700;
  margin-bottom: 1.5rem;
}
.award-title {
  font-size: clamp(1.5rem, 4vw, 2.4rem);
  font-weight: 800;
  letter-spacing: -0.03em;
  margin-bottom: 1rem;
  color: var(--negro);
}
.award-desc {
  color: var(--texto-gris);
  font-size: 0.95rem;
  line-height: 1.7;
  margin-bottom: 2.5rem;
}
.award-logos {
  display: flex;
  gap: 2rem;
  justify-content: center;
  align-items: center;
  flex-wrap: wrap;
  margin-top: 1rem;
}
.award-logo-badge {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  background: var(--gris);
  border-radius: 100px;
  padding: 0.5rem 1.2rem;
  font-size: 0.78rem;
  font-weight: 700;
  color: var(--negro);
}

/* ── CONTACTO ────────────────────────────────── */
#contacto {
  padding: 7rem 2rem;
  background: var(--negro);
}
.contacto-inner {
  max-width: 680px;
  margin: 0 auto;
  text-align: center;
}
.contacto-inner .section-label {
  color: var(--azul);
}
.contacto-inner .section-title {
  color: var(--blanco);
  margin: 0 auto 1rem;
}
.contacto-sub {
  color: rgba(255, 255, 255, 0.45);
  font-size: 0.95rem;
  line-height: 1.6;
  margin-bottom: 3rem;
}
.contacto-form {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  text-align: left;
}
.form-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1rem;
}
@media (max-width: 560px) {
  .form-row {
    grid-template-columns: 1fr;
  }
}
.form-field {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
}
.form-field label {
  font-size: 0.72rem;
  font-weight: 700;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: rgba(255, 255, 255, 0.4);
}
.form-field input,
.form-field select,
.form-field textarea {
  background: rgba(255, 255, 255, 0.06);
  border: 1.5px solid rgba(255, 255, 255, 0.1);
  border-radius: 10px;
  padding: 0.85rem 1rem;
  color: #fff;
  font-family: 'DM Sans', sans-serif;
  font-size: 0.9rem;
  outline: none;
  transition: border-color 0.2s;
}
.form-field input:focus,
.form-field select:focus,
.form-field textarea:focus {
  border-color: var(--azul);
}
.form-field input::placeholder,
.form-field textarea::placeholder {
  color: rgba(255, 255, 255, 0.3);
}
.form-field select {
  color: rgba(255, 255, 255, 0.7);
}
.form-field select option {
  color: #fff;
  background: #111;
}
.form-field textarea {
  resize: vertical;
  min-height: 100px;
}
.form-submit {
  background: var(--azul);
  color: #fff;
  padding: 1rem 2.5rem;
  border-radius: 100px;
  font-family: 'DM Sans', sans-serif;
  font-size: 0.95rem;
  font-weight: 700;
  border: none;
  cursor: pointer;
  align-self: center;
  transition: background 0.2s, transform 0.15s;
  box-shadow: 0 4px 20px rgba(26, 111, 232, 0.35);
}
.form-submit:hover:not(:disabled) {
  background: var(--azul-dark);
  transform: translateY(-2px);
}
.form-submit:disabled {
  cursor: not-allowed;
  opacity: 0.85;
}
</style>

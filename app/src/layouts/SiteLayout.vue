<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute } from 'vue-router'
import { useLocaleLinks } from '../i18n/useLocaleLinks'
import { routeName } from '../router'

const { t } = useI18n()
const route = useRoute()
const { currentLocale, otherLocale, otherLocaleHref } = useLocaleLinks()

const scrolled = ref(false)
const drawerOpen = ref(false)

function onScroll() {
  scrolled.value = window.scrollY > 60
}

function isActive(baseName: string) {
  return route.meta.baseName === baseName
}

function closeDrawer() {
  drawerOpen.value = false
}

watch(drawerOpen, (open) => {
  document.body.style.overflow = open ? 'hidden' : ''
})

onMounted(() => {
  window.addEventListener('scroll', onScroll, { passive: true })
  onScroll()
})

onUnmounted(() => {
  window.removeEventListener('scroll', onScroll)
  document.body.style.overflow = ''
})
</script>

<template>
  <nav class="br-nav" :class="{ scrolled }">
    <router-link class="br-nav-logo" :to="{ name: routeName('home', currentLocale) }">
      <img src="/images/bairesrentallogoblanco.png" alt="BairesRental" />
    </router-link>
    <ul class="br-nav-links">
      <li><router-link :to="{ name: routeName('home', currentLocale), hash: '#por-que' }">{{ t('nav.services') }}</router-link></li>
      <li><router-link :to="{ name: routeName('home', currentLocale), hash: '#planes' }">{{ t('nav.plans') }}</router-link></li>
      <li><router-link :to="{ name: routeName('home', currentLocale), hash: '#contacto' }">{{ t('nav.owners') }}</router-link></li>
      <li><router-link :to="{ name: routeName('departamentos', currentLocale) }" :class="{ 'active-link': isActive('departamentos') }">{{ t('nav.rentals') }}</router-link></li>
      <li><router-link :to="{ name: routeName('ventas', currentLocale) }" :class="{ 'active-link': isActive('ventas') }">{{ t('nav.sales') }}</router-link></li>
      <li><router-link :to="{ name: routeName('tickets', currentLocale) }" :class="{ 'active-link': isActive('tickets') }">{{ t('nav.tickets') }}</router-link></li>
      <li><a href="https://wa.me/5491173735757" target="_blank" rel="noopener">{{ t('nav.contact') }}</a></li>
    </ul>
    <a :href="otherLocaleHref" class="br-lang-btn" :data-lang="currentLocale">
      <span class="br-lang-es">ES</span>
      <span class="br-lang-sep">·</span>
      <span class="br-lang-en">EN</span>
    </a>
    <router-link class="br-nav-cta" :to="{ name: routeName('home', currentLocale), hash: '#contacto' }">{{ t('nav.cta') }}</router-link>
    <button class="br-nav-toggle" aria-label="Menú" @click="drawerOpen = true">☰</button>
  </nav>

  <div class="br-mob-overlay" :class="{ open: drawerOpen }" @click="closeDrawer"></div>
  <div class="br-mob-drawer" :class="{ open: drawerOpen }">
    <div class="br-drawer-header">
      <img src="/images/bairesrentallogoblanco.png" alt="BairesRental" />
      <button class="br-drawer-close" aria-label="Cerrar" @click="closeDrawer">✕</button>
    </div>
    <ul class="br-drawer-links">
      <li><router-link :to="{ name: routeName('home', currentLocale), hash: '#por-que' }" @click="closeDrawer">{{ t('nav.services') }}</router-link></li>
      <li><router-link :to="{ name: routeName('home', currentLocale), hash: '#planes' }" @click="closeDrawer">{{ t('nav.plans') }}</router-link></li>
      <li><router-link :to="{ name: routeName('home', currentLocale), hash: '#contacto' }" @click="closeDrawer">{{ t('nav.owners') }}</router-link></li>
      <li><router-link :to="{ name: routeName('departamentos', currentLocale) }" :class="{ 'active-link': isActive('departamentos') }" @click="closeDrawer">{{ t('nav.rentals') }}</router-link></li>
      <li><router-link :to="{ name: routeName('ventas', currentLocale) }" :class="{ 'active-link': isActive('ventas') }" @click="closeDrawer">{{ t('nav.sales') }}</router-link></li>
      <li><router-link :to="{ name: routeName('tickets', currentLocale) }" :class="{ 'active-link': isActive('tickets') }" @click="closeDrawer">{{ t('nav.tickets') }}</router-link></li>
      <li><a href="https://wa.me/5491173735757" target="_blank" rel="noopener" @click="closeDrawer">{{ t('nav.contact') }}</a></li>
    </ul>
    <router-link class="br-drawer-cta" :to="{ name: routeName('home', currentLocale), hash: '#contacto' }" @click="closeDrawer">{{ t('nav.cta') }}</router-link>
    <div class="br-drawer-lang-row">
      <a :href="otherLocaleHref" class="br-lang-btn" :data-lang="currentLocale">
        <span class="br-lang-es">ES</span>
        <span class="br-lang-sep">·</span>
        <span class="br-lang-en">EN</span>
      </a>
    </div>
  </div>

  <slot />

  <footer>
    <div class="footer-inner">
      <div class="footer-brand">
        <img src="/images/bairesrentallogoblanco.png" alt="BairesRental" />
        <p>{{ t('footer.address') }}</p>
      </div>
      <div class="footer-links">
        <h4>{{ t('footer.pagesHeading') }}</h4>
        <ul>
          <li><router-link :to="{ name: routeName('departamentos', currentLocale) }">{{ t('nav.rentals') }}</router-link></li>
          <li><router-link :to="{ name: routeName('ventas', currentLocale) }">{{ t('nav.sales') }}</router-link></li>
          <li><router-link :to="{ name: routeName('tickets', currentLocale) }">{{ t('nav.tickets') }}</router-link></li>
          <li><router-link :to="{ name: routeName('home', currentLocale), hash: '#planes' }">{{ t('footer.plans') }}</router-link></li>
          <li><router-link :to="{ name: routeName('home', currentLocale), hash: '#contacto' }">{{ t('footer.freeAppraisal') }}</router-link></li>
        </ul>
      </div>
      <div class="footer-links">
        <h4>{{ t('footer.contactHeading') }}</h4>
        <ul>
          <li><router-link :to="{ name: routeName('home', currentLocale), hash: '#contacto' }">{{ t('footer.inquiries') }}</router-link></li>
          <li><a href="https://wa.me/5491173735757" target="_blank" rel="noopener">WhatsApp</a></li>
          <li><a href="https://chat.whatsapp.com/FeYh0RpkLqN0JnWiEi5ucG?mode=gi_t" target="_blank" rel="noopener">{{ t('footer.community') }}</a></li>
          <li><a href="https://www.instagram.com/bairesrentalok/" target="_blank" rel="noopener">Instagram</a></li>
        </ul>
      </div>
    </div>
    <div class="footer-bottom">
      <p>{{ t('footer.rights') }}</p>
    </div>
  </footer>
</template>

<style scoped>
/* Ported from the static site's per-page inline <style> (e.g. departamentos.html)
   rather than css/style.css, which never defined this nav/drawer/footer chrome. */
.br-nav {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  z-index: 1000;
  padding: 1.2rem 2rem;
  display: flex;
  align-items: center;
  gap: 1.2rem;
  transition: background 0.4s, backdrop-filter 0.4s, padding 0.3s;
  font-family: 'DM Sans', sans-serif;
}
.br-nav-logo {
  margin-right: auto;
}
.br-nav-logo img {
  height: 34px;
}
.br-nav.scrolled {
  background: rgba(17, 17, 17, 0.96);
  backdrop-filter: blur(12px);
  padding: 0.8rem 2rem;
  box-shadow: 0 1px 0 rgba(255, 255, 255, 0.08);
}
.br-nav-links {
  display: flex;
  gap: 1.45rem;
  list-style: none;
  margin: 0;
  padding: 0;
}
.br-nav-links a {
  font-family: 'DM Sans', sans-serif !important;
  color: rgba(255, 255, 255, 0.7) !important;
  text-decoration: none !important;
  font-size: 10.5px !important;
  font-weight: 600 !important;
  letter-spacing: 0.08em !important;
  text-transform: uppercase !important;
  transition: color 0.2s;
}
.br-nav-links a:hover,
.br-nav-links a.active-link {
  color: #fff !important;
}
.br-nav-cta {
  font-family: 'DM Sans', sans-serif !important;
  background: #1a6fe8 !important;
  color: #fff !important;
  padding: 9px 19px !important;
  border-radius: 100px !important;
  font-size: 13px !important;
  font-weight: 700 !important;
  text-decoration: none !important;
  transition: background 0.2s, transform 0.15s;
}
.br-nav-cta:hover {
  background: #1058c0 !important;
  transform: translateY(-1px);
}
.br-nav-toggle {
  display: none;
  background: none !important;
  border: none !important;
  color: white !important;
  cursor: pointer;
  font-size: 22px;
  width: 40px;
  height: 40px;
  align-items: center;
  justify-content: center;
  border-radius: 8px;
  transition: background 0.2s;
}
.br-nav-toggle:hover {
  background: rgba(255, 255, 255, 0.1) !important;
}
@media (max-width: 1100px) {
  .br-nav-links,
  .br-nav-cta {
    display: none !important;
  }
  .br-nav-toggle {
    display: flex !important;
  }
}

/* Mobile drawer */
.br-mob-overlay {
  display: none;
  position: fixed;
  inset: 0;
  z-index: 1001;
  background: rgba(0, 0, 0, 0.6);
  backdrop-filter: blur(4px);
}
.br-mob-overlay.open {
  display: block;
}
.br-mob-drawer {
  position: fixed;
  top: 0;
  right: -280px;
  bottom: 0;
  z-index: 1002;
  width: 280px;
  background: #111118;
  border-left: 1px solid rgba(255, 255, 255, 0.08);
  display: flex;
  flex-direction: column;
  padding: 1.5rem;
  transition: right 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}
.br-mob-drawer.open {
  right: 0;
}
.br-drawer-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 2rem;
}
.br-drawer-header img {
  height: 28px;
}
.br-drawer-close {
  background: none !important;
  border: none !important;
  color: rgba(255, 255, 255, 0.5);
  font-size: 1.5rem;
  cursor: pointer;
  line-height: 1;
  width: 36px;
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 8px;
  transition: background 0.2s, color 0.2s;
}
.br-drawer-close:hover {
  background: rgba(255, 255, 255, 0.08) !important;
  color: #fff;
}
.br-drawer-links {
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  flex: 1;
  margin: 0;
  padding: 0;
}
.br-drawer-links a {
  display: block !important;
  padding: 12px 16px !important;
  font-family: 'DM Sans', sans-serif !important;
  color: rgba(255, 255, 255, 0.7) !important;
  text-decoration: none !important;
  font-size: 15px !important;
  font-weight: 600 !important;
  border-radius: 10px;
  transition: background 0.2s, color 0.2s;
}
.br-drawer-links a:hover,
.br-drawer-links a.active-link {
  background: rgba(255, 255, 255, 0.06) !important;
  color: #fff !important;
}
.br-drawer-cta {
  display: block;
  text-align: center;
  background: #1a6fe8 !important;
  color: #fff !important;
  padding: 14px;
  border-radius: 100px;
  font-family: 'DM Sans', sans-serif !important;
  font-weight: 700 !important;
  font-size: 14.5px !important;
  text-decoration: none !important;
  margin-top: 1rem;
  transition: background 0.2s;
}
.br-drawer-cta:hover {
  background: #1058c0 !important;
}
.br-drawer-lang-row {
  display: flex;
  justify-content: center;
  margin-top: 1rem;
  padding-top: 1rem;
  border-top: 1px solid rgba(255, 255, 255, 0.08);
}
.br-drawer-lang-row .br-lang-btn {
  display: flex !important;
}

/* Lang toggle */
.br-lang-btn {
  background: rgba(255, 255, 255, 0.08) !important;
  border: 1px solid rgba(255, 255, 255, 0.18) !important;
  border-radius: 100px !important;
  color: rgba(255, 255, 255, 0.45) !important;
  font-family: 'DM Sans', sans-serif !important;
  font-size: 11px !important;
  font-weight: 700 !important;
  letter-spacing: 0.08em !important;
  padding: 5px 11px !important;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 3px;
  text-decoration: none !important;
  transition: background 0.2s;
}
.br-lang-btn:hover {
  background: rgba(255, 255, 255, 0.14) !important;
}
.br-lang-btn[data-lang='es'] .br-lang-es {
  color: #fff !important;
}
.br-lang-btn[data-lang='en'] .br-lang-en {
  color: #fff !important;
}
.br-lang-sep {
  opacity: 0.35;
}
@media (max-width: 1100px) {
  .br-nav .br-lang-btn {
    display: none !important;
  }
}

/* Footer */
footer {
  background: #0a0a0f;
  padding: 3rem 2rem 2rem;
  border-top: 1px solid rgba(255, 255, 255, 0.06);
  font-family: 'DM Sans', sans-serif;
}
.footer-inner {
  max-width: 1100px;
  margin: 0 auto;
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  flex-wrap: wrap;
  gap: 2rem;
}
.footer-brand img {
  height: 32px;
  margin-bottom: 0.75rem;
}
.footer-brand p {
  font-size: 13px !important;
  color: rgba(255, 255, 255, 0.3);
  font-family: 'DM Sans', sans-serif !important;
}
.footer-links h4 {
  font-size: 11px !important;
  letter-spacing: 0.15em;
  text-transform: uppercase;
  color: rgba(255, 255, 255, 0.4);
  margin-bottom: 12px;
  font-family: 'DM Sans', sans-serif !important;
}
.footer-links ul {
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 0;
}
.footer-links a {
  color: rgba(255, 255, 255, 0.45);
  font-size: 14px !important;
  text-decoration: none;
  transition: color 0.2s;
  font-family: 'DM Sans', sans-serif !important;
}
.footer-links a:hover {
  color: #fff;
}
.footer-bottom {
  max-width: 1100px;
  margin: 32px auto 0;
  padding-top: 24px;
  border-top: 1px solid rgba(255, 255, 255, 0.06);
  display: flex;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 16px;
}
.footer-bottom p {
  font-size: 12px !important;
  color: rgba(255, 255, 255, 0.25);
  font-family: 'DM Sans', sans-serif !important;
}
</style>

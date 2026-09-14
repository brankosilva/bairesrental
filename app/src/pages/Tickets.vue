<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { useHead } from '@unhead/vue'
import SiteLayout from '../layouts/SiteLayout.vue'
import { useLocaleLinks } from '../i18n/useLocaleLinks'

// M7: ports the root tickets.html landing for "Baires-Football
// Experience" — a parallel business (see docs/negocio.md). It's a real
// content page (hero, badge, trust points), not a bare JS redirect — the
// only actual redirect is the CTA link itself, which opens the external
// site (not part of this repo) in a new tab, same as the legacy page.
const { t } = useI18n()
const { currentLocale, hreflangLinks } = useLocaleLinks()

useHead({
  title: t('tickets.metaTitle'),
  meta: [{ name: 'description', content: t('tickets.metaDescription') }],
  link: [{ rel: 'canonical', href: `https://www.bairesrental.com.ar${currentLocale === 'en' ? '/en' : ''}/tickets` }, ...hreflangLinks],
})
</script>

<template>
  <SiteLayout>
    <main class="tk-page">
      <section class="tk-hero">
        <div class="tk-hero-bg"></div>
        <div class="tk-hero-content">
          <div class="tk-badge">{{ t('tickets.badge') }}</div>
          <h1 class="tk-title">
            Baires<span class="accent-green">-Football</span><br />
            <span class="accent-gold">Experience</span>
          </h1>
          <p class="tk-sub">{{ t('tickets.sub') }}</p>
          <a href="https://baires-football.com/" target="_blank" rel="noopener" class="tk-cta">
            <span>{{ t('tickets.cta') }}</span>
            <svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path d="M5 12h14M12 5l7 7-7 7" /></svg>
          </a>
          <div class="tk-trust">
            <div class="tk-trust-item">
              <span class="tk-trust-icon">🏟️</span>
              <span class="tk-trust-label">{{ t('tickets.trust1') }}</span>
            </div>
            <div class="tk-trust-item">
              <span class="tk-trust-icon">🎟️</span>
              <span class="tk-trust-label">{{ t('tickets.trust2') }}</span>
            </div>
            <div class="tk-trust-item">
              <span class="tk-trust-icon">⚡</span>
              <span class="tk-trust-label">{{ t('tickets.trust3') }}</span>
            </div>
            <div class="tk-trust-item">
              <span class="tk-trust-icon">🇦🇷</span>
              <span class="tk-trust-label">{{ t('tickets.trust4') }}</span>
            </div>
          </div>
        </div>
      </section>
    </main>
  </SiteLayout>
</template>

<style scoped>
.tk-page {
  font-family: 'DM Sans', sans-serif;
}
.tk-hero {
  position: relative;
  min-height: 80vh;
  display: flex;
  align-items: center;
  justify-content: center;
  text-align: center;
  overflow: hidden;
  background: #070e07;
}
.tk-hero-bg {
  position: absolute;
  inset: 0;
  z-index: 0;
  background: radial-gradient(ellipse 90% 55% at 50% 35%, rgba(45, 122, 34, 0.22) 0%, transparent 65%),
    radial-gradient(ellipse 50% 40% at 80% 70%, rgba(212, 166, 26, 0.08) 0%, transparent 60%), linear-gradient(170deg, #070e07 0%, #0a160a 50%, #050a05 100%);
}
.tk-hero-content {
  position: relative;
  z-index: 10;
  max-width: 760px;
  padding: 6rem 2rem 5rem;
  margin: 0 auto;
}
.tk-badge {
  display: inline-block;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.2em;
  text-transform: uppercase;
  color: rgba(255, 255, 255, 0.75);
  background: rgba(45, 122, 34, 0.2);
  border: 1px solid rgba(45, 122, 34, 0.45);
  padding: 6px 18px;
  border-radius: 100px;
  margin-bottom: 28px;
}
.tk-title {
  font-size: clamp(40px, 8vw, 80px);
  font-weight: 800;
  line-height: 1.05;
  letter-spacing: -0.04em;
  color: #fff;
  margin-bottom: 24px;
}
.tk-title .accent-green {
  color: #4caf50;
}
.tk-title .accent-gold {
  color: #d4a61a;
}
.tk-sub {
  font-size: clamp(15px, 1.8vw, 18px);
  color: rgba(255, 255, 255, 0.5);
  margin-bottom: 44px;
  line-height: 1.65;
  max-width: 540px;
  margin-left: auto;
  margin-right: auto;
}
.tk-cta {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  font-size: 15px;
  font-weight: 700;
  background: #2d7a22;
  color: #fff;
  padding: 15px 34px;
  border-radius: 100px;
  text-decoration: none;
  transition: background 0.2s, transform 0.2s;
  box-shadow: 0 6px 28px rgba(45, 122, 34, 0.35);
}
.tk-cta:hover {
  background: #236119;
  color: #fff;
  transform: translateY(-2px);
}
.tk-trust {
  display: flex;
  gap: 2rem;
  justify-content: center;
  flex-wrap: wrap;
  margin-top: 64px;
}
.tk-trust-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
}
.tk-trust-icon {
  font-size: 28px;
}
.tk-trust-label {
  font-size: 12px;
  color: rgba(255, 255, 255, 0.4);
  letter-spacing: 0.05em;
  text-transform: uppercase;
}
</style>

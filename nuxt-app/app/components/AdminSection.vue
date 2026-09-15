<script setup lang="ts">
// Section grouping for the /app/admin edit forms and the users-page invite
// panel — same visual role as the old static CMS's .section-divider
// (bairesrental/admin/index.html), reintroduced here since the Vue port
// of these forms dropped grouping entirely (one flat column of fields).
defineProps<{ title: string }>()
</script>

<template>
  <section class="admin-section">
    <h2 class="admin-section-title">{{ title }}</h2>
    <div class="admin-section-body">
      <slot />
    </div>
  </section>
</template>

<style scoped>
.admin-section {
  margin-bottom: 1.75rem;
}
.admin-section-title {
  font-size: 0.7rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: #6c757d;
  border-bottom: 1px solid #dee2e6;
  padding-bottom: 0.4rem;
  margin-bottom: 0.9rem;
}
</style>

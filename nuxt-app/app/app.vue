<template>
  <div>
    <NuxtRouteAnnouncer />
    <NuxtLayout>
      <NuxtPage />
    </NuxtLayout>
  </div>
</template>

<!-- El <style> que había acá era un parche: `body { font-family: 'DM Sans'
     !important }` para ganarle al `body { font-family: "Source Sans Pro" }`
     de la plantilla legacy que se cargaba globalmente. Esa hoja ya no se
     carga (ver nuxt.config.ts y public/css/legacy-template.css), así que
     el parche sobra. La tipografía por defecto, el reset y los tokens
     viven ahora en public/css/br-base.css. -->

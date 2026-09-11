import { defineConfig } from 'astro/config'
import tailwindcss from '@tailwindcss/vite'

// Static marketing site: no server runtime needed, so it ships as plain
// HTML/CSS/JS that any static host can serve.
export default defineConfig({
  output: 'static',

  // CONFIRM THIS BEFORE PUBLISHING. Without `site`, Astro.site is undefined
  // and the canonical link, the hreflang pair and the Open Graph image are
  // all emitted against the building machine's origin — localhost in
  // development — which breaks link previews and misleads crawlers.
  site: 'https://plintoapp.com',

  // Spanish is the default and lives at the root ('/'); English lives under
  // '/en/'. prefixDefaultLocale: false keeps '/' un-prefixed instead of
  // redirecting it to '/es/'.
  i18n: {
    defaultLocale: 'es',
    locales: ['es', 'en'],
    routing: {
      prefixDefaultLocale: false,
    },
  },

  vite: {
    plugins: [tailwindcss()],
  },
})

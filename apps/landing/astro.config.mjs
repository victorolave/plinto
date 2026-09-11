import { defineConfig } from 'astro/config'
import tailwindcss from '@tailwindcss/vite'

// Static marketing site: no server runtime needed, so it ships as plain
// HTML/CSS/JS that any static host can serve.
export default defineConfig({
  output: 'static',

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

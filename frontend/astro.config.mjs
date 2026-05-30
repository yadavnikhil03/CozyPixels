import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import sitemap from '@astrojs/sitemap';
import { fileURLToPath, URL } from 'node:url';

// https://astro.build/config
export default defineConfig({
  site: 'https://cozy-pixels.vercel.app',
  integrations: [react(), sitemap()],
  vite: {
    resolve: {
      alias: {
        '@': fileURLToPath(new URL('./src', import.meta.url)),
      },
    },
  },
});

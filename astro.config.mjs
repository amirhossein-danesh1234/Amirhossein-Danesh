import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

export default defineConfig({
  site: 'https://amirhossein-danesh.ir',
  output: 'static',
  integrations: [sitemap()],
});

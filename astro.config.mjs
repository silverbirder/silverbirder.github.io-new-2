import { satteri } from '@astrojs/markdown-satteri';
import { defineConfig } from 'astro/config';
import notebookImageDelivery from './src/lib/notebook-image-delivery.mjs';

export default defineConfig({
  output: 'static',
  markdown: {
    syntaxHighlight: false,
    processor: satteri({ hastPlugins: [notebookImageDelivery] }),
  },
  trailingSlash: 'always',
  base: process.env.ASTRO_BASE || '/',
});

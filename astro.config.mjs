import { satteri } from '@astrojs/markdown-satteri';
import { defineConfig } from 'astro/config';
import notebookCodeBlocks from './src/lib/notebook-code-blocks.mjs';
import notebookImageDelivery from './src/lib/notebook-image-delivery.mjs';

export default defineConfig({
  output: 'static',
  markdown: {
    syntaxHighlight: { type: 'shiki', excludeLangs: ['git'] },
    shikiConfig: {
      theme: 'tokyo-night',
      wrap: false,
      langAlias: { Dockerfile: 'dockerfile', feature: 'gherkin' },
    },
    processor: satteri({ hastPlugins: [notebookImageDelivery, notebookCodeBlocks] }),
  },
  trailingSlash: 'always',
  base: process.env.ASTRO_BASE || '/',
});

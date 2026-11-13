import { defineConfig } from 'astro/config';
import { resolve } from 'node:path';

export default defineConfig({
  output: 'static',
  site: process.env.SITE_URL || 'https://silverbirder.github.io',
  base: process.env.BASE_PATH || '/',
  trailingSlash: 'always',
  ...(process.env.OUTPUT_DIR ? { outDir: resolve(process.env.OUTPUT_DIR) } : {}),
});

import { defineConfig } from 'oxlint';
import sonarjs from 'eslint-plugin-sonarjs';

export default defineConfig({
  plugins: ['typescript', 'unicorn', 'oxc'],
  jsPlugins: ['eslint-plugin-sonarjs'],
  categories: {
    correctness: 'error',
    suspicious: 'error',
    perf: 'error',
  },
  rules: {
    ...sonarjs.configs.recommended.rules,
    'unicorn/prefer-number-properties': 'error',
    'eslint/complexity': [
      'error',
      {
        max: 10,
      },
    ],
    'sonarjs/cognitive-complexity': ['error', 15],
  },
  ignorePatterns: [
    '**/*.astro',
    'node_modules/**',
    'dist/**',
    '.astro/**',
    '.agents/**',
    '.cache/**',
    '.yomiyasu/**',
    'yomiyasu-work/**',
    '.husky/_/**',
  ],
});

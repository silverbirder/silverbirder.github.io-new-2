import astro from 'eslint-plugin-astro';
import tsParser from '@typescript-eslint/parser';

export default [
  {
    ignores: [
      'dist/**',
      '.astro/**',
      '.agents/**',
      '.cache/**',
      '.yomiyasu/**',
      'yomiyasu-work/**',
      '.husky/_/**',
    ],
  },
  ...astro.configs.recommended,
  ...astro.configs['jsx-a11y-recommended'],
  { files: ['**/*.astro'], languageOptions: { parserOptions: { parser: tsParser } } },
  {
    languageOptions: { globals: { process: 'readonly', console: 'readonly', URL: 'readonly' } },
    linterOptions: { reportUnusedDisableDirectives: 'error' },
  },
  {
    files: ['src/**/*.astro', 'src/**/*.{js,ts}'],
    rules: {
      'astro/no-set-html-directive': 'error',
      'astro/no-unsafe-inline-scripts': 'error',
      'astro/no-unused-css-selector': 'error',
      'no-restricted-globals': ['error', 'ResizeObserver', 'MutationObserver', 'getComputedStyle'],
    },
  },
];

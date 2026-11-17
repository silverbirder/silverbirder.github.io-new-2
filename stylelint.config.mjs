export default {
  extends: ['stylelint-config-standard'],
  referenceFiles: ['src/styles/**/*.css', '.astro/design-tokens.css'],
  reportNeedlessDisables: true,
  reportInvalidScopeDisables: true,
  reportDescriptionlessDisables: true,
  rules: {
    'no-unknown-custom-properties': true,
    'declaration-no-important': true,
    'color-no-hex': true,
    'function-disallowed-list': ['rgb', 'rgba', 'hsla', 'hwb', 'lab', 'lch', 'oklab', 'oklch'],
    'value-type-custom-property-required-list': [
      ['color', 'length', 'percentage', 'number', 'integer', 'angle', 'time'],
      { ignoreValues: ['Highlight', 'HighlightText'] },
    ],
  },
  overrides: [{ files: ['**/*.{astro,html}'], customSyntax: 'postcss-html' }],
};

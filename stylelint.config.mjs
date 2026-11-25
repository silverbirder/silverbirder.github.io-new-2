const hairline = 'var(--semantic-border-width-hairline)';
const noLine = 'var(--primitive-space-none)';
const borderSide = '^border(?:-(?:top|right|bottom|left|(?:block|inline)(?:-(?:start|end))?))?';
const withHairline = '/(?:^|\\s)var\\(--semantic-border-width-hairline\\)(?:\\s|$)/';

export default {
  extends: ['stylelint-config-recommended'],
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
    'declaration-property-value-allowed-list': {
      ['/' + borderSide + '$/']: ['none', noLine, withHairline],
      ['/' + borderSide + '-width$/']: [hairline, noLine],
      'text-decoration': ['none', withHairline],
      'text-decoration-thickness': [hairline],
      'stroke-width': [
        hairline,
        noLine,
        'var(--window-stroke-width-fallback)',
        '/^calc\\(\\s*var\\(--semantic-border-width-hairline\\)\\s*\\*/',
      ],
    },
  },
  overrides: [{ files: ['**/*.{astro,html}'], customSyntax: 'postcss-html' }],
};

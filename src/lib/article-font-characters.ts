export function fontProps(content: string, title: string, publishedAt: string, headings: string) {
  const fontText = `${content.replace(/<[^<>]*>/g, '')}${publishedAt}`;
  const boldText = /\*\*|__|<(?:strong|b)\b/i.test(content) ? fontText : headings;
  return {
    characters: [...new Set(` HxNODATE0123456789トップブログ${title}${fontText}`)].join(''),
    boldCharacters: [...new Set(` Hx${title}${boldText}`)].join(''),
  };
}

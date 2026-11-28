const textLanguages = new Set(['text', 'txt', 'plain', 'plaintext']);

export default {
  name: 'notebook-code-blocks',
  element: {
    filter: ['pre'],
    visit(node, context) {
      const code = node.children.find(
        (child) => child.type === 'element' && child.tagName === 'code',
      );
      if (!code) return;

      const languageClass = code.properties.className?.find((name) => name.startsWith('language-'));
      const language = node.properties.dataLanguage ?? languageClass?.slice('language-'.length);
      const label = !language || textLanguages.has(language) ? 'テキスト' : language.toUpperCase();

      context.wrapNode(node, {
        type: 'element',
        tagName: 'figure',
        properties: { className: ['notebook-code-frame'] },
        children: [
          {
            type: 'element',
            tagName: 'figcaption',
            properties: { className: ['notebook-code-language'] },
            children: [{ type: 'text', value: label }],
          },
        ],
      });
    },
  },
};

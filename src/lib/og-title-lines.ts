/* oxlint-disable eslint/no-await-in-loop -- Each width check depends on the previous result. */
import { jaModel, Parser } from 'budoux';

const parser = new Parser(jaModel);
const graphemes = new Intl.Segmenter('ja', { granularity: 'grapheme' });
const maxLines = 3;

type Fits = (text: string) => Promise<boolean>;

async function truncate(text: string, fits: Fits) {
  const characters = Array.from(graphemes.segment(text), ({ segment }) => segment);
  while (characters.length && !(await fits(characters.join('').trimEnd() + '…'))) {
    characters.pop();
  }
  return characters.join('').trimEnd() + '…';
}

export async function wrapOgTitle(title: string, fits: Fits) {
  const lines: string[] = [];
  let current = '';
  const content = title.trim();
  if (!content) return lines;
  if (await fits(content)) return [content];

  for (const phrase of parser.parse(content)) {
    const next = (current + phrase).trimStart();
    if (await fits(next)) {
      current = next;
      continue;
    }
    if (!current || lines.length === maxLines - 1) {
      return [...lines, await truncate(current || next, fits)];
    }
    lines.push(current.trimEnd());
    current = phrase.trimStart();
    if (!(await fits(current))) return [...lines, await truncate(current, fits)];
  }

  return current ? [...lines, current.trimEnd()] : lines;
}

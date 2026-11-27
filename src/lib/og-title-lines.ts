import { jaModel, Parser } from 'budoux';

const parser = new Parser(jaModel);
const graphemes = new Intl.Segmenter('ja', { granularity: 'grapheme' });
const maxLines = 3;

type Fits = (text: string) => Promise<boolean>;

async function truncate(text: string, fits: Fits) {
  const characters = Array.from(graphemes.segment(text), ({ segment }) => segment);

  async function shorten(): Promise<string> {
    const candidate = characters.join('').trimEnd() + '…';
    if (!characters.length || (await fits(candidate))) return candidate;
    characters.pop();
    return shorten();
  }

  return shorten();
}

export async function wrapOgTitle(title: string, fits: Fits) {
  const lines: string[] = [];
  const content = title.trim();
  if (!content) return lines;
  if (await fits(content)) return [content];

  const phrases = parser.parse(content);

  async function addPhrase(index: number, current: string): Promise<string[]> {
    const phrase = phrases[index];
    if (phrase === undefined) return current ? [...lines, current.trimEnd()] : lines;

    const next = (current + phrase).trimStart();
    if (await fits(next)) return addPhrase(index + 1, next);
    if (!current || lines.length === maxLines - 1) {
      return [...lines, await truncate(current || next, fits)];
    }

    lines.push(current.trimEnd());
    const start = phrase.trimStart();
    if (!(await fits(start))) return [...lines, await truncate(start, fits)];
    return addPhrase(index + 1, start);
  }

  return addPhrase(0, '');
}

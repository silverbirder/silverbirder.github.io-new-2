declare module 'budoux' {
  export const jaModel: unknown;

  export class Parser {
    constructor(model: unknown);
    parse(text: string): string[];
  }
}

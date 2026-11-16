import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, writeFileSync, rmSync, readFileSync } from 'node:fs';
import test from 'node:test';

function lint(input) {
  mkdirSync('.cache', { recursive: true });
  const directory = mkdtempSync('.cache/complexity-');
  const filename = `${directory}/fixture.ts`;
  writeFileSync(filename, input);
  const config = JSON.parse(readFileSync('.oxlintrc.json', 'utf8'));
  writeFileSync(`${directory}/config.json`, JSON.stringify({ ...config, ignorePatterns: [] }));
  try {
    return spawnSync(
      'node_modules/.bin/oxlint',
      ['--no-ignore', '--config', `${directory}/config.json`, filename],
      { encoding: 'utf8' },
    );
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
}
test('rejects too many independent branches', () => {
  const branches = Array.from({ length: 11 }, (_, i) => `if (x === ${i}) return ${i};`).join('\n');
  const result = lint(`export function example(x: number) { ${branches} return -1; }`);
  assert.equal(result.status, 1);
  assert.match(result.stdout + result.stderr, /eslint\(complexity\)/);
});
test('rejects deeply nested control flow', () => {
  const nesting = Array.from({ length: 7 }, (_, i) => `if (x > ${i}) {`).join('\n');
  const result = lint(
    `export function example(x: number) { ${nesting} return x; ${'}'.repeat(7)} return 0; }`,
  );
  assert.equal(result.status, 1);
  assert.match(result.stdout + result.stderr, /sonarjs\(cognitive-complexity\)/);
});
test('accepts a small function', () => {
  assert.equal(lint('export function example(x: number) { return x > 0 ? x : 0; }').status, 0);
});

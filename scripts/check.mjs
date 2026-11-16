import { spawn } from 'node:child_process';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';

await mkdir('.cache/tmp', { recursive: true });
const env = {
  ...process.env,
  ASTRO_TELEMETRY_DISABLED: '1',
  ASTRO_BASE: '/',
  npm_config_cache: path.resolve('.cache/npm'),
  PLAYWRIGHT_BROWSERS_PATH: path.resolve('.cache/playwright'),
  TMPDIR: path.resolve('.cache/tmp'),
};
function run(script) {
  return new Promise((resolve, reject) => {
    const child = spawn('npm', ['run', script], { stdio: 'inherit', env });
    child.once('error', reject);
    child.once('exit', (code) =>
      code === 0 ? resolve() : reject(new Error(`${script} failed (${code})`)),
    );
  });
}
const fast = [
  'format:check',
  'lint:js',
  'lint:astro',
  'lint:css',
  'lint:md',
  'lint:config',
  'typecheck',
  'test',
  'lint:unused',
  'lint:duplicates',
  'audit',
];
const results = await Promise.allSettled(fast.map(run));
const errors = results.filter((result) => result.status === 'rejected');
if (errors.length) {
  for (const result of errors) console.error(result.reason.message);
  process.exitCode = 1;
} else {
  for (const script of ['build', 'lint:html', 'check:assets', 'check:browser']) await run(script);
}

import { copyFile, readdir, rm } from 'node:fs/promises';
import { join } from 'node:path';

export async function copyPublishedSnapshot(snapshot, directory) {
  const entries = await readdir(snapshot, { withFileTypes: true });
  if (
    entries.some(
      (entry) => !entry.isFile() || !/^[A-Za-z0-9][A-Za-z0-9._-]*\.md$/u.test(entry.name),
    )
  )
    throw new Error('Invalid public article snapshot');
  const names = new Set(entries.map(({ name }) => name));
  await removeStaleArticles(directory, names);
  await Promise.all(
    Array.from(names, (name) => copyFile(join(snapshot, name), new URL(name, directory))),
  );
}

export async function removeStaleArticles(directory, names) {
  const entries = await readdir(directory, { withFileTypes: true });
  const stale = entries.filter(({ name }) => name.endsWith('.md') && !names.has(name));
  await Promise.all(stale.map(({ name }) => rm(new URL(name, directory))));
  if (entries.some((entry) => names.has(entry.name) && !entry.isFile()))
    throw new Error('The published archive contains a non-file article');
}

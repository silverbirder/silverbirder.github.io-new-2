import { readFile } from 'node:fs/promises';
import type { APIRoute, GetStaticPaths } from 'astro';
import { loadLinkCards } from '../../lib/blog-link-card-source';

export const getStaticPaths = (() =>
  Array.from(loadLinkCards().images, ([hash, path]) => ({
    params: { hash },
    props: { path },
  }))) satisfies GetStaticPaths;

export const GET: APIRoute = async ({ props }) =>
  new Response(new Uint8Array(await readFile(props.path)), {
    headers: { 'Content-Type': 'image/webp' },
  });

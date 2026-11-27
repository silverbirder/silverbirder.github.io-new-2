import type { APIRoute, GetStaticPaths, InferGetStaticPropsType } from 'astro';
import { centerOgText, renderOpenGraphImage } from '../lib/open-graph-image';
import { siteOpenGraphPages } from '../lib/site-open-graph';

export const getStaticPaths = (() => {
  return Object.values(siteOpenGraphPages).map(({ imagePath, title, caption }) => ({
    params: { ogImage: imagePath },
    props: { title, caption },
  }));
}) satisfies GetStaticPaths;

export const GET: APIRoute<InferGetStaticPropsType<typeof getStaticPaths>> = async ({ props }) => {
  const text = await Promise.all([
    centerOgText(props.title, 80, 380),
    centerOgText(props.caption, 28, 465),
  ]);
  return renderOpenGraphImage(text, { top: 122, diameter: 172, padding: 23, border: 6 });
};

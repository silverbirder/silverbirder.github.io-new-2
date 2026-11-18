import type { APIRoute } from 'astro';
import { fetchCMSAsset, getCMSAssets } from '../../lib/cms';

export async function getStaticPaths() {
  const assets = await getCMSAssets();
  return assets.map((asset) => ({ params: { id: asset.id }, props: { asset } }));
}

export const GET: APIRoute = async ({ props }) =>
  new Response(await fetchCMSAsset(props.asset), {
    headers: { 'Content-Type': props.asset.contentType },
  });

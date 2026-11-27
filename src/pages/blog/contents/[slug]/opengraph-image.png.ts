import type { APIRoute, GetStaticPaths, InferGetStaticPropsType } from 'astro';
import { articleSlug } from '../../../../lib/article-slug';
import { getBlogArticles } from '../../../../lib/blog-articles';
import { wrapOgTitle } from '../../../../lib/og-title-lines';
import {
  centerOgText,
  ogImageSize,
  ogTitleFits,
  renderOpenGraphImage,
} from '../../../../lib/open-graph-image';

export const getStaticPaths = (async () => {
  const articles = await getBlogArticles();
  return articles.map(({ article }) => ({
    params: { slug: articleSlug(article.id) },
    props: { title: article.data.title },
  }));
}) satisfies GetStaticPaths;

export const GET: APIRoute<InferGetStaticPropsType<typeof getStaticPaths>> = async ({ props }) => {
  const titleInset = 88;
  const titleSize = 68;
  const titleWidth = ogImageSize.width - 2 * titleInset;
  const titleRowHeight = 84;
  const avatarDiameter = 104;
  const avatarGap = 48;

  const titleLines = await wrapOgTitle(props.title, (line) =>
    ogTitleFits(line, titleSize, titleWidth),
  );
  const titleBlockHeight = titleLines.length * titleRowHeight;
  const groupHeight = titleBlockHeight + avatarGap + avatarDiameter;
  const titleTop = (ogImageSize.height - groupHeight) / 2;
  const avatarTop = titleTop + titleBlockHeight + avatarGap;
  const text = await Promise.all(
    titleLines.map((line, index) =>
      centerOgText(line, titleSize, titleTop + (index + 0.5) * titleRowHeight),
    ),
  );

  return renderOpenGraphImage(text, {
    top: avatarTop,
    diameter: avatarDiameter,
    padding: 15,
    border: 4,
  });
};

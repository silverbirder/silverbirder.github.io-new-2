import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';

const schema = z.object({
  draftId: z
    .string()
    .regex(/^[a-z0-9][a-z0-9-]*$/u)
    .optional(),
  publicationId: z
    .string()
    .regex(/^[a-f0-9]{64}$/u)
    .optional(),
  number: z.number().optional(),
  index: z.boolean().optional(),
  title: z.string().trim().min(1),
  summary: z.string().trim().nullish(),
  publishedAt: z.string().regex(/^\d{4}-\d{2}-\d{2}(?:T.+)?$/u),
});

function articles(base: string) {
  return defineCollection({
    loader: glob({
      base,
      pattern: '*.md',
      generateId: ({ entry }) => entry.slice(0, -'.md'.length),
    }),
    schema,
  });
}

export const collections = {
  published: articles('./.cache/cms-published'),
};

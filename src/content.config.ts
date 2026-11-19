import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';

const published = defineCollection({
  loader: glob({ base: './.cache/cms-published', pattern: '*.md' }),
  schema: z.object({
    publicationId: z
      .string()
      .regex(/^[a-f0-9]{64}$/u)
      .optional(),
    title: z.string().trim().min(1),
    publishedAt: z.string().regex(/^\d{4}-\d{2}-\d{2}(?:T.+)?$/u),
  }),
});

export const collections = { published };

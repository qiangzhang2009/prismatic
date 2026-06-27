/**
 * Prismatic — Sitemap
 * Auto-generated sitemap for SEO
 */

import { MetadataRoute } from 'next';
import { PERSONA_INDEX } from '@/lib/persona-index';

const BASE_URL = 'https://prismatic.zxqconsulting.com';

export default function sitemap(): MetadataRoute.Sitemap {
  const staticPages = [
    {
      url: BASE_URL,
      lastModified: new Date(),
      changeFrequency: 'daily' as const,
      priority: 1,
    },
    {
      url: `${BASE_URL}/personas`,
      lastModified: new Date(),
      changeFrequency: 'weekly' as const,
      priority: 0.9,
    },
    {
      url: `${BASE_URL}/methodology`,
      lastModified: new Date(),
      changeFrequency: 'monthly' as const,
      priority: 0.8,
    },
    {
      url: `${BASE_URL}/pricing`,
      lastModified: new Date(),
      changeFrequency: 'monthly' as const,
      priority: 0.8,
    },
    {
      url: `${BASE_URL}/forum/debate`,
      lastModified: new Date(),
      changeFrequency: 'daily' as const,
      priority: 0.7,
    },
    {
      url: `${BASE_URL}/graph`,
      lastModified: new Date(),
      changeFrequency: 'weekly' as const,
      priority: 0.7,
    },
    {
      url: `${BASE_URL}/observatory`,
      lastModified: new Date(),
      changeFrequency: 'weekly' as const,
      priority: 0.7,
    },
    {
      url: `${BASE_URL}/app`,
      lastModified: new Date(),
      changeFrequency: 'weekly' as const,
      priority: 0.8,
    },
  ];

  // Dynamic persona pages
  const personaPages = PERSONA_INDEX.map((persona) => ({
    url: `${BASE_URL}/personas/${persona.slug}`,
    lastModified: new Date(),
    changeFrequency: 'monthly' as const,
    priority: persona.hasDistillationData ? 0.8 : 0.6,
  }));

  return [...staticPages, ...personaPages];
}

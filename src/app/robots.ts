/**
 * Prismatic — Robots.txt
 */

import { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/api/', '/admin/', '/settings/', '/conversations/'],
    },
    sitemap: 'https://prismatic.zxqconsulting.com/sitemap.xml',
  };
}

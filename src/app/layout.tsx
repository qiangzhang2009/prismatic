import type { Metadata } from 'next';
import Script from 'next/script';
import './globals.css';
import { Providers } from '@/components/providers';

export const metadata: Metadata = {
  title: 'Prismatic · 折射之光',
  description: '汇聚人类最卓越思维的多智能体协作平台，让乔布斯、马斯克、芒格、费曼同时为你思考。',
  keywords: ['AI', '多智能体', '认知蒸馏', '心智模型', '思维伙伴', '协作'],
  authors: [{ name: 'Prismatic' }],
  openGraph: {
    title: 'Prismatic · 折射之光',
    description: '汇聚人类最卓越思维的多智能体协作平台',
    type: 'website',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="zh" className="dark">
      <head>
        <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        {/* Prismatic Analytics Tracking SDK */}
        <Script
          src="/dist/zxq-tracking-v2.min.js"
          strategy="afterInteractive"
          crossOrigin="anonymous"
        />
      </head>
      <body className="min-h-screen bg-bg-base antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}

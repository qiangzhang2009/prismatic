import type { Metadata } from 'next';
import './globals.css';
import { Providers } from '@/components/providers';

export const metadata: Metadata = {
  title: 'Prismatic · 折射之光',
  description: '汇聚人类最卓越思维的多智能体协作平台。让乔布斯、马斯克、芒格、费曼同时为你思考。',
  keywords: ['AI', 'multi-agent', 'thinking', 'mental models', 'persona', 'collaboration'],
  authors: [{ name: 'Prismatic' }],
  openGraph: {
    title: 'Prismatic · 折射之光',
    description: '让每一个卓越灵魂为你思考',
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
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      </head>
      <body className="min-h-screen bg-bg-base antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}

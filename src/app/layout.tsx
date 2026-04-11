import type { Metadata } from 'next';
import './globals.css';
import { Providers } from '@/components/providers';

export const metadata: Metadata = {
  title: '炼心阁 · 认知蒸馏会客厅',
  description: '让古今中外的智者同堂，为你的问题各抒己见。芒格、马斯克、乔布斯、费曼……选择你的智囊团，开启多维度思考之旅。',
  keywords: ['AI', '多智能体', '认知蒸馏', '心智模型', '思维伙伴', '协作'],
  authors: [{ name: '炼心阁' }],
  openGraph: {
    title: '炼心阁 · 认知蒸馏会客厅',
    description: '让古今中外的智者同堂，为你的问题各抒己见',
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
      </head>
      <body className="min-h-screen bg-bg-base antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}

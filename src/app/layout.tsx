import type { Metadata } from 'next';
import Script from 'next/script';
import { Inter, Inter_Tight, JetBrains_Mono } from 'next/font/google';
import './globals.css';
import { Providers } from '@/components/providers';
import { NavBar } from '@/components/nav-bar';

// Self-hosted via next/font: Next.js downloads the font files at build time
// and serves them from Vercel CDN. This eliminates the <link rel="stylesheet">
// to fonts.googleapis.com which was unreachable from mainland-China mobile
// networks (caused blank-page / "can't open" on iPad/phone).
const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-inter',
});
const interTight = Inter_Tight({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-inter-tight',
});
const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-jetbrains-mono',
});

export const metadata: Metadata = {
  metadataBase: new URL('https://prismatic.zxqconsulting.com'),
  title: {
    default: 'Prismatic · 棱镜折射',
    template: '%s | Prismatic 棱镜折射',
  },
  description: '汇聚人类最卓越思维的多智能体协作平台，让乔布斯、马斯克、芒格、费曼同时为你思考。认知蒸馏技术，提取真实思想家的思维模型和表达DNA。',
  keywords: ['AI', '多智能体', '认知蒸馏', '心智模型', '思维伙伴', '协作', 'ChatGPT', 'LLM', '思想家', '哲学'],
  authors: [{ name: 'Prismatic' }],
  creator: 'Prismatic',
  publisher: 'Prismatic',
  openGraph: {
    type: 'website',
    locale: 'zh_CN',
    url: 'https://prismatic.zxqconsulting.com',
    siteName: 'Prismatic 棱镜折射',
    title: 'Prismatic · 棱镜折射',
    description: '汇聚人类最卓越思维的多智能体协作平台',
    images: [
      {
        url: '/og-image.png',
        width: 1200,
        height: 630,
        alt: 'Prismatic 棱镜折射',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Prismatic · 棱镜折射',
    description: '汇聚人类最卓越思维的多智能体协作平台',
    images: ['/og-image.png'],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  // Google Search Console verification: set NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION in env,
  // otherwise the meta tag is omitted (avoids serving the placeholder string).
  ...(process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION
    ? { verification: { google: process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION } }
    : {}),
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
        {/* Prismatic Analytics Tracking SDK — served as static file from Vercel CDN */}
        <Script
          src="/tracking-sdk.js"
          strategy="lazyOnload"
        />
      </head>
      <body className={`${inter.variable} ${interTight.variable} ${jetbrainsMono.variable} min-h-screen bg-bg-base antialiased`}>
        <NavBar />
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}

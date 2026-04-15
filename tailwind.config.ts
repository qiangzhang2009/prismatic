import type { Config } from 'tailwindcss';

const config: Config = {
  darkMode: ['class'],
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // Deep space background
        'bg-base': '#0a0a0f',
        'bg-surface': '#12121a',
        'bg-elevated': '#1a1a25',
        'bg-overlay': '#22222e',
        'bg-glass': 'rgba(18, 18, 26, 0.8)',

        // Prism spectrum
        prism: {
          red: '#ff6b6b',
          yellow: '#ffd93d',
          green: '#6bcb77',
          blue: '#4d96ff',
          purple: '#c77dff',
          orange: '#ff9f43',
          pink: '#ff6b9d',
          cyan: '#67e8f9',
        },

        // Text
        'text-primary': '#f1f5f9',
        'text-secondary': '#cbd5e1',
        'text-muted': '#94a3b8',

        // Border
        'border-subtle': 'rgba(255, 255, 255, 0.06)',
        'border-medium': 'rgba(255, 255, 255, 0.12)',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
        display: ['Inter Tight', 'system-ui', 'sans-serif'],
      },
      animation: {
        'prism-spin': 'prismSpin 12s linear infinite',
        'fade-in': 'fadeIn 0.4s ease-out',
        'slide-up': 'slideUp 0.4s ease-out',
        'glow-pulse': 'glowPulse 3s ease-in-out infinite',
        'refract': 'refract 0.6s ease-out',
        'scale-in': 'scaleIn 0.3s ease-out',
      },
      keyframes: {
        prismSpin: {
          '0%': { filter: 'hue-rotate(0deg)' },
          '100%': { filter: 'hue-rotate(360deg)' },
        },
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(20px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        glowPulse: {
          '0%, 100%': { opacity: '0.4', transform: 'scale(1)' },
          '50%': { opacity: '0.8', transform: 'scale(1.05)' },
        },
        refract: {
          '0%': { opacity: '0', transform: 'translateY(30px) scale(0.95)', filter: 'blur(8px)' },
          '100%': { opacity: '1', transform: 'translateY(0) scale(1)', filter: 'blur(0px)' },
        },
        scaleIn: {
          '0%': { opacity: '0', transform: 'scale(0.9)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
      },
      backgroundImage: {
        'prism-gradient': 'linear-gradient(135deg, #ff6b6b 0%, #ffd93d 25%, #6bcb77 50%, #4d96ff 75%, #c77dff 100%)',
        'glass-gradient': 'linear-gradient(135deg, rgba(255,255,255,0.05) 0%, rgba(255,255,255,0.02) 100%)',
      },
      boxShadow: {
        'prism': '0 0 30px rgba(77, 150, 255, 0.15), 0 0 60px rgba(199, 125, 255, 0.1)',
        'prism-strong': '0 0 40px rgba(77, 150, 255, 0.25), 0 0 80px rgba(199, 125, 255, 0.15)',
        'card': '0 4px 24px rgba(0, 0, 0, 0.4)',
        'card-hover': '0 8px 40px rgba(0, 0, 0, 0.6)',
      },
    },
  },
  plugins: [require('@tailwindcss/typography')],
};

export default config;

/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // 深空背景
        'bg-base': '#0a0a0f',
        'bg-surface': '#12121a',
        'bg-elevated': '#1a1a25',
        'bg-overlay': '#22222e',
        // 文字颜色
        'text-primary': '#f1f5f9',
        'text-secondary': '#94a3b8',
        'text-muted': '#475569',
        // 主色调：折射棱镜
        'prism-1': '#ff6b6b',
        'prism-2': '#ffd93d',
        'prism-3': '#6bcb77',
        'prism-4': '#4d96ff',
        'prism-5': '#c77dff',
        'prism-6': '#ff9f43',
        'prism-neutral': '#64748b',
      },
      fontFamily: {
        sans: ['Inter', 'Noto Sans SC', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
    },
  },
  plugins: [],
};

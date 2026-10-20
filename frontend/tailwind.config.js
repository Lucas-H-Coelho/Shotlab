/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: ['class', '[data-theme="dark"]'],
  theme: {
    extend: {
      colors: {
        void: 'var(--bg-void)',
        chassis: 'var(--bg-chassis)',
        surface: 'var(--bg-surface)',
        elevated: 'var(--bg-elevated)',
        'interactive-hover': 'var(--bg-interactive-hover)',
        hairline: 'var(--border-hairline)',
        specular: 'var(--border-specular)',
        'primary-text': 'var(--text-primary)',
        'secondary-text': 'var(--text-secondary)',
        'muted-text': 'var(--text-muted)',
        optic: {
          DEFAULT: 'var(--accent-optic)',
          muted: 'var(--accent-optic-muted)',
        },
        tally: {
          DEFAULT: 'var(--accent-tally)',
        },
        'status-ok': 'var(--status-ok)',
      },
      fontFamily: {
        sans: ['Inter', 'Geist', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
        mono: ['JetBrains Mono', 'Geist Mono', 'SFMono-Regular', 'Menlo', 'Monaco', 'Consolas', 'monospace'],
      },
      borderRadius: {
        DEFAULT: '4px',
        sm: '2px',
        md: '4px',
        lg: '6px',
        xl: '8px',
      },
    },
  },
  plugins: [],
}

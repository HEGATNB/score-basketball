/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        display: ['"Barlow Condensed"', '"Bebas Neue"', 'sans-serif'],
        display2: ['"Bebas Neue"', '"Barlow Condensed"', 'sans-serif'],
        sans: ['"Space Grotesk"', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'monospace'],
      },
      colors: {
        // Surfaces — deep court hue
        bg: { DEFAULT: '#08080b', 2: '#0e0e13' },
        surface: { DEFAULT: '#14141c', 2: '#1b1b25', 3: '#23232f' },
        // Text
        text: { DEFAULT: '#f5f1ea', 2: '#c2bfb8', 3: '#8a8a92', mute: '#5a5a64' },
        // Accents
        accent: {
          DEFAULT: '#ff5a1f',
          soft: 'rgba(255, 90, 31, 0.14)',
          glow: 'rgba(255, 90, 31, 0.55)',
        },
        gold: '#ffb800',
        neon: '#d1ff3a',
        info: '#5db8ff',
        danger: '#ff3858',
        ok: '#2ee68a',
      },
      borderRadius: {
        sm: '8px',
        md: '14px',
        lg: '22px',
        pill: '999px',
      },
      boxShadow: {
        lg: '0 30px 80px -20px rgba(0,0,0,0.7)',
        accent: '0 8px 24px -8px rgba(255,90,31,0.55)',
        'accent-lg': '0 30px 60px -20px rgba(255,90,31,0.55)',
      },
      keyframes: {
        marquee: {
          from: { transform: 'translateX(0)' },
          to: { transform: 'translateX(-50%)' },
        },
        pulseDot: {
          '0%, 100%': { boxShadow: '0 0 0 0 rgba(255, 56, 88, 0.5)' },
          '70%': { boxShadow: '0 0 0 6px rgba(255, 56, 88, 0)' },
        },
        heroFade: {
          '0%, 18%': { opacity: '0', transform: 'scale(1.18)' },
          '4%, 14%': { opacity: '0.55' },
          '25%, 100%': { opacity: '0', transform: 'scale(1.05)' },
        },
        glowPulse: {
          '0%, 100%': { opacity: '0.45' },
          '50%': { opacity: '0.85' },
        },
        floatY: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-6px)' },
        },
        ringExpand: {
          '0%': { transform: 'scale(0.9)', opacity: '0.8' },
          '100%': { transform: 'scale(1.6)', opacity: '0' },
        },
        kenBurns: {
          from: { transform: 'scale(1.05) translate(0, 0)' },
          to: { transform: 'scale(1.15) translate(-2%, -1%)' },
        },
      },
      animation: {
        marquee: 'marquee 38s linear infinite',
        'pulse-dot': 'pulseDot 1.2s infinite',
        'hero-fade': 'heroFade 24s infinite',
        'glow-pulse': 'glowPulse 3s ease-in-out infinite',
        'float-y': 'floatY 4s ease-in-out infinite',
        'ring-expand': 'ringExpand 2s ease-out infinite',
        'ken-burns': 'kenBurns 12s ease-in-out infinite alternate',
      },
      letterSpacing: {
        editorial: '-0.005em',
        wide: '0.05em',
        mono1: '0.1em',
        mono2: '0.14em',
        mono3: '0.18em',
        mono4: '0.2em',
      },
    },
  },
  plugins: [],
};

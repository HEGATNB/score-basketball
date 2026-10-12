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
        // Surfaces — deep cool navy (blue-charcoal, eye-comfort tuned)
        bg: { DEFAULT: '#0a0e1a', 2: '#0d1322' },
        surface: { DEFAULT: '#131a2c', 2: '#1a2238', 3: '#232d47' },
        // Text — cool off-white neutrals (reduce glare on navy)
        text: { DEFAULT: '#eef2fb', 2: '#aeb8cf', 3: '#76819f', mute: '#515c78' },
        // SCORE brand — warm amber-orange accent on navy
        accent: {
          DEFAULT: '#d26a34',
          2: '#e48a54',
          soft: 'rgba(210, 106, 52, 0.13)',
          glow: 'rgba(210, 106, 52, 0.34)',
          strong: '#e48a54',
          deep: '#9c4719',
        },
        // AI is a cool azure — complementary contrast to the orange accent
        ai: {
          DEFAULT: '#d99a4f',
          soft: 'rgba(217, 154, 79, 0.13)',
          glow: 'rgba(217, 154, 79, 0.32)',
          deep: '#8a5a1f',
        },
        positive: {
          DEFAULT: '#38d39f',
          soft: 'rgba(56, 211, 159, 0.12)',
          glow: 'rgba(56, 211, 159, 0.32)',
        },
        confidence: {
          DEFAULT: '#ffb454',
          soft: 'rgba(255, 180, 84, 0.12)',
          glow: 'rgba(255, 180, 84, 0.32)',
        },
        gold: '#e3b341',
        neon: '#8fe04a',
        info: '#d99a4f',
        danger: '#ff5d6c',
        ok: '#38d39f',
      },
      borderRadius: {
        sm: '8px',
        md: '14px',
        lg: '22px',
        pill: '999px',
      },
      boxShadow: {
        lg: '0 30px 80px -20px rgba(0,0,0,0.7)',
        accent: '0 8px 24px -8px rgba(210,106,52,0.34)',
        'accent-lg': '0 30px 60px -20px rgba(210,106,52,0.36)',
        ai: '0 8px 24px -8px rgba(217,154,79,0.32)',
        'ai-lg': '0 24px 60px -16px rgba(217,154,79,0.36)',
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

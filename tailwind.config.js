/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx}",
    "./components/**/*.{js,ts,jsx,tsx}",
    "./app/**/*.{js,ts,jsx,tsx}"
  ],
  theme: {
    extend: {
      colors: {
        app: {
          bg: '#080B12',
          surface: '#111827',
          elevated: '#151E2E',
          hover: '#1B2638',
          border: '#273244',
          text: '#F8FAFC',
          muted: '#94A3B8',
          primary: '#8B5CF6',
          secondary: '#06B6D4',
          success: '#22C55E',
          warning: '#F59E0B',
          danger: '#EF4444',
          star: '#FACC15',
        }
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        display: ['"Space Grotesk"', 'Inter', 'sans-serif'],
      },
      borderRadius: {
        '4xl': '2rem',
      },
      boxShadow: {
        'card': '0 4px 24px rgba(0,0,0,0.32)',
        'elevated': '0 18px 48px rgba(0,0,0,0.40)',
      },
      spacing: {
        'safe-bottom': 'env(safe-area-inset-bottom, 0px)',
      }
    }
  },
  plugins: []
};

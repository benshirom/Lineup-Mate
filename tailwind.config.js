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
          bgSoft: '#0D111A',
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
          star: '#FACC15'
        }
      },
      borderRadius: {
        card: '24px',
        control: '16px',
        pill: '999px'
      },
      boxShadow: {
        card: '0 18px 48px rgba(0,0,0,0.24)',
        glow: '0 0 32px rgba(139,92,246,0.20)'
      },
      fontFamily: {
        heading: ['Space Grotesk', 'Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        body: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif']
      }
    }
  },
  plugins: []
};

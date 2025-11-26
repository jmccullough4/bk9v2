/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        'bluek9': {
          'dark': '#1a1f16',      // Dark olive
          'darker': '#0f120d',    // Darker olive/brown
          'blue': '#2d4a2b',      // Forest green
          'cyan': '#4a7c59',      // Military green
          'red': '#8b4513',       // Saddle brown
          'green': '#556b2f',     // Dark olive green
          'yellow': '#9b7653',    // Tan/brown
        }
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'ping-slow': 'ping 2s cubic-bezier(0, 0, 0.2, 1) infinite',
      }
    },
  },
  plugins: [],
}

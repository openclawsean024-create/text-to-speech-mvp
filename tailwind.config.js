module.exports = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        primary: '#8B5CF6',
        'primary-hover': '#7C3AED',
        secondary: '#6366F1',
        accent: '#EC4899',
        'bg-main': '#FAFAFA',
        surface: '#FFFFFF',
        'text-primary': '#1A1A1A',
        'text-secondary': '#71717A',
        border: '#E4E4E7',
        error: '#EF4444',
        success: '#22C55E',
      },
    },
  },
  plugins: [],
}

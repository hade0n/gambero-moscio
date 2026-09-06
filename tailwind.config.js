/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        cream: '#FFF3E2',
        'cream-soft': '#FFF9F1',
        terracotta: '#D96B32',
        'terracotta-deep': '#BB5A20',
        apricot: '#E98B4A',
        green: '#5F8F3A',
        'green-deep': '#385C32',
        brown: '#3A2A22',
        'brown-soft': '#6B564B',
        rating: '#E39A2D',
        danger: '#B23B2E',
      },
      fontFamily: {
        display: ['Fraunces', 'Playfair Display', 'Georgia', 'serif'],
        sans: ['Karla', 'system-ui', '-apple-system', 'Segoe UI', 'sans-serif'],
      },
      borderColor: {
        DEFAULT: 'rgba(58,42,34,0.12)',
      },
      // PNDR Material — elevation morbida, diffusa, tinta calda (marrone).
      // Poca distanza, grande blur, bassa intensità. Mai ombre nere pesanti.
      boxShadow: {
        xs: '0 1px 2px rgba(58,42,34,0.04), 0 1px 3px rgba(58,42,34,0.05)',
        sm: '0 2px 6px rgba(58,42,34,0.05), 0 6px 16px rgba(58,42,34,0.06)',
        md: '0 4px 10px rgba(58,42,34,0.06), 0 14px 30px rgba(58,42,34,0.10)',
        lg: '0 10px 24px rgba(58,42,34,0.10), 0 28px 64px rgba(58,42,34,0.16)',
        xl: '0 8px 20px rgba(58,42,34,0.14), 0 20px 48px rgba(58,42,34,0.18)',
      },
      // PNDR Material — gerarchia dei raggi: morbidi, con gerarchia (no pillola ovunque).
      borderRadius: {
        sm: '0.625rem', // 10px  — micro elementi, badge
        DEFAULT: '0.75rem', // 12px  — elementi piccoli
        md: '0.75rem', // 12px
        lg: '0.875rem', // 14px  — input, select, textarea
        xl: '1.125rem', // 18px  — pulsanti, contenitori medi
        '2xl': '1.375rem', // 22px  — card
        '3xl': '1.75rem', // 28px  — modali, gallerie
      },
      maxWidth: {
        content: '72rem',
      },
      transitionDuration: {
        DEFAULT: '200ms',
      },
      transitionTimingFunction: {
        pndr: 'cubic-bezier(0.2, 0.7, 0.2, 1)',
      },
    },
  },
  plugins: [],
};

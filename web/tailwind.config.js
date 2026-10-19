/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        olive: '#5F7050',
        'olive-soft': '#EEF0E8',
        'olive-line': '#D9DDCF',
        bg: '#F4F2EC',
        card: '#FDFCF9',
        ink: '#2B2B26',
        ink2: '#5A5A50',
        muted: '#9B9B8E',
        gold: '#C9A24B',
        'gold-off': '#E3DDC9',
        line: '#EAE7DC',
        'tweak-bg': '#FFF8E6',
        'tweak-bar': '#C9A24B',
      },
      fontFamily: {
        serif: ['"Noto Serif SC"', '"Songti SC"', 'STSong', 'SimSun', 'Georgia', 'serif'],
      },
      borderRadius: {
        card: '18px',
      },
      boxShadow: {
        soft: '0 2px 8px rgba(60,60,40,.05)',
        lift: '0 10px 24px rgba(60,60,40,.12)',
      },
    },
  },
  plugins: [],
};

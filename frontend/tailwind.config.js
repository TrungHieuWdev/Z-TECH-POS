export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: '#74B8E0',
          strong: '#3F90BD',
          deep: '#2F789F',
          soft: '#DFF2FB',
          surface: '#F4FAFE',
          muted: '#BFE3F5',
          ink: '#17384A'
        }
      },
      fontFamily: {
        sans: ['"Be Vietnam Pro"','Plus Jakarta Sans', 'Inter', 'ui-sans-serif', 'system-ui', 'sans-serif']
      }
    }
  },
  plugins: []
};

/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  content: ['./src/renderer/src/**/*.{js,ts,jsx,tsx}', './src/renderer/index.html'],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#1B3A6B',
          50: '#E8EDF5',
          100: '#C5D2E7',
          200: '#8FA9CF',
          300: '#5980B7',
          400: '#2E579F',
          500: '#1B3A6B',
          600: '#162F56',
          700: '#102342',
          800: '#0B182D',
          900: '#050C19'
        },
        accent: {
          DEFAULT: '#C9A84C',
          50: '#FBF5E6',
          100: '#F4E5BE',
          200: '#E9CC8D',
          300: '#DEB35C',
          400: '#C9A84C',
          500: '#A88A39',
          600: '#876E2E',
          700: '#655223',
          800: '#443618',
          900: '#221B0C'
        },
        background: '#F8F6F1',
        dark: '#0a0a0a'
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif']
      },
      boxShadow: {
        card: '0 2px 8px rgba(27, 58, 107, 0.08)',
        'card-hover': '0 8px 24px rgba(27, 58, 107, 0.15)',
        modal: '0 20px 60px rgba(0, 0, 0, 0.2)'
      },
      animation: {
        'fade-in': 'fadeIn 0.3s ease-in-out',
        'slide-up': 'slideUp 0.3s ease-out',
        'slide-in': 'slideIn 0.25s ease-out'
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' }
        },
        slideUp: {
          '0%': { transform: 'translateY(10px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' }
        },
        slideIn: {
          '0%': { transform: 'translateX(-10px)', opacity: '0' },
          '100%': { transform: 'translateX(0)', opacity: '1' }
        }
      }
    }
  },
  plugins: []
}

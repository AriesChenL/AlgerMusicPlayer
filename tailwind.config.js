/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/renderer/index.html', './src/renderer/**/*.{vue,js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        primary: {
          // 暖色琥珀强调色（设计稿 --accent / --accent2）
          DEFAULT: '#e08a3c',
          light: '#f4a85e',
          dark: '#c5702a',
          hover: '#f4a85e',
          pressed: '#c5702a',
          // 数值梯度：供原绿色梯度类（green-50..900）平滑迁移
          50: '#fdf3e7',
          100: '#fbe4c9',
          200: '#f6cb98',
          300: '#f1ad66',
          400: '#ea9747',
          500: '#e08a3c',
          600: '#c5702a',
          700: '#a3591f',
          800: '#80471c',
          900: '#693c1a'
        },
        secondary: {
          DEFAULT: '#8a7c6e',
          light: '#bcae9f',
          dark: '#6d5f50'
        },
        dark: {
          // 暖色窗口 / 面板层级（设计稿 --win / --panel / --panel2 / --elev）
          DEFAULT: '#1b1612',
          100: '#241e19',
          200: '#2b241e',
          300: '#322a23'
        },
        light: {
          DEFAULT: '#fff',
          100: '#f7f0e7',
          200: '#f2e9dd',
          300: '#ece0d2'
        }
      }
    }
  },
  plugins: []
};

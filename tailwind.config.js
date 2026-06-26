/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/renderer/index.html', './src/renderer/**/*.{vue,js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        primary: {
          // 品牌绿，保持与 logo / README 徽章一致
          DEFAULT: '#22c55e',
          // 更浅的悬停色（原先误设为与 DEFAULT 相同）
          light: '#4ade80',
          // 更深的按下色
          dark: '#16a34a',
          hover: '#34d27b',
          pressed: '#16a34a'
        },
        secondary: {
          DEFAULT: '#6c757d',
          light: '#8c959e',
          dark: '#495057'
        },
        dark: {
          // 微冷调 off-black，替代纯黑，增加层次与质感
          DEFAULT: '#0a0b0d',
          100: '#15161a',
          200: '#2a2c31',
          300: '#3a3d43'
        },
        light: {
          DEFAULT: '#fff',
          100: '#f8f9fa',
          200: '#e9ecef',
          300: '#dee2e6'
        }
      }
    }
  },
  plugins: []
};

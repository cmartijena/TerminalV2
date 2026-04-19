/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        bg:      '#0a0e1a',
        surface: '#0f1629',
        surface2:'#141d35',
        surface3:'#1a2444',
        border:  '#1e2d4a',
        ac:      '#00e5a0',
        ac2:     '#4f8ef7',
        pur:     '#7c5cfc',
        pink:    '#f72585',
        cyan:    '#00d4ff',
        warn:    '#f7931a',
        danger:  '#f72564',
        tx:      '#e8eeff',
        tx2:     '#7b8db0',
        tx3:     '#3d4f73',
      },
    },
  },
  plugins: [],
}
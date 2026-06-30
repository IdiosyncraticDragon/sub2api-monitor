/** @type {import('tailwindcss').Config} */
// CommonJS（package.json 未设 type:module，.js 按 CJS 解析）
module.exports = {
  content: ['./src/renderer/**/*.{html,ts,tsx}'],
  // 配色统一走 CSS 变量（var(--s2a-*)，见 globals.css），由 <html data-theme/data-mode> 切换。
  // dark: 变体（若仍有使用）绑定到 data-mode="dark"，不再跟随系统 prefers-color-scheme。
  darkMode: ['selector', '[data-mode="dark"]'],
  theme: {
    extend: {}
  },
  plugins: []
}

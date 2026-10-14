/** 内联矢量皇后（皇冠）：跨平台一致渲染，避免系统 emoji 字形差异 */
export const QUEEN_SVG = `
<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false">
  <defs>
    <linearGradient id="qg" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#f6c560"/>
      <stop offset="1" stop-color="#d98e2b"/>
    </linearGradient>
  </defs>
  <path d="M4 6 L8 12 L12 4 L16 12 L20 6 L20 14 L4 14 Z"
        fill="url(#qg)" stroke="#a9691a" stroke-width="1" stroke-linejoin="round"/>
  <rect x="4" y="14" width="16" height="3.4" rx="1.4" fill="#c9801f" stroke="#a9691a" stroke-width="0.8"/>
  <circle cx="4" cy="6" r="1.7" fill="#e5484d"/>
  <circle cx="12" cy="4" r="1.9" fill="#2f9e44"/>
  <circle cx="20" cy="6" r="1.7" fill="#3a86ff"/>
  <circle cx="12" cy="15.7" r="1" fill="#fff3d6"/>
</svg>`;

/**
 * Renders the Pip app icons from one SVG so the PNG set stays consistent.
 * Run from qa/: node make-icons.mjs
 */
import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';

const OUT = path.resolve('../pla-frontend/assets/icons');
await mkdir(OUT, { recursive: true });

const pod = `
  <path d="M32 50.6c-8.7-6.2-12.7-13.3-12.7-20.6C19.3 22 24.6 16.4 32 16.4s12.7 5.6 12.7 13.6c0 7.3-4 14.4-12.7 20.6Z"
        fill="#f9edd9" stroke="#422f20" stroke-width="1.5" stroke-linejoin="round"/>
  <path d="M32 16.4V9.6" fill="none" stroke="#f9edd9" stroke-width="2.6" stroke-linecap="round"/>
  <path d="M31.6 11.3c-2.5-.2-4.2-1.7-4.2-3.7 2.5.1 4.2 1.7 4.2 3.7Z" fill="#7e9470"/>
  <path d="M32.4 10.9c2.5-.2 4.2-1.7 4.2-3.7-2.5.1-4.2 1.7-4.2 3.7Z" fill="#93a784"/>
  <path d="M27.6 30.4v.1M36.4 30.4v.1" stroke="#3a2a1d" stroke-width="2.8" stroke-linecap="round"/>
  <circle cx="25.4" cy="35.4" r="2.3" fill="#dd8f6c" opacity=".62"/>
  <circle cx="38.6" cy="35.4" r="2.3" fill="#dd8f6c" opacity=".62"/>
  <path d="M29.4 37.2c1.4 1.5 3.8 1.5 5.2 0" fill="none" stroke="#3a2a1d" stroke-width="1.6" stroke-linecap="round"/>
  <ellipse cx="26.4" cy="23.6" rx="2.4" ry="3.4" fill="#fffaf1" opacity=".55" transform="rotate(-18 26.4 23.6)"/>
`;

function svg({ maskable = false, radius = 12 } = {}) {
  const scale = maskable ? 0.66 : 0.8;
  const offset = (64 - 64 * scale) / 2;
  const shape = maskable
    ? ''
    : `<rect x="0" y="0" width="64" height="64" rx="${radius}" fill="#b4552d"/>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="64" height="64">
    <defs>
      <radialGradient id="paper" cx="30%" cy="22%" r="90%">
        <stop offset="0" stop-color="#cf7449"/>
        <stop offset="55%" stop-color="#b4552d"/>
        <stop offset="100%" stop-color="#9a4524"/>
      </radialGradient>
      <clipPath id="clip"><rect x="0" y="0" width="64" height="64" rx="${maskable ? 0 : radius}"/></clipPath>
    </defs>
    ${shape ? '' : `<rect x="0" y="0" width="64" height="64" fill="url(#paper)"/>`}
    <g clip-path="url(#clip)">
      ${shape ? `<rect x="0" y="0" width="64" height="64" fill="url(#paper)" rx="${radius}"/>` : ''}
      <g transform="translate(${offset} ${offset}) scale(${scale})">${pod}</g>
    </g>
  </svg>`;
}

const browser = await chromium.launch();
const targets = [
  { file: 'icon-192.png', size: 192, maskable: false },
  { file: 'icon-512.png', size: 512, maskable: false },
  { file: 'icon-maskable-192.png', size: 192, maskable: true },
  { file: 'icon-maskable-512.png', size: 512, maskable: true },
  { file: 'apple-touch-icon.png', size: 180, maskable: true },
];

for (const target of targets) {
  const page = await browser.newPage({
    viewport: { width: target.size, height: target.size },
    deviceScaleFactor: 1,
  });
  const markup = svg({ maskable: target.maskable, radius: target.maskable ? 0 : 12 });
  await page.setContent(
    `<style>html,body{margin:0;padding:0;background:transparent}svg{display:block;width:100vw;height:100vh}</style>${markup}`
  );
  await page.screenshot({
    path: path.join(OUT, target.file),
    omitBackground: !target.maskable,
    clip: { x: 0, y: 0, width: target.size, height: target.size },
  });
  await page.close();
  console.log('wrote', target.file, `${target.size}px`);
}

await browser.close();

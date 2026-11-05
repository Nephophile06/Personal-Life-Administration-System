/**
 * Renders the Puffy app icons from one SVG so the PNG set stays consistent.
 * Run from qa/: node make-icons.mjs
 */
import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';

const OUT = path.resolve('../pla-frontend/assets/icons');
await mkdir(OUT, { recursive: true });

const mark = `
  <path d="M25 15c0-5.4 14-5.4 14 0" fill="none" stroke="#27343c" stroke-width="2" stroke-linecap="round"/>
  <path d="M19 22c.7-3.4 2.6-5.8 5.6-7h14.8c3 1.2 4.9 3.6 5.6 7Z"
        fill="#465c6b" stroke="#27343c" stroke-width="2.1" stroke-linejoin="round"/>
  <path d="M32 20c9.4 0 15 3.4 17.6 9.2 2.6 5.8 2.6 12.4 0 18.2C47 53.2 41.4 56.6 32 56.6s-15-3.4-17.6-9.2c-2.6-5.8-2.6-12.4 0-18.2C17 23.4 22.6 20 32 20Z"
        fill="#5f7482" stroke="#27343c" stroke-width="2.2" stroke-linejoin="round"/>
  <path d="M32 25c6.6 0 10.8 2.9 12.2 7.4 1.3 4.5 1.3 10.2 0 14.7-1.4 4.5-5.6 7.4-12.2 7.4s-10.8-2.9-12.2-7.4c-1.3-4.5-1.3-10.2 0-14.7C21.2 27.9 25.4 25 32 25Z"
        fill="#f9edd9"/>
  <g fill="none" stroke="#465c6b" stroke-width="1.1" stroke-linecap="round" opacity=".55">
    <path d="M17.6 26c-1.5 4.6-1.5 10.4 0 15.4"/>
    <path d="M46.4 26c1.5 4.6 1.5 10.4 0 15.4"/>
  </g>
  <g fill="none" stroke="#465c6b" stroke-width="1" stroke-linecap="round" opacity=".25">
    <path d="M26.5 26.4c-1 4-1 9.2 0 13.4"/>
    <path d="M37.5 26.4c1 4 1 9.2 0 13.4"/>
  </g>
  <path d="M32 56.6v2.2" stroke="#27343c" stroke-width="1.6" stroke-linecap="round"/>
  <path d="M32 58.4 34.4 61 32 63.6 29.6 61Z" fill="#465c6b" stroke="#27343c" stroke-width="1.3" stroke-linejoin="round"/>
  <path d="M26.9 33.8v.1M37.1 33.8v.1" stroke="#27343c" stroke-width="2.6" stroke-linecap="round"/>
  <circle cx="24.8" cy="37.6" r="1.9" fill="#c99a86" opacity=".62"/>
  <circle cx="39.2" cy="37.6" r="1.9" fill="#c99a86" opacity=".62"/>
  <path d="M29.4 39.4c1.3 1.4 3.9 1.4 5.2 0" fill="none" stroke="#27343c" stroke-width="1.5" stroke-linecap="round"/>
  <ellipse cx="26.2" cy="26.5" rx="1.9" ry="2.8" fill="#fffaf1" opacity=".5" transform="rotate(-16 26.2 26.5)"/>
`;

function svg({ maskable = false, radius = 12 } = {}) {
  const scale = maskable ? 0.66 : 0.8;
  const offset = (64 - 64 * scale) / 2;
  const shape = maskable
    ? ''
    : `<rect x="0" y="0" width="64" height="64" rx="${radius}" fill="#465c6b"/>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="64" height="64">
    <defs>
      <radialGradient id="paper" cx="30%" cy="22%" r="90%">
        <stop offset="0" stop-color="#728a98"/>
        <stop offset="55%" stop-color="#465c6b"/>
        <stop offset="100%" stop-color="#465c6b"/>
      </radialGradient>
      <clipPath id="clip"><rect x="0" y="0" width="64" height="64" rx="${maskable ? 0 : radius}"/></clipPath>
    </defs>
    ${shape ? '' : `<rect x="0" y="0" width="64" height="64" fill="url(#paper)"/>`}
    <g clip-path="url(#clip)">
      ${shape ? `<rect x="0" y="0" width="64" height="64" fill="url(#paper)" rx="${radius}"/>` : ''}
      <g transform="translate(${offset} ${offset}) scale(${scale})">${mark}</g>
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

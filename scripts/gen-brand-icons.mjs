/**
 * 品牌图标生成脚本 —— 单一数据源：MarkWaveform 声波符号（10 根声条）。
 * 来源：Claude Design 项目 “Aries Logo.dc.html / MarkWaveform.dc.html”。
 *
 * 产物：
 *  - 应用图标（dock/任务栏/安装包）：透明浮标 · 钴蓝渐变波形
 *      resources/icon.png · icon.icns · icon.ico  + build/ 同名副本
 *  - 浏览器标签：resources/favicon.ico（透明钴蓝波形）
 *  - 托盘/菜单栏（最小化处）：
 *      resources/icons/note.png · note@2x.png（mac 单色模板，透明）
 *      resources/icon_16x16.png（win/linux 托盘，透明钴蓝）
 *  - 应用内品牌图（更新/安装弹窗）：src/renderer/assets/logo.png（钴蓝渐变砖 + 白波形）
 *
 * 用法：node scripts/gen-brand-icons.mjs
 */
import { execFileSync } from 'node:child_process';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import pngToIco from 'png-to-ico';
import sharp from 'sharp';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');

// MarkWaveform：viewBox 0 0 120 120，10 根声条 [x, y, h]，宽 5.4，圆角 2.7
const BARS = [
  [16, 50, 20],
  [25.5, 42, 36],
  [35, 32, 56],
  [44.5, 44, 32],
  [54, 24, 72],
  [63.5, 38, 44],
  [73, 30, 60],
  [82.5, 44, 32],
  [92, 36, 48],
  [101.5, 50, 20]
];
const BAR_W = 5.4;
const BAR_RX = 2.7;

const bars = (fill) =>
  BARS.map(
    ([x, y, h]) =>
      `<rect x="${x}" y="${y}" width="${BAR_W}" height="${h}" rx="${BAR_RX}" fill="${fill}"/>`
  ).join('');

// 内容包围盒：x[16,106.9] y[24,96] → 居中裁剪到 ~80% 内容占比的方形 viewBox
const CROP = '4.65 3.2 113.6 113.6';

const COBALT_GRAD = `<linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
  <stop offset="0" stop-color="#6cb2e8"/><stop offset="1" stop-color="#2f6fb0"/></linearGradient>`;

// 透明浮标：钴蓝渐变波形（应用图标 / favicon）
const svgMark = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${CROP}">
<defs>${COBALT_GRAD}</defs>${bars('url(#g)')}</svg>`;

// 单色波形（mac 菜单栏模板图，黑色 + 透明，系统按深浅自动反色）
const svgMono = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${CROP}">${bars('#000000')}</svg>`;

// 托盘小图（win/linux）：实心钴蓝，小尺寸更清晰
const svgTraySolid = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${CROP}">${bars('#2f6fb0')}</svg>`;

// 品牌砖：钴蓝渐变圆角砖 + 白波形 + 高光（应用内弹窗）
const svgTile = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 212 212">
<defs>
  <linearGradient id="t" x1="0" y1="0" x2="1" y2="1">
    <stop offset="0" stop-color="#6cb2e8"/><stop offset="1" stop-color="#2f6fb0"/></linearGradient>
  <linearGradient id="gloss" x1="0" y1="0" x2="0.5" y2="0.7">
    <stop offset="0" stop-color="#ffffff" stop-opacity="0.45"/>
    <stop offset="0.44" stop-color="#ffffff" stop-opacity="0"/></linearGradient>
</defs>
<rect x="0" y="0" width="212" height="212" rx="56" fill="url(#t)"/>
<rect x="0" y="0" width="212" height="212" rx="56" fill="url(#gloss)"/>
<g transform="translate(20 22) scale(1.4)">${bars('#f5fbff')}</g>
</svg>`;

const svgToPng = (svg, size, out) =>
  sharp(Buffer.from(svg), { density: 384 })
    .resize(size, size, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toFile(out);

const tmpPng = async (svg, size) =>
  sharp(Buffer.from(svg), { density: 384 })
    .resize(size, size, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer();

async function main() {
  const resDir = join(root, 'resources');
  const buildDir = join(root, 'build');
  const iconsDir = join(resDir, 'icons');

  // ---- 应用图标 PNG（透明浮标） ----
  await svgToPng(svgMark, 512, join(resDir, 'icon.png'));
  await svgToPng(svgMark, 512, join(buildDir, 'icon.png'));

  // ---- .ico（应用 + favicon），多尺寸 ----
  const icoSizes = [16, 24, 32, 48, 64, 128, 256];
  const icoBufs = await Promise.all(icoSizes.map((s) => tmpPng(svgMark, s)));
  const icoData = await pngToIco(icoBufs);
  writeFileSync(join(resDir, 'icon.ico'), icoData);
  writeFileSync(join(buildDir, 'icon.ico'), icoData);
  const favBufs = await Promise.all([16, 32, 48].map((s) => tmpPng(svgMark, s)));
  writeFileSync(join(resDir, 'favicon.ico'), await pngToIco(favBufs));

  // ---- .icns（mac），iconset + iconutil ----
  const iconset = join(buildDir, 'AppIcon.iconset');
  rmSync(iconset, { recursive: true, force: true });
  mkdirSync(iconset, { recursive: true });
  const icnsSpec = [
    [16, 'icon_16x16.png'],
    [32, 'icon_16x16@2x.png'],
    [32, 'icon_32x32.png'],
    [64, 'icon_32x32@2x.png'],
    [128, 'icon_128x128.png'],
    [256, 'icon_128x128@2x.png'],
    [256, 'icon_256x256.png'],
    [512, 'icon_256x256@2x.png'],
    [512, 'icon_512x512.png'],
    [1024, 'icon_512x512@2x.png']
  ];
  for (const [s, name] of icnsSpec) await svgToPng(svgMark, s, join(iconset, name));
  execFileSync('iconutil', ['-c', 'icns', iconset, '-o', join(resDir, 'icon.icns')]);
  execFileSync('iconutil', ['-c', 'icns', iconset, '-o', join(buildDir, 'icon.icns')]);
  rmSync(iconset, { recursive: true, force: true });

  // ---- 托盘 / 菜单栏（透明） ----
  await svgToPng(svgMono, 18, join(iconsDir, 'note.png')); // mac 模板 @1x
  await svgToPng(svgMono, 36, join(iconsDir, 'note@2x.png')); // mac 模板 @2x
  await svgToPng(svgTraySolid, 32, join(resDir, 'icon_16x16.png')); // win/linux 托盘（@2x 余量）

  // ---- 应用内品牌图（弹窗） ----
  await svgToPng(svgTile, 512, join(root, 'src/renderer/assets/logo.png'));

  console.log('✓ 品牌图标已生成');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

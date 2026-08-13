import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const sourcePath = path.join(root, 'assets', 'maps', 'reference', '497年_萧齐北魏政权边界.geojson');
const outputPath = path.join(root, 'assets', 'maps', 'reference', 'qi-497-regime-boundary.svg');
const geojson = JSON.parse(fs.readFileSync(sourcePath, 'utf8'));
const width = 1800;
const height = 1400;
const padding = 70;

function ringsOf(geometry) {
  if (geometry.type === 'Polygon') return geometry.coordinates;
  if (geometry.type === 'MultiPolygon') return geometry.coordinates.flat();
  return [];
}

const points = geojson.features.flatMap((feature) => ringsOf(feature.geometry).flat());
const minX = Math.min(...points.map(([x]) => x));
const maxX = Math.max(...points.map(([x]) => x));
const minY = Math.min(...points.map(([, y]) => y));
const maxY = Math.max(...points.map(([, y]) => y));
const scale = Math.min((width - padding * 2) / (maxX - minX), (height - padding * 2) / (maxY - minY));
const offsetX = (width - (maxX - minX) * scale) / 2;
const offsetY = (height - (maxY - minY) * scale) / 2;
const project = ([x, y]) => [offsetX + (x - minX) * scale, height - offsetY - (y - minY) * scale];

function pathFor(feature) {
  return ringsOf(feature.geometry).map((ring) => ring.map((point, index) => {
    const [x, y] = project(point);
    return `${index ? 'L' : 'M'}${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(' ') + ' Z').join(' ');
}

function centroid(feature) {
  const ring = ringsOf(feature.geometry)[0] || [];
  const [x, y] = ring.reduce(([sx, sy], [px, py]) => [sx + px, sy + py], [0, 0]);
  return project([x / ring.length, y / ring.length]);
}

const palette = { '蕭齊': '#d9e6cf', '北魏': '#e5d8c2' };
const shapes = geojson.features.map((feature) => {
  const regime = feature.properties.regime.replace('萧', '蕭');
  return `<path d="${pathFor(feature)}" fill="${palette[regime] || '#ddd'}" stroke="#5f5143" stroke-width="3" vector-effect="non-scaling-stroke"/>`;
}).join('\n');
const labels = geojson.features.map((feature) => {
  const regime = feature.properties.regime.replace('萧', '蕭');
  const [x, y] = centroid(feature);
  return `<text x="${x.toFixed(1)}" y="${y.toFixed(1)}" text-anchor="middle">${regime}</text>`;
}).join('\n');

const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" role="img" aria-labelledby="title desc">
  <title id="title">公元497年蕭齊、北魏政權邊界</title>
  <desc id="desc">依齊魏時期全圖配準並與ChinaXMap對齊的WGS84中等置信度政權邊界。</desc>
  <rect width="100%" height="100%" fill="#eef2ed"/>
  <g>${shapes}</g>
  <g fill="#4a3b31" font-family="Noto Serif TC, Songti TC, serif" font-size="62" font-weight="700" paint-order="stroke" stroke="#fffaf0" stroke-width="8">${labels}</g>
  <g transform="translate(70 1310)" font-family="Noto Serif TC, Songti TC, serif" fill="#5d554d">
    <text font-size="30">497年基準斷面 · 政權邊界（中等置信度）</text>
    <text y="42" font-size="24">WGS84；據歷史地圖色塊與界線配準，不代表逐年州郡界。</text>
  </g>
</svg>\n`;

fs.writeFileSync(outputPath, svg);
console.log(`Wrote ${path.relative(root, outputPath)}`);

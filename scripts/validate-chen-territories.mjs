import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const geojson = JSON.parse(fs.readFileSync(new URL('../data/chen-territories.geojson', import.meta.url), 'utf8'));
const wrapper = fs.readFileSync(new URL('../data/chen-territories.js', import.meta.url), 'utf8');
const context = { window: {} };
vm.runInNewContext(wrapper, context, { filename: 'chen-territories.js' });

const expectedTerritoryYears = [557, 558, 559, 560, 561, 562, 569, 573, 574, 575, 576, 577, 578, 579];
const expectedSourceYears = new Map([
  [557, 557], [558, 559], [559, 559], [560, 560], [561, 561], [562, 562],
  [569, 569], [573, 575], [574, 575], [575, 575], [576, 577], [577, 577],
  [578, 578], [579, 579]
]);

assert.equal(geojson.type, 'FeatureCollection');
assert.deepEqual(JSON.parse(JSON.stringify(context.window.CHEN_TERRITORIES)), geojson, 'JS wrapper must match GeoJSON');
assert.equal(geojson.crs.properties.name, 'urn:ogc:def:crs:OGC:1.3:CRS84');
assert.ok(geojson.metadata.registration.reference_iou > 0.6, 'registration IoU is unexpectedly low');
assert.equal(geojson.metadata.guangzhou_569_in_territory, true);

const territories = geojson.features.filter((feature) => feature.properties.kind === 'territory');
const rebellions = geojson.features.filter((feature) => feature.properties.kind === 'rebellion');
assert.deepEqual(territories.map((feature) => feature.properties.year), expectedTerritoryYears);
assert.equal(rebellions.length, 1);
assert.equal(rebellions[0].properties.year, 569);

function visitCoordinates(value, callback) {
  if (typeof value[0] === 'number') callback(value);
  else for (const child of value) visitCoordinates(child, callback);
}

for (const feature of geojson.features) {
  assert.ok(['Polygon', 'MultiPolygon'].includes(feature.geometry.type));
  assert.ok(feature.properties.svgPath.startsWith('M'));
  visitCoordinates(feature.geometry.coordinates, ([longitude, latitude]) => {
    assert.ok(longitude >= 93.5 && longitude <= 128.5, `longitude out of map extent: ${longitude}`);
    assert.ok(latitude >= 18 && latitude <= 44, `latitude out of map extent: ${latitude}`);
  });
  if (feature.properties.kind === 'territory') {
    assert.equal(feature.properties.source_year, expectedSourceYears.get(feature.properties.year));
  }
}

function pointInRing([x, y], ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    const crosses = (yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi;
    if (crosses) inside = !inside;
  }
  return inside;
}

function pointInPolygon(point, polygon) {
  return pointInRing(point, polygon[0]) && !polygon.slice(1).some((hole) => pointInRing(point, hole));
}

function featureContains(feature, point) {
  const polygons = feature.geometry.type === 'Polygon' ? [feature.geometry.coordinates] : feature.geometry.coordinates;
  return polygons.some((polygon) => pointInPolygon(point, polygon));
}

const territory = (year) => territories.find((feature) => feature.properties.year === year);
const guangzhou = [113.2644, 23.1291];
const shouchun = [116.79, 32.57];
assert.ok(featureContains(territory(569), guangzhou), 'Guangzhou must remain inside Chen territory in 569');
assert.ok(!featureContains(territory(557), shouchun), 'Shouchun must not appear in the early Chen extent');
assert.ok(featureContains(territory(575), shouchun), 'Shouchun must appear during the Taijian northern expansion');
assert.ok(!featureContains(territory(579), shouchun), 'Shouchun must fall outside the 579 extent');
assert.ok(!JSON.stringify(geojson).includes('BaiduNetdiskDownload'), 'public GIS must not expose an absolute local path');

console.log(`Validated ${territories.length} territory features and ${rebellions.length} rebellion feature.`);

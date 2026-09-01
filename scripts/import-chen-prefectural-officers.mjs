import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const siteDir = path.resolve(scriptDir, '..');
const workspace = path.resolve(siteDir, '..');
const phase7Dir = path.join(
  workspace,
  'outputs',
  '01a040ca-52aa-7c21-8f57-1cc409b88fb1',
  'phase7'
);
const sourceJson = path.join(phase7Dir, 'chen_prefectural_officers_web.json');
const sourceManifest = path.join(phase7Dir, 'manifest.json');
const targetJson = path.join(siteDir, 'data', 'chen-prefectural-officers.json');
const targetScript = path.join(siteDir, 'data', 'chen-prefectural-officers.js');
const targetManifest = path.join(siteDir, 'data', 'chen-prefectural-officers-manifest.json');

const sha256 = (filePath) => crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');
const manifest = JSON.parse(fs.readFileSync(sourceManifest, 'utf8'));
const manifestEntry = manifest.files.find((entry) => entry.path === 'chen_prefectural_officers_web.json');

if (!manifestEntry) throw new Error('manifest中没有chen_prefectural_officers_web.json');
const sourceBytes = fs.statSync(sourceJson).size;
const sourceHash = sha256(sourceJson);
if (sourceBytes !== manifestEntry.bytes || sourceHash !== manifestEntry.sha256) {
  throw new Error(`发布JSON与manifest不一致：bytes=${sourceBytes}/${manifestEntry.bytes}; sha256=${sourceHash}/${manifestEntry.sha256}`);
}

const data = JSON.parse(fs.readFileSync(sourceJson, 'utf8'));
fs.copyFileSync(sourceJson, targetJson);
fs.copyFileSync(sourceManifest, targetManifest);
fs.writeFileSync(targetScript, `window.CHEN_PREFECTURAL_OFFICERS = ${JSON.stringify(data)};\n`, 'utf8');

const importedData = JSON.parse(fs.readFileSync(targetJson, 'utf8'));
if (JSON.stringify(importedData) !== JSON.stringify(data)) throw new Error('导入后的JSON与第七阶段发布JSON不一致');

console.log(JSON.stringify({
  status: 'PASS',
  source: 'phase7/chen_prefectural_officers_web.json',
  source_manifest: 'phase7/manifest.json',
  bytes: sourceBytes,
  sha256: sourceHash,
  targets: [
    path.relative(siteDir, targetJson).replaceAll('\\', '/'),
    path.relative(siteDir, targetScript).replaceAll('\\', '/'),
    path.relative(siteDir, targetManifest).replaceAll('\\', '/')
  ]
}, null, 2));

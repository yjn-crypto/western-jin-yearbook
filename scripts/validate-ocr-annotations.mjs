import fs from 'node:fs';
import vm from 'node:vm';

function load(path, variable) {
  const context = { window: {} };
  vm.createContext(context);
  vm.runInContext(fs.readFileSync(path, 'utf8'), context, { filename: path });
  return context.window[variable];
}

function walk(value, visit) {
  if (Array.isArray(value)) return value.forEach((item) => walk(item, visit));
  if (!value || typeof value !== 'object') return;
  visit(value);
  Object.values(value).forEach((item) => walk(item, visit));
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const jin = load('data/jin-data.js', 'JIN_DATA');
const chen = load('data/chen-data.js', 'CHEN_DATA');

assert(jin.meta?.ocr_refresh?.engine === 'PaddleOCR-VL-1.6', '西晋 OCR 版本元数据缺失');
assert(chen.meta?.ocr_refresh?.engine === 'PaddleOCR-VL-1.6', '南陈 OCR 版本元数据缺失');

const protectedNames = [];
const excerpts = [];
const qiao = [];
for (const data of [jin, chen]) {
  walk(data, (node) => {
    if (node.id && node.base_name) protectedNames.push([node.id, node.base_name]);
    if (node.source?.excerpt) excerpts.push(node.source.excerpt);
    if (node.qiao_annotation) qiao.push([node.base_name || node.name || '', node.qiao_annotation]);
  });
}

const nameMap = new Map(protectedNames);
assert(nameMap.get('ch_c0002') === '秣陵', '人工校勘的南陈秣陵实体名被改动');
assert(nameMap.get('jin_c0218') === '秣陵' || [...nameMap.values()].includes('秣陵'), '人工校勘的西晋秣陵实体名缺失');
assert(excerpts.every((text) => !text.includes('\uFFFD')), '注释中出现损坏的替代字符');
assert(excerpts.every((text) => text.length < 2000), '注释出现疑似整页或重复 OCR 文本');
assert(!excerpts.some((text) => /襪陵|漂陽|廢人焉/.test(text)), '旧 OCR 的典型误字仍残留在注释引文中');

assert(qiao.length === 39, `侨置标记数量异常：${qiao.length}`);
const huainan = qiao.filter(([name, note]) =>
  ['淮南郡', '繁昌', '當塗', '襄垣', '逸遒', '定陵'].includes(name)
    && note.sources?.some((source) => source.excerpt?.includes('元帝渡江，以春谷县侨立襄城郡及繁昌县'))
);
assert(huainan.length === 6, `淮南—襄城侨置说明不完整：${huainan.length}/6`);

for (const [, note] of qiao) {
  assert(Array.isArray(note.sources) && note.sources.length, '侨置注释缺少来源说明');
  for (const source of note.sources) {
    if (source.source_title?.includes('卷（上）')) continue;
    if (source.book_page && source.pdf_page && source.book_page >= 1500) {
      assert(source.book_page - source.pdf_page === 898, '侨置考表书页/PDF页映射错误');
    }
  }
}

console.log(`OCR annotations OK: ${excerpts.length} excerpts, ${qiao.length} qiao notes, ${huainan.length} Huainan explanations.`);

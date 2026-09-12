import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const context = {window:{}};
vm.createContext(context);
for (const file of ['data/jin-data.js', 'data/chen-data.js', 'data/liang-data.js']) {
  vm.runInContext(fs.readFileSync(file, 'utf8'), context, {filename:file});
}
const before = JSON.stringify([context.window.JIN_DATA, context.window.CHEN_DATA, context.window.LIANG_DATA]);
vm.runInContext(fs.readFileSync('data/chen-qiao-prefaces.js', 'utf8'), context);
vm.runInContext(fs.readFileSync('source-annotations.js', 'utf8'), context);
const {displaySource, qiaoSources} = context.window.SOURCE_ANNOTATIONS;
const entities = new Map(), qiao = [];
function walk(node) {
  if (!node || typeof node !== 'object') return;
  if (node.id) entities.set(node.id, node);
  if (node.qiao_annotation) qiao.push(node.qiao_annotation);
  Object.values(node).forEach(walk);
}
walk(context.window.CHEN_DATA);
const excerpt = id => displaySource(entities.get(id).source).excerpt;

assert(excerpt('ch_s0001').includes('析吴郡置海宁郡，旋废'), '州自身的属郡沿革必须保留');
assert(!excerpt('ch_s0001').includes('（一）丹阳郡'), '州注释不应纳入郡独立条目');
assert(excerpt('ch_p0004').includes('盐官、海盐、前京三县复还属吴郡'), '吴郡按语中的属县变动不能删除');
assert(!excerpt('ch_p0004').includes('1. 吴'), '吴郡不应混入吴县独立条目');
assert(excerpt('ch_p0006').startsWith('（六）吴兴郡'), '吴兴郡不应带入前京的前段按语');
assert(!excerpt('ch_p0006').includes('前京本吴郡属县'), '吴兴郡前京残段未清理');
assert(!excerpt('ch_p0006').includes('1. 武康'), '吴兴郡不应混入属县条目');
assert(excerpt('ch_p0006').includes('并东迁县入焉'), '郡自身引用的县级变化应保留');
assert(excerpt('ch_c0018').includes('则陈当有吴县'), '吴县应保留自己的按语');
assert(!excerpt('ch_c0018').includes('2. 娄'), '县注释不应混入相邻县条目');
assert(excerpt('ch_c0032').includes('按：齐吴兴郡领有武康县'), 'OCR倒置的武康按语应归回武康');
assert(!excerpt('ch_c0032').includes('皆有乌程县'), '武康不应混入乌程按语');
assert(excerpt('ch_c0033').includes('皆有乌程县'), '乌程自己的按语应保留');
assert(!excerpt('ch_c0033').includes('领有武康县'), '乌程不应混入武康按语');
assert(!excerpt('ch_c0047').includes('9.鄭'), '同一OCR行中的下一县也应分开');
assert(!excerpt('ch_c0396').includes('光城'), '宋安不应沿用错位的光城标题与按语');
assert(!excerpt('ch_c0397').includes('宋安'), '光城不应混入宋安按语');
assert(!excerpt('ch_c0689').includes('永丰'), '荔浦不应沿用错位的永丰标题与按语');
assert(excerpt('ch_c0690').includes('析汉荔浦县之永丰乡置'), '永丰自身沿革引用荔浦的句子不能误删');
assert(!excerpt('ch_c0798').includes('按：梁置岭山郡'), '岭山县不应混入岭山郡的独立按语');
assert(excerpt('ch_c0908').startsWith('金宁（558—588）'), '无序号的金宁县标题应从利州条目中分出');
assert(excerpt('ch_c0909').startsWith('交谷（558—588）'), '无序号的交谷县标题应从明州条目中分出');
assert(excerpt('ch_c0908').includes('则陈有金宁县'), '金宁自身按语应完整保留');
assert(excerpt('ch_c0909').includes('则陈有交谷县'), '交谷自身按语应完整保留');
assert(excerpt('ch_c0328').startsWith('按：齐南兖州山阳侨郡领有盐城县'), '盐城应保留自身按语并移除错位的沛郡标题');
assert(excerpt('ch_c0754').startsWith('按：旧有龙平县'), '龙平应保留自身按语并移除错位的静慰郡标题');
for (const id of ['ch_c0901', 'ch_c0902', 'ch_c0903', 'ch_c0904', 'ch_c0906']) {
  assert.equal(excerpt(id), '', `${id} 没有本县条目的派生摘录应留待补充，不能显示上级郡和相邻县正文`);
}
assert.equal(excerpt('ch_c0907'), '3. 黟（562—588）', '确有自身县标题的黟县仍应保留');

assert.equal(qiao.length, 39, '侨置标记数量应保留');
let qiaoSourceCount = 0;
for (const note of qiao) for (const source of note.sources || []) {
  assert(source.book_page, '侨置页码应保留');
  assert.equal(displaySource(source).origin, source.origin || note.origin, '恢复用户独立整理的原属，不以表格OCR推定');
  assert.equal(displaySource(source).excerpt, '', '侨置重复表格OCR不应显示');
  assert.equal(displaySource({...source}).excerpt, '', '普通注释入口中的同一侨置来源副本也应隐藏表格OCR');
  qiaoSourceCount++;
}
assert(excerpt('ch_p0002').includes('南琅邪彭城二郡太守'), '侨郡正常沿革中的史书引用应保留');
const prefectures = [...entities.values()].filter(entity => entity.qiao_annotation && Array.isArray(entity.counties));
assert.equal(prefectures.length, 13, '覆盖现有全部侨郡，不擅自增加侨置标记');
for (const entity of entities.values()) {
  if (!entity.qiao_annotation) continue;
  const sources = qiaoSources(entity);
  const originals = entity.qiao_annotation.sources || [];
  for (const [index, source] of originals.entries()) {
    assert.equal(sources[index].origin, source.origin || entity.qiao_annotation.origin, `${entity.id} 原属须逐字保留`);
    assert.equal(displaySource(sources[index], {qiao:true}).excerpt, '', `${entity.id} 重复表格OCR仍需抑制`);
  }
  if (Array.isArray(entity.counties)) {
    assert(sources.some(source => source.qiao_preface && displaySource(source).excerpt), `${entity.id} 应有侨郡说明或明确标注的正文补证`);
  } else assert.equal(sources.length, originals.length, `${entity.id} 县注释不得加入整段郡说明`);
}
const prefaces = context.window.CHEN_QIAO_PREFACES.by_entity;
assert(prefaces.ch_p0002[0].book_pages.includes(1602), '彭城表前说明跨页应留存两页定位');
assert(prefaces.ch_p0002[0].excerpt.includes('复立二郡'), '表前说明必须与下一页接合至完整句子');
assert(prefaces.ch_p0043[0].excerpt.includes('太原郡于彭泽'), '太原注释应选彭泽条而非北方同名侨郡');
assert(prefaces.ch_p0129.some(source => source.book_page === 1546 && source.excerpt.includes('双头郡')), '西阳双头郡备考须使用真正的1546页来源');
assert(prefaces.ch_p0147[0].excerpt_label.includes('正文补证'), '1614页OCR缺失不得伪称表前原文');
assert(prefaces.ch_p0003[0].excerpt_label.includes('正文补证'), '陈留表前OCR缺失不得伪称表前原文');
assert.equal(displaySource(entities.get('ch_c0181').source).origin || entities.get('ch_c0181').qiao_annotation.origin, '豫州襄城郡');
assert.equal(displaySource(entities.get('ch_c0182').source).origin || entities.get('ch_c0182').qiao_annotation.origin, '揚州淮南郡');

// Exercise the shared source renderer: both citation and auxiliary dialogs use it.
function element(tag) {
  return {tag, textContent:'', children:[], appendChild(child){this.children.push(child);}, append(...children){this.children.push(...children);}};
}
context.document = {createElement:element};
const app = fs.readFileSync('app.js', 'utf8');
const renderer = app.slice(app.indexOf('  function appendSourceEntry('), app.indexOf('  function appendLocalOfficerDetailSection('));
vm.runInContext(renderer, context);
const qiaoSource = qiao.find(note => note.sources?.some(source => source.book_page === 1602)).sources.find(source => source.book_page === 1602);
const body = element('div');
context.appendSourceEntry(body, qiaoSource);
assert.equal(body.children[0].children.length, 2, '侨置来源恢复页码与原属，不显示重复表格或摘录待补');
assert.equal(body.children[0].children[1].textContent, `原屬：${qiaoSource.origin}`, '通用注释弹窗必须恢复原属');
const prefaceBody = element('div');
context.appendSourceEntry(prefaceBody, prefaces.ch_p0043[0], {qiao:true});
assert(prefaceBody.children[0].children.some(child => child.textContent.includes('太原郡于彭泽')), '通用弹窗必须显示新增核对过的侨郡说明');
assert(body.children[0].children[0].textContent.includes('1602') && body.children[0].children[0].textContent.includes('704'));
const regularBody = element('div');
context.appendSourceEntry(regularBody, entities.get('ch_p0004').source);
assert(!regularBody.children[0].children[1].textContent.includes('1. 吴'), '通用弹窗必须使用分层后的引文');
const generatedBody = element('div');
context.appendSourceEntry(generatedBody, {book_page:1602, excerpt:'应隐藏', origin:'应隐藏', editorial_note:'应隐藏'}, {pagesOnly:true});
assert.equal(generatedBody.children[0].children.length, 1, '动态生成的侨置注释也应遵守仅页码规则');
const missingExcerptBody = element('div');
context.appendSourceEntry(missingExcerptBody, entities.get('ch_c0901').source);
assert.equal(missingExcerptBody.children[0].children[1].textContent, '摘錄待補。', '本县正文缺失时不得回退显示错误的郡摘录');
assert(missingExcerptBody.children[0].children[0].textContent.includes(String(entities.get('ch_c0901').source.book_page)), '摘录待补时仍应保留原页码');

// The older standalone Liang view must keep qiao metadata to page references too.
const liang = fs.readFileSync('liang-app.js', 'utf8');
vm.runInContext(`const entityQiao = e => Boolean(e.q || e.qiao); const qiaoInfo = e => e.qi || e.qiao_info || null;\n${liang.slice(liang.indexOf('function qiaoText('), liang.indexOf('function qiaoNote('))}`, context);
assert.equal(context.qiaoText({q:true, qi:{book_page:1602, pdf_page:704, text:'彭城郡；武进；彭城郡；武进'}}), '書內第 1602 頁（PDF 第 704 頁）');
assert.equal(context.qiaoText({q:true, qi:{qiao_table_page_index:12, original_jurisdiction:'彭城郡；武进'}}), '僑置考表原記錄頁序 12（書內／PDF頁碼待校）');
assert.equal(context.qiaoText({q:true, qi:{text:'重复的表格文字'}}), '僑置考表頁碼待校。');
assert.equal(JSON.stringify([context.window.JIN_DATA, context.window.CHEN_DATA, context.window.LIANG_DATA]), before, '不能修改原始OCR和行政数据');

console.log(`Source annotations OK: hierarchy unchanged; ${qiao.length} qiao origins / ${qiaoSourceCount} citations restored; ${prefectures.length} prefecture introductions; original data unchanged.`);

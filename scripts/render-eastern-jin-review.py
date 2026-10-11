#!/usr/bin/env python3
"""Render the machine decisions without redoing the underlying research."""
from pathlib import Path
import json, html
ROOT=Path(__file__).resolve().parents[1]
r=json.loads((ROOT/'data/eastern-jin-display/machine-decisions.json').read_text())
H=html.escape
statuses={'adopted':'采用','partial':'部分采用','suspended':'暂搁置','retained_with_note':'保留并注释'}

def periods(years):
    out=[]
    for y in sorted(set(years)):
        if out and out[-1][1]+1==y:out[-1][1]=y
        else:out.append([y,y])
    return '、'.join(str(a) if a==b else f'{a}—{b}' for a,b in out) or '未定年'

def evidence(items):
    out=[]
    for e in items:
        loc=' · '.join(str(x) for x in [e['source'],e.get('chapter'),f"书{e['book_page']}页" if e.get('book_page') else '',f"PDF {e['pdf_page']}页" if e.get('pdf_page') else ''] if x)
        out.append('<div class="ev"><b>'+H(loc)+'</b><p>'+H(e['excerpt'])+'</p><small>'+H(e.get('editorial_note') or '')+'</small></div>')
    return ''.join(out)

out=['''<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>东晋445项机器判断</title><style>body{font:16px/1.8 system-ui,serif;max-width:1100px;margin:32px auto;padding:0 24px;color:#24272a;background:#fbfaf7}h1,h2{color:#684733}h3{margin-bottom:8px}article{border-top:1px solid #d5cbbd;padding:16px 0}p{margin:.5em 0}small{color:#686057}.tag{background:#eee5d8;padding:3px 8px;margin-right:10px}details{background:#f1ece4;padding:10px 14px;margin:10px 0}.ev{border-top:1px dotted #bdb2a4;padding:8px 0}summary{cursor:pointer}input{font:inherit;padding:8px;width:90%;max-width:600px}@media print{body{max-width:none;background:white;font-size:11pt}input,button{display:none}}</style><h1>东晋第一轮：445项机器判断</h1><p>2026-10-11 · 供人工核对。以下是网页展示裁定，均非历史定论。另列102组年度行政父级问题。</p>''']
out.append('<ul>'+''.join('<li>'+H(x)+'</li>' for x in r['meta']['rules'])+'</ul>')
out.append('<p>'+H('；'.join(statuses[k]+str(v)+'项' for k,v in r['meta']['counts'].items()))+'</p>')
out.append('<p><a href="../data/eastern-jin-display/machine-decisions.csv">下载445项CSV</a> · <a href="../data/eastern-jin-display/machine-decisions.json">下载完整判断JSON</a></p><label>查找条目 <input id="find" placeholder="输入名称、编号或问题关键词"></label><h2>逐项判断（445项）</h2>')
for d in r['decisions']:
    cs=[]
    for c in d['candidates']:
        pp=[]
        for p in c['phases']:
            pp.append('%s：%s；原候选起年%s，终年%s；Work采用%s—%s' % (p['name'],p['raw'],p['start_candidates'] or '未详',p['end_candidates'] or '未详',p['start'] if p['start'] is not None else '未定',p['end'] if p['end'] is not None else '未定'))
        cs.append('<p><b>'+H(c['name'])+'</b> '+H('；'.join(pp))+'</p>')
    pars=[f"{p.get('name','')} {p['start']}—{p['end']} → {p['parent_name']}：{p['basis']}" for p in d['adopted_parentages']]
    out.append('<article><h3>'+H(d['id']+' '+d['label'])+'</h3><span class="tag">'+H(d['kind_label']+' · '+statuses[d['status']])+'</span><span>置信：'+H(d['confidence'])+'</span><p><b>原问题：</b>'+H(d['original_question'])+'</p><p><b>机器判断：</b>'+H(d['decision'])+'</p><p><b>实际年度：</b>'+H(d['display_summary'])+'</p><p><b>依据：</b>'+H(d['reason'])+'</p>'+''.join('<p>'+H(p)+'</p>' for p in pars)+'<p><b>人工核对：</b>'+H(d['manual_review'])+'</p><details><summary>原候选、分段与来源节录</summary>'+''.join(cs)+evidence(d['evidence'])+'</details></article>')
out.append('<h2>年度归属问题附表（102组）</h2>')
for d in r['structural_decisions']:
    out.append('<article><h3>'+H(d['id']+' '+d['name']+'（'+d['level_label']+'）')+'</h3><p>'+H(d['kind_label']+'；原年份：'+periods(d['years']))+'</p><p><b>裁定：</b>'+H(d['decision'])+'</p><p><b>依据：</b>'+H(d['reason'])+'</p><p><b>人工核对：</b>'+H(d['manual_review'])+'</p><details><summary>来源节录</summary>'+evidence(d['evidence'])+'</details></article>')
out.append('''<script>document.getElementById('find').addEventListener('input',e=>{const q=e.target.value.trim();document.querySelectorAll('article').forEach(a=>a.hidden=q&&!a.textContent.includes(q));});</script></html>''')
target=ROOT/'reports/eastern-jin-machine-decisions-20261011.html'
target.write_text(''.join(out))
print(target)

// 把分镜表导出成一张给人看的表（out/分镜表.md）：每一镜什么时候、你说了什么、画面上放什么。
// 发给用户确认用；用户用大白话说「第几镜换成什么」，再回去改 src/shots.js。
// 用法：node tools/storyboard.mjs [输出路径]
import {mkdirSync, writeFileSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';
import {runLint} from './lint.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const {errors, warns, project: P} = await runLint();
if (errors.length) { console.error(`分镜表还有 ${errors.length} 个错误，先跑 npm run check 改掉。`); process.exit(1); }

const q = (t) => `「${t}」`;
const focusOf = (c) => (c.focus ? `；框出${(Array.isArray(c.focus) ? c.focus : [c.focus]).map((f) => (f.text ? q(f.text) : '一处')).join('、')}` : '');
const pillOf = (c) => (c.pill ? `；下面一句结论${q(c.pill)}` : '');
const describe = (s) => {
  const out = [];
  const c = s.card, o = s.overlay;
  if (s.state === 'full') out.push('整张脸出镜');
  if (c) {
    const who = s.state === 'cutout' ? '人站在旁边' : '人在小窗里';
    if (c.type === 'cards3') out.push(`${c.items.length} 张编号小卡${q(c.title)}：${c.items.join(' / ')}（${who}）`);
    else if (c.type === 'list') out.push(`清单${q(c.title)}：${c.items.join(' / ')}（${who}）`);
    else if (c.type === 'window') out.push(`窗口${q(c.title)}：${c.img ? `截图 ${c.img}${c.scroll ? '（滚动着看）' : ''}` : c.lines.join(' / ')}${focusOf(s.card)}${pillOf(c)}（${who}）`);
    else if (c.type === 'image') out.push(`截图 ${c.img}${c.crop ? '（只显示一块）' : ''}${c.scroll ? '（滚动着看）' : ''}${c.caption ? `，小标题${q(c.caption)}` : ''}${focusOf(c)}${pillOf(c)}（${who}）`);
    else if (c.type === 'screen') out.push(`录屏 ${c.src} 第 ${c.start}–${c.end} 秒${s.cont ? '（接着上一镜放）' : ''}${c.label ? `，标签${q(c.label)}` : ''}${focusOf(c)}${pillOf(c)}（${who}）`);
    else if (c.type === 'stat') out.push(`大数字 ${c.value}${c.unit || ''}，${q(c.title)}（${who}）`);
    else if (c.type === 'pill') out.push(`一句结论${q(c.text)}（${who}）`);
    else if (c.type === 'quote') out.push(`引用${q(c.text)}${c.by ? ` —— ${c.by}` : ''}（${who}）`);
  }
  if (o) out.push(`${{chapter: '章节卡', note: '便签', tag: '小标签'}[o.type]}${q(o.type === 'chapter' ? `${o.part ? o.part + ' ' : ''}${o.title}` : o.text)}`);
  return out.join(' + ');
};
// 这一镜放的东西是真的（截图、录屏）还是做出来的示意
const real = (s) => { const c = s.card; if (!c) return ''; if (c.mock) return '示意'; if (c.type === 'screen') return '真录屏'; if (c.img) return `真截图${c.mask ? '（已打码）' : ''}`; if (c.type === 'window') return '拼的，要不要标示意？'; return '文字'; };
const cell = (t) => String(t).replace(/\|/g, '｜').replace(/\n/g, ' ');
const st = P.stats;
const pct = (v) => `${Math.round((v / st.total) * 100)}%`;
const lines = [
  '# 分镜表',
  '',
  '想改哪里，直接用大白话说「第几镜换成什么」。「观众能明白什么」那一栏写不出来或者你觉得牵强的，就是该删的。',
  '',
  `全片 ${st.total} 秒，${P.shots.length} 镜。露脸：整张脸 ${pct(st.full)} · 小窗 ${pct(st.small)} · 看不到人 ${pct(st.hidden)}`,
  '',
  '| # | 时间（秒） | 你说 | 画面 | 观众能明白什么 | 真实 / 示意 | 什么时候出现 | 备注 |',
  '|---|---|---|---|---|---|---|---|',
  ...P.shots.map((s) => `| ${s.index + 1} | ${s.from.toFixed(1)}–${s.to.toFixed(1)} | ${cell(s.said)} | ${cell(describe(s))} | ${cell(s.why || (s.card ? '（没写）' : ''))} | ${cell(real(s))} | ${cell(s.notes.join('；'))} | ${cell(s.memo || '')} |`),
  '',
];
// 截图里露出来的字：看不见图的话，靠这一段核对每张截图放得对不对——露出来的是不是这一镜在讲的事
const {MEASURED} = await import(pathToFileURL(path.join(root, 'src/measured.js')).href + `?t=${Date.now()}`);
const shown = P.shots.filter((s) => s.card && s.card.img && MEASURED.ocr && MEASURED.ocr[s.card.img]).map((s) => {
  const c = s.card, cr = c.crop || null;
  const inside = (r) => !cr || (r[0] + r[2] / 2 >= cr[0] && r[0] + r[2] / 2 <= cr[0] + cr[2] && r[1] + r[3] / 2 >= cr[1] && r[1] + r[3] / 2 <= cr[1] + cr[3]);
  const txt = MEASURED.ocr[c.img].lines.filter(([, r]) => inside(r)).map(([t]) => t);
  const joined = txt.join(' ／ ');
  return `- 第 ${s.index + 1} 镜（你说：「${s.said.slice(0, 30)}${s.said.length > 30 ? '…' : ''}」）→ ${c.img}${cr ? ' 的一块' : ''}：${txt.length ? `${joined.slice(0, 160)}${joined.length > 160 ? '…' : ''}` : '（这一块里没有字）'}`;
});
if (shown.length) lines.push('## 截图里露出来的字', '', '逐条看：露出来的是不是这一镜在讲的事？有不相干的消息混在里面，就把 crop 收小，只留要讲的那条。', '', ...shown, '');
if (warns.length) lines.push('## 检查器的提醒', '', ...warns.map((w) => `- ${w.where}：${w.msg}`), '');
const out = path.resolve(root, process.argv[2] || 'out/分镜表.md');
mkdirSync(path.dirname(out), {recursive: true});
writeFileSync(out, lines.join('\n'));
console.log(`分镜表：${out}（${P.shots.length} 镜）`);

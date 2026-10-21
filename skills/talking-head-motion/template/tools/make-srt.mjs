// 把 src/subs.js 导出成 .srt（去掉关键词方括号），方便在剪映里改字幕。
// 用法：node tools/make-srt.mjs out/字幕.srt
import {writeFileSync} from 'node:fs';
import {SUBS} from '../src/subs.js';

const ts = (t) => {
  const ms = Math.round(t * 1000);
  const p = (n, w = 2) => String(n).padStart(w, '0');
  return `${p(Math.floor(ms / 3600000))}:${p(Math.floor(ms / 60000) % 60)}:${p(Math.floor(ms / 1000) % 60)},${p(ms % 1000, 3)}`;
};
const srt = SUBS.map((s, i) => `${i + 1}\n${ts(s.from)} --> ${ts(s.to)}\n${s.text.replace(/[\[\]]/g, '')}\n`).join('\n');
const out = process.argv[2] || 'out/subtitles.srt';
writeFileSync(out, srt);
console.log(`wrote ${SUBS.length} lines -> ${out}`);

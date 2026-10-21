// 节奏检查：内容全部出现后停留太久、镜头之间有空档、字幕和分镜对不上，都会列出来。
// 用法：node tools/check-pacing.mjs
import {CONFIG} from '../src/config.js';
import {SHOTS} from '../src/shots.js';
import {SUBS} from '../src/subs.js';
import {contentDone} from '../src/sfx.js';

const issues = [];
SHOTS.forEach((s, i) => {
  const next = SHOTS[i + 1];
  if (next && Math.abs(next.from - s.to) > 0.01) issues.push(`第 ${i + 1} 镜和第 ${i + 2} 镜之间有 ${(next.from - s.to).toFixed(2)} 秒空档或重叠`);
  if (s.state !== 'full') {
    const hold = s.to - contentDone(s, CONFIG.fps);
    const spoken = SUBS.filter((x) => x.to > s.from && x.from < s.to).reduce((m, x) => Math.max(m, x.to), 0);
    // 人还在说话时画面停着没关系；说完了还停就是空档
    if (hold > CONFIG.maxHold && spoken < s.to - CONFIG.maxHold) issues.push(`第 ${i + 1} 镜（${s.from}–${s.to}）内容出全后停了 ${hold.toFixed(1)} 秒，台词已经说完，最多 ${CONFIG.maxHold} 秒`);
    if (hold < 0) issues.push(`第 ${i + 1} 镜（${s.from}–${s.to}）太短，内容还没出全就切走了，差 ${(-hold).toFixed(1)} 秒`);
  }
});
SUBS.forEach((x, i) => {
  if (x.text.replace(/\[|\]/g, '').length > 18) issues.push(`字幕第 ${i + 1} 句超过 18 个字，可能放不下一行：${x.text}`);
  const prev = SUBS[i - 1];
  if (prev && x.from - prev.to > 0.3) issues.push(`字幕第 ${i} 和第 ${i + 1} 句之间空了 ${(x.from - prev.to).toFixed(2)} 秒，检查是不是没剪干净的停顿`);
});
console.log(issues.length ? issues.join('\n') : '节奏检查通过');
process.exitCode = issues.length ? 1 : 0;

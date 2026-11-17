// 把句子写成 src/sentences.js。make-timeline.mjs（识别成片口播）和 cut.mjs（从原始素材剪出口播）都用这一个写法。
// sentences: [{from, to, text, words}]，编号在这里统一编成 S01、S02…
import {writeFileSync} from 'node:fs';

const r2 = (v) => Math.round(v * 100) / 100;
const q = (t) => `'${String(t).replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;

export const writeSentences = (dest, sentences, duration, source) => {
  const pad = Math.max(2, String(sentences.length).length);
  const id = (i) => `S${String(i + 1).padStart(pad, '0')}`;
  writeFileSync(dest, [
    '// 句子时间轴：每句话一个编号。分镜表（shots.js）按编号指句子，字幕也从这里来。',
    `// ${source}（${new Date().toLocaleDateString('sv')}）。`,
    '// 只改 text：改错字、给关键词加 [方括号]（会上色）、给英文词补中文「take over（接管）」。',
    '// 不要改 id / from / to，也不要增删行。',
    `export const DURATION = ${r2(duration)};   // 口播总时长（秒）`,
    'export const SENTENCES = [',
    ...sentences.map((s, i) => `  {id: '${id(i)}', from: ${r2(s.from)}, to: ${r2(s.to)}, text: ${q(s.text)}},`),
    '];',
    '',
    '// 逐词时间（机器生成，别改）。用来把「说到哪个词」换算成秒。',
    'export const WORDS = {',
    ...sentences.map((s, i) => `  ${id(i)}: ${JSON.stringify(s.words || [])},`),
    '};',
    '',
  ].join('\n'));
};

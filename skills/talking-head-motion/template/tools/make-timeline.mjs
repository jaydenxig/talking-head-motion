// 句子时间轴：从口播里识别出每一句话和它的起止时间，写进 src/sentences.js。
// 分镜表按句子编号写，字幕也从这里来，所以这一步要在写分镜之前做。
// （口播是用 npm run cut 从原始素材剪出来的话，句子时间轴已经一起生成了，不用再跑这个。）
//
// 用法：
//   node tools/make-timeline.mjs                    # 识别 public/ 下的口播（config.js 的 talk），需要装 whisper.cpp
//   node tools/make-timeline.mjs --srt 字幕.srt      # 已经有字幕文件（剪映或任何识别工具导出的都行），用它的文字
//   可选：
//   --vocab "Muse,Claude"   专有名词，逗号分隔，识别更准
//   --max 18                每句最多几个字宽（一行字幕放得下的长度）
//   --noise -35             低于多少分贝算停顿（默认自动判断；断句太碎就调低，停顿没断开就调高）
//   --lang zh               语言
//   --force                 覆盖已有的 sentences.js（旧的会备份成 sentences.backup.js）
import {copyFileSync, existsSync, mkdtempSync, readFileSync, rmSync} from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {CONFIG} from '../src/config.js';
import {WHISPER_HELP, countChars, durationOf, envelope, findWhisper, hasFfmpeg, loadPcm, r2, recognize, segsFromSrt, toSentences, vad} from './speech.mjs';
import {writeSentences} from './write-sentences.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const arg = (k, d) => { const i = process.argv.indexOf(`--${k}`); return i > 0 ? process.argv[i + 1] : d; };
const has = (k) => process.argv.includes(`--${k}`);
const die = (msg) => { console.error(msg); process.exit(1); };

const talk = path.join(root, 'public', CONFIG.talk);
const dest = path.join(root, 'src/sentences.js');
if (!existsSync(talk)) die(`找不到口播：public/${CONFIG.talk}。先把口播放进去（文件名和 config.js 的 talk 一致）`);
if (existsSync(dest) && !has('force') && !readFileSync(dest, 'utf8').includes('这份是演示内容')) {
  die('src/sentences.js 里已经有这期的句子了（可能已经改过错字）。\n确定要重新识别，就加 --force：旧的会备份成 src/sentences.backup.js。');
}
if (!hasFfmpeg()) die('没有 ffmpeg / ffprobe。先装 ffmpeg（macOS：brew install ffmpeg）');
const duration = durationOf(talk);
if (!duration) die(`读不出 public/${CONFIG.talk} 的时长，文件可能坏了`);

const tmp = mkdtempSync(path.join(os.tmpdir(), 'thm-timeline-'));
const pcm = loadPcm(talk, tmp);
const {blocks, thr} = vad(envelope(pcm), arg('noise'));
if (!blocks.length) die('整段口播都没检测到说话声。检查文件有没有声音，或者手动指定门槛（比如 --noise -45）');

let segs;
if (arg('srt')) {
  segs = segsFromSrt(path.resolve(arg('srt')), blocks);
  if (!segs.length) die(`${arg('srt')} 里没读到字幕`);
} else {
  const whisper = findWhisper();
  if (!whisper) die(`${WHISPER_HELP}\n或者：用剪映（或任何能出字幕的工具）识别这条口播，导出 .srt，然后 node tools/make-timeline.mjs --srt 字幕.srt`);
  console.log(`识别中：${Math.round(duration)} 秒的口播，按停顿切开逐段识别（${path.basename(whisper.model)}）…`);
  try { segs = recognize(pcm, blocks, {tmp, whisper, lang: arg('lang', 'zh'), vocab: arg('vocab', '')}).segs; } catch (e) { die(e.message); }
}
if (!segs.length) die('没识别出任何句子。口播里有人说话吗？');
const sentences = toSentences(segs, {max: Number(arg('max', 18)), lang: arg('lang', 'zh'), duration});

if (existsSync(dest) && has('force')) copyFileSync(dest, path.join(root, 'src/sentences.backup.js'));
writeSentences(dest, sentences, duration, `由 npm run timeline 从 public/${CONFIG.talk} 识别出来`);
rmSync(tmp, {recursive: true, force: true});

const speech = blocks.reduce((n, [a, b]) => n + b - a, 0);
const count = sentences.reduce((n, s) => n + countChars(s.text), 0);
console.log(`\n写好了 src/sentences.js：${sentences.length} 句，口播 ${r2(duration)} 秒，其中说话 ${r2(speech)} 秒，语速约 ${(count / speech).toFixed(1)} 字/秒（停顿门槛 ${Math.round(thr)} 分贝）`);
const gaps = sentences.slice(1).map((s, i) => ({a: i + 1, b: i + 2, g: r2(s.from - sentences[i].to)})).filter((x) => x.g > 0.6);
if (sentences[0].from > 0.5) console.log(`· 开头 ${sentences[0].from} 秒没人说话，成片开头会空着。建议先把口播开头剪掉`);
if (gaps.length) console.log(`· 有 ${gaps.length} 处句子之间停顿超过 0.6 秒，口播可能还没剪紧（npm run check 会列出来）`);
console.log('\n下一步：打开 src/sentences.js 对照口播稿改错字（只改 text），再跑 npm run next。');
console.log('前几句：');
sentences.slice(0, 8).forEach((s, i) => console.log(`  S${String(i + 1).padStart(2, '0')}  ${String(s.from).padStart(6)} – ${String(s.to).padEnd(6)} ${s.text}`));

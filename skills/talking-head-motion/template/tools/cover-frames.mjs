// 挑封面帧：每隔一小段看一次脸，按「眼睛看镜头 + 嘴闭着不歪 + 眼睛睁开 + 画面清楚」排好，
// 把最好的几帧（原尺寸）和一张总览图放到 out/封面候选/。只在 macOS 上能用（用的是系统自带的人脸识别）。
//
//   node tools/cover-frames.mjs [视频，默认 public/talk.mp4] [--step 0.2] [--n 8] [--gap 2]
//
// --step 每隔几秒看一次；--n 留几帧；--gap 留下的帧之间至少隔几秒（免得全挤在同一句话里）。
// 说话时大部分帧嘴是歪的、眼睛常看提词器，凭感觉截一帧多半不好看，所以用这个先筛一遍，再从里面挑 4–6 帧给用户选。
import {spawnSync, execFileSync} from 'node:child_process';
import {existsSync, mkdirSync, mkdtempSync, readdirSync, rmSync, statSync, copyFileSync} from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const argv = process.argv.slice(2);
const opt = (k, d) => { const i = argv.indexOf(`--${k}`); return i >= 0 ? Number(argv[i + 1]) : d; };
const video = path.resolve(root, argv.find((a, i) => !a.startsWith('--') && !(i > 0 && argv[i - 1].startsWith('--'))) || 'public/talk.mp4');
const STEP = opt('step', 0.2), N = opt('n', 8), GAP = opt('gap', 2);

if (process.platform !== 'darwin') { console.error('挑封面帧要用 macOS 自带的人脸识别，这台电脑用不了。照 references/cover.md 手动挑。'); process.exit(1); }
if (!existsSync(video)) { console.error(`找不到视频：${video}`); process.exit(1); }

// 识别程序：和 measure.mjs 共用同一个编译缓存
const src = path.join(root, 'tools/vision.swift');
const dir = path.join(root, 'node_modules/.cache/talking-head-motion');
const bin = path.join(dir, 'vision');
if (!existsSync(bin) || statSync(bin).mtimeMs < statSync(src).mtimeMs) {
  mkdirSync(dir, {recursive: true});
  execFileSync('swiftc', ['-O', src, '-o', bin], {stdio: 'pipe'});
}

const tmp = mkdtempSync(path.join(os.tmpdir(), 'thm-cover-'));
console.log(`每 ${STEP} 秒抽一帧……`);
let r = spawnSync('ffmpeg', ['-v', 'error', '-i', video, '-vf', `fps=${1 / STEP},scale=540:-2`, '-q:v', '3', path.join(tmp, '%05d.jpg')]);
if (r.status !== 0) { console.error(String(r.stderr)); process.exit(1); }
const files = readdirSync(tmp).filter((f) => f.endsWith('.jpg')).sort();
console.log(`看 ${files.length} 帧的脸……`);

const looks = [];
for (let i = 0; i < files.length; i += 60) {
  const batch = files.slice(i, i + 60).map((f) => path.join(tmp, f));
  const out = spawnSync(bin, ['look', ...batch], {encoding: 'utf8', maxBuffer: 1 << 26});
  if (out.status !== 0) { console.error(out.stderr); process.exit(1); }
  looks.push(...JSON.parse(out.stdout));
}

const faces = looks.map((l, i) => ({...l, t: Math.round(i * STEP * 100) / 100})).filter((l) => l.face);
if (!faces.length) { console.error('整条视频里没找到脸。'); process.exit(1); }
const median = (k) => { const v = faces.map((f) => f[k]).sort((a, b) => a - b); return v[Math.floor(v.length / 2)]; };
const eyeMid = median('eyeOpen'), sizeMid = median('size');

// 分数越小越好。每一项都按「这条视频里这个人平时什么样」来比，换个人、换个镜头也不用改数
for (const f of faces) {
  f.bad = f.gaze * 4                                   // 视线偏
    + Math.max(0, f.mouthOpen - 0.04) * 6              // 嘴张着
    + f.mouthTilt * 1.5                                // 嘴歪
    + Math.max(0, eyeMid * 0.85 - f.eyeOpen) * 6       // 眯眼、眨眼
    + Math.max(0, sizeMid * 0.85 - f.size) * 3         // 往后仰、侧过去、离镜头远
    + (1 - f.quality) * 0.6;                           // 糊、光不好
}
faces.sort((a, b) => a.bad - b.bad);
const pick = [];
for (const f of faces) {
  if (pick.length >= N) break;
  if (pick.every((p) => Math.abs(p.t - f.t) >= GAP)) pick.push(f);
}
pick.sort((a, b) => a.t - b.t);

const outDir = path.join(root, 'out/封面候选');
rmSync(outDir, {recursive: true, force: true});
mkdirSync(outDir, {recursive: true});
const sheetDir = path.join(tmp, 'sheet');
mkdirSync(sheetDir);
const mmss = (t) => `${Math.floor(t / 60)}分${(t % 60).toFixed(1)}秒`;
pick.forEach((f, k) => {
  const name = `${String(k + 1).padStart(2, '0')}_${mmss(f.t)}.jpg`;
  spawnSync('ffmpeg', ['-v', 'error', '-y', '-ss', String(f.t), '-i', video, '-frames:v', '1', '-q:v', '1', path.join(outDir, name)]);
  copyFileSync(path.join(outDir, name), path.join(sheetDir, `${String(k + 1).padStart(2, '0')}.jpg`));
  f.name = name;
});
const cols = Math.min(4, pick.length), rows = Math.ceil(pick.length / cols);
spawnSync('ffmpeg', ['-v', 'error', '-y', '-i', path.join(sheetDir, '%02d.jpg'), '-vf', `scale=360:-2,tile=${cols}x${rows}:padding=6:color=white`, '-frames:v', '1', path.join(outDir, '总览.jpg')]);
rmSync(tmp, {recursive: true, force: true});

console.log(`\n挑出 ${pick.length} 帧（总览图里从左到右、从上到下就是 01、02……）：`);
for (const f of pick) {
  const why = [];
  if (f.gaze > 0.06) why.push('视线有点偏');
  if (f.mouthOpen > 0.08) why.push('嘴张着');
  if (f.mouthTilt > 0.09) why.push('嘴有点歪');
  if (f.eyeOpen < eyeMid * 0.85) why.push('眼睛偏小');
  console.log(`  ${f.name}${why.length ? '　（' + why.join('、') + '）' : ''}`);
}
console.log(`\n在 ${path.relative(root, outDir)}/。自己先看一遍总览图，去掉表情怪的，再挑 4–6 帧给用户选。`);

// 量一量：口播多大多长、脸在哪、每个素材多大、分镜表里要框的字在图上哪里。结果写进 src/measured.js。
// 这些数都是量出来的，不用（也不要）自己估：头像取哪块、横竖互转保留哪块、框画在哪，全按它来。
//
// 用法：
//   node tools/measure.mjs           # 换了口播或素材、改了分镜表里的 focus，就再跑一次
//   node tools/measure.mjs --force   # 全部重量
//   node tools/measure.mjs --text 截图.png [要找的字]   # 单独看一张图上能认出哪些字（写 focus 之前先看一眼）
//   node tools/measure.mjs --text 截图.png --crop x,y,宽,高   # 只看 crop 这一块里露出来的字（写好 crop 以后核对用）
//
// 找脸和找字用的是 macOS 自带的识别（tools/vision.swift）。其他系统暂时没有接识别：
// 脸的位置手填 config.js 的 source / avatar.crop，要框的地方写 focus: {rect: [x, y, 宽, 高]}。
import {execFileSync, spawnSync} from 'node:child_process';
import {existsSync, mkdirSync, mkdtempSync, readdirSync, rmSync, statSync, writeFileSync} from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const pub = path.join(root, 'public');
const has = (k) => process.argv.includes(`--${k}`);
const r4 = (v) => Math.round(v * 10000) / 10000;
const run = (cmd, args) => spawnSync(cmd, args, {encoding: 'utf8', maxBuffer: 1 << 28});
const load = async (f) => import(pathToFileURL(path.join(root, f)).href + `?t=${Date.now()}`);

// ---------- 识别工具（macOS） ----------
let visionBin = null;
const vision = (args) => {
  if (process.platform !== 'darwin') return null;
  const src = path.join(root, 'tools/vision.swift');
  if (visionBin === null) {
    // 先编译成小程序放在缓存里，之后每次调用都很快；编译不了就直接解释执行
    const dir = path.join(root, 'node_modules/.cache/talking-head-motion');
    const bin = path.join(dir, 'vision');
    try {
      if (!existsSync(bin) || statSync(bin).mtimeMs < statSync(src).mtimeMs) {
        mkdirSync(dir, {recursive: true});
        execFileSync('swiftc', ['-O', src, '-o', bin], {stdio: 'pipe'});
      }
      visionBin = bin;
    } catch { visionBin = ''; }
  }
  const r = visionBin ? run(visionBin, args) : run('swift', [src, ...args]);
  if (r.status !== 0) return null;
  try { return JSON.parse(r.stdout); } catch { return null; }
};

const probe = (file) => {
  const r = run('ffprobe', ['-v', 'error', '-show_streams', '-show_format', '-of', 'json', file]);
  if (r.status !== 0) return null;
  const j = JSON.parse(r.stdout);
  const v = (j.streams || []).find((s) => s.codec_type === 'video');
  if (!v) return {duration: r4(Number(j.format?.duration || 0)), audioOnly: true};
  // 手机拍的视频常带旋转标记：实际看到的宽高要对调
  const rot = Number((v.side_data_list || []).map((x) => x.rotation).find((x) => x !== undefined) ?? v.tags?.rotate ?? 0);
  const swap = Math.abs(rot) % 180 === 90;
  const [n, d] = String(v.r_frame_rate || '30/1').split('/').map(Number);
  return {width: swap ? v.height : v.width, height: swap ? v.width : v.height, duration: r4(Number(j.format?.duration || v.duration || 0)), fps: r4(n / (d || 1))};
};
const sig = (file) => { const s = statSync(file); return `${s.size}-${Math.round(s.mtimeMs)}`; };
const tmp = mkdtempSync(path.join(os.tmpdir(), 'thm-measure-'));
const frameAt = (file, t, out, scale) => {
  execFileSync('ffmpeg', ['-v', 'error', '-y', '-ss', String(Math.max(0, t)), '-i', file, '-frames:v', '1', ...(scale ? ['-vf', `scale=${scale}:-2`] : []), out]);
  return out;
};

// ---------- 单独看一张图上的字 ----------
if (has('text')) {
  const i = process.argv.indexOf('--text');
  const file = [process.argv[i + 1], path.join(pub, process.argv[i + 1] || '')].find((f) => f && existsSync(f));
  if (!file) { console.error('用法：node tools/measure.mjs --text 截图.png [要找的字]（文件放在 public/ 下）'); process.exit(1); }
  const needle = process.argv[i + 2] && !process.argv[i + 2].startsWith('--') ? process.argv[i + 2] : null;
  // --crop x,y,宽,高：只列这一块里露出来的字（写好 crop 以后，用它核对画面上到底会露出什么）
  const ci = process.argv.indexOf('--crop');
  const crop = ci > 0 ? process.argv[ci + 1].split(',').map(Number) : null;
  const res = vision(['text', file, ...(needle ? [needle] : [])]);
  if (!res) { console.error('这台电脑上用不了自带的文字识别（需要 macOS）。要框的地方改用 focus: {rect: [x, y, 宽, 高]}'); process.exit(1); }
  const inCrop = (r) => !crop || (r[0] + r[2] / 2 >= crop[0] && r[0] + r[2] / 2 <= crop[0] + crop[2] && r[1] + r[3] / 2 >= crop[1] && r[1] + r[3] / 2 <= crop[1] + crop[3]);
  const lines = res.lines.filter((l) => inCrop(l.rect));
  console.log(crop ? `${path.basename(file)} 在 crop [${crop.join(', ')}] 这一块里露出来的字（${lines.length} 行）：` : `${path.basename(file)}（${res.width}×${res.height}）上认出来的字：`);
  lines.forEach((l) => console.log(`  ${l.text}    [${l.rect.join(', ')}]`));
  if (crop && !lines.length) console.log('  （这一块里一个字都没有：多半是裁到空白处了）');
  if (needle) console.log(res.hits.length ? `\n「${needle}」找到 ${res.hits.length} 处：` + res.hits.map((h, k) => `\n  第 ${k + 1} 处 [${h.rect.join(', ')}]  在「${h.line}」里`).join('') : `\n没找到「${needle}」`);
  rmSync(tmp, {recursive: true, force: true});
  process.exit(0);
}

const {CONFIG} = await load('src/config.js');
const old = (await load('src/measured.js')).MEASURED || {};
const M = {talk: null, face: null, files: {}, boxes: {}, masks: {}, crops: {}, ocr: {}};
const problems = [];

// ---------- 1. 口播 ----------
const talkFile = path.join(pub, CONFIG.talk);
if (!existsSync(talkFile)) { console.error(`找不到口播：public/${CONFIG.talk}`); process.exit(1); }
const tp = probe(talkFile);
if (!tp || !tp.width) { console.error(`读不出 public/${CONFIG.talk} 的画面，文件可能坏了`); process.exit(1); }
M.talk = {file: CONFIG.talk, ...tp, sig: sig(talkFile)};

// ---------- 2. 脸在哪 ----------
if (!has('force') && old.talk && old.talk.sig === M.talk.sig && old.face) {
  M.face = old.face;
} else {
  const n = Math.min(60, Math.max(12, Math.round(tp.duration / 2)));
  const times = Array.from({length: n}, (_, i) => r4((i + 0.5) * tp.duration / n));
  console.log(`找脸：从口播里抽 ${n} 帧…`);
  const shots = times.map((t, i) => frameAt(talkFile, t, path.join(tmp, `f${String(i).padStart(3, '0')}.jpg`), 960));
  const res = vision(['face', ...shots]);
  if (!res) {
    M.face = {found: false, reason: process.platform === 'darwin' ? '识别工具没跑起来（需要 Xcode 命令行工具：xcode-select --install）' : '这个系统还没接人脸识别'};
  } else {
    const hit = res.map((x, i) => ({...x.face, t: times[i]})).filter((x) => x.w);
    if (hit.length < Math.max(3, n * 0.2)) {
      M.face = {found: false, reason: `抽了 ${n} 帧，只有 ${hit.length} 帧里有脸`};
    } else {
      const med = (a) => { const s = [...a].sort((p, q) => p - q); return s[Math.floor(s.length / 2)]; };
      const xs = hit.map((h) => h.x), ys = hit.map((h) => h.y);
      // 去掉个别认错的帧（离中位数太远的）再算移动范围
      const mx = med(xs), my = med(ys), mh = med(hit.map((h) => h.h)), mw = med(hit.map((h) => h.w));
      const ok = hit.filter((h) => Math.abs(h.x - mx) < 0.35 && Math.abs(h.y - my) < 0.35 && h.h > mh * 0.5 && h.h < mh * 2);
      const missing = times.filter((t) => !hit.some((h) => h.t === t));
      M.face = {found: true, x: r4(mx), y: r4(my), w: r4(mw), h: r4(mh),
        minX: r4(Math.min(...ok.map((h) => h.x))), maxX: r4(Math.max(...ok.map((h) => h.x))), minY: r4(Math.min(...ok.map((h) => h.y))), maxY: r4(Math.max(...ok.map((h) => h.y))),
        samples: n, seen: hit.length, missingAt: missing.slice(0, 8).map((t) => Math.round(t))};
    }
  }
}

// ---------- 3. 每个素材多大 ----------
const IMG = /\.(png|jpe?g|webp|gif|bmp)$/i, VID = /\.(mp4|mov|m4v|webm|mkv)$/i;
const walk = (dir, rel = '') => readdirSync(dir, {withFileTypes: true}).flatMap((e) => {
  if (e.name.startsWith('.') || (rel === '' && e.name === 'sfx')) return [];
  return e.isDirectory() ? walk(path.join(dir, e.name), `${rel}${e.name}/`) : [`${rel}${e.name}`];
});
for (const f of walk(pub)) {
  if ((!IMG.test(f) && !VID.test(f)) || f === CONFIG.talk || f === CONFIG.matte) continue;
  const full = path.join(pub, f), s = sig(full);
  if (!has('force') && old.files && old.files[f] && old.files[f].sig === s) { M.files[f] = old.files[f]; continue; }
  const p = probe(full);
  if (p && p.width) M.files[f] = {width: p.width, height: p.height, ...(VID.test(f) ? {duration: p.duration} : {}), sig: s};
}

// ---------- 3.5 音效文件有多响（混音时按它配音量） ----------
const sfxDir = path.join(pub, 'sfx');
if (existsSync(sfxDir)) {
  M.sfx = {};
  for (const f of readdirSync(sfxDir).filter((x) => /\.(mp3|wav|m4a|ogg)$/i.test(x))) {
    if (!has('force') && old.sfx && old.sfx[f] !== undefined) { M.sfx[f] = old.sfx[f]; continue; }
    const m = run('ffmpeg', ['-hide_banner', '-i', path.join(sfxDir, f), '-af', 'volumedetect', '-f', 'null', '-']).stderr.match(/max_volume: (-?[\d.]+)/);
    if (m) M.sfx[f] = Number(m[1]);
  }
}

// ---------- 4. 分镜表里要框的字，在图上的位置 ----------
const {SHOTS} = await load('src/shots.js');
const {SENTENCES, WORDS, DURATION} = await load('src/sentences.js');
const {resolveProject, resolveLayout} = await load('src/resolve.js');
const {resolveStyle} = await load('src/styles.js');
const P = resolveProject({config: CONFIG, shots: SHOTS, sentences: SENTENCES, words: WORDS, duration: DURATION, measured: {...M, boxes: {}}});
let found = 0;
for (const s of P.shots) {
  for (const b of (s.card && s.card.focusBoxes) || []) {
    const need = b.need;
    if (!need || !need.text) continue;
    const full = path.join(pub, need.file || '');
    const where = `第 ${s.index + 1} 镜`;
    if (!need.file || !existsSync(full)) { problems.push(`${where}：找不到素材 public/${need.file}`); continue; }
    const cacheKey = `${need.key}#${M.files[need.file] ? M.files[need.file].sig : ''}`;
    if (!has('force') && old.boxes && old.boxes[need.key] && old.boxSigs && old.boxSigs[need.key] === cacheKey) {
      M.boxes[need.key] = old.boxes[need.key]; (M.boxSigs ||= {})[need.key] = cacheKey; found++;
      if (old.boxes[`${need.key}>`]) M.boxes[`${need.key}>`] = old.boxes[`${need.key}>`];
      continue;
    }
    const img = need.t !== undefined ? frameAt(full, need.t, path.join(tmp, `v${found}_${problems.length}.png`)) : full;
    const res = vision(['text', img, need.text]);
    if (!res) { problems.push(`${where}：这台电脑上用不了自带的文字识别（需要 macOS + Xcode 命令行工具）。把这处 focus 改成 {rect: [x, y, 宽, 高]}（原图像素）`); continue; }
    const hit = res.hits[need.nth - 1];
    if (!hit) {
      const seen = res.lines.map((l) => l.text).filter((t) => t.trim()).slice(0, 40);
      problems.push(`${where}：在 ${need.file}${need.t !== undefined ? `（第 ${need.t} 秒的画面）` : ''} 上${res.hits.length ? `「${need.text}」只有 ${res.hits.length} 处，没有第 ${need.nth} 处` : `没找到「${need.text}」`}。\n    图上认出来的字有：${seen.length ? seen.map((t) => `「${t}」`).join(' ') : '（一个字都没认出来）'}\n    把 focus 的 text 改成上面某一段里连着的几个字（要和图上一模一样），或者改用 rect`);
      continue;
    }
    M.boxes[need.key] = hit.rect;
    (M.boxSigs ||= {})[need.key] = cacheKey;
    found++;
    // 录屏会滚动：1 秒后再找一次同一处字，渲染时框跟着从第一个位置走到第二个位置
    if (need.t !== undefined) {
      const rate = (s.card.rate || 1);
      const res2 = vision(['text', frameAt(full, need.t + rate, path.join(tmp, `w${found}.png`)), need.text]);
      const d = (h) => Math.hypot(h.rect[0] - hit.rect[0], h.rect[1] - hit.rect[1]);
      // 认准「同一行字」才算同一处，免得跟到别处同样的词上去
      const flat = (t) => t.replace(/\s/g, '');
      const same = res2 && res2.hits.filter((h) => flat(h.line) === flat(hit.line) && d(h) < 700).sort((a, b) => d(a) - d(b))[0];
      if (same && d(same) > 6) M.boxes[`${need.key}>`] = same.rect;
    }
  }
}

// ---------- 4.5 要糊掉的字：邮箱、手机号，或者指定的词 ----------
const PATTERN = {money: /\d+(\.\d+)?\s*[-–~]\s*\d+(\.\d+)?\s*[KkWw万千]|[¥￥$]\s*\d[\d,.]*|\d[\d,.]*\s*(元|万元|块)/g, email: /[\w.+-]+@[\w-]+(\.[\w-]+)+/g, phone: /(?<!\d)1[3-9]\d{9}(?!\d)|(?<!\d)\d{3,4}[- ]\d{7,8}(?!\d)/g};
let masked = 0;
for (const s of P.shots) {
  const c = s.card;
  if (!c || !Array.isArray(c.mask) || !c.img) continue;
  const full = path.join(pub, c.img);
  const where = `第 ${s.index + 1} 镜`;
  if (!existsSync(full)) continue;
  const base = vision(['text', full]);
  if (!base) { problems.push(`${where}：这台电脑上用不了自带的文字识别，打码的位置没法自动找。先用 tools/mosaic.py 把图处理好再放进来`); continue; }
  for (const term of c.mask) {
    // email / phone 是按格式找；其他的按字面找。一张图上有几处就糊几处
    const needles = PATTERN[term] ? [...new Set(base.lines.flatMap((l) => l.text.match(PATTERN[term]) || []))] : [term];
    const rects = needles.flatMap((n) => (vision(['text', full, n]) || {hits: []}).hits.map((h) => h.rect));
    const key = `${c.img}|${term}`;
    if (!rects.length) {
      if (PATTERN[term]) { M.masks[key] = []; continue; }  // 这张图上没有邮箱 / 手机号：不算错
      problems.push(`${where}：要糊的「${term}」在 ${c.img} 上没找到。\n    图上认出来的字有：${base.lines.map((l) => `「${l.text}」`).slice(0, 40).join(' ')}\n    照图上的写法改 mask 里的这个词；图上确实没有，就把它从 mask 里去掉`);
      continue;
    }
    M.masks[key] = rects;
    masked += rects.length;
  }
}

// ---------- 4.6 截图上有哪些字（分镜表里列出「画面上露出来的字」，看不见图也能核对放得对不对） ----------
M.ocr = {};
for (const s of P.shots) {
  const c = s.card;
  if (!c || !c.img || M.ocr[c.img]) continue;
  const full = path.join(pub, c.img);
  if (!existsSync(full)) continue;
  const sg = M.files[c.img] ? M.files[c.img].sig : '';
  if (!has('force') && old.ocr && old.ocr[c.img] && old.ocr[c.img].sig === sg) { M.ocr[c.img] = old.ocr[c.img]; continue; }
  const res = vision(['text', full]);
  if (res) M.ocr[c.img] = {sig: sg, lines: res.lines.filter((l) => l.text.trim().length > 1).map((l) => [l.text, l.rect])};
}

// ---------- 4.7 裁出来的那一块，内容占了多少（看不见图的时候，裁歪了自己发现不了） ----------
// 缩成 64×64 的灰度小图，背景 = 最常见的那个灰度；有内容的列和行围出一个框，框占整块的比例就是「内容占了多少」
M.crops = {};
for (const s of P.shots) {
  const c = s.card;
  if (!c || !Array.isArray(c.crop) || !(c.img || c.src)) continue;
  const full = path.join(pub, c.img || c.src);
  if (!existsSync(full)) continue;
  const [x, y, w, h] = c.crop.map((v) => Math.max(0, Math.round(v)));
  const key = `${c.img || c.src}|${[x, y, w, h].join(',')}`;
  if (M.crops[key] !== undefined) continue;
  const N = 64;
  const r = spawnSync('ffmpeg', ['-v', 'error', ...(c.src ? ['-ss', String(c.start || 0)] : []), '-i', full, '-frames:v', '1', '-vf', `crop=${w}:${h}:${x}:${y},scale=${N}:${N},format=gray`, '-f', 'rawvideo', '-'], {maxBuffer: 1 << 24});
  if (r.status !== 0 || !r.stdout || r.stdout.length < N * N) continue;
  const px = r.stdout.subarray(0, N * N), hist = new Array(256).fill(0);
  px.forEach((v) => { hist[v]++; });
  const mode = hist.indexOf(Math.max(...hist));
  const ink = (i) => Math.abs(px[i] - mode) > 14;
  const colOn = [], rowOn = [];
  for (let k = 0; k < N; k++) {
    let cc = 0, rc = 0;
    for (let m = 0; m < N; m++) { if (ink(m * N + k)) cc++; if (ink(k * N + m)) rc++; }
    colOn.push(cc >= 2); rowOn.push(rc >= 2);
  }
  const first = (a) => a.indexOf(true), last = (a) => a.lastIndexOf(true);
  if (first(colOn) < 0) { M.crops[key] = {cover: 0, empty: '整块'}; continue; }
  const bw = (last(colOn) - first(colOn) + 1) / N, bh = (last(rowOn) - first(rowOn) + 1) / N;
  // 空在哪一边（空得最多的那一边）
  const gaps = {左边: first(colOn) / N, 右边: (N - 1 - last(colOn)) / N, 上面: first(rowOn) / N, 下面: (N - 1 - last(rowOn)) / N};
  const side = Object.entries(gaps).sort((p, q) => q[1] - p[1])[0];
  M.crops[key] = {cover: r4(bw * bh), empty: side[1] >= 0.25 ? side[0] : ''};
}

// ---------- 5. 写文件 ----------
writeFileSync(path.join(root, 'src/measured.js'), [
  '// 量出来的数据：口播的尺寸和时长、脸在哪、每个素材多大、要框的字在图上哪里。',
  `// 由 npm run measure 生成（${new Date().toLocaleDateString('sv')}），别手改。换了口播或素材、改了分镜表里的 focus，就重跑一次。`,
  `export const MEASURED = ${JSON.stringify(M, null, 2)};`,
  '',
].join('\n'));
rmSync(tmp, {recursive: true, force: true});

// ---------- 6. 报告 ----------
const pct = (v) => `${Math.round(v * 100)}%`;
console.log(`\n口播：${M.talk.width}×${M.talk.height}（${M.talk.height > M.talk.width ? '竖着拍的' : '横着拍的'}），${M.talk.duration} 秒`);
if (M.face.found) {
  const f = M.face;
  console.log(`脸：在画面横向 ${pct(f.x)}、纵向 ${pct(f.y)} 的位置，脸高占画面 ${pct(f.h)}；全程横向在 ${pct(f.minX)}–${pct(f.maxX)} 之间移动` + (f.seen < f.samples ? `；${f.samples - f.seen} 帧里没看到脸（大约在第 ${f.missingAt.join('、')} 秒）` : ''));
} else console.log(`脸：没找到（${M.face.reason}）。头像和裁切会按画面正中算；位置不对就在 config.js 里手填 source 和 avatar.crop`);
console.log(`素材：${Object.keys(M.files).length} 个` + (found ? `；要框的字找到 ${found} 处` : '') + (masked ? `；要糊的地方找到 ${masked} 处` : ''));
const lay = resolveLayout(CONFIG, M, resolveStyle(CONFIG.style));
lay.issues.forEach((x) => console.log(`${x.level === 'error' ? '✗' : '！'} ${x.where}：${x.msg}`));
if (lay.cutout && lay.cutout.center) console.log(`！ 原位抠像（cutout）：${lay.cutout.reason}。这条口播的图卡段落用 pip`);
else if (lay.cutout && lay.cutout.side) console.log(`原位抠像（cutout）时，图卡会摆在人的${lay.cutout.side === 'right' ? '右' : '左'}边`);
if (problems.length) {
  console.log(`\n${problems.length} 处没量出来：`);
  problems.forEach((p) => console.log(`✗ ${p}`));
  process.exit(1);
}
console.log('\n已写入 src/measured.js');

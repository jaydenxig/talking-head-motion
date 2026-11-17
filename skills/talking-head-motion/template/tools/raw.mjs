// 识别原始素材：把 raw/ 下没剪过的口播逐句识别出来、编上号，写进 src/takes.js，并把疑似「说错重来」的句子先标出来。
// 之后只要在 takes.js 里把不要的句子改成 keep: false，再跑 npm run cut，就得到剪紧的口播和句子时间轴。
//
// 用法：
//   node tools/raw.mjs                      # npm run raw
//   可选：--vocab "Muse,Claude"（专有名词）、--noise -40（停顿门槛，默认自动）、--max 18、--lang zh
//         --force（覆盖已有的 takes.js，旧的备份成 takes.backup.js）
//
// 另外录了一条更清楚的声音（电脑或录音笔）：也放进 raw/，这里会按声音波形自动对齐，剪的时候用它替换手机的声音。
import {copyFileSync, existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync} from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {CONFIG} from '../src/config.js';
import {SR, WHISPER_HELP, countChars, envelope, findWhisper, hasFfmpeg, loadPcm, r2, recognize, run, speedAdvice, toSentences, vad} from './speech.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const rawDir = path.join(root, 'raw');
const dest = path.join(root, 'src/takes.js');
const arg = (k, d) => { const i = process.argv.indexOf(`--${k}`); return i > 0 ? process.argv[i + 1] : d; };
const has = (k) => process.argv.includes(`--${k}`);
const die = (msg) => { console.error(msg); process.exit(1); };
const VID = /\.(mp4|mov|m4v|webm|mkv)$/i, AUD = /\.(m4a|mp3|wav|aac|flac|ogg)$/i;
const C = CONFIG.cut || {};

if (!hasFfmpeg()) die('没有 ffmpeg / ffprobe。先装 ffmpeg（macOS：brew install ffmpeg）');
if (!existsSync(rawDir)) die('没有 raw/ 文件夹。在 template/ 下建一个 raw/，把没剪过的口播（和另外录的声音，如果有）放进去');
const all = readdirSync(rawDir).filter((f) => !f.startsWith('.')).sort((a, b) => a.localeCompare(b, 'zh', {numeric: true}));
const clipNames = Array.isArray(C.clips) ? C.clips : all.filter((f) => VID.test(f));
const audioNames = C.audio === null ? [] : Array.isArray(C.audio) ? C.audio : typeof C.audio === 'string' && C.audio !== 'auto' ? [C.audio] : all.filter((f) => AUD.test(f));
if (!clipNames.length) die('raw/ 下没有视频。把没剪过的口播放进去（mp4 / mov）');
for (const f of [...clipNames, ...audioNames]) if (!existsSync(path.join(rawDir, f))) die(`config.js 的 cut 里写了 ${f}，但 raw/ 下没有这个文件`);
if (existsSync(dest) && !has('force') && /id: 'R\d+'/.test(readFileSync(dest, 'utf8'))) {
  die('src/takes.js 里已经有这期的清单了（可能已经挑过要留的句子）。\n确定要重新识别，就加 --force：旧的会备份成 src/takes.backup.js。');
}
const whisper = findWhisper();
if (!whisper) die(WHISPER_HELP);

const tmp = mkdtempSync(path.join(os.tmpdir(), 'thm-raw-'));
const probe = (file) => {
  const j = JSON.parse(run('ffprobe', ['-v', 'error', '-show_streams', '-show_format', '-of', 'json', file]).stdout || '{}');
  const v = (j.streams || []).find((s) => s.codec_type === 'video');
  const rot = v ? Number((v.side_data_list || []).map((x) => x.rotation).find((x) => x !== undefined) ?? v.tags?.rotate ?? 0) : 0;
  const swap = Math.abs(rot) % 180 === 90;
  const [n, d] = String(v?.r_frame_rate || '30/1').split('/').map(Number);
  return {width: v ? (swap ? v.height : v.width) : 0, height: v ? (swap ? v.width : v.height) : 0, fps: r2(n / (d || 1)), duration: r2(Number(j.format?.duration || 0))};
};
const sig = (f) => { const s = statSync(path.join(rawDir, f)); return `${s.size}-${Math.round(s.mtimeMs)}`; };

// ---------- 对齐另外录的声音 ----------
// 两条录音录的是同一段话，音量起伏的形状是一样的。拿这个形状去比，找出错开多少秒时最吻合。
const shape = (db, step) => {  // 每 step 格取一个平均值，再减掉整体平均
  const n = Math.floor(db.length / step);
  const out = new Float32Array(n);
  let mean = 0;
  for (let i = 0; i < n; i++) { let s = 0; for (let k = 0; k < step; k++) s += Math.max(-70, db[i * step + k]); out[i] = s / step; mean += out[i]; }
  mean /= n || 1;
  for (let i = 0; i < n; i++) out[i] -= mean;
  return out;
};
// a 错开 lag 格放到 b 上，重叠部分有多像（-1..1）
const corrAt = (a, b, lag) => {
  const i0 = Math.max(0, -lag), i1 = Math.min(a.length, b.length - lag);
  if (i1 - i0 < a.length * 0.5) return -1;
  let ab = 0, aa = 0, bb = 0;
  for (let i = i0; i < i1; i++) { const x = a[i], y = b[i + lag]; ab += x * y; aa += x * x; bb += y * y; }
  return ab / (Math.sqrt(aa * bb) + 1e-9);
};
const best = (a, b, lo, hi) => { let s = -2, at = lo; for (let l = lo; l <= hi; l++) { const c = corrAt(a, b, l); if (c > s) { s = c; at = l; } } return {lag: at, score: s}; };
const align = (clipDb, extDb, clipPcm, extPcm) => {
  // 先粗找（每 0.05 秒一格），再细找（0.01 秒），最后用原始波形找到 1 毫秒以内
  const c5 = shape(clipDb, 5), e5 = shape(extDb, 5);
  const coarse = best(c5, e5, -Math.floor(c5.length * 0.5), e5.length - Math.floor(c5.length * 0.5));
  const c1 = shape(clipDb, 1), e1 = shape(extDb, 1);
  const fine = best(c1, e1, coarse.lag * 5 - 8, coarse.lag * 5 + 8);
  const wave = (frac) => {  // 在素材的某个位置取 8 秒波形细对
    const len = 8 * SR, start = Math.max(0, Math.floor(clipPcm.length * frac - len / 2));
    const base = start + Math.round(fine.lag / 100 * SR);
    let top = -Infinity, at = 0;
    for (let d = -400; d <= 400; d += 4) {
      let s = 0;
      for (let i = 0; i < len; i += 3) { const j = base + d + i; if (j >= 0 && j < extPcm.length && start + i < clipPcm.length) s += clipPcm[start + i] * extPcm[j]; }
      if (s > top) { top = s; at = d; }
    }
    return fine.lag / 100 + at / SR;
  };
  const offs = [0.2, 0.5, 0.8].map(wave);
  const mid = [...offs].sort((x, y) => x - y)[1];
  return {offset: Math.round(mid * 1000) / 1000, score: r2(fine.score), drift: r2(Math.max(...offs) - Math.min(...offs))};
};

// ---------- 逐条素材识别 ----------
const audios = audioNames.map((f, i) => { const pcm = loadPcm(path.join(rawDir, f), tmp, `ext${i}`); return {file: f, pcm, db: envelope(pcm)}; });
const clips = [];
const takes = [];
const notes = [];
let n = 0;
clipNames.forEach((file, ci) => {
  const full = path.join(rawDir, file);
  const meta = probe(full);
  const pcm = loadPcm(full, tmp, `clip${ci}`);
  const db = envelope(pcm);
  const {blocks, thr} = vad(db, arg('noise'));
  console.log(`识别 ${file}（${Math.round(meta.duration)} 秒）…`);
  let segs = [];
  try { segs = recognize(pcm, blocks, {tmp, whisper, lang: arg('lang', 'zh'), vocab: arg('vocab', ''), name: `k${ci}_`}).segs; } catch (e) { die(e.message); }
  const sents = toSentences(segs, {max: Number(arg('max', 18)), lang: arg('lang', 'zh'), duration: meta.duration});
  let audio = null;
  if (audios.length) {
    const tries = audios.map((a) => ({file: a.file, ...align(db, a.db, pcm, a.pcm)})).sort((x, y) => y.score - x.score);
    if (tries[0].score >= 0.35) {
      audio = tries[0];
      if (audio.drift > 0.03) notes.push(`${file} 和 ${audio.file} 对齐后，头尾差了 ${audio.drift} 秒：这条素材中途可能被裁过，或者两个设备走得不一样快。剪出来以后留意后半段口型和声音对不对得上`);
    } else notes.push(`${file} 在另外录的声音里没找到对得上的地方（最像的是 ${tries[0].file}，相似度只有 ${tries[0].score}），这条用素材自己的声音`);
  }
  clips.push({file, ...meta, sig: sig(file), noise: Math.round(thr), audio});
  sents.forEach((s) => takes.push({id: `R${String(++n).padStart(3, '0')}`, clip: ci, from: s.from, to: s.to, keep: true, text: s.text, words: s.words, joined: s.joined}));
});
if (!takes.length) die('没识别出任何句子。素材里有人说话吗？');

// ---------- 先标出疑似「说错重来」的 ----------
// 只认「同样的话说了两遍」这类从字面上看得出来的；说到一半换了个意思重来的，要靠通读去找。
const norm = (t) => t.replace(/[\s，。、！？；：,.!?;:"“”'‘’…—\-]/g, '').toLowerCase();
const prefix = (a, b) => { let k = 0; while (k < a.length && k < b.length && a[k] === b[k]) k++; return k; };
const lcsLen = (a, b) => { const m = Array.from({length: a.length + 1}, () => new Array(b.length + 1).fill(0)); for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++) m[i][j] = a[i - 1] === b[j - 1] ? m[i - 1][j - 1] + 1 : Math.max(m[i - 1][j], m[i][j - 1]); return m[a.length][b.length]; };
const FILLER = /^[呃嗯啊哦额唉]{1,3}$|^(然后|那个|这个|就是|那)$/;
const LINK = /^(甚至|然后|就是|或者|还有|而且|并且|所以|那|就|也|又|还)?$/;

// 一句话里同样的几个字说了两遍、而且后一遍是接着前一遍重说的（「直接收到，甚至直接收到面试邀请」）：从中间拆成两句
for (let i = 0; i < takes.length; i++) {
  const t = takes[i];
  const chars = [...t.text];
  if (chars.length < 8 || !t.words.length) continue;
  let cut = -1;
  for (let len = Math.min(8, Math.floor(chars.length / 2)); len >= 3 && cut < 0; len--) {
    const g = chars.slice(0, len).join('');
    if (/[，,、\s]/.test(g)) continue;
    const at = t.text.indexOf(g, [...g].length);
    if (at < 0) continue;
    const between = norm(t.text.slice(g.length, at));
    // 前一遍只说了这几个字（后面最多带个连接词）就重来了
    if (LINK.test(between)) cut = g.length;
    // 或者前一遍整个被后一遍从头盖住
    else if (norm(t.text.slice(at)).startsWith(norm(t.text.slice(0, at)))) cut = at;
  }
  if (cut <= 0) continue;
  // 切点的时间：按逐词时间找最近的词边界
  let pos = 0, when = null, wi = 0;
  for (const w of t.words) { if (pos >= norm(t.text.slice(0, cut)).length) { when = w[1]; break; } pos += norm(w[0]).length; wi++; }
  if (when === null || wi === 0 || wi >= t.words.length) continue;
  const A = {...t, to: when, text: t.text.slice(0, cut).replace(/[，,、\s]+$/, ''), words: t.words.slice(0, wi)};
  const B = {...t, from: when, text: t.text.slice(cut).replace(/^[，,、\s]+/, ''), words: t.words.slice(wi), joined: true};
  takes.splice(i, 1, A, B);
  i++;
}
takes.forEach((t, i) => { t.id = `R${String(i + 1).padStart(3, '0')}`; });

const drop = (k, why) => { if (takes[k].keep) { takes[k].keep = false; takes[k].why = why; } };
takes.forEach((t, i) => {
  if (!t.keep) return;
  const a = norm(t.text);
  const cutOff = /(\.{2,}|…)$/.test(t.text.trim());
  t.text = t.text.replace(/(\.{2,}|…)+$/, '');
  if (FILLER.test(a)) return drop(i, '只有语气词');
  const nextSame = takes[i + 1] && takes[i + 1].clip === t.clip ? takes[i + 1] : null;
  const pause = nextSame ? nextSame.from - t.to : 0;
  for (let j = i + 1; j <= Math.min(takes.length - 1, i + 3); j++) {
    const u = takes[j];
    if (u.clip !== t.clip) break;
    const b = norm(u.text);
    const p = prefix(a, b), short = Math.min(a.length, b.length), l = lcsLen(a, b);
    const near = j === i + 1;
    let why = '';
    if (near) {
      if (p >= 3 && p >= short * 0.75) why = `像是说错重来：和 ${u.id}「${u.text.slice(0, 10)}」开头一样，留后一遍`;
      else if (short >= 3 && l / short >= 0.75 && l / a.length >= 0.75 && (a.length <= 10 || pause >= 0.5)) why = `像是说错重来：和 ${u.id}「${u.text.slice(0, 10)}」几乎一样，留后一遍`;
      else if (cutOff && l >= 2) why = `话没说完就断了，后面 ${u.id}「${u.text.slice(0, 10)}」重新说了`;
      else if (pause >= 1 && l >= 4 && l / a.length >= 0.5) why = `像是说到一半换了说法：停了 ${r2(pause)} 秒后 ${u.id}「${u.text.slice(0, 10)}」把这件事重说了一遍`;
    } else if ((p >= 4 && p >= short * 0.75) || (a.length >= 5 && l / a.length >= 0.8 && l / short >= 0.8)) why = `像是说错重来：和 ${u.id}「${u.text.slice(0, 10)}」${p >= 4 ? '开头一样' : '几乎一样'}，留后一遍`;
    if (!why) continue;
    drop(i, why);
    for (let k = i + 1; k < j; k++) drop(k, `夹在重来的两遍中间（${t.id} → ${u.id}），多半是没说完的那一遍`);
    break;
  }
});
// 上一条素材结尾说的话，下一条素材开头又说了一遍：分段重录时常见，留后一条里的
for (let c = 0; c + 1 < clips.length; c++) {
  const tail = takes.map((t, i) => ({t, i})).filter((x) => x.t.clip === c).slice(-4);
  const head = takes.filter((t) => t.clip === c + 1).slice(0, 4);
  const hit = tail.find((x) => head.some((h) => { const a = norm(x.t.text), b = norm(h.text); const l = lcsLen(a, b); return a.length >= 5 && l / Math.min(a.length, b.length) >= 0.8; }));
  if (!hit) continue;
  const h = head.find((x) => { const a = norm(hit.t.text), b = norm(x.text); return lcsLen(a, b) / Math.min(a.length, b.length) >= 0.8; });
  for (let k = hit.i; k < takes.length && takes[k].clip === c; k++) drop(k, `下一条素材开头（${h.id}）把这里重录了一遍，留后面那条的`);
  const before = takes[hit.i - 1];
  if (before && before.clip === c && before.keep) before.note = `看一下：它后面那句在下一条素材里重录了，这句是不是也被 ${head[0].id} 替掉了`;
}

// ---------- 写文件 ----------
if (existsSync(dest) && has('force')) copyFileSync(dest, path.join(root, 'src/takes.backup.js'));
const q = (t) => `'${String(t).replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;
const out = [
  '// 原始素材逐句清单：npm run raw 识别出来的每一句话。在这里挑哪些留、哪些不要，再跑 npm run cut 剪出口播。',
  `// 由 npm run raw 生成（${new Date().toLocaleDateString('sv')}）。`,
  '// 你只做两件事：',
  '//   1. 不要的句子把 keep 改成 false：说错重来的（留最后完整的那一遍）、说到一半换说法的、和内容无关的。',
  '//      带 why 的是程序先标出来的疑似重讲，逐条核对：标错了就改回 keep: true。',
  '//   2. 识别错的字可以顺手改 text（也可以剪完再在 sentences.js 里改）。',
  '// 不要改 id / clip / from / to，不要增删行、不要调换顺序。',
  'export const CLIPS = [',
  ...clips.map((c) => `  ${JSON.stringify(c)},`),
  '];',
  '',
  'export const TAKES = [',
  ...takes.map((t, i) => {
    const gap = i > 0 && takes[i - 1].clip === t.clip ? t.from - takes[i - 1].to : 0;
    const head = (i === 0 || takes[i - 1].clip !== t.clip ? `  // ── ${clips[t.clip].file} ──\n` : '') + (gap >= 1 ? `  // （停了 ${r2(gap)} 秒）\n` : '');
    return `${head}  {id: '${t.id}', clip: ${t.clip}, from: ${t.from}, to: ${t.to}, keep: ${t.keep}, text: ${q(t.text)}${t.why ? `, why: ${q(t.why)}` : ''}${t.note ? `, note: ${q(t.note)}` : ''}},`;
  }),
  '];',
  '',
  '// 机器用的数据（逐词时间、哪些句子和上一句连着说），别改。',
  `export const RAW_JOINED = ${JSON.stringify(takes.filter((t) => t.joined).map((t) => t.id))};`,
  'export const RAW_WORDS = {',
  ...takes.map((t) => `  ${t.id}: ${JSON.stringify(t.words)},`),
  '};',
  '',
].join('\n');
writeFileSync(dest, out);
rmSync(tmp, {recursive: true, force: true});

// ---------- 报告 ----------
const kept = takes.filter((t) => t.keep), dropped = takes.filter((t) => !t.keep);
const speech = kept.reduce((s, t) => s + t.to - t.from, 0);
const rate = kept.reduce((s, t) => s + countChars(t.text), 0) / (speech || 1);
console.log(`\n写好了 src/takes.js：${clips.length} 条素材共 ${r2(clips.reduce((s, c) => s + c.duration, 0))} 秒，识别出 ${takes.length} 句。`);
clips.forEach((c) => { if (c.audio) console.log(`· ${c.file} 的声音会换成 ${c.audio.file}（已对齐，相似度 ${c.audio.score}）`); });
notes.forEach((x) => console.log(`！ ${x}`));
console.log(`· 先标出 ${dropped.length} 句疑似重讲 / 语气词（keep: false，带 why）。这只是初筛，要逐条核对，也要通读全文找漏掉的。`);
dropped.slice(0, 12).forEach((t) => console.log(`    ${t.id}「${t.text}」— ${t.why}`));
if (dropped.length > 12) console.log(`    … 还有 ${dropped.length - 12} 句，见 src/takes.js`);
console.log(`· ${speedAdvice(rate).say}。要不要加速由用户定，写进 config.js 的 cut.speed。`);
console.log('\n下一步：通读 src/takes.js，把不要的句子改成 keep: false（规则见 references/cutting.md），再跑 npm run next。');

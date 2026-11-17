// 剪口播：按 src/takes.js 里留下来的句子，把原始素材剪成 public/ 下的口播，同时写好句子时间轴（src/sentences.js）。
// 做的事：去掉不要的句子、把句子之间的停顿收到设定的长度、（有的话）换成另外录的声音、（要的话）整体加速、统一响度。
//
// 用法：
//   node tools/cut.mjs            # npm run cut
//   node tools/cut.mjs --dry      # 只算不剪：看看会剪成多长、哪些刀口要留意
// 设置在 src/config.js 的 cut 里：pause（气口松紧）、speed（加速）、loudness（响度）。
//
// 几条做法（都是踩过坑定下来的）：
//   · 下刀的位置来自量出来的停顿，落在两句话之间的安静处；非切在连着说的话中间不可时，找附近最安静的那一刻，并在报告里提醒去听。
//   · 每一刀对齐到整帧；声音单独处理、只编码一次（每段各编一次再拼，接缝处会有几十毫秒的空档，听着像卡了一下）。
//   · 不降噪、不调色。
import {execFileSync} from 'node:child_process';
import {copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync} from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';
import {durationOf, envelope, hasFfmpeg, loadPcm, r2, run, vad, valleyNear} from './speech.mjs';
import {writeSentences} from './write-sentences.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const has = (k) => process.argv.includes(`--${k}`);
const die = (msg) => { console.error(msg); process.exit(1); };
const load = async (f) => import(pathToFileURL(path.join(root, f)).href + `?t=${Date.now()}`);
const {CONFIG} = await load('src/config.js');
const {CLIPS, TAKES, RAW_JOINED, RAW_WORDS} = await load('src/takes.js');
const C = {pause: 'tight', speed: 1, loudness: -14, ...(CONFIG.cut || {})};
const FPS = CONFIG.fps || 30;
const rawDir = path.join(root, 'raw');

// ---------- 检查清单有没有被改坏 ----------
if (!hasFfmpeg()) die('没有 ffmpeg / ffprobe。先装 ffmpeg（macOS：brew install ffmpeg）');
if (!TAKES.length) die('src/takes.js 还是空的。先把原始口播放进 raw/，跑 npm run raw');
const PAUSES = {tight: {lead: 0.15, tail: 0.2}, loose: {lead: 0.35, tail: 0.45}, keep: {lead: 0.35, tail: 0.45, max: 1.5}};
if (!PAUSES[C.pause]) die(`config.js 的 cut.pause 写的是 '${C.pause}'，只能是 'tight'（约 0.35 秒）/ 'loose'（约 0.8 秒）/ 'keep'（原样）`);
if (typeof C.speed !== 'number' || C.speed < 1 || C.speed > 1.5) die(`config.js 的 cut.speed 写的是 ${JSON.stringify(C.speed)}，要写 1 到 1.5 之间的数字（1 = 不加速）`);
TAKES.forEach((t, i) => {
  const where = `src/takes.js 的 ${t && t.id ? t.id : `第 ${i + 1} 行`}`;
  if (!t || !/^R\d+$/.test(t.id || '') || typeof t.from !== 'number' || typeof t.to !== 'number' || !CLIPS[t.clip]) die(`${where} 被改坏了（id / clip / from / to 不能动）。恢复不了就重跑 npm run raw -- --force`);
  if (typeof t.keep !== 'boolean') die(`${where} 的 keep 要写 true 或 false，现在是 ${JSON.stringify(t.keep)}`);
  const prev = TAKES[i - 1];
  if (prev && (prev.clip > t.clip || (prev.clip === t.clip && prev.to > t.from + 0.011))) die(`${where} 的顺序不对。不要调换行的顺序、不要增删行；恢复不了就重跑 npm run raw -- --force`);
});
CLIPS.forEach((c) => { if (!existsSync(path.join(rawDir, c.file))) die(`找不到原始素材 raw/${c.file}（清单是按它识别的）。把它放回 raw/`); if (c.audio && !existsSync(path.join(rawDir, c.audio.file))) die(`找不到另外录的声音 raw/${c.audio.file}`); });
const kept = TAKES.filter((t) => t.keep);
if (!kept.length) die('src/takes.js 里所有句子都是 keep: false，没有东西可剪');

// ---------- 每句话留哪一段 ----------
const tmp = mkdtempSync(path.join(os.tmpdir(), 'thm-cut-'));
const joined = new Set(RAW_JOINED);
const dbs = CLIPS.map((c, i) => envelope(loadPcm(path.join(rawDir, c.file), tmp, `clip${i}`)));
const P = PAUSES[C.pause];
const risky = [];  // 不得不切在连着说的话中间的刀口
const spans = [];  // {clip, s, e, takes: []}
TAKES.forEach((t, i) => {
  if (!t.keep) return;
  const prev = TAKES[i - 1] && TAKES[i - 1].clip === t.clip ? TAKES[i - 1] : null;
  const next = TAKES[i + 1] && TAKES[i + 1].clip === t.clip ? TAKES[i + 1] : null;
  const gapPrev = prev ? t.from - prev.to : t.from, gapNext = next ? next.from - t.to : CLIPS[t.clip].duration - t.to;
  const whole = (gap) => gap <= (P.max ?? P.lead + P.tail);  // 停顿本来就不长：整段留着，不动刀
  let s, e;
  // 开头
  if (prev && prev.keep && whole(gapPrev)) s = t.from - gapPrev / 2;
  else if (prev && !prev.keep && gapPrev < 0.12) {
    const v = valleyNear(dbs[t.clip], t.from);
    s = v.t;
    if (v.db > CLIPS[t.clip].noise + 6) risky.push({take: t, side: '前'});
  } else s = t.from - Math.min(P.lead, gapPrev * (prev ? 0.5 : 1));
  // 结尾
  if (next && next.keep && whole(gapNext)) e = t.to + gapNext / 2;
  else if (next && !next.keep && gapNext < 0.12) {
    const v = valleyNear(dbs[t.clip], t.to);
    e = v.t;
    if (v.db > CLIPS[t.clip].noise + 6) risky.push({take: t, side: '后'});
  } else e = t.to + Math.min(P.tail, gapNext * (next ? 0.5 : 1));
  const last = spans[spans.length - 1];
  if (last && last.clip === t.clip && s <= last.e + 0.5 / FPS) { last.e = e; last.takes.push(t); }
  else spans.push({clip: t.clip, s: Math.max(0, s), e, takes: [t]});
});
// 对齐到整帧（统一用 int(x*fps+0.5)，不同工具的四舍五入不一样会差一帧）
const fr = (x) => Math.floor(x * FPS + 0.5);
let outFrame = 0;
spans.forEach((sp, k) => {
  sp.a = Math.max(fr(sp.s), k > 0 && spans[k - 1].clip === sp.clip ? spans[k - 1].b : 0);
  sp.b = Math.max(sp.a + 1, Math.min(fr(sp.e), Math.floor(CLIPS[sp.clip].duration * FPS)));
  sp.out = outFrame;
  outFrame += sp.b - sp.a;
});
const cutFrames = outFrame;
// 加速：挑帧（不是混帧），画面不糊
const speedPick = (n) => C.speed === 1 || n === Math.round(C.speed * Math.round(n / C.speed));
let finalFrames = 0;
for (let n = 0; n < cutFrames; n++) if (speedPick(n)) finalFrames++;
const duration = finalFrames / FPS;

// ---------- 句子时间轴：原片时间 → 成片时间（剪辑表是自己算的，换算是精确的） ----------
const spanOf = new Map();
spans.forEach((sp) => sp.takes.forEach((t) => spanOf.set(t.id, sp)));
const map = (t, sp) => r2(Math.max(0, Math.min(duration, (sp.out + (t * FPS - sp.a)) / FPS / C.speed)));
const sentences = kept.map((t) => {
  const sp = spanOf.get(t.id);
  return {from: map(t.from, sp), to: map(t.to, sp), text: t.text, words: (RAW_WORDS[t.id] || []).map((w) => [w[0], map(w[1], sp), map(w[2], sp)]), take: t.id};
});
sentences.forEach((s, i) => { if (i > 0 && s.from < sentences[i - 1].to) s.from = sentences[i - 1].to; if (s.to <= s.from) s.to = r2(s.from + 0.1); });

// ---------- 报告（--dry 到这里为止） ----------
const rawTotal = CLIPS.reduce((n, c) => n + c.duration, 0);
const dropped = TAKES.filter((t) => !t.keep);
const report = () => {
  console.log(`原始素材 ${r2(rawTotal)} 秒 → 口播 ${r2(duration)} 秒（${spans.length} 段拼起来${C.speed !== 1 ? `，整体 ${C.speed} 倍速` : ''}）。`);
  console.log(`去掉 ${dropped.length} 句不要的；句子之间的气口按「${{tight: '紧（约 0.35 秒）', loose: '松（约 0.8 秒）', keep: '原样'}[C.pause]}」留。`);
  CLIPS.forEach((c) => { if (c.audio) console.log(`${c.file} 的声音换成了 ${c.audio.file}。`); });
  if (risky.length) {
    console.log(`\n！ 有 ${risky.length} 处刀口切在连着说的话中间（去掉的那句和留下的这句之间没有停顿），可能切到字，剪完请听一下：`);
    risky.forEach((x) => { const s = sentences.find((y) => y.take === x.take.id); console.log(`   成片第 ${x.side === '前' ? s.from : s.to} 秒，「${x.take.text}」的${x.side}面（${x.take.id}）`); });
  }
};
if (has('dry')) { report(); rmSync(tmp, {recursive: true, force: true}); process.exit(0); }

// ---------- 剪：画面一遍（不带声音），声音一遍（只编码一次），最后合起来 ----------
const dest = path.join(root, 'public', CONFIG.talk);
mkdirSync(path.dirname(dest), {recursive: true});
const ff = (args) => execFileSync('ffmpeg', ['-v', 'error', '-y', ...args], {stdio: ['ignore', 'ignore', 'inherit'], maxBuffer: 1 << 28});
const used = [...new Set(spans.map((s) => s.clip))];
const W = CLIPS[used[0]].width, H = CLIPS[used[0]].height;
console.log(`剪画面（${spans.length} 段）…`);
{
  const inputs = used.flatMap((c) => ['-i', path.join(rawDir, CLIPS[c].file)]);
  const parts = used.map((c, i) => {
    const expr = spans.filter((s) => s.clip === c).map((s) => `between(n\\,${s.a}\\,${s.b - 1})`).join('+');
    return `[${i}:v]fps=${FPS},select='${expr}',setpts=N/(${FPS}*TB),scale=${W - (W % 2)}:${H - (H % 2)},setsar=1,format=yuv420p[v${i}]`;
  });
  const cat = used.length > 1 ? `${used.map((_, i) => `[v${i}]`).join('')}concat=n=${used.length}:v=1:a=0[vc]` : '[v0]null[vc]';
  const sp = C.speed === 1 ? '[vc]null[vo]' : `[vc]select='eq(n\\,round(${C.speed}*round(n/${C.speed})))',setpts=N/(${FPS}*TB)[vo]`;
  const graph = path.join(tmp, 'v.txt');
  writeFileSync(graph, [...parts, cat, sp].join(';\n'));
  ff([...inputs, '-filter_complex_script', graph, '-map', '[vo]', '-an', '-r', String(FPS), '-c:v', 'libx264', '-crf', '17', '-preset', 'fast', '-pix_fmt', 'yuv420p', path.join(tmp, 'v.mp4')]);
}
console.log('剪声音…');
{
  // 每一段从哪条声音里取：有对齐好的外录就用外录（时间加上错开的秒数），否则用素材自己的
  const srcs = [];
  const srcIndex = (file) => { let i = srcs.indexOf(file); if (i < 0) { srcs.push(file); i = srcs.length - 1; } return i; };
  const segs = spans.map((s) => {
    const c = CLIPS[s.clip];
    const off = c.audio ? c.audio.offset : 0;
    return {src: srcIndex(path.join(rawDir, c.audio ? c.audio.file : c.file)), a: Math.max(0, s.a / FPS + off), d: (s.b - s.a) / FPS};
  });
  const lines = [];
  srcs.forEach((_, i) => {
    const mine = segs.map((s, k) => ({...s, k})).filter((s) => s.src === i);
    lines.push(`[${i}:a]aresample=48000,aformat=sample_fmts=fltp:channel_layouts=stereo,asplit=${mine.length}${mine.map((s) => `[s${s.k}]`).join('')}`);
    // 每段补够整帧的长度（素材结尾声音可能比画面短一点），接缝才不会越攒越偏
    mine.forEach((s) => lines.push(`[s${s.k}]atrim=start=${s.a.toFixed(5)}:duration=${s.d.toFixed(5)},asetpts=PTS-STARTPTS,apad=whole_dur=${s.d.toFixed(5)},atrim=duration=${s.d.toFixed(5)}[a${s.k}]`));
  });
  lines.push(`${segs.map((_, k) => `[a${k}]`).join('')}concat=n=${segs.length}:v=0:a=1${C.speed === 1 ? '' : `,atempo=${C.speed}`}[ao]`);
  const graph = path.join(tmp, 'a.txt');
  writeFileSync(graph, lines.join(';\n'));
  const wav = path.join(tmp, 'a.wav');
  ff([...srcs.flatMap((f) => ['-i', f]), '-filter_complex_script', graph, '-map', '[ao]', '-c:a', 'pcm_s16le', wav]);
  // 响度：整体加减音量 + 限幅，量一遍差多少再补，最多三轮（一遍到位的做法常常差一两个单位；也不做动态压缩，免得声音发闷）
  const measure = (filter) => { const m = run('ffmpeg', ['-hide_banner', '-i', wav, '-af', `${filter ? filter + ',' : ''}ebur128`, '-f', 'null', '-']).stderr.match(/I:\s+(-?[\d.]+) LUFS/g); return m ? Number(m.pop().replace(/[^-\d.]/g, '')) : NaN; };
  const chain = (g) => `volume=${g.toFixed(2)}dB,alimiter=limit=0.84:attack=5:release=80:level=false`;
  let gain = C.loudness - measure('');
  let af = `loudnorm=I=${C.loudness}:TP=-1.5:LRA=11`;
  if (Number.isFinite(gain)) {
    gain = Math.max(-20, Math.min(40, gain));
    for (let k = 0; k < 3; k++) { const miss = C.loudness - measure(chain(gain)); if (!Number.isFinite(miss) || Math.abs(miss) < 0.3) break; gain = Math.max(-20, Math.min(40, gain + miss)); }
    af = chain(gain);
  }
  ff(['-i', wav, '-af', af, '-ar', '48000', '-ac', '2', '-c:a', 'aac', '-b:a', '192k', path.join(tmp, 'a.m4a')]);
}
ff(['-i', path.join(tmp, 'v.mp4'), '-i', path.join(tmp, 'a.m4a'), '-map', '0:v', '-map', '1:a', '-c', 'copy', '-shortest', '-movflags', '+faststart', dest]);

// ---------- 写句子时间轴和剪辑表 ----------
const outDur = durationOf(dest) || duration;
const senFile = path.join(root, 'src/sentences.js');
if (existsSync(senFile) && !readFileSync(senFile, 'utf8').includes('这份是演示内容')) copyFileSync(senFile, path.join(root, 'src/sentences.backup.js'));
writeSentences(senFile, sentences.map((s) => ({...s, to: Math.min(s.to, r2(outDur))})), outDur, `由 npm run cut 从 raw/ 下的原始素材剪出来时一起生成`);
const mmss = (t) => `${Math.floor(t / 60)}:${(t % 60).toFixed(2).padStart(5, '0')}`;
mkdirSync(path.join(root, 'out'), {recursive: true});
writeFileSync(path.join(root, 'out/剪辑表.md'), [
  '# 剪辑表', '',
  `原始素材 ${r2(rawTotal)} 秒 → 口播 ${r2(outDur)} 秒。气口：${C.pause}；速度：${C.speed} 倍。`, '',
  '| 成片时间 | 原片 | 原片时间 | 说了什么 |', '|---|---|---|---|',
  ...spans.map((s) => `| ${mmss(s.out / FPS / C.speed)}–${mmss((s.out + s.b - s.a) / FPS / C.speed)} | ${CLIPS[s.clip].file} | ${mmss(s.a / FPS)}–${mmss(s.b / FPS)} | ${s.takes.map((t) => t.text).join(' ').replace(/\|/g, '｜')} |`),
  '', '## 去掉的句子', '',
  ...(dropped.length ? dropped.map((t) => `- ${t.id} ${CLIPS[t.clip].file} ${mmss(t.from)}「${t.text}」${t.why ? `—— ${t.why}` : ''}`) : ['（没有）']), '',
].join('\n'));

// ---------- 验收：把剪好的口播重新量一遍，看每句话是不是落在有声音的地方、每个接缝是不是安静的 ----------
const pcm = loadPcm(dest, tmp, 'out');
const db = envelope(pcm);
const {thr} = vad(db);
const voiced = (a, b) => { let n = 0, m = 0; for (let i = Math.round(a * 100); i < Math.min(db.length, Math.round(b * 100)); i++) { m++; if (db[i] > thr) n++; } return m ? n / m : 0; };
const off = sentences.filter((s) => voiced(s.from, s.to) < 0.5);
const seams = spans.slice(1).map((s) => s.out / FPS / C.speed).filter((t) => { const i = Math.round(t * 100); return i > 2 && i < db.length - 2 && Math.min(db[i - 2], db[i - 1], db[i], db[i + 1], db[i + 2]) > thr + 6; });
const probe = JSON.parse(run('ffprobe', ['-v', 'error', '-show_streams', '-of', 'json', dest]).stdout || '{}');
const nAudio = (probe.streams || []).filter((s) => s.codec_type === 'audio').length;
const lufs = (run('ffmpeg', ['-hide_banner', '-i', dest, '-af', 'ebur128', '-f', 'null', '-']).stderr.match(/I:\s+(-?[\d.]+) LUFS/g) || []).pop();
rmSync(tmp, {recursive: true, force: true});

// 记一笔这次是按什么设置剪的，npm run next 用它判断口播是不是最新的
const stateFile = path.join(root, '.progress.json');
const state = existsSync(stateFile) ? JSON.parse(readFileSync(stateFile, 'utf8')) : {ok: {}};
state.cut = {key: JSON.stringify([C.pause, C.speed, C.loudness]), at: new Date().toISOString()};
writeFileSync(stateFile, JSON.stringify(state, null, 2));

console.log(`\n剪好了：public/${CONFIG.talk}`);
report();
console.log(`\n验收：音轨 ${nAudio} 条；响度 ${lufs ? lufs.replace(/I:\s+/, '') : '没量出来'}（目标 ${C.loudness}）；${sentences.length} 句里 ${sentences.length - off.length} 句落在有声音的位置；${spans.length - 1} 个接缝里 ${spans.length - 1 - seams.length} 个落在安静处。`);
if (off.length) console.log(`！ 这几句的位置上声音很弱，时间可能没对上，听一下：${off.slice(0, 6).map((s) => `第 ${s.from} 秒「${s.text.slice(0, 8)}」`).join('，')}`);
if (seams.length) console.log(`！ 这几个接缝处声音没有断开，可能切到了字，听一下：成片第 ${seams.slice(0, 8).map((t) => r2(t)).join('、')} 秒`);
console.log('句子时间轴已写进 src/sentences.js；每一段对应原片哪里见 out/剪辑表.md。');
console.log('\n下一步：npm run next。');

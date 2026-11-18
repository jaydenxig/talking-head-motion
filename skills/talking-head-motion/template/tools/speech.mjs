// 听口播的公共部分：量出哪些时间段在说话、识别每段说了什么、断成句子。
// tools/make-timeline.mjs（成片口播 → 句子时间轴）和 tools/raw.mjs（原始素材 → 逐句清单）都用它。
//
// 时间怎么来的：识别工具给的时间不够准（开头有静音会整体漂，整段识别还会漏字）。
// 所以先按音量量出「哪些时间段真的在说话」，按停顿切成一小段一小段分别识别，再把字铺进各自的时间段——
// 每个停顿的位置是量出来的，句子的起止和「说到哪个词」都能对上。
import {execFileSync, spawnSync} from 'node:child_process';
import {existsSync, readFileSync, readdirSync, writeFileSync} from 'node:fs';
import os from 'node:os';
import path from 'node:path';

export const SR = 16000;
const HOP = 160;  // 10 毫秒一格
export const r2 = (v) => Math.round(v * 100) / 100;
export const run = (cmd, args) => spawnSync(cmd, args, {encoding: 'utf8', maxBuffer: 1 << 28});

export const STRONG = /[。！？!?；;]/, WEAK = /[，,、：:]/, ANYP = /[\s。！？!?；;，,、：:"“”'‘’「」『』《》…—~～]/;
// 没人说话时识别工具会编出这些字（键盘声、底噪会触发），直接丢掉
export const JUNK = /涉及词汇|以下是普通话|字幕[:：]|字幕志愿者|请不吝点赞|明镜需要您的支持|订阅.*频道|谢谢观看|by索兰娅|^\(.*\)$|^（.*）$|^\[.*\]$|^【.*】$/;

export const hasFfmpeg = () => run('ffprobe', ['-version']).status === 0 && run('ffmpeg', ['-version']).status === 0;
export const durationOf = (file) => Number(run('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', file]).stdout.trim()) || 0;

// 把任何音视频解成 16k 单声道的采样
export const loadPcm = (file, tmp, name = 'a') => {
  const wav = path.join(tmp, `${name}.wav`);
  // aresample=async：按时间戳解码。手机里剪过的视频，声音在剪切处的时间戳会有小缺口，不按时间戳解码的话剪切点之后会错开几十毫秒
  execFileSync('ffmpeg', ['-v', 'error', '-y', '-i', file, '-vn', '-af', 'aresample=async=1:min_hard_comp=0.01:first_pts=0', '-ar', String(SR), '-ac', '1', '-c:a', 'pcm_s16le', wav]);
  const raw = readFileSync(wav);
  const at = raw.indexOf('data') + 8;
  return new Int16Array(raw.buffer, raw.byteOffset + at, Math.floor((raw.length - at) / 2));
};

// 每 10 毫秒的音量（分贝）
export const envelope = (pcm) => {
  const nf = Math.max(0, Math.floor(pcm.length / HOP) - 1);
  const db = new Float32Array(nf);
  for (let i = 0; i < nf; i++) {
    let e = 0;
    for (let k = i * HOP; k < i * HOP + 2 * HOP; k++) { const v = pcm[k] / 32768; e += v * v; }
    db[i] = 10 * Math.log10(e / (2 * HOP) + 1e-10);
  }
  return db;
};

// 哪些时间段在说话。门槛默认自动取「底噪」和「说话声」之间偏下的位置，录音环境吵一点也能分开
export const vad = (db, noise) => {
  const nf = db.length;
  const sorted = Float32Array.from(db).sort();
  const floor = sorted[Math.floor(nf * 0.1)], top = sorted[Math.floor(nf * 0.95)];
  const thr = noise !== undefined && noise !== null ? Number(noise) : Math.min(top - 12, Math.max(floor + 8, floor + 0.3 * (top - floor)));
  const blocks = [];
  for (let i = 0; i < nf;) {
    if (db[i] <= thr) { i++; continue; }
    let j = i, quiet = 0, last = i;
    while (j < nf && quiet < 12) { if (db[j] > thr) { last = j; quiet = 0; } else quiet++; j++; }
    const a = Math.max(0, i - 2) / 100, b = Math.min(nf, last + 4) / 100;
    if (b - a >= 0.08) blocks.push([a, b]);
    i = j;
  }
  return {blocks, thr};
};

// t 附近最安静的那一刻（要在没有停顿的地方下刀时，尽量落在两个字之间）
export const valleyNear = (db, t, span = 0.25) => {
  const c = Math.round(t * 100);
  let best = c, low = Infinity;
  for (let i = Math.max(1, c - Math.round(span * 100)); i <= Math.min(db.length - 2, c + Math.round(span * 100)); i++) {
    const v = (db[i - 1] + db[i] + db[i + 1]) / 3 + Math.abs(i - c) * 0.02;  // 一样安静时取离得近的
    if (v < low) { low = v; best = i; }
  }
  return {t: best / 100, db: low};
};

export const findWhisper = () => {
  const bin = ['whisper-cli', 'whisper-cpp', 'whisper'].find((b) => run('which', [b]).status === 0);
  const dir = path.join(os.homedir(), '.whisper-models');
  const models = existsSync(dir) ? readdirSync(dir).filter((f) => f.endsWith('.bin')) : [];
  const model = process.env.WHISPER_MODEL || ['large-v3-turbo', 'large-v3', 'large', 'medium', 'small', 'base'].map((n) => models.find((f) => f.includes(n))).filter(Boolean).map((f) => path.join(dir, f))[0];
  return bin && model && existsSync(model) ? {bin, model} : null;
};
export const WHISPER_HELP = [
  '这台电脑上没找到语音识别工具（whisper.cpp）或它的模型。',
  '装 whisper.cpp（macOS：brew install whisper-cpp），再把模型（如 ggml-large-v3-turbo.bin）放到 ~/.whisper-models/，',
  '或者用环境变量 WHISPER_MODEL 指到模型文件。',
].join('\n');

const wavOf = (pcm, a, b) => {
  const i0 = Math.max(0, Math.floor(a * SR)), i1 = Math.min(pcm.length, Math.ceil(b * SR));
  const padN = Math.round(0.35 * SR), n = Math.max(i1 - i0 + padN * 2, Math.round(1.3 * SR));
  const buf = Buffer.alloc(44 + n * 2);
  buf.write('RIFF', 0); buf.writeUInt32LE(36 + n * 2, 4); buf.write('WAVEfmt ', 8); buf.writeUInt32LE(16, 16); buf.writeUInt16LE(1, 20); buf.writeUInt16LE(1, 22);
  buf.writeUInt32LE(SR, 24); buf.writeUInt32LE(SR * 2, 28); buf.writeUInt16LE(2, 32); buf.writeUInt16LE(16, 34); buf.write('data', 36); buf.writeUInt32LE(n * 2, 40);
  for (let k = i0; k < i1; k++) buf.writeInt16LE(pcm[k], 44 + (padN + k - i0) * 2);
  return buf;
};

// 按停顿切块、逐块识别。返回 [{text, parts: [{a, b}]}]：一段话 + 它落在哪几个说话时间段里
export const recognize = (pcm, blocks, {tmp, whisper, lang = 'zh', vocab = '', name = 'c'}) => {
  const duration = pcm.length / SR;
  const chunks = [];
  for (const b of blocks) {
    const c = chunks[chunks.length - 1];
    if (c && b[0] - c.end < 0.35 && b[1] - c.start < 14) { c.parts.push(b); c.end = b[1]; }
    else chunks.push({start: b[0], end: b[1], parts: [b]});
  }
  // 太短的（不到半秒）并到挨得近的那一段
  for (let i = 0; i < chunks.length; i++) {
    const c = chunks[i];
    if (c.end - c.start >= 0.5 || chunks.length === 1) continue;
    const p = chunks[i - 1], n = chunks[i + 1];
    const gp = p ? c.start - p.end : Infinity, gn = n ? n.start - c.end : Infinity;
    if (Math.min(gp, gn) > 0.8) continue;
    if (gp <= gn) { p.parts.push(...c.parts); p.end = c.end; } else { n.parts.unshift(...c.parts); n.start = c.start; }
    chunks.splice(i--, 1);
  }
  // 每段切成一个小 wav，前后垫一点静音（太短的声音识别工具会直接跳过）
  const files = chunks.map((c, i) => {
    const prev = chunks[i - 1], next = chunks[i + 1];
    const a = Math.max(c.start - 0.12, prev ? (prev.end + c.start) / 2 : 0), b = Math.min(c.end + 0.2, next ? (c.end + next.start) / 2 : duration);
    const f = path.join(tmp, `${name}${String(i).padStart(4, '0')}.wav`);
    writeFileSync(f, wavOf(pcm, a, b));
    return f;
  });
  const prompt = (lang === 'zh' ? '以下是普通话口播。' : '') + (vocab ? `涉及词汇：${vocab.replace(/,/g, '、')}。` : '');
  // 一次把一批小段交给识别工具，模型只加载一遍
  for (let i = 0; i < files.length; i += 200) {
    const w = run(whisper.bin, ['-m', whisper.model, '-l', lang, '-np', '-oj', ...(prompt ? ['--prompt', prompt] : []), ...files.slice(i, i + 200)]);
    if (w.status !== 0 && !existsSync(files[i] + '.json')) throw new Error(`识别失败：\n${(w.stderr || '').split('\n').slice(-6).join('\n')}`);
  }
  const segs = [];
  chunks.forEach((c, i) => {
    if (!existsSync(files[i] + '.json')) return;
    const json = JSON.parse(readFileSync(files[i] + '.json', 'utf8'));
    const text = (json.transcription || []).map((x) => (x.text || '').trim()).filter((t) => t && !JUNK.test(t)).join('');
    // 很短的一段声音（咳嗽、杂音）有时会被识别成提示词本身的开头，丢掉
    const echo = text.length <= 14 && /^(涉及|以下是)/.test(text);
    if (text && !JUNK.test(text) && !echo) segs.push({text, parts: c.parts.map(([a, b]) => ({a, b}))});
  });
  return {segs, chunks: chunks.length};
};

// 已经有字幕文件（剪映或任何工具导出的 .srt）：用它的文字，时间还是按量出来的说话时间段对
export const segsFromSrt = (file, blocks) => {
  const parseTime = (t) => { const m = t.trim().match(/(\d+):(\d+):(\d+)[,.](\d+)/); return m[1] * 3600 + m[2] * 60 + Number(m[3]) + Number(m[4]) / 1000; };
  const segs = [];
  for (const block of readFileSync(file, 'utf8').replace(/\r/g, '').split(/\n\s*\n/)) {
    const lines = block.split('\n').filter((l) => l.trim());
    const k = lines.findIndex((l) => l.includes('-->'));
    if (k < 0) continue;
    const [a, b] = lines[k].split('-->');
    const text = lines.slice(k + 1).join('').replace(/<[^>]+>/g, '').trim();
    if (!text || JUNK.test(text)) continue;
    const from = parseTime(a), to = parseTime(b);
    let parts = blocks.map(([x, y]) => ({a: Math.max(x, from - 0.15), b: Math.min(y, to + 0.15), full: y - x})).filter((x) => x.b - x.a > 0.02);
    // 只蹭到一点边的时间段多半属于前后句
    const kept = parts.filter((x) => x.b - x.a >= 0.2 || (x.b - x.a) / x.full >= 0.35);
    parts = kept.length ? kept : [{a: from, b: to}];
    segs.push({text, parts});
  }
  return segs;
};

// 把每段的字铺进它的说话时间段：一个字念多久按相对值算（汉字 1，数字 1，英文字母 0.4，标点 0）
const unit = (ch) => (ANYP.test(ch) ? 0 : /[0-9]/.test(ch) ? 1 : ch.charCodeAt(0) < 256 ? 0.4 : 1);
const spread = (segs) => {
  const chars = [];
  segs.forEach((s, si) => {
    const speech = s.parts.reduce((n, x) => n + x.b - x.a, 0);
    const list = [...s.text];
    const total = list.reduce((n, ch) => n + unit(ch), 0) || 1;
    const at = (u) => {
      let t = (u / total) * speech;
      for (const x of s.parts) { if (t <= x.b - x.a + 1e-9) return x.a + t; t -= x.b - x.a; }
      return s.parts[s.parts.length - 1].b;
    };
    let u = 0;
    for (const ch of list) { const a = at(u); u += unit(ch); chars.push({ch, a, b: at(u), seg: si}); }
  });
  for (let i = 1; i < chars.length; i++) { chars[i].a = Math.max(chars[i].a, chars[i - 1].a); chars[i].b = Math.max(chars[i].b, chars[i].a); }
  return chars;
};

// 断句：每句一行字幕放得下。返回 [{from, to, text, words: [[词, 起, 止]]}]
export const toSentences = (segs, {max = 18, lang = 'zh', duration = Infinity} = {}) => {
  const chars = spread(segs);
  const width = (list) => list.reduce((n, c) => n + (ANYP.test(c.ch) ? 0 : c.ch.charCodeAt(0) < 256 ? 0.55 : 1), 0);
  const seg = new Intl.Segmenter(lang, {granularity: 'word'});
  const idxMap = (list) => { const m = []; list.forEach((c, i) => { for (let k = 0; k < c.ch.length; k++) m.push(i); }); return m; };
  // 在一串字里找一个不劈开词的切点，尽量靠近 want
  const wordCut = (list, want) => {
    const m = idxMap(list);
    let best = -1;
    for (const w of seg.segment(list.map((c) => c.ch).join(''))) {
      const i = m[w.index];
      if (i > 0 && i < list.length && (best < 0 || Math.abs(i - want) < Math.abs(best - want))) best = i;
    }
    return best > 0 ? best : Math.round(want);
  };
  const split = (list) => {
    if (width(list) <= max) return [list];
    // 先在逗号处切：从左往右攒，放不下就切
    const clauses = [];
    let start = 0;
    list.forEach((c, i) => { if (WEAK.test(c.ch) || /\s/.test(c.ch)) { clauses.push(list.slice(start, i + 1)); start = i + 1; } });
    if (start < list.length) clauses.push(list.slice(start));
    if (clauses.length > 1) {
      const out = [];
      let acc = [];
      for (const cl of clauses) {
        if (acc.length && width(acc) + width(cl) > max) { out.push(acc); acc = []; }
        acc = acc.concat(cl);
      }
      if (acc.length) out.push(acc);
      if (out.length > 1) return out.flatMap(split);
    }
    // 没有逗号：在中间最大的停顿处切；没有停顿就在中间找个不劈开词的地方
    let cut = -1, gap = 0.15;
    const lo = Math.ceil(list.length * 0.25), hi = Math.floor(list.length * 0.75);
    for (let i = lo; i <= hi; i++) { const g = list[i].a - list[i - 1].b; if (g > gap) { gap = g; cut = i; } }
    if (cut < 0) cut = wordCut(list, list.length / 2);
    if (cut <= 0 || cut >= list.length) return [list];
    return [...split(list.slice(0, cut)), ...split(list.slice(cut))];
  };
  let pieces = [];
  let buf = [];
  chars.forEach((c, i) => {
    buf.push(c);
    const next = chars[i + 1];
    if (STRONG.test(c.ch) || !next || next.seg !== c.seg) { pieces.push(buf); buf = []; }
  });
  pieces = pieces.filter((p) => width(p) > 0).flatMap(split).filter((p) => width(p) > 0);
  // 太短的碎片（「对吧」「然后」）并到前一句
  const merged = [];
  const spoken = (l) => l.filter((c) => !ANYP.test(c.ch));
  for (const p of pieces) {
    const prev = merged[merged.length - 1];
    if (prev && (width(p) < 3 || width(prev) < 3) && width(prev) + width(p) <= max && spoken(p)[0].a - spoken(prev).at(-1).b < 0.3 && !STRONG.test(prev.at(-1).ch)) merged[merged.length - 1] = prev.concat(p);
    else merged.push(p);
  }
  // 断句不把一个词劈成两半（「薪｜资翻倍」），也不让下一句以「的、了」开头：把被劈开的那几个字挪到同一边
  const PARTICLE = /^[的了吗呢吧啊嘛]/;
  for (let i = 1; i < merged.length; i++) {
    const a = merged[i - 1], b = merged[i];
    if (spoken(b)[0].a - spoken(a).at(-1).b > 0.8 || ANYP.test(a.at(-1).ch)) continue;
    let move = 0;  // 正数：b 开头的几个字挪给 a；负数：a 结尾的几个字挪给 b
    if (PARTICLE.test(b[0].ch)) move = 1;
    else {
      const m = idxMap([...a, ...b]);
      for (const w of seg.segment([...a, ...b].map((c) => c.ch).join(''))) {
        if (!w.isWordLike) continue;
        const s0 = m[w.index], s1 = m[w.index + w.segment.length - 1];
        if (s0 < a.length && s1 >= a.length) { const head = a.length - s0, tail = s1 - a.length + 1; move = tail <= head ? tail : -head; break; }
      }
    }
    if (move > 0 && b.length > move) a.push(...b.splice(0, move));
    else if (move < 0 && a.length > -move) b.unshift(...a.splice(a.length + move));
  }
  const out = [];
  for (const list of merged) {
    const sp = spoken(list);
    // 字幕不带句尾的逗号句号，问号叹号留着
    const text = list.map((c) => c.ch).join('').trim().replace(/[，,、：:。；;\s]+$/, '').replace(/^[，,、：:。；;\s]+/, '');
    let from = r2(sp[0].a);
    const to = r2(Math.min(Math.max(sp.at(-1).b, sp[0].a + 0.3), duration));
    const prev = out[out.length - 1];
    if (prev && from < prev.to) { const mid = r2((from + prev.to) / 2); prev.to = Math.min(prev.to, mid); from = Math.max(from, mid); }
    const m = idxMap(list);
    const words = [...seg.segment(list.map((c) => c.ch).join(''))].filter((w) => w.isWordLike).map((w) => [w.segment, r2(list[m[w.index]].a), r2(list[m[w.index + w.segment.length - 1]].b)]);
    // 这句话前面有没有停顿：没有的话，它和上一句是连着说的，中间下刀要小心
    out.push({from, to, text, words, joined: !!prev && sp[0].a - prev._end < 0.12, _end: sp.at(-1).b});
  }
  out.forEach((s) => { delete s._end; });
  return out;
};

// 语速（剪掉停顿后每秒几个字）和要不要加速的建议
export const countChars = (text) => [...text].filter((ch) => !ANYP.test(ch) && ch.charCodeAt(0) >= 256).length + (text.match(/[A-Za-z]+|\d+/g) || []).length;
export const speedAdvice = (rate) => {
  if (rate >= 6.2) return {speed: 1, say: `语速约 ${rate.toFixed(1)} 字/秒，已经和节奏紧凑的口播博主差不多（6.3–6.6），建议不加速`};
  if (rate >= 5.6) return {speed: 1, say: `语速约 ${rate.toFixed(1)} 字/秒，可加可不加：加到 1.1 倍是 ${(rate * 1.1).toFixed(1)} 字/秒，更紧凑；不加也自然`};
  const sp = Math.min(1.2, Math.round((6.3 / rate) * 20) / 20);
  return {speed: sp, say: `语速约 ${rate.toFixed(1)} 字/秒，偏慢（节奏紧凑的口播约 6.3–6.6）。建议加速到 ${sp} 倍左右（加速后约 ${(rate * sp).toFixed(1)} 字/秒，音调不变）`};
};

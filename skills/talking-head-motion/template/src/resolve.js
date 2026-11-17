// 解析器：把「按句子编号写的分镜表」换算成渲染用的秒数和节拍。
// 所有时间都在这里算，写分镜的人（或模型）不用碰秒数。渲染（Talk.jsx）和各个工具（tools/*.mjs）共用这一份，结果永远一致。
// 这个文件不读硬盘，只做计算；需要读文件才知道的东西（脸在哪、图多大、字在图上哪里）由 tools/measure.mjs 量好写进 measured.js。
import {AVATARS} from './styles.js';

// ---------- 文字 ----------
// 去掉关键词方括号和括号里的注释（「take over（接管）」里的「接管」没有说出口）
export const clean = (t = '') => String(t).replace(/[[\]]/g, '').replace(/（[^）]*）|\([^)]*\)/g, '');
const PUNCT = /[\s，。、！？；：,.!?;:"“”'‘’「」『』《》<>…—\-·~～]/g;
export const norm = (t = '') => clean(t).replace(PUNCT, '').toLowerCase();
// 一段字有多宽：汉字算 1，英文数字算 0.55
export const textWidth = (t = '') => [...clean(t)].reduce((n, ch) => n + (ch.charCodeAt(0) < 256 ? 0.55 : 1), 0);
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const r2 = (v) => Math.round(v * 100) / 100;

const numOf = (id) => { const m = String(id).trim().match(/^s?0*(\d+)$/i); return m ? Number(m[1]) : NaN; };

// say: 'S03' | 'S03-S05' | ['S03', 'S04'] | 3 → 句子下标数组
const parseSay = (say, byNum) => {
  const parts = Array.isArray(say) ? say : [say];
  const out = [];
  for (const p of parts) {
    const m = String(p).trim().match(/^(s?\d+)(?:\s*(?:-|–|—|~|到)\s*(s?\d+))?$/i);
    if (!m) return {error: `say 写的「${p}」认不出来。写法：'S03'、'S03-S05' 或 ['S03', 'S04']`};
    const a = numOf(m[1]), b = m[2] ? numOf(m[2]) : a;
    if (b < a) return {error: `say 写的「${p}」前后反了`};
    for (let n = a; n <= b; n++) {
      if (!byNum.has(n)) return {error: `没有 S${String(n).padStart(2, '0')} 这句话（sentences.js 里一共 ${byNum.size} 句）`};
      out.push(byNum.get(n));
    }
  }
  return {idx: out};
};

// ---------- 一句话里「第几个字」对应第几秒 ----------
// 有逐词时间（WORDS）就按词走，没有就按字数平均。
const curveOf = (s, words) => {
  const w = (words && words[s.id] || []).map((x) => ({len: norm(x[0]).length, a: x[1], b: x[2]})).filter((x) => x.len > 0);
  const total = w.reduce((n, x) => n + x.len, 0);
  if (!total) return (f) => s.from + clamp(f, 0, 1) * (s.to - s.from);
  return (f) => {
    let pos = clamp(f, 0, 1) * total;
    for (const x of w) {
      if (pos <= x.len) return x.a + (pos / x.len) * (x.b - x.a);
      pos -= x.len;
    }
    return w[w.length - 1].b;
  };
};

// 两段字最长的相同片段
const lcs = (a, b) => {
  let best = {len: 0, at: -1};
  for (let i = 0; i < a.length; i++) {
    for (let j = 0; j < b.length; j++) {
      let k = 0;
      while (i + k < a.length && j + k < b.length && a[i + k] === b[j + k]) k++;
      if (k > best.len) best = {len: k, at: j};
    }
  }
  return best;
};

// 在这一镜说的话里找某个词，返回它被说出来的时刻
const makeFinder = (sents, words) => {
  const rows = sents.map((s) => ({s, n: norm(s.text), curve: curveOf(s, words)}));
  const timeAt = (row, i) => row.curve(row.n.length ? i / row.n.length : 0);
  return {
    said: sents.map((s) => clean(s.text)).join(' '),
    // 精确找：needle 可以写成 '词#2' 表示第 2 次出现
    exact(needle, after = -Infinity) {
      const m = String(needle).match(/^(.*?)(?:#(\d+))?$/);
      const key = norm(m[1]);
      let nth = m[2] ? Number(m[2]) : 1;
      if (!key) return null;
      for (const row of rows) {
        let i = row.n.indexOf(key);
        while (i >= 0) {
          const t = timeAt(row, i);
          if (t > after && --nth === 0) return {t, id: row.s.id, hit: key};
          i = row.n.indexOf(key, i + 1);
        }
      }
      return null;
    },
    // 模糊找：条目和说的话不一定一字不差，找最长的相同片段（至少 2 个字，且不少于条目长度的四成）
    fuzzy(text, after = -Infinity) {
      const key = norm(text);
      const need = Math.max(2, Math.ceil(key.length * 0.4));
      let best = null;
      for (const row of rows) {
        const m = lcs(key, row.n);
        if (m.len < need) continue;
        const t = timeAt(row, m.at);
        if (t <= after) continue;
        if (!best || m.len > best.len) best = {t, id: row.s.id, hit: row.n.slice(m.at, m.at + m.len), len: m.len};
      }
      return best;
    },
  };
};

const CN = '一二三四五六七八九十';

// 几个依次出现的东西（清单条目、要框的重点）各在什么时候出现。
// 顺序：自己写的 at → 在说的话里找到原词 → 「第一 / 第二」这类序数 → 剩下的在前后之间平均排。
const timeSeries = (entries, shot, finder, fps, issues, where, what) => {
  const n = entries.length;
  const ts = new Array(n).fill(null);
  const how = new Array(n).fill('');
  let prev = -Infinity;
  entries.forEach((e, k) => {
    if (e.at !== undefined && e.at !== null) {
      if (typeof e.at === 'number') { ts[k] = shot.from + e.at; how[k] = `第 ${e.at} 秒`; }
      else {
        const f = finder.exact(e.at);
        if (f) { ts[k] = f.t; how[k] = `说到「${f.hit}」`; }
        else issues.push({level: 'error', where, msg: `${what}第 ${k + 1} 个写了 at: '${e.at}'，但这一镜说的话里没有这个词。这一镜说的是：「${finder.said}」`});
      }
    } else if (e.text) {
      const f = finder.exact(e.text, prev) || finder.fuzzy(e.text, prev)
        || (CN[k] && finder.exact(`第${CN[k]}`, prev)) || (k === 0 && finder.exact('首先', prev)) || (k === 1 && finder.exact('其次', prev)) || (k === n - 1 && n > 1 && finder.exact('最后', prev));
      if (f) { ts[k] = f.t; how[k] = `说到「${f.hit}」`; }
    }
    if (ts[k] !== null) prev = ts[k];
  });
  // 没对上的：夹在前后对上的之间平均排；一个都没对上，就在这一镜说话的时间里平均排
  const known = ts.map((t) => t !== null);
  // 一个都没对上（比如「这期讲三件事」，条目本身没念出来）：开头就一条条亮出来，别拖到句尾，留时间给人看
  const a0 = shot.speechFrom + 0.3;
  const b0 = a0 + Math.min((n - 1) * 0.6, Math.max((n - 1) * 0.33, (shot.speechTo - a0) * 0.55));
  for (let k = 0; k < n; k++) {
    if (known[k]) continue;
    let i = k - 1, j = k + 1;
    while (i >= 0 && !known[i]) i--;
    while (j < n && !known[j]) j++;
    if (i < 0 && j >= n) ts[k] = n === 1 ? a0 : a0 + (b0 - a0) * k / (n - 1);
    else if (i < 0) ts[k] = Math.max(shot.from + 0.45, ts[j] - (j - k) * Math.min(0.6, Math.max(0.33, (ts[j] - a0) / j)));
    else if (j >= n) {
      // 后面几条没对上：跟在最后一条对上的后面，半秒一条；地方不够就挤一挤，最后一条至少留 0.9 秒给人看
      const step = Math.max(0.33, Math.min(0.5, (shot.speechTo - 0.9 - ts[i]) / (n - 1 - i)));
      ts[k] = ts[i] + step * (k - i);
    } else ts[k] = ts[i] + (ts[j] - ts[i]) * (k - i) / (j - i);
    how[k] = known.some(Boolean) ? '没对到词，夹在前后之间' : '没对到词，开头依次出';
  }
  // 换成帧：不早于卡片出场，后一个不早于前一个，最后一个出现后至少还能看到半秒
  const frames = [];
  ts.forEach((t, k) => {
    const fr = Math.round((t - shot.from) * fps);
    frames.push(Math.max(fr, k === 0 ? 14 : frames[k - 1] + 5));
  });
  const limit = Math.round((shot.to - shot.from) * fps) - 15;
  for (let k = n - 1; k >= 0; k--) frames[k] = Math.max(14 + k * 5, Math.min(frames[k], limit - (n - 1 - k) * 5));
  return {frames, how};
};

// ---------- 版式：脸在哪 → 小头像取哪块、横竖互转保留哪块、抠像时图卡摆哪边 ----------
export const sizeOf = (orientation) => (orientation === 'portrait' ? {width: 1080, height: 1920} : {width: 1920, height: 1080});

// 把原片铺满一个框（cover）时，原片缩放多少、露出哪一块；focus 是想让脸落在框里的位置（0..1）
const cover = (src, box, face, target) => {
  const k = Math.max(box.w / src.width, box.h / src.height);
  const iw = src.width * k, ih = src.height * k;
  const pos = (len, boxLen, center, want) => (len - boxLen < 1 ? 0.5 : clamp((center * len - want * boxLen) / (len - boxLen), 0, 1));
  const px = pos(iw, box.w, face ? face.x : 0.5, target.x);
  const py = pos(ih, box.h, face ? face.y : 0.5, target.y);
  // 原片坐标（0..1）→ 框内像素
  const map = (x, y) => ({x: x * iw - px * (iw - box.w), y: y * ih - py * (ih - box.h)});
  return {k, px, py, map, objectPosition: `${r2(px * 100)}% ${r2(py * 100)}%`};
};

export const resolveLayout = (config, measured = {}, look) => {
  const issues = [];
  const talk = measured.talk || null;
  const face = measured.face && measured.face.found ? measured.face : null;
  const canvas = sizeOf(config.orientation);
  const portrait = canvas.height > canvas.width;
  const auto = (v) => v === undefined || v === null || v === 'auto';

  // 原片尺寸
  const cs = auto(config.source) ? {} : config.source;
  const source = {width: cs.width || (talk ? talk.width : 1920), height: cs.height || (talk ? talk.height : 1080)};
  if (auto(config.source) && !talk) issues.push({level: 'warn', where: '口播', msg: '还没量过口播（尺寸、脸的位置都按默认值算）。先跑 npm run measure'});
  const needFace = auto(config.source) || auto(cs.x) || auto(config.avatar && config.avatar.crop);
  if (talk && !face && needFace) issues.push({level: 'warn', where: '口播', msg: '口播里没找到人脸，头像和裁切按画面正中算。如果位置不对，在 config.js 里手填 source.x 和 avatar.crop'});
  const fx = !auto(cs.x) ? cs.x : face ? face.x : 0.5;
  const fpos = {x: fx, y: face ? face.y : 0.4};

  // 全屏口播：横竖互转时让脸落在画面横向正中、纵向约 40% 处
  const full = cover(source, {w: canvas.width, h: canvas.height}, fpos, {x: 0.5, y: portrait ? 0.38 : 0.42});
  if (full.k > 1.5) issues.push({level: 'warn', where: '口播', msg: `原片是 ${source.width}×${source.height}，铺满 ${canvas.width}×${canvas.height} 要放大 ${r2(full.k)} 倍，画面会发虚。原片是${source.height > source.width ? '竖' : '横'}着拍的，建议成片也做${source.height > source.width ? '竖屏' : '横屏'}（config.js 的 orientation）`});
  if (face) {
    // 脸在整段里移动的范围，都要留在画面里
    const lo = full.map(face.minX - face.w / 2, face.minY - face.h * 0.75), hi = full.map(face.maxX + face.w / 2, face.maxY + face.h / 2);
    if (lo.x < 0 || hi.x > canvas.width || lo.y < 0 || hi.y > canvas.height) {
      issues.push({level: 'warn', where: '口播', msg: `人在画面里走动的范围比较大，铺满${portrait ? '竖屏' : '横屏'}后有时候脸会被裁到边上（脸的横向位置在 ${r2(face.minX)}–${r2(face.maxX)} 之间）。拍的时候站在正中，或者换个画面方向`});
    }
  }

  // 小头像：框里头只占一半、露出肩膀
  const A = look ? look.avatar : AVATARS.circle;
  const cc = config.avatar && config.avatar.crop;
  let crop;
  if (auto(cc)) crop = face ? {scale: clamp(face.h * 2.7, 0.18, 1), x: face.x, y: clamp(face.y + face.h * 0.3, 0, 1)} : {scale: 0.42, x: 0.5, y: 0.36};
  else crop = cc;
  if (face) {
    const halfW = crop.scale * (A.w / A.h) * (source.height / source.width) / 2;
    const off = Math.max(crop.x - face.minX, face.maxX - crop.x) + face.w / 2;
    if (off > halfW * 1.05) issues.push({level: 'warn', where: '小头像', msg: `人在口播里左右移动比较多，有时候脸会碰到小头像的边。可以把 config.js 的 avatar.crop 改成 {scale: ${r2(clamp(crop.scale * off / halfW, 0, 1))}, x: ${r2(crop.x)}, y: ${r2(crop.y)}}（框大一点）`});
  }

  // 上图下人：下半屏里让脸落在这一条的中间偏上
  const band = portrait ? cover(source, {w: canvas.width, h: canvas.height - 1000}, fpos, {x: 0.5, y: 0.42}) : null;

  // 抠像时图卡摆在哪：人偏左就摆右边，人偏右就摆左边；人在正中，横屏放不下
  let cutout = null;
  if (face) {
    const c = full.map(face.x, face.y);
    const faceW = face.w * source.width * full.k, faceH = face.h * source.height * full.k;
    if (portrait) {
      const top = Math.round(c.y + faceH * 0.8 + 40);
      cutout = {left: 40, width: canvas.width - 80, top, height: Math.max(0, canvas.height - 420 - top), scale: 0.8};
      if (cutout.height < 380) cutout = {center: true, reason: '脸下面的地方不够放图卡'};
    } else {
      const body = faceW * 1.9;  // 肩膀大约是脸宽的三四倍，取一半再留点余量
      const leftFree = c.x - body - 60, rightFree = canvas.width - (c.x + body) - 60;
      if (Math.max(leftFree, rightFree) < 620) cutout = {center: true, reason: `人站在画面中间（横向 ${r2(face.x)}），两边都放不下图卡`};
      else if (rightFree >= leftFree) cutout = {side: 'right', left: Math.round(c.x + body), width: Math.round(rightFree), top: 0, height: canvas.height};
      else cutout = {side: 'left', left: 60, width: Math.round(leftFree), top: 0, height: canvas.height};
      if (!cutout.center) cutout.scale = clamp(cutout.width / 1120, 0.55, 1);
    }
  }
  // 竖屏「人全屏 + 浮卡」：图卡浮在胸前（从 820 像素往下），人拍得太近的话会盖住下半张脸
  if (face && portrait && config.portraitLayout === 'float') {
    const chin = full.map(face.x, face.y).y + face.h * source.height * full.k * 0.55;
    if (chin > 840) issues.push({level: 'warn', where: '版式', msg: `竖屏用的是 float（人全屏 + 浮卡），但这条口播人拍得比较近，图卡会盖住下半张脸（下巴在第 ${Math.round(chin)} 像素，图卡从第 820 像素开始）。把 config.js 的 portraitLayout 换成 'split'（上图下人）或 'pip'（小头像）`});
  }
  return {canvas, portrait, source, face, crop, full, band, cutout, issues};
};

// ---------- 主函数 ----------
// 输入：config、shots（分镜表）、sentences / words / duration（句子时间轴）、measured（量出来的数据）
// 输出：shots（带秒数和节拍）、subs（字幕）、duration、stats（露脸占比）、issues（错误和提醒）
export const resolveProject = ({config, shots = [], sentences = [], words = {}, duration = 0, measured = {}}) => {
  const fps = config.fps || 30;
  const issues = [];
  const err = (where, msg) => issues.push({level: 'error', where, msg});
  const warn = (where, msg) => issues.push({level: 'warn', where, msg});
  const byNum = new Map(sentences.map((s, i) => [numOf(s.id), i]));
  const total = duration || (sentences.length ? sentences[sentences.length - 1].to : 0);
  const files = measured.files || {};
  const boxes = measured.boxes || {};

  // 1. 每一镜对应哪几句、从第几秒到第几秒
  const legacy = shots.length > 0 && shots.every((s) => s && s.say === undefined && typeof s.from === 'number' && typeof s.to === 'number');
  const rows = [];
  if (legacy) {
    shots.forEach((s, i) => rows.push({raw: s, i, from: s.from, to: s.to, sents: sentences.filter((x) => (x.from + x.to) / 2 >= s.from && (x.from + x.to) / 2 < s.to)}));
  } else {
    let next = 0;  // 下一句该轮到谁
    shots.forEach((s, i) => {
      const where = `第 ${i + 1} 镜`;
      if (!s || typeof s !== 'object') return err(where, '这一镜不是一个 {…}');
      if (s.say === undefined) return err(where, typeof s.from === 'number' ? '这一镜写的是秒数（from / to），别的镜写的是句子编号（say）。不要混用，统一写 say' : '缺 say：这一镜对应哪几句话，如 say: \'S03\' 或 say: \'S03-S05\'');
      const p = parseSay(s.say, byNum);
      if (p.error) return err(where, p.error);
      const id = (k) => sentences[k].id;
      for (let k = 1; k < p.idx.length; k++) if (p.idx[k] !== p.idx[k - 1] + 1) return err(where, `say 里的句子要连着：${id(p.idx[k - 1])} 后面跳到了 ${id(p.idx[k])}`);
      if (p.idx[0] < next) return err(where, `${id(p.idx[0])} 已经分给前面的镜头了。一句话只能属于一镜，镜头按说话顺序往下排`);
      if (p.idx[0] > next) err(where, `${id(next)}${p.idx[0] - next > 1 ? ` 到 ${id(p.idx[0] - 1)}` : ''} 没有分给任何一镜。每句话都要归到一镜；只是人在说话、不配画面，就写一镜 state: 'full'`);
      next = p.idx[p.idx.length - 1] + 1;
      rows.push({raw: s, i, sents: p.idx.map((k) => sentences[k])});
    });
    if (sentences.length && rows.length && next < sentences.length) err('分镜表', `${sentences[next].id} 到 ${sentences[sentences.length - 1].id} 还没有分给任何一镜（一共 ${sentences.length} 句，排到了第 ${next} 句）`);
    rows.forEach((r, k) => { r.from = k === 0 ? 0 : r.sents[0].from; });
    rows.forEach((r, k) => { r.to = k + 1 < rows.length ? rows[k + 1].from : Math.max(total, r.sents[r.sents.length - 1].to); });
  }

  // 录屏从第几秒放：自己写的 start；同一段录屏接着上一镜用、又没写 start，就从上一镜放到的地方接着放
  let prevScreen = null;
  rows.forEach((r) => {
    const c = r.raw && r.raw.card;
    if (!c || c.type !== 'screen') { prevScreen = null; return; }
    if (typeof c.start === 'number') r.start = c.start;
    else if (prevScreen && prevScreen.src === c.src) r.start = prevScreen.end;
    prevScreen = r.start === undefined ? null : {src: c.src, end: r2(r.start + (r.to - r.from) * (c.rate || 1))};
  });

  // 2. 每一镜的节拍
  const out = rows.map((r) => {
    const s = r.raw;
    const where = `第 ${r.i + 1} 镜`;
    const shot = {...s, index: r.i, from: r2(r.from), to: r2(r.to), ids: r.sents.map((x) => x.id), said: r.sents.map((x) => clean(x.text)).join(' '), notes: []};
    shot.speechFrom = r.sents.length ? Math.max(r.from, r.sents[0].from) : r.from;
    shot.speechTo = r.sents.length ? r.sents[r.sents.length - 1].to : r.to;
    const frames = Math.round((shot.to - shot.from) * fps);
    const finder = makeFinder(r.sents, words);
    const at = (anchor, what) => {
      if (typeof anchor === 'number') return Math.round(anchor * fps);
      const f = finder.exact(anchor);
      if (!f) { err(where, `${what}写了 '${anchor}'，但这一镜说的话里没有这个词。这一镜说的是：「${finder.said}」`); return null; }
      shot.notes.push(`${what}：说到「${f.hit}」`);
      return Math.round((f.t - shot.from) * fps);
    };
    const B = {appear: 6};
    let last = 12;
    if (s.card && typeof s.card === 'object') {
      const c = {...s.card};
      shot.card = c;
      B.appear = 6;
      last = B.appear + 12;
      if (c.type === 'screen') {
        if (r.start === undefined) err(where, '录屏要写 start：从录屏的第几秒开始放（同一段录屏接着上一镜往下放时可以不写）');
        else { c.start = r.start; c.end = r2(r.start + (shot.to - shot.from) * (c.rate || 1)); shot.notes.push(`录屏：放第 ${c.start}–${c.end} 秒`); }
      }
      // 依次出现的东西：清单的条目、对话的消息、流程的每一站、文档上划的重点
      const listKey = {chat: 'messages', flow: 'steps', doc: 'marks'}[c.type] || 'items';
      if (Array.isArray(c[listKey])) {
        const raw = c[listKey];
        const entries = raw.map((x) => (x && typeof x === 'object' ? {text: x.text ?? x.file, at: x.at} : {text: String(x)}));
        if (c.type === 'chat') c.messages = raw.map((x) => ({from: x && x.from === 'ai' ? 'ai' : 'me', text: (x && x.text) || '', file: (x && x.file) || ''}));
        else c[listKey] = entries.map((e) => e.text);
        if (c.type === 'flow') c.icons = raw.map((x) => (x && typeof x === 'object' && x.icon) || '');
        const what = {messages: '消息', steps: '这一站', marks: '重点', items: '条目'}[listKey];
        const ser = timeSeries(entries, shot, finder, fps, issues, where, what);
        B.items = ser.frames;
        shot.notes.push(`${what}出现：` + ser.how.map((h, k) => `${k + 1} ${h}`).join('；'));
        last = B.items[B.items.length - 1] + 12;
      }
      // 这三种卡的内容都是做出来的，默认标「示意」
      if (['chat', 'flow', 'doc'].includes(c.type) && c.mock === undefined) c.mock = true;
      if (c.type === 'doc' && c.stamp !== undefined) {
        const st = c.stamp && typeof c.stamp === 'object' ? c.stamp : {text: String(c.stamp)};
        c.stamp = st.text;
        const f = st.at !== undefined ? at(st.at, '盖章') : null;
        B.stamp = Math.max(f ?? 0, last);
        last = B.stamp + 14;
      }
      if (Array.isArray(c.lines)) {
        B.lines = c.lines.map((_, k) => 14 + k * 6);
        last = Math.max(last, B.lines[B.lines.length - 1] + 12);
        if (c.highlight !== undefined) {
          const h = c.highlightAt !== undefined ? at(c.highlightAt, '高亮') : null;
          B.highlight = Math.max(h ?? 0, 14 + c.lines.length * 6 + 8);
          last = Math.max(last, B.highlight + 12);
        }
      }
      // 要框的重点：位置来自 measured.js（npm run measure 找的）或自己写的 rect
      if (c.focus !== undefined) {
        const list = (Array.isArray(c.focus) ? c.focus : [c.focus]).filter((x) => x && typeof x === 'object');
        const file = c.img || c.src;
        const ser = timeSeries(list.map((x) => ({text: x.text, at: x.at})), shot, finder, fps, issues, where, '要框的重点');
        B.focus = ser.frames;
        c.focusBoxes = list.map((x, k) => {
          let rect = Array.isArray(x.rect) ? x.rect : null;
          const need = {file, text: x.text, nth: x.nth || 1};
          if (!rect && x.text) {
            // 录屏：要找的是「这个框出现时」录屏放到的那一帧
            if (c.type === 'screen') need.t = r2((c.start || 0) + (B.focus[k] / fps) * (c.rate || 1));
            const key = c.type === 'screen' ? `${file}@${need.t.toFixed(2)}|${x.text}|${need.nth}` : `${file}|${x.text}|${need.nth}`;
            need.key = key;
            rect = boxes[key] || null;
            if (!rect) err(where, `还不知道「${x.text}」在 ${file} 上的位置。跑 npm run measure 让它去找；找不到的话它会列出图上认出来的字`);
          }
          return {rect, rect2: (need.key && boxes[`${need.key}>`]) || null, label: x.label || '', need: rect && !x.text ? null : need};
        });
        shot.notes.push('框重点：' + ser.how.map((h, k) => `${k + 1} ${h}`).join('；'));
        last = Math.max(last, B.focus[B.focus.length - 1] + 14);
      }
      if (c.type === 'stat') {
        let f = c.at !== undefined ? at(c.at, '数字停住') : null;
        if (f === null && c.at === undefined) {
          const hit = finder.exact(String(c.value));
          if (hit) { f = Math.round((hit.t - shot.from) * fps) + 8; shot.notes.push(`数字停住：说到「${hit.hit}」`); }
        }
        B.statEnd = Math.max(f ?? 46, B.appear + 20);
        last = Math.max(last, B.statEnd);
      }
      if (c.pill !== undefined && c.type !== 'pill') {
        const p = c.pill && typeof c.pill === 'object' ? c.pill : {text: String(c.pill)};
        c.pill = p.text;
        const f = p.at !== undefined ? at(p.at, '结论') : null;
        B.pill = Math.max(f ?? 0, last);
        last = B.pill + 12;
      }
      // 要糊掉的地方（位置由 npm run measure 找）
      if (Array.isArray(c.mask) && c.img) {
        const masks = measured.masks || {};
        c.maskBoxes = [];
        c.mask.forEach((term) => {
          const hit = masks[`${c.img}|${term}`];
          if (!hit) err(where, `还没找过 ${c.img} 上要糊的「${term}」在哪。跑 npm run measure`);
          else c.maskBoxes.push(...hit);
        });
      }
      // 录屏 / 图片的原始尺寸，排版要用
      if (c.img && files[c.img]) c.media = files[c.img];
      if (c.src && files[c.src]) c.media = files[c.src];
    }
    shot.beats = B;
    shot.done = r2(shot.from + last / fps);
    shot.frames = frames;
    return shot;
  });

  // 同一段录屏连着用：中间不重新弹出来，直接接着放
  out.forEach((s, k) => {
    const p = out[k - 1];
    const same = (a, b) => a && b && a.card && b.card && a.card.type === 'screen' && b.card.type === 'screen' && a.card.src === b.card.src && a.state === b.state
      && JSON.stringify(a.card.crop || null) === JSON.stringify(b.card.crop || null);
    if (same(p, s)) {
      s.cont = true; p.contNext = true;
      // 接着放的这一镜没写标签，就沿用上一镜的，免得标签在中间突然消失
      if (s.card.label === undefined && p.card.label) s.card.label = p.card.label;
    }
  });

  // 3. 字幕 = 句子
  const subs = sentences.map((s) => ({from: s.from, to: s.to, text: s.text, id: s.id}));

  // 4. 露脸占比：整张脸 / 小窗 / 不见人，以及各自最长连续多久
  const layoutKind = config.orientation === 'portrait' ? (config.portraitLayout || 'split') : 'landscape';
  const M = config.modules || {};
  const faceOf = (s) => {
    if (s.state === 'full' || M.cards === false) return 'full';
    if (s.state === 'cutout') return 'full';
    if (layoutKind === 'float') return 'full';
    if (layoutKind === 'split') return 'small';
    return M.avatar === false ? 'hidden' : 'small';
  };
  const stats = {total: r2(total), full: 0, small: 0, hidden: 0, runs: []};
  out.forEach((s) => {
    const kind = faceOf(s);
    s.face = kind;
    stats[kind] += s.to - s.from;
    const lastRun = stats.runs[stats.runs.length - 1];
    if (lastRun && lastRun.kind === kind) { lastRun.to = s.to; lastRun.shots.push(s.index + 1); }
    else stats.runs.push({kind, from: s.from, to: s.to, shots: [s.index + 1]});
  });
  ['full', 'small', 'hidden'].forEach((k) => { stats[k] = r2(stats[k]); });

  return {shots: out, subs, duration: r2(out.length ? out[out.length - 1].to : total), stats, issues, legacy, fps};
};

// 排版的尺寸计算：图卡放在画面的哪一块、截图和录屏显示多大。
// 渲染（Film.jsx）和检查器（tools/lint.mjs）共用这一份，所以检查器说「这张图会很小」时，渲染出来就是那么小。

// 版式：横屏一种，竖屏三种（split 上图下人 / float 人全屏 + 浮卡 / pip 小头像 + 满屏图卡）。
// zone 是图卡占的区域；竖屏要避开顶部状态栏（约 180）、底部标题简介（约 20%）和右侧按钮列。
export const layoutOf = (width, height, portraitLayout) => {
  if (width >= height) return {kind: 'landscape', portrait: false, zone: {top: 0, height, scale: 1}, overlayTop: {chapter: 300, note: 340, tag: 50}};
  const base = {portrait: true, overlayTop: {chapter: 1020, note: 1060, tag: 200}};
  if (portraitLayout === 'float') return {...base, kind: 'float', zone: {top: 820, height: 540, scale: 0.8}};
  if (portraitLayout === 'pip') return {...base, kind: 'pip', zone: {top: 330, height: 1100, scale: 1}};
  return {...base, kind: 'split', band: 1000, zone: {top: 150, height: 850, scale: 1}};
};

// 图卡段落里字幕顶边在第几像素（没开字幕返回 null）。截图和录屏会撑满区域，要给字幕让出地方
export const subtitleTop = (lay, height, subtitle, on) => {
  if (!on || !subtitle) return null;
  const sub = lay.portrait ? subtitle.portrait : subtitle;
  const bottom = lay.kind === 'split' ? height - lay.band - 50 : sub.bottom;
  return Math.round(height - bottom - sub.size * 1.5);
};

// 这一镜的图卡区域。L 需要：canvas、zone、portrait、layout（resolveLayout 的结果）、subTop
//   原位抠像：摆在人的旁边（横屏）或脸的下面（竖屏），不压住人
//   media = true（截图、录屏这类会撑满的）：下边收到字幕上方
export const zoneFor = (L, s, media) => {
  let z = {left: 0, width: L.canvas.width, stack: L.portrait, ...L.zone};
  const c = L.layout && L.layout.cutout;
  if (s && s.state === 'cutout' && c && !c.center) z = {...z, ...c, stack: true};
  if (media && L.subTop !== null && L.subTop !== undefined && z.top + z.height > L.subTop - 14) {
    const top = L.kind === 'landscape' ? 24 : z.top;
    z = {...z, top, height: Math.max(200, L.subTop - 14 - top)};
  }
  return z;
};

// 区域里还剩多大地方放图（缩放前的尺寸）
export const roomFor = (z, {side = 60, top = 50, pill, extra = 0}) => ({w: z.width / z.scale - side * 2, h: z.height / z.scale - top * 2 - (pill ? 130 : 0) - extra});

// 图片 / 录屏按原始尺寸算显示大小：crop 只显示一块；scroll 长图宽度撑满、超出的高度滚动着看
export const fitMedia = ({media, crop, maxW, maxH, scroll}) => {
  const iw = media ? media.width : 1600, ih = media ? media.height : 900;
  const c = crop ? {x: crop[0], y: crop[1], w: crop[2], h: crop[3]} : {x: 0, y: 0, w: iw, h: ih};
  let k = Math.min(maxW / c.w, maxH / c.h, 2);
  let dw = c.w * k, dh = c.h * k, travel = 0;
  if (scroll && c.h * Math.min(maxW / c.w, 2) > maxH) { k = Math.min(maxW / c.w, 2); dw = c.w * k; travel = c.h * k - maxH; dh = maxH; }
  return {iw, ih, c, k, dw, dh, travel};
};

// 横屏时给小头像让出的一条：录屏不被头像压住
export const avatarLane = (L, s) => (L.kind === 'landscape' && s.state === 'pip' && L.avatarOn ? Math.round(L.avatar.w + L.avatarCfg.margin * 1.7) : 0);

// 一张卡里的图 / 录屏最后显示多大（Film.jsx 的三种带图的卡都从这里取）
export const mediaFit = (L, s) => {
  const c = s.card;
  const z = zoneFor(L, s, true);
  if (c.type === 'screen') {
    const lane = avatarLane(L, s);
    const room = roomFor(z, {side: 40, top: 20, pill: c.pill});
    return {z, lane, fit: fitMedia({media: c.media, crop: c.crop, maxW: room.w - lane, maxH: room.h})};
  }
  if (c.type === 'window') {
    const room = roomFor(z, {top: 24, pill: c.pill, extra: 56});
    return {z, fit: fitMedia({media: c.media, crop: c.crop, maxW: Math.min(L.portrait ? 960 : 1040, room.w), maxH: room.h, scroll: c.scroll})};
  }
  const room = roomFor(z, {top: 24, pill: c.pill, extra: c.caption ? 70 : 0});
  return {z, fit: fitMedia({media: c.media, crop: c.crop, maxW: Math.min(room.w, L.portrait ? 960 : 1300), maxH: room.h, scroll: c.scroll})};
};

// ---------- 叠在人像上的小卡片（章节卡 / 便签 / 小标签）放哪：不能压到脸 ----------
const tw = (t = '') => [...String(t)].reduce((n, ch) => n + (ch.charCodeAt(0) < 256 ? 0.55 : 1), 0);
// 脸在画面里占的范围：含头发、下巴，以及全程走动的余量。没量过脸返回 null
export const faceBoxOf = (L) => {
  const {face, full, source} = L.layout || {};
  if (!face || !full) return null;
  const fw = face.w * source.width * full.k, fh = face.h * source.height * full.k;
  const a = full.map(face.minX, face.minY), b = full.map(face.maxX, face.maxY);
  return {x0: a.x - fw * 0.62, x1: b.x + fw * 0.62, y0: a.y - fh * 1.0, y1: b.y + fh * 0.62, mouth: b.y + fh * 0.3};
};
// 这张小卡片大概多大（按字数估）
export const overlaySize = (o, maxW) => {
  if (o.type === 'chapter') return {w: Math.min(maxW, Math.max(tw(o.title) * 72, tw(o.part || '') * 30) + 84), h: 216};
  if (o.type === 'note') return {w: Math.min(maxW, tw(o.text) * 46 + 72), h: 112};
  return {w: Math.min(maxW, tw(o.text) * 34 + 60), h: 72};
};
// 选位置：依次试几个地方，用第一个不压脸的。都压脸就返回 overlap: true（检查器会报错）
// L 需要：canvas、portrait、overlayTop、layout、subFullTop（全屏口播时字幕的顶边，没字幕为 null）
export const overlayPlace = (L, o, corner) => {
  const {width: W, height: H} = L.canvas;
  const fb = faceBoxOf(L);
  const maxW = L.portrait ? 800 : 760;
  const {w, h} = overlaySize(o, maxW);
  const old = L.portrait ? {left: 60, top: L.overlayTop[o.type]} : {[corner === 'top-right' ? 'left' : 'right']: 70, top: L.overlayTop[o.type]};
  const rectOf = (p) => { const x0 = p.left !== undefined ? p.left : W - p.right - w; return {x0, x1: x0 + w, y0: p.top, y1: p.top + h}; };
  const hits = (p) => { if (!fb) return false; const r = rectOf(p); return r.x0 < fb.x1 && r.x1 > fb.x0 && r.y0 < fb.y1 && r.y1 > fb.y0; };
  if (!fb) return {style: {...old, maxWidth: maxW}, overlap: false};
  const floor = L.subFullTop ?? H - 120;
  const tries = [];
  if (o.type === 'tag') tries.push(old);
  if (L.portrait) {
    // 头顶上方（像标题），其次胸口，最后老位置
    if (fb.y0 - h - 60 >= 230) tries.push({left: 60, top: Math.round(fb.y0 - h - 60)});
    if (fb.y1 + 40 + h <= floor - 20) tries.push({left: 60, top: Math.round(fb.y1 + 40)});
  } else {
    // 人旁边（头像的对侧优先），其次头顶上方
    const a = corner === 'top-right' ? 'left' : 'right', b = a === 'left' ? 'right' : 'left';
    tries.push({[a]: 70, top: L.overlayTop[o.type]}, {[b]: 70, top: L.overlayTop[o.type] + (o.type === 'tag' ? 0 : 220)});
    if (fb.y0 - h - 30 >= 40) tries.push({[a]: 70, top: Math.round(Math.max(40, fb.y0 - h - 30))});
    if (fb.y1 + 30 + h <= floor - 10) tries.push({[a]: 70, top: Math.round(fb.y1 + 30)});
  }
  tries.push(old);
  const ok = tries.find((p) => !hits(p));
  return {style: {...(ok || old), maxWidth: maxW}, overlap: !ok};
};

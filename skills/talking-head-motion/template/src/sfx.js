// 音效和画面共用同一张节拍表：动画在第几帧出现，音效就在第几帧响。
// 规则：只用真实录音；音量压在人声下面；同一种动作永远配同一个声音（声音来自风格里的音效包）。
//
// 节拍 = 每张卡里各个元素相对这一镜开头的出场帧。
// 正片的节拍由解析器（resolve.js）按「说到哪个词」算好，放在 shot.beats 里；
// 没经过解析器的镜头（风格样板）用下面的默认节拍。
const defaults = (s) => {
  const c = s.card || {};
  const B = {appear: 6};
  if (Array.isArray(c.items)) B.items = c.items.map((_, k) => 18 + k * 10);
  if (Array.isArray(c.lines)) {
    B.lines = c.lines.map((_, k) => 14 + k * 6);
    if (c.highlight !== undefined) B.highlight = 14 + c.lines.length * 6 + 8;
  }
  if (c.type === 'stat') B.statEnd = 46;
  if (c.pill && c.type !== 'pill') B.pill = 14 + (c.lines ? c.lines.length : 0) * 6 + 8 + 12;
  return B;
};
export const beatsOf = (s) => s.beats || defaults(s);

// 音量。量过音效文件的响度（npm run measure）就按响度配：每个音效的峰值压到人声下面一截，再按动作分轻重；
// 没量过就用固定音量。
const VOL = {enterGraphics: 0.3, cardAppear: 0.35, item: 0.25, highlight: 0.25, payoff: 0.28, overlay: 0.3};
const WEIGHT = {enterGraphics: 1, cardAppear: 1, item: 0.75, highlight: 0.8, payoff: 0.9, overlay: 0.9};
const PEAK = -16;  // 音效峰值的目标（dBFS）。人声在 -14 LUFS 时，大约比人声低 11 分贝

export const buildSfx = (fps, shots, pack, modules = {cards: true, overlays: true}, levels) => {
  const out = [];
  if (!pack || !pack.cardAppear) return out;
  const len = pack.tail || 1;
  const vol = (key) => { const lv = levels && levels[pack[key]]; return lv === undefined ? VOL[key] : Math.min(1, WEIGHT[key] * Math.pow(10, (PEAK - lv) / 20)); };
  const add = (at, key) => out.push({at: Math.max(0, Math.round(at)), src: pack[key], v: vol(key), len});
  shots.forEach((s, i) => {
    const a = s.from * fps;
    const prev = shots[i - 1];
    if (modules.cards && prev && prev.state === 'full' && s.state !== 'full') add(a - 4, 'enterGraphics');
    if (modules.overlays && s.overlay && s.overlay.type !== 'tag') add(a + 4, 'overlay');
    if (!s.card || !modules.cards) return;
    const B = beatsOf(s);
    // 接着上一镜的录屏没有「弹出」这个动作，就不响
    if (!s.cont) add(a + B.appear, 'cardAppear');
    (B.items || []).forEach((fr) => add(a + fr, 'item'));
    if (B.highlight !== undefined) add(a + B.highlight, 'highlight');
    (B.focus || []).forEach((fr) => add(a + fr, 'highlight'));
    if (B.pill !== undefined) add(a + B.pill, 'payoff');
    if (B.stamp !== undefined) add(a + B.stamp, 'payoff');
    if (B.statEnd !== undefined) add(a + B.statEnd, 'payoff');
  });
  return out;
};

// 这一镜的内容什么时候全部出现（秒），给节奏检查用
export const contentDone = (s, fps = 30) => {
  if (s.done !== undefined) return s.done;
  const B = beatsOf(s);
  const all = [B.appear + 12, ...(B.items || []).map((x) => x + 12), ...(B.lines || []).map((x) => x + 12), ...(B.focus || []).map((x) => x + 14)];
  if (B.highlight !== undefined) all.push(B.highlight + 12);
  if (B.pill !== undefined) all.push(B.pill + 12);
  if (B.stamp !== undefined) all.push(B.stamp + 14);
  if (B.statEnd !== undefined) all.push(B.statEnd);
  return s.from + Math.max(...all) / fps;
};

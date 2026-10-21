// 音效和画面共用这一张节拍表：动画在第几帧出现，音效就在第几帧响。
// 规则：只用真实录音；音量压在人声下面；同一种动作永远配同一个声音（声音来自风格里的音效包）。

// 每张卡里各个元素相对镜头开头的出场帧（30fps）
export const cardBeats = {
  appear: 6,
  item: (k) => 18 + k * 10,
  line: (k) => 14 + k * 6,
  highlight: (c) => 14 + (c.lines ? c.lines.length : 0) * 6 + 8,
  pill: (c) => cardBeats.highlight(c) + 12,
  statEnd: 46,
};

// 动作 → 音量
const VOL = {enterGraphics: 0.3, cardAppear: 0.35, item: 0.25, highlight: 0.25, payoff: 0.28, overlay: 0.3};

export const buildSfx = (fps, shots, pack, modules = {cards: true, overlays: true}) => {
  const out = [];
  if (!pack || !pack.cardAppear) return out;
  const add = (at, key) => out.push({at: Math.max(0, Math.round(at)), src: pack[key], v: VOL[key]});
  shots.forEach((s, i) => {
    const a = s.from * fps;
    const prev = shots[i - 1];
    if (modules.cards && prev && prev.state === 'full' && s.state !== 'full') add(a - 4, 'enterGraphics');
    if (modules.overlays && s.overlay && s.overlay.type !== 'tag') add(a + 4, 'overlay');
    const c = s.card;
    if (!c || !modules.cards) return;
    add(a + cardBeats.appear, 'cardAppear');
    if (c.type === 'cards3' || c.type === 'list') c.items.forEach((_, k) => add(a + cardBeats.item(k), 'item'));
    if (c.type === 'window' && c.highlight !== undefined) add(a + cardBeats.highlight(c), 'highlight');
    if (c.type === 'window' && c.pill) add(a + cardBeats.pill(c), 'payoff');
    if (c.type === 'stat') add(a + cardBeats.statEnd, 'payoff');
  });
  return out;
};

// 这一镜的内容什么时候全部出现（秒），给节奏检查用
export const contentDone = (s, fps = 30) => {
  const c = s.card;
  let fr = 12;
  if (c) {
    if (c.type === 'cards3' || c.type === 'list') fr = cardBeats.item(c.items.length - 1) + 12;
    else if (c.type === 'window') fr = (c.pill ? cardBeats.pill(c) : cardBeats.highlight(c)) + 12;
    else if (c.type === 'stat') fr = cardBeats.statEnd;
    else fr = cardBeats.appear + 12;
  }
  return s.from + fr / fps;
};

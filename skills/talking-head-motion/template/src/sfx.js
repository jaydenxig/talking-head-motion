// 音效和画面共用这一张节拍表：动画在第几帧出现，音效就在第几帧响。
// 规则：只用真实录音；音量约为原始的 0.25–0.35（压在人声下面）；同一种动作永远配同一个声音。
import {SHOTS} from './shots.js';

// 每张卡里各个元素相对镜头开头的出场帧（30fps）
export const cardBeats = {
  appear: 6,
  item: (k) => 18 + k * 10,
  line: (k) => 14 + k * 6,
  highlight: (c) => 14 + (c.lines ? c.lines.length : 0) * 6 + 8,
  pill: (c) => cardBeats.highlight(c) + 12,
  statEnd: 46,
};

// 动作 → 音效（文件放在 public/sfx/，见 tools/fetch-sfx.sh）
export const SOUND = {
  enterGraphics: {src: 'whoosh-short.mp3', v: 0.3},
  cardAppear: {src: 'pop.mp3', v: 0.35},
  item: {src: 'click-soft.mp3', v: 0.25},
  highlight: {src: 'click.mp3', v: 0.25},
  payoff: {src: 'ping.mp3', v: 0.28},
  overlay: {src: 'pop.mp3', v: 0.3},
};

const add = (out, at, key) => out.push({at: Math.max(0, Math.round(at)), ...SOUND[key]});

export const buildSfx = (fps) => {
  const out = [];
  SHOTS.forEach((s, i) => {
    const a = s.from * fps;
    const prev = SHOTS[i - 1];
    if (prev && prev.state === 'full' && s.state !== 'full') add(out, a - 4, 'enterGraphics');
    if (s.overlay && s.overlay.type !== 'tag') add(out, a + 4, 'overlay');
    const c = s.card;
    if (!c) return;
    add(out, a + cardBeats.appear, 'cardAppear');
    if (c.type === 'cards3' || c.type === 'list') c.items.forEach((_, k) => add(out, a + cardBeats.item(k), 'item'));
    if (c.type === 'window' && c.highlight !== undefined) add(out, a + cardBeats.highlight(c), 'highlight');
    if (c.type === 'window' && c.pill) add(out, a + cardBeats.pill(c), 'payoff');
    if (c.type === 'stat') add(out, a + cardBeats.statEnd, 'payoff');
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

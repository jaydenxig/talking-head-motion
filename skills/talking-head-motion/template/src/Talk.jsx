import React from 'react';
import {AbsoluteFill, Audio, Img, OffthreadVideo, Sequence, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig, Easing} from 'remotion';
import '@fontsource/noto-sans-sc/chinese-simplified-500.css';
import '@fontsource/noto-sans-sc/chinese-simplified-700.css';
import '@fontsource/noto-sans-sc/chinese-simplified-900.css';
import '@fontsource/jetbrains-mono/700.css';
import {CONFIG} from './config.js';
import {SHOTS} from './shots.js';
import {SUBS} from './subs.js';
import {buildSfx, cardBeats} from './sfx.js';

const T = CONFIG.theme;
const CLAMP = {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'};
const SPRING = {damping: 15, stiffness: 170};

// 每种状态的可见度（0..1），镜头边界做 handoff 秒的交叉淡化
const useWeights = () => {
  const f = useCurrentFrame();
  const {fps} = useVideoConfig();
  const XF = CONFIG.handoff * fps;
  const w = {full: 0, pip: 0, cutout: 0};
  SHOTS.forEach((s, i) => {
    const a = s.from * fps, b = s.to * fps;
    const fin = i === 0 ? 1 : interpolate(f, [a - XF / 2, a + XF / 2], [0, 1], CLAMP);
    const fout = i === SHOTS.length - 1 ? 1 : interpolate(f, [b - XF / 2, b + XF / 2], [1, 0], CLAMP);
    w[s.state] = Math.max(w[s.state], Math.min(fin, fout));
  });
  return w;
};

// 进场 / 退场的通用曲线：弹簧进，handoff 秒淡出
const useEnter = (s, at) => {
  const f = useCurrentFrame();
  const {fps} = useVideoConfig();
  const p = spring({frame: f - s.from * fps - at, fps, config: SPRING});
  const out = interpolate(f, [s.to * fps - CONFIG.handoff * fps, s.to * fps], [1, 0], CLAMP);
  return {p, out, f, fps, a: s.from * fps};
};

// 白底蓝光：浅灰白底 + 细网格 + 两团柔光
const Stage = () => {
  const f = useCurrentFrame();
  const drift = Math.sin(f / 90) * 30;
  return (
    <AbsoluteFill style={{background: T.bg, overflow: 'hidden'}}>
      <AbsoluteFill style={{backgroundImage: `linear-gradient(${T.grid} 1px, transparent 1px), linear-gradient(90deg, ${T.grid} 1px, transparent 1px)`, backgroundSize: '48px 48px'}} />
      <div style={{position: 'absolute', left: -260 + drift, top: -220, width: 900, height: 700, borderRadius: '50%', background: `radial-gradient(closest-side, ${T.glowA}, transparent)`}} />
      <div style={{position: 'absolute', right: -240 - drift, bottom: -260, width: 980, height: 720, borderRadius: '50%', background: `radial-gradient(closest-side, ${T.glowB}, transparent)`}} />
    </AbsoluteFill>
  );
};

const Kicker = ({children}) => (
  <div style={{fontFamily: T.mono, fontSize: 24, letterSpacing: 6, color: T.accent, fontWeight: 700}}>{children}</div>
);

const Pill = ({children, p}) => (
  <div style={{display: 'inline-block', padding: '14px 34px', borderRadius: 999, color: '#fff', fontWeight: 900, fontSize: 40,
    background: `linear-gradient(90deg, ${T.accent}, ${T.accent2})`, boxShadow: '0 16px 40px rgba(47,107,255,.35)',
    opacity: p, transform: `scale(${0.85 + 0.15 * p})`}}>{children}</div>
);

const Cards3 = ({s}) => {
  const {p, out, f, fps, a} = useEnter(s, 6);
  const c = s.card;
  return (
    <AbsoluteFill style={{alignItems: 'center', justifyContent: 'center', fontFamily: T.font, opacity: out}}>
      <div style={{textAlign: 'center', opacity: p, transform: `translateY(${(1 - p) * 30}px)`}}>
        {c.kicker && <Kicker>{c.kicker}</Kicker>}
        <div style={{fontSize: 72, fontWeight: 900, color: T.ink, marginTop: 18}}>{c.title}</div>
      </div>
      <div style={{display: 'flex', gap: 36, marginTop: 64}}>
        {c.items.map((t, k) => {
          const q = spring({frame: f - a - cardBeats.item(k), fps, config: SPRING});
          return (
            <div key={t} style={{width: 360, padding: '34px 40px', borderRadius: 18, background: T.card, boxShadow: T.shadow,
              opacity: q, transform: `translateY(${(1 - q) * 40}px)`}}>
              <div style={{fontFamily: T.mono, fontSize: 44, fontWeight: 700, color: T.accent}}>{String(k + 1).padStart(2, '0')}</div>
              <div style={{fontSize: 56, fontWeight: 900, color: T.ink, marginTop: 30}}>{t}</div>
            </div>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};

const Window = ({s}) => {
  const {p, out, f, fps, a} = useEnter(s, 6);
  const c = s.card;
  const lines = c.lines || [];
  const hlAt = cardBeats.highlight(c);
  const hl = spring({frame: f - a - hlAt, fps, config: SPRING});
  const zoom = c.zoom ? interpolate(f - a, [hlAt, hlAt + 12], [1, c.zoom], {...CLAMP, easing: Easing.out(Easing.cubic)}) : 1;
  const pl = spring({frame: f - a - cardBeats.pill(c), fps, config: SPRING});
  return (
    <AbsoluteFill style={{alignItems: 'center', justifyContent: 'center', fontFamily: T.font, opacity: out}}>
      <div style={{width: 1040, borderRadius: 18, background: T.card, boxShadow: T.shadow, overflow: 'hidden',
        opacity: p, transform: `translateY(${(1 - p) * 50}px) scale(${(0.92 + 0.08 * p) * zoom})`}}>
        <div style={{height: 56, display: 'flex', alignItems: 'center', padding: '0 22px', position: 'relative', borderBottom: '1px solid #EEF0F4'}}>
          {['#FF5F57', '#FEBC2E', '#28C840'].map((col) => <div key={col} style={{width: 16, height: 16, borderRadius: 8, background: col, marginRight: 10}} />)}
          <div style={{position: 'absolute', left: 0, right: 0, textAlign: 'center', fontSize: 26, fontWeight: 700, color: T.ink}}>{c.title}</div>
        </div>
        {c.img && <Img src={staticFile(c.img)} style={{width: '100%', display: 'block'}} />}
        {lines.length > 0 && (
          <div style={{padding: '30px 40px 40px'}}>
            {lines.map((t, k) => {
              const q = spring({frame: f - a - cardBeats.line(k), fps, config: SPRING});
              const on = c.highlight === k;
              return (
                <div key={t} style={{margin: '18px 0', padding: '22px 28px', borderRadius: 14, fontSize: 34, fontWeight: 500, color: T.ink,
                  background: on ? `rgba(47,107,255,${0.06 + 0.08 * hl})` : '#F5F7FB', borderLeft: `6px solid ${on ? T.accent : '#DDE3EE'}`,
                  outline: on ? `3px solid rgba(47,107,255,${hl})` : 'none', opacity: q, transform: `translateX(${(1 - q) * -30}px)`}}>{t}</div>
              );
            })}
          </div>
        )}
      </div>
      {c.pill && <div style={{marginTop: 46}}><Pill p={pl}>{c.pill}</Pill></div>}
    </AbsoluteFill>
  );
};

const List = ({s}) => {
  const {p, out, f, fps, a} = useEnter(s, 6);
  const c = s.card;
  return (
    <AbsoluteFill style={{alignItems: 'center', justifyContent: 'center', fontFamily: T.font, opacity: out}}>
      <div style={{width: 820, padding: '44px 56px', borderRadius: 20, background: T.card, boxShadow: T.shadow,
        opacity: p, transform: `translateY(${(1 - p) * 50}px)`}}>
        <div style={{fontSize: 52, fontWeight: 900, color: T.ink}}>{c.title}</div>
        <div style={{height: 4, width: 90, borderRadius: 2, background: T.accent, margin: '22px 0 12px'}} />
        {c.items.map((t, k) => {
          const q = spring({frame: f - a - cardBeats.item(k), fps, config: SPRING});
          return (
            <div key={t} style={{display: 'flex', alignItems: 'center', gap: 22, margin: '26px 0', fontSize: 42, fontWeight: 700, color: T.ink,
              opacity: q, transform: `translateX(${(1 - q) * -30}px)`}}>
              <div style={{width: 46, height: 46, borderRadius: 23, background: T.accent, color: '#fff', fontSize: 26, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: T.mono}}>{k + 1}</div>
              {t}
            </div>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};

const Stat = ({s}) => {
  const {p, out, f, a} = useEnter(s, 6);
  const c = s.card;
  const v = interpolate(f, [a + 6, a + cardBeats.statEnd], [0, c.value], {...CLAMP, easing: Easing.out(Easing.cubic)});
  const shown = Number.isInteger(c.value) ? Math.round(v) : v.toFixed(1);
  return (
    <AbsoluteFill style={{alignItems: 'center', justifyContent: 'center', fontFamily: T.font, opacity: out}}>
      <div style={{textAlign: 'center', opacity: p, transform: `translateY(${(1 - p) * 40}px)`}}>
        {c.kicker && <Kicker>{c.kicker}</Kicker>}
        <div style={{fontSize: 56, fontWeight: 900, color: T.ink, marginTop: 16}}>{c.title}</div>
        <div style={{fontSize: 220, fontWeight: 900, lineHeight: 1.1, marginTop: 20, fontVariantNumeric: 'tabular-nums',
          background: `linear-gradient(90deg, ${T.accent}, ${T.accent2})`, WebkitBackgroundClip: 'text', color: 'transparent'}}>
          {shown}<span style={{fontSize: 80}}>{c.unit}</span></div>
        {c.note && <div style={{fontSize: 36, color: T.sub, fontWeight: 500}}>{c.note}</div>}
      </div>
    </AbsoluteFill>
  );
};

const Quote = ({s}) => {
  const {p, out} = useEnter(s, 6);
  const c = s.card;
  return (
    <AbsoluteFill style={{alignItems: 'center', justifyContent: 'center', fontFamily: T.font, opacity: out}}>
      <div style={{width: 1100, padding: '56px 70px', borderRadius: 20, background: T.card, boxShadow: T.shadow, borderLeft: `10px solid ${T.accent}`,
        opacity: p, transform: `translateY(${(1 - p) * 40}px)`}}>
        <div style={{fontSize: 52, fontWeight: 900, color: T.ink, lineHeight: 1.5}}>{c.text}</div>
        {c.by && <div style={{fontSize: 30, color: T.sub, marginTop: 24}}>— {c.by}</div>}
      </div>
    </AbsoluteFill>
  );
};

const CARDS = {cards3: Cards3, window: Window, list: List, stat: Stat, quote: Quote,
  pill: ({s}) => { const {p, out} = useEnter(s, 6); return <AbsoluteFill style={{alignItems: 'center', justifyContent: 'center', fontFamily: T.font, opacity: out}}><Pill p={p}>{s.card.text}</Pill></AbsoluteFill>; }};

// 叠在全屏口播上的元素。放在头像的对侧，避免挡脸。
const Overlay = ({s}) => {
  const {p, out} = useEnter(s, 4);
  const o = s.overlay;
  const away = CONFIG.avatar.corner === 'top-right' ? {left: 70} : {right: 70};
  if (o.type === 'chapter') {
    return (
      <div style={{position: 'absolute', top: 300, ...away, padding: '26px 40px 30px', borderRadius: 14, background: T.card, boxShadow: T.shadow,
        fontFamily: T.font, opacity: p * out, transform: `translateY(${(1 - p) * 30}px)`}}>
        <Kicker>{o.part}</Kicker>
        <div style={{fontSize: 72, fontWeight: 900, color: T.ink, marginTop: 10}}>{o.title}</div>
        <div style={{height: 7, borderRadius: 4, marginTop: 16, width: `${100 * p}%`, background: `linear-gradient(90deg, ${T.accent}, ${T.accent2})`}} />
      </div>
    );
  }
  if (o.type === 'note') {
    return (
      <div style={{position: 'absolute', top: 340, ...away, padding: '24px 34px', borderRadius: 12, background: T.card, boxShadow: T.shadow,
        borderTop: `6px solid ${T.accent}`, fontFamily: T.font, fontSize: 46, fontWeight: 900, color: T.ink,
        opacity: p * out, transform: `rotate(${-2 * p}deg) scale(${0.9 + 0.1 * p})`}}>{o.text}</div>
    );
  }
  return (
    <div style={{position: 'absolute', top: 50, ...away, padding: '12px 28px', borderRadius: 999, color: '#fff', fontWeight: 900, fontSize: 34,
      fontFamily: T.font, background: `linear-gradient(90deg, ${T.accent}, ${T.accent2})`, opacity: p * out}}>{o.text}</div>
  );
};

const Avatar = ({opacity}) => {
  const {width, height} = useVideoConfig();
  const A = CONFIG.avatar;
  const D = A.size;
  const vh = D / A.crop.scale, vw = vh * width / height;
  const side = A.corner === 'top-right' ? {right: A.margin} : {left: A.margin};
  return (
    <div style={{position: 'absolute', top: A.margin, ...side, width: D, height: D, borderRadius: '50%', overflow: 'hidden',
      border: '5px solid #fff', boxShadow: '0 14px 40px rgba(30,60,120,.25)', opacity}}>
      <OffthreadVideo src={staticFile(CONFIG.talk)} muted
        style={{position: 'absolute', width: vw, height: vh, left: D / 2 - A.crop.x * vw, top: D / 2 - A.crop.y * vh}} />
    </div>
  );
};

// 字幕：[关键词] 上色
const Subtitle = () => {
  const f = useCurrentFrame();
  const {fps} = useVideoConfig();
  const t = f / fps;
  const cur = SUBS.find((s) => t >= s.from && t < s.to);
  if (!cur) return null;
  const S = CONFIG.subtitle;
  const parts = cur.text.split(/(\[[^\]]+\])/);
  return (
    <div style={{position: 'absolute', bottom: S.bottom, width: '100%', textAlign: 'center', fontFamily: T.font}}>
      <span style={{fontSize: S.size, fontWeight: 900, color: '#fff', WebkitTextStroke: `${S.stroke}px rgba(12,18,32,.88)`, paintOrder: 'stroke fill', letterSpacing: 1}}>
        {parts.map((x, i) => x.startsWith('[') ? <span key={i} style={{color: S.keyword}}>{x.slice(1, -1)}</span> : x)}
      </span>
    </div>
  );
};

export const Talk = () => {
  const f = useCurrentFrame();
  const {fps} = useVideoConfig();
  const w = useWeights();
  const sfx = buildSfx(fps);
  const graphics = Math.max(w.pip, w.cutout);
  const live = (s) => f >= s.from * fps - 1 && f < s.to * fps + 1;
  return (
    <AbsoluteFill style={{background: T.bg}}>
      <AbsoluteFill style={{opacity: w.full}}><OffthreadVideo src={staticFile(CONFIG.talk)} /></AbsoluteFill>
      <AbsoluteFill style={{opacity: graphics}}><Stage /></AbsoluteFill>
      {/* 原位抠像：位置大小与原片完全一致 */}
      {CONFIG.matte
        ? <AbsoluteFill style={{opacity: w.cutout}}><OffthreadVideo src={staticFile(CONFIG.matte)} transparent muted /></AbsoluteFill>
        : <AbsoluteFill style={{opacity: w.cutout}}><OffthreadVideo src={staticFile(CONFIG.talk)} muted /></AbsoluteFill>}
      {SHOTS.filter((s) => s.card && live(s)).map((s) => { const C = CARDS[s.card.type]; return <C key={s.from} s={s} />; })}
      {SHOTS.filter((s) => s.overlay && live(s)).map((s) => <Overlay key={s.from} s={s} />)}
      <Avatar opacity={w.pip} />
      <Subtitle />
      {sfx.map((s, i) => (
        <Sequence key={i} from={s.at} durationInFrames={Math.round(fps * 1.5)} layout="none"><Audio src={staticFile(`sfx/${s.src}`)} volume={s.v} /></Sequence>
      ))}
    </AbsoluteFill>
  );
};

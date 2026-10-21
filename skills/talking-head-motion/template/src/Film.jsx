// 渲染引擎：给一张分镜表 + 一套风格，画出整段视频。正片（Talk）和风格样板（Sample / Teaser）都用它。
import React, {createContext, useContext} from 'react';
import {AbsoluteFill, Audio, Img, OffthreadVideo, Sequence, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig, Easing} from 'remotion';
import '@fontsource/noto-sans-sc/chinese-simplified-500.css';
import '@fontsource/noto-sans-sc/chinese-simplified-700.css';
import '@fontsource/noto-sans-sc/chinese-simplified-900.css';
import '@fontsource/noto-serif-sc/chinese-simplified-900.css';
import '@fontsource/zcool-kuaile/chinese-simplified-400.css';
import '@fontsource/ma-shan-zheng/chinese-simplified-400.css';
import '@fontsource/zcool-xiaowei/chinese-simplified-400.css';
import '@fontsource/zcool-qingke-huangyou/chinese-simplified-400.css';
import '@fontsource/jetbrains-mono/700.css';
import {MONO} from './styles.js';
import {buildSfx, cardBeats} from './sfx.js';

const CLAMP = {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'};
// 强调色上的文字：强调色偏亮就用深色字，偏暗就用白字
const lum = (hex) => { const n = parseInt(hex.slice(1, 7), 16); return (0.299 * (n >> 16) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255; };
const onAccent = (p) => (lum(p.accent) > 0.62 ? (p.dark ? p.bg : p.ink) : '#fff');
const Ctx = createContext(null);
const useLook = () => useContext(Ctx);

const GRAIN = `url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='300' height='300'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='3' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 0.4  0 0 0 0 0.32  0 0 0 0 0.22  0 0 0 0.16 0'/></filter><rect width='300' height='300' filter='url(%23n)'/></svg>")`;

// 每种状态的可见度（0..1），镜头边界做 handoff 秒的交叉淡化
const useWeights = (shots, handoff) => {
  const f = useCurrentFrame();
  const {fps} = useVideoConfig();
  const XF = handoff * fps;
  const w = {full: 0, pip: 0, cutout: 0};
  shots.forEach((s, i) => {
    const a = s.from * fps, b = s.to * fps;
    const fin = i === 0 ? 1 : interpolate(f, [a - XF / 2, a + XF / 2], [0, 1], CLAMP);
    const fout = i === shots.length - 1 ? 1 : interpolate(f, [b - XF / 2, b + XF / 2], [1, 0], CLAMP);
    w[s.state] = Math.max(w[s.state], Math.min(fin, fout));
  });
  return w;
};

// 进场：风格里的弹簧 + 风格里的动作；退场：handoff 秒淡出
const useEnter = (s, at) => {
  const L = useLook();
  const f = useCurrentFrame();
  const {fps} = useVideoConfig();
  const p = spring({frame: f - s.from * fps - at, fps, config: L.motion.spring});
  const out = interpolate(f, [s.to * fps - L.handoff * fps, s.to * fps], [1, 0], CLAMP);
  return {p, out, f, fps, a: s.from * fps, L};
};
const useItem = (a, at) => {
  const L = useLook();
  const f = useCurrentFrame();
  const {fps} = useVideoConfig();
  return spring({frame: f - a - at, fps, config: L.motion.spring});
};

// ---------- 背景 ----------
const Stage = () => {
  const {p, bg} = useLook();
  const f = useCurrentFrame();
  const drift = Math.sin(f / 90) * 30;
  const glows = (big) => (
    <>
      <div style={{position: 'absolute', left: -260 + drift, top: -220, width: big ? 1200 : 900, height: big ? 900 : 700, borderRadius: '50%', background: `radial-gradient(closest-side, ${p.glowA}, transparent)`}} />
      <div style={{position: 'absolute', right: -240 - drift, bottom: -260, width: big ? 1250 : 980, height: big ? 950 : 720, borderRadius: '50%', background: `radial-gradient(closest-side, ${p.glowB}, transparent)`}} />
    </>
  );
  const layer = {
    grid: <AbsoluteFill style={{backgroundImage: `linear-gradient(${p.line} 1px, transparent 1px), linear-gradient(90deg, ${p.line} 1px, transparent 1px)`, backgroundSize: '48px 48px'}} />,
    darkgrid: <AbsoluteFill style={{backgroundImage: `linear-gradient(${p.line} 1px, transparent 1px), linear-gradient(90deg, ${p.line} 1px, transparent 1px)`, backgroundSize: '64px 64px'}} />,
    scan: <AbsoluteFill style={{backgroundImage: `repeating-linear-gradient(0deg, ${p.line} 0 2px, transparent 2px 6px)`}} />,
    dots: <AbsoluteFill style={{backgroundImage: `radial-gradient(${p.line} 2.5px, transparent 2.5px)`, backgroundSize: '32px 32px'}} />,
    paper: <AbsoluteFill style={{backgroundImage: GRAIN, opacity: 0.9}} />,
    chalk: <AbsoluteFill style={{backgroundImage: GRAIN, opacity: 0.35, mixBlendMode: 'screen'}} />,
    lined: <AbsoluteFill style={{backgroundImage: `repeating-linear-gradient(0deg, transparent 0 55px, ${p.line} 55px 56px)`}}><div style={{position: 'absolute', left: 150, top: 0, bottom: 0, width: 2, background: 'rgba(230,80,80,.25)'}} /></AbsoluteFill>,
    plain: <AbsoluteFill style={{backgroundImage: `linear-gradient(90deg, ${p.line} 1px, transparent 1px)`, backgroundSize: '240px 100%'}} />,
  }[bg];
  const base = bg === 'sunset' ? `linear-gradient(180deg, ${p.bg} 0%, #6A2C4A 55%, #C8553D 100%)` : p.bg;
  return (
    <AbsoluteFill style={{background: base, overflow: 'hidden'}}>
      {glows(bg === 'blobs' || bg === 'sunset' || bg === 'darkglow')}
      {layer}
      {bg === 'chalk' && <AbsoluteFill style={{background: 'radial-gradient(ellipse at center, transparent 55%, rgba(0,0,0,.35))'}} />}
    </AbsoluteFill>
  );
};

// ---------- 卡片外观 ----------
const cardStyle = (L) => {
  const {p} = L;
  const S = {
    clean: {background: p.card, borderRadius: 18, boxShadow: '0 30px 80px rgba(30,60,120,.16)'},
    glass: {background: p.card, borderRadius: 20, border: '1px solid rgba(255,255,255,.16)', boxShadow: `0 0 40px ${p.accent}33, 0 24px 60px rgba(0,0,0,.35)`, backdropFilter: 'blur(14px)'},
    terminal: {background: p.card, borderRadius: 6, border: `1.5px solid ${p.accent}`, boxShadow: `0 0 28px ${p.accent}40`},
    soft: {background: p.card, borderRadius: 34, boxShadow: '0 18px 50px rgba(0,0,0,.07)'},
    paper: {background: p.card, borderRadius: 4, boxShadow: '0 12px 30px rgba(80,50,20,.18)'},
    sticker: {background: p.card, borderRadius: 22, border: `3px solid ${p.ink}`, boxShadow: `7px 7px 0 ${p.ink}`},
    editorial: {background: p.card, borderRadius: 0, borderTop: `8px solid ${p.accent}`, boxShadow: '0 20px 60px rgba(0,0,0,.08)'},
    chalk: {background: p.card, borderRadius: 14, border: '3px dashed rgba(255,255,255,.55)'},
    note: {background: p.card, borderRadius: 10, borderLeft: `12px solid ${p.accent}`, boxShadow: '0 10px 30px rgba(30,40,80,.10)'},
  };
  return S[L.card] || S.clean;
};
const tiltOf = (L) => (L.card === 'paper' || L.card === 'sticker' ? -1.2 : 0);

// solid：叠在口播画面上时，半透明卡片换成实底，免得看不清
const Box = ({children, style, solid}) => {
  const L = useLook();
  const fill = solid && (L.card === 'glass' || L.card === 'chalk') ? {background: `${L.p.bg}EE`} : {};
  return (
    <div style={{position: 'relative', ...cardStyle(L), ...fill, ...style}}>
      {L.card === 'paper' && <div style={{position: 'absolute', top: -16, left: '50%', marginLeft: -60, width: 120, height: 32, background: `${L.p.accent2}88`, transform: 'rotate(-3deg)'}} />}
      {children}
    </div>
  );
};

const Kicker = ({children}) => {
  const {p} = useLook();
  return <div style={{fontFamily: MONO, fontSize: 24, letterSpacing: 6, color: p.accent, fontWeight: 700}}>{children}</div>;
};
const Title = ({children, size, style}) => {
  const {p, font} = useLook();
  return <div style={{fontFamily: font.title, fontWeight: font.titleWeight, fontSize: size, color: p.ink, lineHeight: 1.25, ...style}}>{children}</div>;
};
const Pill = ({children, q}) => {
  const {p, font} = useLook();
  return (
    <div style={{display: 'inline-block', padding: '14px 34px', borderRadius: 999, color: onAccent(p), fontFamily: font.sub, fontWeight: font.subWeight, fontSize: 40,
      background: `linear-gradient(90deg, ${p.accent}, ${p.accent2})`, boxShadow: `0 16px 40px ${p.accent}55`, opacity: q, transform: `scale(${0.85 + 0.15 * q})`}}>{children}</div>
  );
};

// ---------- 图卡 ----------
const Center = ({children, out}) => (
  <AbsoluteFill style={{alignItems: 'center', justifyContent: 'center', opacity: out}}>{children}</AbsoluteFill>
);

const Cards3 = ({s}) => {
  const {p: pr, out, a, L} = useEnter(s, 6);
  const c = s.card;
  return (
    <Center out={out}>
      <div style={{textAlign: 'center', opacity: pr, transform: L.motion.enter(pr)}}>
        {c.kicker && <Kicker>{c.kicker}</Kicker>}
        <Title size={72} style={{marginTop: 18}}>{c.title}</Title>
      </div>
      <div style={{display: 'flex', gap: 36, marginTop: 64}}>
        {c.items.map((t, k) => <Cards3Item key={t} t={t} k={k} a={a} />)}
      </div>
    </Center>
  );
};
const Cards3Item = ({t, k, a}) => {
  const L = useLook();
  const q = useItem(a, cardBeats.item(k));
  return (
    <Box style={{width: 360, padding: '34px 40px', opacity: q, transform: `${L.motion.enter(q)} rotate(${tiltOf(L) * (k - 1)}deg)`}}>
      <div style={{fontFamily: MONO, fontSize: 44, fontWeight: 700, color: L.p.accent}}>{String(k + 1).padStart(2, '0')}</div>
      <Title size={56} style={{marginTop: 26}}>{t}</Title>
    </Box>
  );
};

const Window = ({s}) => {
  const {p: pr, out, f, a, L} = useEnter(s, 6);
  const {p} = L;
  const c = s.card;
  const lines = c.lines || [];
  const hlAt = cardBeats.highlight(c);
  const hl = useItem(a, hlAt);
  const zoom = c.zoom ? interpolate(f - a, [hlAt, hlAt + 12], [1, c.zoom], {...CLAMP, easing: Easing.out(Easing.cubic)}) : 1;
  const pl = useItem(a, cardBeats.pill(c));
  return (
    <Center out={out}>
      <Box style={{width: 1040, overflow: 'hidden', opacity: pr, transform: `${L.motion.enter(pr)} scale(${zoom}) rotate(${tiltOf(L)}deg)`}}>
        <div style={{height: 56, display: 'flex', alignItems: 'center', padding: '0 22px', position: 'relative', borderBottom: `1px solid ${p.dark ? 'rgba(255,255,255,.08)' : 'rgba(0,0,0,.06)'}`}}>
          {['#FF5F57', '#FEBC2E', '#28C840'].map((col) => <div key={col} style={{width: 16, height: 16, borderRadius: 8, background: col, marginRight: 10}} />)}
          <div style={{position: 'absolute', left: 0, right: 0, textAlign: 'center', fontSize: 26, fontWeight: 700, color: p.ink, fontFamily: L.font.body}}>{c.title}</div>
        </div>
        {c.img && <Img src={staticFile(c.img)} style={{width: '100%', display: 'block'}} />}
        {lines.length > 0 && (
          <div style={{padding: '24px 40px 36px'}}>
            {lines.map((t, k) => <WindowLine key={t} t={t} k={k} a={a} on={c.highlight === k} hl={hl} />)}
          </div>
        )}
      </Box>
      {c.pill && <div style={{marginTop: 46}}><Pill q={pl}>{c.pill}</Pill></div>}
    </Center>
  );
};
const WindowLine = ({t, k, a, on, hl}) => {
  const L = useLook();
  const {p} = L;
  const q = useItem(a, cardBeats.line(k));
  const idle = p.dark ? 'rgba(255,255,255,.05)' : 'rgba(0,0,0,.035)';
  return (
    <div style={{margin: '16px 0', padding: '22px 28px', borderRadius: 14, fontSize: 34, fontWeight: 500, color: p.ink, fontFamily: L.font.body,
      background: on ? `${p.accent}${hl > 0.5 ? '22' : '11'}` : idle, borderLeft: `6px solid ${on ? p.accent : 'transparent'}`,
      outline: on ? `3px solid ${p.accent}` : 'none', outlineOffset: 0, opacity: q, transform: `translateX(${(1 - q) * -30}px)`}}>{t}</div>
  );
};

const List = ({s}) => {
  const {p: pr, out, a, L} = useEnter(s, 6);
  const c = s.card;
  return (
    <Center out={out}>
      <Box style={{width: 820, padding: '44px 56px', opacity: pr, transform: `${L.motion.enter(pr)} rotate(${tiltOf(L)}deg)`}}>
        <Title size={52}>{c.title}</Title>
        <div style={{height: 5, width: 90, borderRadius: 3, background: L.p.accent, margin: '22px 0 12px'}} />
        {c.items.map((t, k) => <ListItem key={t} t={t} k={k} a={a} />)}
      </Box>
    </Center>
  );
};
const ListItem = ({t, k, a}) => {
  const L = useLook();
  const q = useItem(a, cardBeats.item(k));
  return (
    <div style={{display: 'flex', alignItems: 'center', gap: 22, margin: '26px 0', fontSize: 42, fontWeight: 700, color: L.p.ink, fontFamily: L.font.body, opacity: q, transform: `translateX(${(1 - q) * -30}px)`}}>
      <div style={{width: 48, height: 48, borderRadius: 24, background: L.p.accent, color: L.p.dark ? L.p.bg : '#fff', fontSize: 26, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: MONO}}>{k + 1}</div>
      {t}
    </div>
  );
};

const Stat = ({s}) => {
  const {p: pr, out, f, a, L} = useEnter(s, 6);
  const {p} = L;
  const c = s.card;
  const v = interpolate(f, [a + 6, a + cardBeats.statEnd], [0, c.value], {...CLAMP, easing: Easing.out(Easing.cubic)});
  const shown = Number.isInteger(c.value) ? Math.round(v) : v.toFixed(1);
  return (
    <Center out={out}>
      <div style={{textAlign: 'center', opacity: pr, transform: L.motion.enter(pr)}}>
        {c.kicker && <Kicker>{c.kicker}</Kicker>}
        <Title size={56} style={{marginTop: 16}}>{c.title}</Title>
        <div style={{fontSize: 220, fontWeight: 900, lineHeight: 1.1, marginTop: 20, fontVariantNumeric: 'tabular-nums', fontFamily: L.font.title,
          background: `linear-gradient(90deg, ${p.accent}, ${p.accent2})`, WebkitBackgroundClip: 'text', color: 'transparent'}}>
          {shown}<span style={{fontSize: 80}}>{c.unit}</span></div>
        {c.note && <div style={{fontSize: 36, color: p.sub, fontWeight: 500, fontFamily: L.font.body}}>{c.note}</div>}
      </div>
    </Center>
  );
};

const Quote = ({s}) => {
  const {p: pr, out, L} = useEnter(s, 6);
  const c = s.card;
  return (
    <Center out={out}>
      <Box style={{width: 1100, padding: '56px 70px', opacity: pr, transform: L.motion.enter(pr)}}>
        <Title size={52} style={{lineHeight: 1.5}}>{c.text}</Title>
        {c.by && <div style={{fontSize: 30, color: L.p.sub, marginTop: 24, fontFamily: L.font.body}}>— {c.by}</div>}
      </Box>
    </Center>
  );
};

const PillCard = ({s}) => {
  const {p: pr, out} = useEnter(s, 6);
  return <Center out={out}><Pill q={pr}>{s.card.text}</Pill></Center>;
};

const CARDS = {cards3: Cards3, window: Window, list: List, stat: Stat, quote: Quote, pill: PillCard};

// ---------- 叠在全屏口播上的元素：放在头像的对侧 ----------
const Overlay = ({s, corner}) => {
  const {p: pr, out, L} = useEnter(s, 4);
  const {p} = L;
  const o = s.overlay;
  const away = corner === 'top-right' ? {left: 70} : {right: 70};
  if (o.type === 'chapter') {
    return (
      <div style={{position: 'absolute', top: 300, ...away, opacity: pr * out, transform: L.motion.enter(pr)}}>
        <Box solid style={{padding: '26px 40px 30px'}}>
          <Kicker>{o.part}</Kicker>
          <Title size={72} style={{marginTop: 10}}>{o.title}</Title>
          <div style={{height: 7, borderRadius: 4, marginTop: 16, width: `${100 * pr}%`, background: `linear-gradient(90deg, ${p.accent}, ${p.accent2})`}} />
        </Box>
      </div>
    );
  }
  if (o.type === 'note') {
    return (
      <div style={{position: 'absolute', top: 340, ...away, opacity: pr * out, transform: `${L.motion.enter(pr)} rotate(-2deg)`}}>
        <Box solid style={{padding: '24px 34px'}}><Title size={46}>{o.text}</Title></Box>
      </div>
    );
  }
  return (
    <div style={{position: 'absolute', top: 50, ...away, padding: '12px 28px', borderRadius: 999, color: onAccent(p), fontSize: 34,
      fontFamily: L.font.sub, fontWeight: L.font.subWeight, background: `linear-gradient(90deg, ${p.accent}, ${p.accent2})`, opacity: pr * out}}>{o.text}</div>
  );
};

// ---------- 小头像 ----------
const Avatar = ({opacity, talk, avatar}) => {
  const {width, height} = useVideoConfig();
  const L = useLook();
  const A = L.avatar;
  const vh = A.h / avatar.crop.scale, vw = vh * width / height;
  const side = avatar.corner === 'top-right' ? {right: avatar.margin} : {left: avatar.margin};
  const ring = L.p.dark ? L.p.accent : '#fff';
  const shape = A.clip ? {clipPath: A.clip} : {borderRadius: A.radius, border: `5px solid ${ring}`, boxShadow: '0 14px 40px rgba(0,0,0,.22)'};
  return (
    <div style={{position: 'absolute', top: avatar.margin, ...side, width: A.w, height: A.h, overflow: 'hidden', opacity, background: ring, ...shape}}>
      <OffthreadVideo src={staticFile(talk)} muted
        style={{position: 'absolute', width: vw, height: vh, left: A.w / 2 - avatar.crop.x * vw, top: A.h / 2 - avatar.crop.y * vh}} />
    </div>
  );
};

// ---------- 字幕：[关键词] 上色 ----------
const Subtitle = ({subs, size, bottom}) => {
  const f = useCurrentFrame();
  const {fps} = useVideoConfig();
  const L = useLook();
  const t = f / fps;
  const cur = subs.find((s) => t >= s.from && t < s.to);
  if (!cur) return null;
  const parts = cur.text.split(/(\[[^\]]+\])/);
  const kw = L.p.keyword;
  const look = {
    stroke: {color: '#fff', WebkitTextStroke: '7px rgba(12,18,32,.88)', paintOrder: 'stroke fill'},
    box: {color: '#fff', background: 'rgba(14,14,20,.78)', padding: '6px 24px', borderRadius: 10},
    shadow: {color: '#fff', WebkitTextStroke: '4px rgba(20,20,24,.6)', paintOrder: 'stroke fill', textShadow: '0 3px 14px rgba(0,0,0,.45)'},
  }[L.subtitle];
  return (
    <div style={{position: 'absolute', bottom, width: '100%', textAlign: 'center'}}>
      <span style={{fontSize: size, fontFamily: L.font.sub, fontWeight: L.font.subWeight, letterSpacing: 1, ...look}}>
        {parts.map((x, i) => x.startsWith('[') ? <span key={i} style={{color: kw}}>{x.slice(1, -1)}</span> : x)}
      </span>
    </div>
  );
};

// ---------- 主体 ----------
// props: shots, subs, look（resolveStyle 的结果）, modules, talk, matte, avatar, subtitle, music, handoff, label
export const Film = (props) => {
  const {look, modules: M, talk, matte, avatar, subtitle, music, handoff, label} = props;
  const f = useCurrentFrame();
  const {fps, durationInFrames} = useVideoConfig();
  // 不做图卡时，所有镜头都当全屏口播
  const shots = M.cards ? props.shots : props.shots.map((s) => ({...s, state: 'full', card: undefined}));
  const L = {...look, handoff};
  const w = useWeights(shots, handoff);
  const sfx = M.sfx ? buildSfx(fps, shots, look.sfx, M) : [];
  const graphics = Math.max(w.pip, w.cutout);
  const live = (s) => f >= s.from * fps - 1 && f < s.to * fps + 1;
  const musicVol = (fr) => {
    const fade = Math.min(1, fr / fps, (durationInFrames - fr) / fps);
    return music.volume * fade * (music.duck + (1 - music.duck) * graphics);
  };
  return (
    <Ctx.Provider value={L}>
      <AbsoluteFill style={{background: look.p.bg}}>
        <AbsoluteFill style={{opacity: w.full}}><OffthreadVideo src={staticFile(talk)} /></AbsoluteFill>
        <AbsoluteFill style={{opacity: graphics}}><Stage /></AbsoluteFill>
        {/* 原位抠像：位置大小与原片完全一致 */}
        <AbsoluteFill style={{opacity: w.cutout}}>
          {matte ? <OffthreadVideo src={staticFile(matte)} transparent muted /> : <OffthreadVideo src={staticFile(talk)} muted />}
        </AbsoluteFill>
        {shots.filter((s) => s.card && live(s)).map((s) => { const C = CARDS[s.card.type]; return <C key={s.from} s={s} />; })}
        {M.overlays && shots.filter((s) => s.overlay && live(s)).map((s) => <Overlay key={s.from} s={s} corner={avatar.corner} />)}
        {M.avatar && <Avatar opacity={w.pip} talk={talk} avatar={avatar} />}
        {M.subtitles && <Subtitle subs={props.subs} size={subtitle.size} bottom={subtitle.bottom} />}
        {label && (
          <div style={{position: 'absolute', top: 34, left: '50%', transform: 'translateX(-50%)', padding: '10px 26px', borderRadius: 12, background: 'rgba(10,10,14,.82)',
            color: '#fff', fontFamily: '"Noto Sans SC"', fontWeight: 700, fontSize: 30, whiteSpace: 'nowrap'}}>{label}</div>
        )}
        {sfx.map((s, i) => (
          <Sequence key={i} from={s.at} durationInFrames={Math.round(fps * 1.5)} layout="none"><Audio src={staticFile(`sfx/${s.src}`)} volume={s.v} /></Sequence>
        ))}
        {M.music && <Audio src={staticFile(music.file)} volume={musicVol} />}
      </AbsoluteFill>
    </Ctx.Provider>
  );
};

// ---------- 零件对照表：把每套风格拆开并排摆，方便用户逐项挑 ----------
// rows：配色 / 字体 / 卡片 / 字幕 / 动效和音效；头像形状单独一行，四种形状和风格无关，任选
const Cell = ({children, bg, h}) => (
  <div style={{height: h, display: 'flex', alignItems: 'center', justifyContent: 'center', background: bg, borderRadius: 14, overflow: 'hidden', position: 'relative'}}>{children}</div>
);
const RowLabel = ({children, h}) => (
  <div style={{height: h, display: 'flex', alignItems: 'center', fontFamily: '"Noto Sans SC"', fontWeight: 900, fontSize: 30, color: '#14181F'}}>{children}</div>
);

export const Parts = ({looks, names, talk, crop, shapes, sample}) => {
  const {width} = useVideoConfig();
  const gap = 18, labelW = 170;
  const colW = (width - 60 - labelW - gap * looks.length) / looks.length;
  const H = {head: 70, palette: 110, font: 130, card: 190, sub: 110, motion: 90, avatar: 250};
  const col = (L, i, child, h) => (
    <Ctx.Provider key={i} value={{...L, handoff: 0.3}}>
      <div style={{width: colW}}>{child(L, h)}</div>
    </Ctx.Provider>
  );
  const row = (label, h, child) => (
    <div style={{display: 'flex', gap, marginBottom: gap}}>
      <div style={{width: labelW}}><RowLabel h={h}>{label}</RowLabel></div>
      {looks.map((L, i) => col(L, i, child, h))}
    </div>
  );
  const letters = 'ABCDEFGH';
  return (
    <AbsoluteFill style={{background: '#F4F5F8', padding: 30}}>
      {row('', H.head, (L, h) => {
        const i = looks.indexOf(L);
        return <RowLabel h={h}><span style={{fontSize: 40}}>{letters[i]}</span>&nbsp;·&nbsp;{names[i]}</RowLabel>;
      })}
      {row('配色', H.palette, (L, h) => (
        <Cell bg={L.p.bg} h={h}>
          {[L.p.accent, L.p.accent2, L.p.ink, L.p.keyword].map((c) => <div key={c} style={{width: 56, height: 56, borderRadius: 28, background: c, margin: '0 8px', border: '3px solid rgba(255,255,255,.7)'}} />)}
        </Cell>
      ))}
      {row('字体', H.font, (L, h) => (
        <Cell bg={L.p.bg} h={h}><div style={{textAlign: 'center'}}><Title size={58}>{sample.title}</Title><div style={{fontSize: 20, color: L.p.sub, fontFamily: '"Noto Sans SC"', marginTop: 6}}>{L.font.name}</div></div></Cell>
      ))}
      {row('卡片', H.card, (L, h) => (
        <Cell bg={L.p.bg} h={h}>
          <Box style={{padding: '20px 30px', transform: `rotate(${tiltOf(L)}deg)`}}>
            <Kicker>01</Kicker>
            <Title size={42} style={{marginTop: 8}}>{sample.item}</Title>
          </Box>
        </Cell>
      ))}
      {row('字幕', H.sub, (L, h) => {
        const look = {
          stroke: {color: '#fff', WebkitTextStroke: '6px rgba(12,18,32,.88)', paintOrder: 'stroke fill'},
          box: {color: '#fff', background: 'rgba(14,14,20,.78)', padding: '4px 18px', borderRadius: 10},
          shadow: {color: '#fff', WebkitTextStroke: '4px rgba(20,20,24,.6)', paintOrder: 'stroke fill', textShadow: '0 3px 14px rgba(0,0,0,.45)'},
        }[L.subtitle];
        const parts = sample.sub.split(/(\[[^\]]+\])/);
        return (
          <Cell bg={L.p.bg} h={h}>
            <span style={{fontSize: Math.min(36, colW / 13), fontFamily: L.font.sub, fontWeight: L.font.subWeight, whiteSpace: 'nowrap', ...look}}>
              {parts.map((x, k) => x.startsWith('[') ? <span key={k} style={{color: L.p.keyword}}>{x.slice(1, -1)}</span> : x)}
            </span>
          </Cell>
        );
      })}
      {row('动效 · 音效', H.motion, (L, h) => (
        <Cell bg="#fff" h={h}><div style={{fontFamily: '"Noto Sans SC"', fontSize: 26, fontWeight: 700, color: '#14181F', textAlign: 'center', lineHeight: 1.5}}>{L.motion.name}<br /><span style={{color: '#5A6475', fontWeight: 500}}>音效：{L.sfx.name}</span></div></Cell>
      ))}
      <div style={{display: 'flex', gap, alignItems: 'center'}}>
        <div style={{width: labelW}}><RowLabel h={H.avatar}>头像形状</RowLabel></div>
        {shapes.map((A, i) => {
          const vh = A.h / crop.scale, vw = vh * 16 / 9;
          return (
            <div key={i} style={{width: colW, height: H.avatar, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: '#fff', borderRadius: 14}}>
              <div style={{width: A.w * 0.8, height: A.h * 0.8, borderRadius: A.radius, overflow: 'hidden', position: 'relative', border: '4px solid #fff', boxShadow: '0 8px 24px rgba(0,0,0,.18)'}}>
                <OffthreadVideo src={staticFile(talk)} startFrom={90} muted style={{position: 'absolute', width: vw * 0.8, height: vh * 0.8, left: (A.w / 2 - crop.x * vw) * 0.8, top: (A.h / 2 - crop.y * vh) * 0.8}} />
              </div>
              <div style={{fontFamily: '"Noto Sans SC"', fontSize: 24, fontWeight: 700, marginTop: 12, color: '#14181F'}}>{i + 1}. {A.name}</div>
            </div>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};

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
import {buildSfx, beatsOf} from './sfx.js';
import {resolveLayout} from './resolve.js';
import {layoutOf, subtitleTop, zoneFor, mediaFit, overlayPlace} from './layout.js';

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
    w[s.state] = Math.min(1, w[s.state] + Math.min(fin, fout));
  });
  return w;
};

// 进场：风格里的弹簧 + 风格里的动作；退场：handoff 秒淡出
const useEnter = (s, at) => {
  const L = useLook();
  const f = useCurrentFrame();
  const {fps} = useVideoConfig();
  const p = s.cont ? 1 : spring({frame: f - s.from * fps - at, fps, config: L.motion.spring});
  const out = s.contNext ? 1 : interpolate(f, [s.to * fps - L.handoff * fps, s.to * fps], [1, 0], CLAMP);
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
const Pill = ({children, q, big}) => {
  const {p, font} = useLook();
  return (
    <div style={{display: 'inline-block', padding: big ? '26px 60px' : '14px 34px', borderRadius: 999, color: onAccent(p), fontFamily: font.sub, fontWeight: font.subWeight, fontSize: big ? 68 : 40,
      background: `linear-gradient(90deg, ${p.accent}, ${p.accent2})`, boxShadow: `0 16px 40px ${p.accent}55`, opacity: q, transform: `scale(${0.85 + 0.15 * q})`}}>{children}</div>
  );
};

// ---------- 图卡 ----------
// 图卡放在版式给的区域里居中
// pad：给小头像让出的一条（录屏卡用）
// media：截图、录屏这类会撑满的卡，区域下边收到字幕上方
const Center = ({children, out, s, pad, media}) => {
  const L = useLook();
  const f = useCurrentFrame();
  const {fps} = useVideoConfig();
  const z = zoneFor(L, s, media);
  // 慢推：图卡出全以后人在小窗里，画面几乎不动，看着像卡住了。整张卡在这一镜里极慢地放大一点点（默认 3%）
  const len = (s.to - s.from) * fps;
  const push = s && !s.cont && !s.contNext && len > fps * 2.5 ? 1 + (L.drift || 0) * interpolate(f - s.from * fps, [0, len], [0, 1], CLAMP) : 1;
  return (
    <div style={{position: 'absolute', left: z.left, width: z.width, top: z.top, height: z.height, display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: out, boxSizing: 'border-box', ...pad}}>
      <div style={{position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center', transform: `scale(${z.scale * push})`}}>
        {children}
        {s && s.card && s.card.mock && (
          <div style={{position: 'absolute', right: 0, top: -46, padding: '4px 14px', borderRadius: 8, fontFamily: '"Noto Sans SC", sans-serif', fontWeight: 700, fontSize: 24, letterSpacing: 2,
            color: L.p.sub, border: `2px solid ${L.p.sub}`, opacity: 0.75 * out}}>示意</div>
        )}
      </div>
    </div>
  );
};

// ---------- 图片 / 录屏：按原始尺寸排版，可以只显示一块、滚动、框重点 ----------
const FocusBox = ({box, a, at, until, k, bound}) => {
  const {p} = useLook();
  const f = useCurrentFrame();
  const {fps} = useVideoConfig();
  const q = spring({frame: f - a - at, fps, config: {damping: 16, stiffness: 190}});
  // 下一个重点出现时，这一个就退场：同一时刻只框一处
  const stay = until === null ? 1 : interpolate(f, [a + until - 6, a + until], [1, 0], CLAMP);
  // 录屏在滚动：框的位置量了前后两处，中间跟着走
  const m = box.rect2 ? interpolate(f - a - at, [0, fps], [0, 1], CLAMP) : 0;
  const [x, y, w, h] = box.rect.map((v, i) => (box.rect2 ? v + (box.rect2[i] - v) * m : v));
  const pad = 10;
  // 小字标签：右边放得下就放右边，放不下放上面，免得盖住上一行字
  const labelW = box.label ? [...box.label].length * 30 + 40 : 0;
  const right = (x + w) * k + pad + 14 + labelW < bound;
  const place = right ? {left: '100%', marginLeft: 14, top: '50%', transform: 'translateY(-50%)'} : {left: -5, bottom: '100%', marginBottom: 10};
  return (
    <div style={{position: 'absolute', left: x * k - pad, top: y * k - pad, width: w * k + pad * 2, height: h * k + pad * 2, boxSizing: 'border-box', borderRadius: 12,
      border: `5px solid ${p.accent}`, background: `${p.accent}1A`, boxShadow: `0 0 0 5px ${p.accent}33, 0 10px 30px ${p.accent}55`, opacity: q * stay, transform: `scale(${1.25 - 0.25 * q})`}}>
      {box.label && (
        <div style={{position: 'absolute', ...place, padding: '6px 18px', borderRadius: 10, whiteSpace: 'nowrap', background: p.accent, color: onAccent(p),
          fontFamily: '"Noto Sans SC", sans-serif', fontWeight: 700, fontSize: 28}}>{box.label}</div>
      )}
    </div>
  );
};
const Media = ({s, fit, video}) => {
  const f = useCurrentFrame();
  const {fps} = useVideoConfig();
  const c = s.card;
  const B = beatsOf(s);
  const a = Math.round(s.from * fps), end = Math.round(s.to * fps);
  const y = fit.travel ? interpolate(f, [a + B.appear + 14, Math.max(a + B.appear + 30, end - 16)], [0, -fit.travel], {...CLAMP, easing: Easing.inOut(Easing.quad)}) : 0;
  const boxes = c.focusBoxes || [];
  const beats = B.focus || [];
  return (
    <div style={{position: 'relative', width: fit.dw, height: fit.dh, overflow: 'hidden'}}>
      <div style={{position: 'absolute', left: -fit.c.x * fit.k, top: -fit.c.y * fit.k + y, width: fit.iw * fit.k, height: fit.ih * fit.k}}>
        {video
          ? <Sequence from={a} layout="none"><OffthreadVideo src={staticFile(c.src)} startFrom={Math.round((c.start || 0) * fps)} playbackRate={c.rate || 1} muted={!c.sound} style={{width: '100%', height: '100%', display: 'block'}} /></Sequence>
          : <Img src={staticFile(c.img)} style={{width: '100%', height: '100%', display: 'block'}} />}
        {(c.maskBoxes || []).map((r, i) => (
          <div key={`m${i}`} style={{position: 'absolute', left: r[0] * fit.k - 6, top: r[1] * fit.k - 4, width: r[2] * fit.k + 12, height: r[3] * fit.k + 8, borderRadius: 6,
            backdropFilter: 'blur(14px)', WebkitBackdropFilter: 'blur(14px)', background: 'rgba(140,140,140,.35)'}} />
        ))}
        {boxes.map((b, i) => {
          // 录屏上的框最多留 1.2 秒（画面在动，留久了就对不上了）；截图上的框留到下一个出现
          const next = i + 1 < beats.length ? beats[i + 1] : null;
          const until = video ? Math.min(next ?? Infinity, beats[i] + Math.round(fps * (b.rect2 ? 1.2 : 0.7))) : next;
          return b.rect && <FocusBox key={i} box={b} a={a} at={beats[i]} until={until} k={fit.k} bound={(fit.c.x + fit.c.w) * fit.k} />;
        })}
      </div>
    </div>
  );
};
// 一行放得下的宽度：汉字算 1，英文数字算 0.55
const textW = (t = '') => [...String(t)].reduce((n, ch) => n + (ch.charCodeAt(0) < 256 ? 0.55 : 1), 0);
const Cards3 = ({s}) => {
  const B = beatsOf(s);
  const {p: pr, out, a, L} = useEnter(s, B.appear);
  const c = s.card;
  const stack = zoneFor(L, s).stack;
  // 横着排时卡片宽度按最长的那条字算，几张卡一样宽：字不在半中间折行
  const n = s.card.items.length;
  const wide = Math.max(300, Math.min(Math.round((L.canvas.width - 260) / n) - 36, Math.ceil(Math.max(...s.card.items.map(textW)) * 56 + 84)));
  return (
    <Center out={out} s={s}>
      <div style={{textAlign: 'center', opacity: pr, transform: L.motion.enter(pr)}}>
        {c.kicker && <Kicker>{c.kicker}</Kicker>}
        <Title size={72} style={{marginTop: 18}}>{c.title}</Title>
      </div>
      <div style={{display: 'flex', flexDirection: stack ? 'column' : 'row', gap: stack ? 26 : 36, marginTop: stack ? 48 : 64}}>
        {c.items.map((t, k) => <Cards3Item key={k} t={t} k={k} a={a} at={B.items[k]} stack={stack} wide={wide} />)}
      </div>
    </Center>
  );
};
const Cards3Item = ({t, k, a, at, stack, wide}) => {
  const L = useLook();
  const q = useItem(a, at);
  const num = <div style={{fontFamily: MONO, fontSize: 44, fontWeight: 700, color: L.p.accent}}>{String(k + 1).padStart(2, '0')}</div>;
  // 竖屏或窄区域：几张卡上下叠，编号和文字排成一行
  if (stack) {
    return (
      <Box style={{width: 800, padding: '30px 40px', display: 'flex', alignItems: 'center', gap: 30, opacity: q, transform: `${L.motion.enter(q)} rotate(${tiltOf(L) * (k - 1)}deg)`}}>
        {num}<Title size={56}>{t}</Title>
      </Box>
    );
  }
  return (
    <Box style={{width: wide || 360, padding: '34px 40px', opacity: q, transform: `${L.motion.enter(q)} rotate(${tiltOf(L) * (k - 1)}deg)`}}>
      {num}
      <Title size={56} style={{marginTop: 26}}>{t}</Title>
    </Box>
  );
};

const Window = ({s}) => {
  const B = beatsOf(s);
  const {p: pr, out, f, a, L} = useEnter(s, B.appear);
  const {p} = L;
  const c = s.card;
  const lines = c.lines || [];
  const hlAt = B.highlight ?? (B.focus ? B.focus[0] : 9999);
  const hl = useItem(a, hlAt);
  const zoom = c.zoom ? interpolate(f - a, [hlAt, hlAt + 12], [1, c.zoom], {...CLAMP, easing: Easing.out(Easing.cubic)}) : 1;
  const pl = useItem(a, B.pill ?? 9999);
  const full = L.portrait ? 960 : 1040;
  const fit = c.img ? mediaFit(L, s).fit : null;
  return (
    <Center out={out} s={s} media={!!c.img}>
      <Box style={{width: fit ? Math.max(fit.dw, 480) : full, overflow: 'hidden', opacity: pr, transform: `${L.motion.enter(pr)} scale(${zoom}) rotate(${tiltOf(L)}deg)`}}>
        <div style={{height: 56, display: 'flex', alignItems: 'center', padding: '0 22px', position: 'relative', borderBottom: `1px solid ${p.dark ? 'rgba(255,255,255,.08)' : 'rgba(0,0,0,.06)'}`}}>
          {['#FF5F57', '#FEBC2E', '#28C840'].map((col) => <div key={col} style={{width: 16, height: 16, borderRadius: 8, background: col, marginRight: 10}} />)}
          <div style={{position: 'absolute', left: 0, right: 0, textAlign: 'center', fontSize: 26, fontWeight: 700, color: p.ink, fontFamily: L.font.body}}>{c.title}</div>
        </div>
        {fit && <div style={{display: 'flex', justifyContent: 'center'}}><Media s={s} fit={fit} /></div>}
        {lines.length > 0 && (
          <div style={{padding: '24px 40px 36px'}}>
            {lines.map((t, k) => <WindowLine key={k} t={t} k={k} a={a} at={B.lines[k]} on={c.highlight === k} hl={hl} />)}
          </div>
        )}
      </Box>
      {c.pill && <div style={{marginTop: 46}}><Pill q={pl}>{c.pill}</Pill></div>}
    </Center>
  );
};
const WindowLine = ({t, k, a, at, on, hl}) => {
  const L = useLook();
  const {p} = L;
  const q = useItem(a, at);
  const idle = p.dark ? 'rgba(255,255,255,.05)' : 'rgba(0,0,0,.035)';
  return (
    <div style={{margin: '16px 0', padding: '22px 28px', borderRadius: 14, fontSize: 34, fontWeight: 500, color: p.ink, fontFamily: L.font.body,
      background: on ? `${p.accent}${hl > 0.5 ? '22' : '11'}` : idle, borderLeft: `6px solid ${on ? p.accent : 'transparent'}`,
      outline: on ? `3px solid ${p.accent}` : 'none', outlineOffset: 0, opacity: q, transform: `translateX(${(1 - q) * -30}px)`}}>{t}</div>
  );
};

const List = ({s}) => {
  const B = beatsOf(s);
  const {p: pr, out, a, L} = useEnter(s, B.appear);
  const c = s.card;
  return (
    <Center out={out} s={s}>
      <Box style={{width: 820, padding: '44px 56px', opacity: pr, transform: `${L.motion.enter(pr)} rotate(${tiltOf(L)}deg)`}}>
        <Title size={52}>{c.title}</Title>
        <div style={{height: 5, width: 90, borderRadius: 3, background: L.p.accent, margin: '22px 0 12px'}} />
        {c.items.map((t, k) => <ListItem key={k} t={t} k={k} a={a} at={B.items[k]} />)}
      </Box>
    </Center>
  );
};
const ListItem = ({t, k, a, at}) => {
  const L = useLook();
  const q = useItem(a, at);
  return (
    <div style={{display: 'flex', alignItems: 'center', gap: 22, margin: '26px 0', fontSize: 42, fontWeight: 700, color: L.p.ink, fontFamily: L.font.body, opacity: q, transform: `translateX(${(1 - q) * -30}px)`}}>
      <div style={{width: 48, height: 48, borderRadius: 24, background: L.p.accent, color: L.p.dark ? L.p.bg : '#fff', fontSize: 26, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: MONO}}>{k + 1}</div>
      {t}
    </div>
  );
};

const Stat = ({s}) => {
  const B = beatsOf(s);
  const {p: pr, out, f, a, L} = useEnter(s, B.appear);
  const {p} = L;
  const c = s.card;
  const v = interpolate(f, [a + 6, a + B.statEnd], [0, c.value], {...CLAMP, easing: Easing.out(Easing.cubic)});
  const shown = Number.isInteger(c.value) ? Math.round(v) : v.toFixed(1);
  return (
    <Center out={out} s={s}>
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
  // 短的引用（一句话）放大当主角；长的引用按正文排
  const short = [...c.text].length <= 12;
  return (
    <Center out={out} s={s}>
      <Box style={{width: short ? 'auto' : L.portrait ? 900 : 1100, maxWidth: L.portrait ? 940 : 1300, padding: short ? '60px 90px 56px' : '56px 70px', opacity: pr, transform: L.motion.enter(pr)}}>
        <div style={{fontFamily: L.font.title, fontWeight: 900, fontSize: short ? 150 : 110, lineHeight: 0.6, color: L.p.accent, opacity: 0.85, height: short ? 70 : 50}}>“</div>
        <Title size={short ? 96 : 52} style={{lineHeight: short ? 1.3 : 1.5}}>{c.text}</Title>
        {c.by && <div style={{fontSize: short ? 38 : 30, color: L.p.sub, marginTop: short ? 30 : 24, fontFamily: L.font.body}}>— {c.by}</div>}
      </Box>
    </Center>
  );
};

const PillCard = ({s}) => {
  const {p: pr, out} = useEnter(s, 6);
  return <Center out={out} s={s}><Pill q={pr} big>{s.card.text}</Pill></Center>;
};

// 截图：不带窗口边框，手机截图、长图都能放
const ImageCard = ({s}) => {
  const B = beatsOf(s);
  const {p: pr, out, a, L} = useEnter(s, B.appear);
  const c = s.card;
  const pl = useItem(a, B.pill ?? 9999);
  const {fit} = mediaFit(L, s);
  return (
    <Center out={out} s={s} media>
      {c.caption && <div style={{marginBottom: 22, opacity: pr}}><Kicker>{c.caption}</Kicker></div>}
      <Box style={{overflow: 'hidden', opacity: pr, transform: L.motion.enter(pr)}}><Media s={s} fit={fit} /></Box>
      {c.pill && <div style={{marginTop: 40}}><Pill q={pl}>{c.pill}</Pill></div>}
    </Center>
  );
};

// 录屏：素材尽量占满。横屏时给小头像让出一条，头像不压在录屏上
const ScreenCard = ({s}) => {
  const B = beatsOf(s);
  const {p: pr, out, a, L} = useEnter(s, B.appear);
  const {p} = L;
  const c = s.card;
  const pl = useItem(a, B.pill ?? 9999);
  const {fit, lane} = mediaFit(L, s);
  const pad = lane ? (L.avatarCfg.corner === 'top-right' ? {paddingRight: lane} : {paddingLeft: lane}) : null;
  return (
    <Center out={out} s={s} pad={pad} media>
      <div style={{position: 'relative', borderRadius: 16, overflow: 'hidden', background: '#000', opacity: pr, transform: s.cont ? 'none' : L.motion.enter(pr),
        border: `1px solid ${p.dark ? 'rgba(255,255,255,.18)' : 'rgba(0,0,0,.10)'}`, boxShadow: '0 26px 70px rgba(0,0,0,.26)'}}>
        <Media s={s} fit={fit} video />
        {c.label && (
          <div style={{position: 'absolute', left: 18, top: 18, padding: '8px 22px', borderRadius: 999, color: onAccent(p), fontSize: 28, fontFamily: L.font.sub, fontWeight: L.font.subWeight,
            background: `linear-gradient(90deg, ${p.accent}, ${p.accent2})`}}>{c.label}</div>
        )}
      </div>
      {c.pill && <div style={{marginTop: 36}}><Pill q={pl}>{c.pill}</Pill></div>}
    </Center>
  );
};

// ---------- 动作卡：把「发给它」「它生成」「从哪到哪」演出来，不是把字列出来 ----------
// 小图标（线条画）。流程卡的每一站、对话里的文件用
const ICON_PATHS = {
  doc: 'M6 2h9l5 5v15H6z M15 2v5h5 M9 13h7 M9 17h7',
  chat: 'M4 5h16v11H9l-5 4z M8 9h8 M8 12h5',
  ai: 'M12 3l2.2 6.3 6.3 2.2-6.3 2.2L12 20l-2.2-6.3L3.5 11.5l6.3-2.2z',
  web: 'M12 3a9 9 0 100 18 9 9 0 000-18z M3 12h18 M12 3c3 3 3 15 0 18 M12 3c-3 3-3 15 0 18',
  person: 'M12 12a4 4 0 100-8 4 4 0 000 8z M4 21c0-4 4-6 8-6s8 2 8 6',
  mail: 'M3 6h18v12H3z M3 6l9 7 9-7',
  clock: 'M12 3a9 9 0 100 18 9 9 0 000-18z M12 7v5l3 2',
  search: 'M11 5a6 6 0 100 12 6 6 0 000-12z M16 16l5 5',
  phone: 'M8 2h8a1 1 0 011 1v18a1 1 0 01-1 1H8a1 1 0 01-1-1V3a1 1 0 011-1z M11 18h2',
  check: 'M12 3a9 9 0 100 18 9 9 0 000-18z M8 12l3 3 5-6',
};
const Icon = ({name, size, color}) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d={ICON_PATHS[name] || ICON_PATHS.check} /></svg>
);

// 对话：你发一句话 / 一个文件，对方回复。你的话是一个字一个字打出来的，文件是飞进去的
const ChatBubble = ({m, a, at}) => {
  const L = useLook();
  const {p} = L;
  const f = useCurrentFrame();
  const q = useItem(a, at);
  const me = m.from === 'me';
  const base = {alignSelf: me ? 'flex-end' : 'flex-start', maxWidth: '82%', opacity: q};
  if (m.file) {
    // 文件：从下面飞上来落进对话里
    return (
      <div style={{...base, display: 'flex', alignItems: 'center', gap: 20, padding: '20px 30px 20px 22px', borderRadius: 22, background: p.dark ? 'rgba(255,255,255,.10)' : '#fff',
        border: `2px solid ${p.accent}`, boxShadow: `0 12px 30px ${p.accent}33`, transform: `translate(${(1 - q) * (me ? 90 : -90)}px, ${(1 - q) * 170}px) rotate(${(1 - q) * (me ? 10 : -10)}deg) scale(${0.8 + 0.2 * q})`}}>
        <div style={{width: 68, height: 68, borderRadius: 16, background: `${p.accent}1F`, display: 'flex', alignItems: 'center', justifyContent: 'center'}}><Icon name="doc" size={42} color={p.accent} /></div>
        <div style={{fontFamily: L.font.body, fontWeight: 700, fontSize: 36, color: p.ink}}>{m.file}</div>
      </div>
    );
  }
  const chars = [...m.text];
  const shown = me ? Math.round(interpolate(f - a - at, [0, Math.min(22, chars.length * 1.3)], [0, chars.length], CLAMP)) : chars.length;
  return (
    <div style={{...base, padding: '20px 30px', borderRadius: 26, borderBottomRightRadius: me ? 8 : 26, borderBottomLeftRadius: me ? 26 : 8, fontFamily: L.font.body, fontWeight: 500, fontSize: 38, lineHeight: 1.4,
      color: me ? onAccent(p) : p.ink, background: me ? `linear-gradient(135deg, ${p.accent}, ${p.accent2})` : p.dark ? 'rgba(255,255,255,.10)' : '#EEF1F6', transform: `translateY(${(1 - q) * 26}px) scale(${0.96 + 0.04 * q})`}}>
      {chars.slice(0, shown).join('')}<span style={{opacity: 0}}>{chars.slice(shown).join('')}</span>
    </div>
  );
};
const Chat = ({s}) => {
  const B = beatsOf(s);
  const {p: pr, out, a, L} = useEnter(s, B.appear);
  const {p} = L;
  const c = s.card;
  const pl = useItem(a, B.pill ?? 9999);
  return (
    <Center out={out} s={s}>
      <Box style={{width: L.portrait ? 900 : 980, overflow: 'hidden', opacity: pr, transform: L.motion.enter(pr)}}>
        <div style={{height: 88, display: 'flex', alignItems: 'center', gap: 18, padding: '0 30px', borderBottom: `1px solid ${p.dark ? 'rgba(255,255,255,.10)' : 'rgba(0,0,0,.07)'}`}}>
          <div style={{width: 48, height: 48, borderRadius: 24, background: `linear-gradient(135deg, ${p.accent}, ${p.accent2})`, display: 'flex', alignItems: 'center', justifyContent: 'center'}}><Icon name="ai" size={30} color={onAccent(p)} /></div>
          <div style={{fontFamily: L.font.body, fontWeight: 700, fontSize: 32, color: p.ink}}>{c.title || 'AI 助手'}</div>
        </div>
        <div style={{display: 'flex', flexDirection: 'column', gap: 22, padding: '32px 32px 40px'}}>
          {c.messages.map((m, k) => <ChatBubble key={k} m={m} a={a} at={B.items[k]} />)}
        </div>
      </Box>
      {c.pill && <div style={{marginTop: 40}}><Pill q={pl}>{c.pill}</Pill></div>}
    </Center>
  );
};

// 流程：东西依次经过几站，说到哪一站亮哪一站，中间的线跟着走过去
const FlowNode = ({t, icon, k, a, at, last, row}) => {
  const L = useLook();
  const {p} = L;
  const f = useCurrentFrame();
  const q = useItem(a, at);
  // 刚亮起来的那一站最显眼，后一站亮了它就收一点
  const on = f - a >= at && (last === null || f - a < last);
  return (
    <div style={{display: 'flex', flexDirection: row ? 'column' : 'row', alignItems: 'center', gap: row ? 18 : 30, opacity: q, transform: `scale(${(0.8 + 0.2 * q) * (on ? 1.06 : 1)})`, width: row ? 260 : 640}}>
      <div style={{width: 138, height: 138, flexShrink: 0, borderRadius: 38, display: 'flex', alignItems: 'center', justifyContent: 'center', background: on ? `linear-gradient(135deg, ${p.accent}, ${p.accent2})` : p.card,
        border: `3px solid ${on ? 'transparent' : `${p.accent}55`}`, boxShadow: on ? `0 18px 44px ${p.accent}66` : '0 10px 28px rgba(0,0,0,.08)'}}>
        {icon ? <Icon name={icon} size={76} color={on ? onAccent(p) : p.accent} /> : <div style={{fontFamily: MONO, fontWeight: 700, fontSize: 58, color: on ? onAccent(p) : p.accent}}>{k + 1}</div>}
      </div>
      <Title size={row ? Math.min(40, Math.floor(250 / Math.max(1, textW(t)))) : 52} style={{textAlign: row ? 'center' : 'left', whiteSpace: row ? 'nowrap' : 'normal'}}>{t}</Title>
    </div>
  );
};
const FlowLink = ({a, at, row}) => {
  const {p} = useLook();
  const f = useCurrentFrame();
  // 线比下一站早一点点走到
  const q = interpolate(f - a, [at - 10, at], [0, 1], CLAMP);
  const len = row ? 110 : 64;
  return (
    <div style={{position: 'relative', width: row ? len : 138, height: row ? 138 : len, flexShrink: 0, alignSelf: row ? 'flex-start' : 'flex-start'}}>
      <div style={{position: 'absolute', left: row ? 0 : 66, top: row ? 66 : 0, width: row ? len : 6, height: row ? 6 : len, borderRadius: 3, background: `${p.accent}2E`}} />
      <div style={{position: 'absolute', left: row ? 0 : 66, top: row ? 66 : 0, width: row ? len * q : 6, height: row ? 6 : len * q, borderRadius: 3, background: p.accent}} />
      <div style={{position: 'absolute', left: row ? len * q - 9 : 60, top: row ? 60 : len * q - 9, width: 18, height: 18, borderRadius: 9, background: p.accent, opacity: q > 0 && q < 1 ? 1 : 0, boxShadow: `0 0 16px ${p.accent}`}} />
    </div>
  );
};
const Flow = ({s}) => {
  const B = beatsOf(s);
  const {p: pr, out, a, L} = useEnter(s, B.appear);
  const c = s.card;
  const pl = useItem(a, B.pill ?? 9999);
  const row = !zoneFor(L, s).stack;
  return (
    <Center out={out} s={s}>
      {c.title && <div style={{opacity: pr, transform: L.motion.enter(pr), marginBottom: row ? 56 : 44}}><Title size={60}>{c.title}</Title></div>}
      <div style={{display: 'flex', flexDirection: row ? 'row' : 'column', alignItems: 'flex-start', opacity: pr}}>
        {c.steps.map((t, k) => (
          <React.Fragment key={k}>
            {k > 0 && <FlowLink a={a} at={B.items[k]} row={row} />}
            <FlowNode t={t} icon={c.icons && c.icons[k]} k={k} a={a} at={B.items[k]} last={k + 1 < B.items.length ? B.items[k + 1] : null} row={row} />
          </React.Fragment>
        ))}
      </div>
      {c.pill && <div style={{marginTop: 50}}><Pill q={pl}>{c.pill}</Pill></div>}
    </Center>
  );
};

// 文档：一页纸，光扫一遍（「它在读」），划出几条重点，最后盖上结果
const DocMark = ({t, a, at}) => {
  const L = useLook();
  const {p} = L;
  const q = useItem(a, at);
  return (
    <div style={{position: 'relative', height: 62, margin: '10px 0', display: 'flex', alignItems: 'center'}}>
      <div style={{position: 'absolute', left: -14, top: 0, bottom: 0, width: `calc(${100 * q}% + 28px)`, borderRadius: 10, background: `${p.accent}2B`, borderLeft: `6px solid ${p.accent}`}} />
      <div style={{position: 'relative', fontFamily: L.font.body, fontWeight: 700, fontSize: 38, color: p.ink, opacity: q, paddingLeft: 12}}>{t}</div>
    </div>
  );
};
const Doc = ({s}) => {
  const B = beatsOf(s);
  const {p: pr, out, f, a, L} = useEnter(s, B.appear);
  const {p} = L;
  const c = s.card;
  const marks = c.marks || [];
  const st = useItem(a, B.stamp ?? 9999);
  const bar = p.dark ? 'rgba(255,255,255,.14)' : 'rgba(20,30,60,.10)';
  const gray = (w, k) => <div key={`g${k}`} style={{height: 18, width: `${w}%`, borderRadius: 9, background: bar, margin: '20px 0'}} />;
  // 重点穿插在灰色的「正文」中间
  const rows = [gray(92, 0), gray(74, 1)];
  marks.forEach((t, k) => { rows.push(<DocMark key={`m${k}`} t={t} a={a} at={B.items[k]} />); rows.push(gray(k % 2 ? 88 : 66, 10 + k)); });
  while (rows.length < 8) rows.push(gray(rows.length % 2 ? 80 : 58, 20 + rows.length));
  const scan = c.scan ? interpolate(f - a, [B.appear + 6, B.appear + 44], [0, 1], CLAMP) : -1;
  return (
    <Center out={out} s={s}>
      <Box style={{position: 'relative', width: L.portrait ? 760 : 720, padding: '50px 56px 46px', overflow: 'hidden', opacity: pr, transform: L.motion.enter(pr)}}>
        <div style={{display: 'flex', alignItems: 'center', gap: 18}}>
          <Icon name="doc" size={52} color={p.accent} />
          <Title size={52}>{c.title}</Title>
        </div>
        <div style={{height: 5, width: 100, borderRadius: 3, background: p.accent, margin: '22px 0 14px'}} />
        {rows}
        {scan > 0 && scan < 1 && (
          <div style={{position: 'absolute', left: 0, right: 0, top: `${scan * 100}%`, height: 90, marginTop: -90, background: `linear-gradient(180deg, ${p.accent}00, ${p.accent}40)`, borderBottom: `4px solid ${p.accent}`}} />
        )}
        {c.stamp && (
          <div style={{position: 'absolute', right: 44, bottom: 40, padding: '10px 26px', borderRadius: 14, border: `6px solid ${p.accent}`, color: p.accent, background: `${p.card}`, fontFamily: L.font.title, fontWeight: 900, fontSize: 50,
            opacity: st, transform: `rotate(-8deg) scale(${1.7 - 0.7 * st})`}}>{c.stamp}</div>
        )}
      </Box>
    </Center>
  );
};

const CARDS = {cards3: Cards3, window: Window, list: List, stat: Stat, quote: Quote, pill: PillCard, image: ImageCard, screen: ScreenCard, chat: Chat, flow: Flow, doc: Doc};

// ---------- 叠在全屏口播上的元素：放在头像的对侧 ----------
// 竖屏：一律放左边（右边是点赞评论那列），章节卡和便签放在胸前，不挡脸
const Overlay = ({s, corner}) => {
  const {p: pr, out, L} = useEnter(s, 4);
  const {p} = L;
  const o = s.overlay;
  // 位置按脸来定：头顶上方或胸口，不压脸（layout.js 的 overlayPlace）
  const away = overlayPlace(L, o, corner).style;
  if (o.type === 'chapter') {
    return (
      <div style={{position: 'absolute', ...away, opacity: pr * out, transform: L.motion.enter(pr)}}>
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
      <div style={{position: 'absolute', ...away, opacity: pr * out, transform: `${L.motion.enter(pr)} rotate(-2deg)`}}>
        <Box solid style={{padding: '24px 34px'}}><Title size={46}>{o.text}</Title></Box>
      </div>
    );
  }
  return (
    <div style={{position: 'absolute', ...away, padding: '12px 28px', borderRadius: 999, color: onAccent(p), fontSize: 34,
      fontFamily: L.font.sub, fontWeight: L.font.subWeight, background: `linear-gradient(90deg, ${p.accent}, ${p.accent2})`, opacity: pr * out}}>{o.text}</div>
  );
};

// ---------- 人：全屏口播时铺满，图卡段落时缩成角上的小头像 ----------
// 两种状态之间是同一个画面缩过去 / 放大回来，不是两层画面淡入淡出：观众看得出「还是这个人」，更连贯。
// m：0 = 全屏，1 = 小头像
const Presenter = ({m, opacity, talk, avatar}) => {
  const L = useLook();
  const A = L.avatar;
  const {crop, source, full} = L.layout;
  const {width: W, height: H} = L.canvas;
  const e = m < 0.5 ? 4 * m * m * m : 1 - Math.pow(-2 * m + 2, 3) / 2;
  const mix = (a, b) => a + (b - a) * e;
  const ax = avatar.corner === 'top-right' ? W - avatar.margin - A.w : avatar.margin, ay = L.portrait ? 190 : avatar.margin;
  const fw = source.width * full.k, fh = source.height * full.k;         // 全屏时原片铺多大
  const ah = A.h / crop.scale, aw = ah * source.width / source.height;   // 头像里原片铺多大
  const ring = L.p.dark ? L.p.accent : '#fff';
  const round = A.radius === '50%' ? `${mix(0, A.w / 2)}px / ${mix(0, A.h / 2)}px` : `${mix(0, A.radius)}px`;
  return (
    <div style={{position: 'absolute', left: mix(0, ax), top: mix(0, ay), width: mix(W, A.w), height: mix(H, A.h), overflow: 'hidden', borderRadius: round, opacity, background: ring,
      boxShadow: `0 0 0 ${5 * e}px ${ring}, 0 14px 40px rgba(0,0,0,${0.22 * e})`}}>
      <OffthreadVideo src={staticFile(talk)} style={{position: 'absolute', maxWidth: 'none', left: mix(-full.px * (fw - W), A.w / 2 - crop.x * aw), top: mix(-full.py * (fh - H), A.h / 2 - crop.y * ah), width: mix(fw, aw), height: mix(fh, ah)}} />
    </div>
  );
};

// ---------- 小头像（淡入淡出的旧做法：config.js 里 handoffStyle: 'fade' 时用） ----------
const Avatar = ({opacity, talk, avatar}) => {
  const L = useLook();
  const A = L.avatar;
  const {crop, source} = L.layout;
  const vh = A.h / crop.scale, vw = vh * source.width / source.height;
  const side = avatar.corner === 'top-right' ? {right: avatar.margin} : {left: avatar.margin};
  const top = L.portrait ? 190 : avatar.margin;
  const ring = L.p.dark ? L.p.accent : '#fff';
  const shape = A.clip ? {clipPath: A.clip} : {borderRadius: A.radius, border: `5px solid ${ring}`, boxShadow: '0 14px 40px rgba(0,0,0,.22)'};
  return (
    <div style={{position: 'absolute', top, ...side, width: A.w, height: A.h, overflow: 'hidden', opacity, background: ring, ...shape}}>
      <OffthreadVideo src={staticFile(talk)} muted
        style={{position: 'absolute', width: vw, height: vh, left: A.w / 2 - crop.x * vw, top: A.h / 2 - crop.y * vh}} />
    </div>
  );
};

// ---------- 字幕：[关键词] 上色 ----------
// stroke 粗描边 ／ box 色块底 ／ shadow 投影 ／ soft 细字软描边（不挤）／ band 通栏底条（中间深、两侧淡出）
const SUB_LOOKS = {
  stroke: {color: '#fff', WebkitTextStroke: '7px rgba(12,18,32,.88)', paintOrder: 'stroke fill'},
  box: {color: '#fff', background: 'rgba(14,14,20,.78)', padding: '6px 24px', borderRadius: 10},
  shadow: {color: '#fff', WebkitTextStroke: '4px rgba(20,20,24,.6)', paintOrder: 'stroke fill', textShadow: '0 3px 14px rgba(0,0,0,.45)'},
  soft: {color: '#fff', fontWeight: 700, letterSpacing: 4, WebkitTextStroke: '3px rgba(10,14,24,.55)', paintOrder: 'stroke fill', textShadow: '0 0 10px rgba(0,0,0,.6), 0 2px 5px rgba(0,0,0,.5)'},
  band: {color: '#fff', fontWeight: 700, letterSpacing: 3},
};
const Subtitle = ({subs, size, bottom}) => {
  const f = useCurrentFrame();
  const {fps} = useVideoConfig();
  const L = useLook();
  const t = f / fps;
  const cur = subs.find((s) => t >= s.from && t < s.to);
  if (!cur) return null;
  const parts = cur.text.split(/(\[[^\]]+\])/);
  const kw = L.p.keyword;
  const look = SUB_LOOKS[L.subtitle] || SUB_LOOKS.stroke;
  const band = L.subtitle === 'band' ? {background: 'linear-gradient(90deg, rgba(8,10,16,0), rgba(8,10,16,.86) 24%, rgba(8,10,16,.86) 76%, rgba(8,10,16,0))', padding: '10px 0'} : null;
  return (
    <div style={{position: 'absolute', bottom, left: L.portrait && !band ? 70 : 0, right: L.portrait && !band ? 70 : 0, textAlign: 'center', lineHeight: 1.45, ...band}}>
      <span style={{fontSize: size, fontFamily: L.font.sub, fontWeight: L.font.subWeight, letterSpacing: 1, boxDecorationBreak: 'clone', WebkitBoxDecorationBreak: 'clone', ...look}}>
        {parts.map((x, i) => x.startsWith('[') ? <span key={i} style={{color: kw}}>{x.slice(1, -1)}</span> : x)}
      </span>
    </div>
  );
};

// ---------- 主体 ----------
// props: shots, subs, look（resolveStyle 的结果）, modules, talk, matte, source, avatar, subtitle, music, handoff, portraitLayout, measured, label
// 横屏还是竖屏看画布尺寸（config.js 的 orientation 决定）
export const Film = (props) => {
  const {look, modules: M, talk, matte, source, avatar, music, handoff, label} = props;
  const f = useCurrentFrame();
  const {fps, durationInFrames, width, height} = useVideoConfig();
  const lay = layoutOf(width, height, props.portraitLayout);
  // 脸在哪、原片多大都是量出来的（measured.js），这里只按它排版
  const layout = resolveLayout({orientation: width >= height ? 'landscape' : 'portrait', portraitLayout: props.portraitLayout, source, avatar}, props.measured, look);
  // 不做图卡时，所有镜头都当全屏口播
  const shots = M.cards ? props.shots : props.shots.map((s) => ({...s, state: 'full', card: undefined}));
  const L = {...look, handoff, ...lay, layout, canvas: {width, height}, avatarCfg: avatar, avatarOn: M.avatar, subTop: subtitleTop(lay, height, props.subtitle, M.subtitles), drift: props.drift ?? 0.03,
    subFullTop: M.subtitles ? height - (lay.portrait ? props.subtitle.portrait : props.subtitle).bottom - (lay.portrait ? props.subtitle.portrait : props.subtitle).size * 3 : null};
  const w = useWeights(shots, handoff);
  const sfx = M.sfx ? buildSfx(fps, shots, look.sfx, M, (props.measured || {}).sfx) : [];
  // 横屏和竖屏「小头像」版式：人从全屏缩成小头像（同一个画面）。其他版式、或关掉了小头像时，用淡入淡出
  const morph = props.handoffStyle !== 'fade' && M.avatar && M.cards && (lay.kind === 'landscape' || lay.kind === 'pip') && !look.avatar.clip;
  const graphics = Math.max(w.pip, w.cutout);
  // 浮卡版式里人一直全屏；上图下人版式里人在下半屏
  const talkOpacity = lay.kind === 'float' ? Math.max(w.full, w.pip) : w.full;
  const stageOpacity = lay.kind === 'float' ? w.cutout : graphics;
  const sub = lay.portrait ? props.subtitle.portrait : props.subtitle;
  // 上图下人：讲图卡时字幕挪到上下两半的交界处，不压住脸
  const subBottom = lay.kind === 'split' ? interpolate(w.pip, [0, 1], [sub.bottom, height - lay.band - 50]) : sub.bottom;
  const fit = {width: '100%', height: '100%', objectFit: 'cover', objectPosition: layout.full.objectPosition};
  const fitBand = {...fit, objectPosition: layout.band ? layout.band.objectPosition : fit.objectPosition};
  const live = (s) => f >= s.from * fps - 1 && f < s.to * fps + 1;
  const musicVol = (fr) => {
    const fade = Math.min(1, fr / fps, (durationInFrames - fr) / fps);
    return music.volume * fade * (music.duck + (1 - music.duck) * graphics);
  };
  return (
    <Ctx.Provider value={L}>
      <AbsoluteFill style={{background: look.p.bg}}>
        {!morph && <AbsoluteFill style={{opacity: talkOpacity}}><OffthreadVideo src={staticFile(talk)} style={fit} /></AbsoluteFill>}
        <AbsoluteFill style={{opacity: stageOpacity}}><Stage /></AbsoluteFill>
        {lay.kind === 'split' && (
          <div style={{position: 'absolute', left: 0, right: 0, top: lay.band, bottom: 0, overflow: 'hidden', opacity: w.pip, borderTop: `6px solid ${look.p.accent}`}}>
            <OffthreadVideo src={staticFile(talk)} muted style={fitBand} />
          </div>
        )}
        {lay.kind === 'float' && (
          <div style={{position: 'absolute', left: 40, right: 40, top: lay.zone.top - 20, height: lay.zone.height + 40, borderRadius: 36, opacity: w.pip,
            background: `${look.p.bg}F7`, boxShadow: '0 30px 80px rgba(0,0,0,.28)'}} />
        )}
        {/* 原位抠像：位置大小与原片完全一致 */}
        <AbsoluteFill style={{opacity: w.cutout}}>
          {matte ? <OffthreadVideo src={staticFile(matte)} transparent muted style={fit} /> : <OffthreadVideo src={staticFile(talk)} muted style={fit} />}
        </AbsoluteFill>
        {shots.filter((s) => s.card && CARDS[s.card.type] && live(s)).map((s) => { const C = CARDS[s.card.type]; return <C key={s.from} s={s} />; })}
        {morph && <Presenter m={w.pip / Math.max(1e-6, w.pip + w.full)} opacity={Math.min(1, w.pip + w.full)} talk={talk} avatar={avatar} />}
        {M.overlays && shots.filter((s) => s.overlay && live(s)).map((s) => <Overlay key={s.from} s={s} corner={avatar.corner} />)}
        {!morph && M.avatar && (lay.kind === 'landscape' || lay.kind === 'pip') && <Avatar opacity={w.pip} talk={talk} avatar={avatar} />}
        {M.subtitles && <Subtitle subs={props.subs} size={sub.size} bottom={subBottom} />}
        {label && (
          <div style={{position: 'absolute', top: 34, left: '50%', transform: 'translateX(-50%)', padding: '10px 26px', borderRadius: 12, background: 'rgba(10,10,14,.82)',
            color: '#fff', fontFamily: '"Noto Sans SC"', fontWeight: 700, fontSize: 30, whiteSpace: 'nowrap'}}>{label}</div>
        )}
        {sfx.map((s, i) => (
          <Sequence key={i} from={s.at} durationInFrames={Math.round(fps * s.len)} layout="none">
            <Audio src={staticFile(`sfx/${s.src}`)} volume={(fr) => s.v * interpolate(fr, [fps * (s.len - 0.12), fps * s.len], [1, 0], CLAMP)} />
          </Sequence>
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

export const Parts = ({looks, names, talk, crop, source, shapes, sample}) => {
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
        const look = L.subtitle === 'band' ? {...SUB_LOOKS.band, background: 'rgba(8,10,16,.86)', padding: '4px 18px'} : SUB_LOOKS[L.subtitle] || SUB_LOOKS.stroke;
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
          const vh = A.h / crop.scale, vw = vh * (source ? source.width / source.height : 16 / 9);
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

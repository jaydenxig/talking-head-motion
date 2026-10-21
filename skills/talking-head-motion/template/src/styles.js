// 风格库。一套风格 = 几个可以单独替换的「零件」：
//   palette 配色 · bg 背景 · font 字体 · card 卡片外观 · avatar 头像形状 · motion 动效 · sfx 音效包 · subtitle 字幕样式
// 用户可以整套选，也可以混搭：颜色要 A、字体要 B、头像要 C（见 config.js 的 style）。

export const FONTS = {
  sans: {name: '黑体（思源黑体）', title: '"Noto Sans SC"', titleWeight: 900, body: '"Noto Sans SC"', sub: '"Noto Sans SC"', subWeight: 900},
  serif: {name: '宋体（思源宋体）', title: '"Noto Serif SC"', titleWeight: 900, body: '"Noto Sans SC"', sub: '"Noto Serif SC"', subWeight: 900},
  kuaile: {name: '圆润可爱（站酷快乐体）', title: '"ZCOOL KuaiLe"', titleWeight: 400, body: '"Noto Sans SC"', sub: '"ZCOOL KuaiLe"', subWeight: 400},
  brush: {name: '毛笔（马善政楷书）', title: '"Ma Shan Zheng"', titleWeight: 400, body: '"Noto Sans SC"', sub: '"Ma Shan Zheng"', subWeight: 400},
  xiaowei: {name: '文艺（站酷小薇）', title: '"ZCOOL XiaoWei"', titleWeight: 400, body: '"Noto Sans SC"', sub: '"Noto Sans SC"', subWeight: 700},
  qingke: {name: '方正粗标题（站酷庆科黄油体）', title: '"ZCOOL QingKe HuangYou"', titleWeight: 400, body: '"Noto Sans SC"', sub: '"ZCOOL QingKe HuangYou"', subWeight: 400},
};
export const MONO = '"JetBrains Mono", ui-monospace, Menlo, monospace';

export const AVATARS = {
  circle: {name: '圆形', w: 200, h: 200, radius: '50%'},
  rounded: {name: '圆角方形', w: 200, h: 200, radius: 36},
  portrait: {name: '竖长方形', w: 180, h: 240, radius: 22},
  blob: {name: '不规则圆', w: 210, h: 200, radius: '58% 42% 47% 53% / 52% 46% 54% 48%'},
  hex: {name: '六边形', w: 210, h: 210, clip: 'polygon(25% 4%, 75% 4%, 100% 50%, 75% 96%, 25% 96%, 0% 50%)'},
};

// 进场动作：p 从 0 到 1
export const MOTIONS = {
  spring: {name: '弹出（轻微回弹）', spring: {damping: 15, stiffness: 170}, enter: (p) => `translateY(${(1 - p) * 40}px) scale(${0.92 + 0.08 * p})`},
  smooth: {name: '平滑上浮（无回弹）', spring: {damping: 200, stiffness: 90}, enter: (p) => `translateY(${(1 - p) * 30}px)`},
  bouncy: {name: '俏皮弹跳（带一点旋转）', spring: {damping: 9, stiffness: 200}, enter: (p) => `translateY(${(1 - p) * 60}px) rotate(${(1 - p) * -6}deg) scale(${0.85 + 0.15 * p})`},
  snap: {name: '利落滑入（从左侧）', spring: {damping: 22, stiffness: 260}, enter: (p) => `translateX(${(1 - p) * -80}px)`},
};

// 音效包：同一种动作永远配同一个声音。文件见 tools/fetch-sfx.sh
export const SFX_PACKS = {
  crisp: {name: '清脆 UI', enterGraphics: 'whoosh-short.mp3', cardAppear: 'pop.mp3', item: 'click-soft.mp3', highlight: 'click.mp3', payoff: 'ping.mp3', overlay: 'pop.mp3'},
  soft: {name: '柔和温暖', enterGraphics: 'whoosh-short.mp3', cardAppear: 'click-soft.mp3', item: 'click-soft.mp3', highlight: 'sparkle.mp3', payoff: 'chime.mp3', overlay: 'click-soft.mp3'},
  tech: {name: '科技电子', enterGraphics: 'glitch-3.mp3', cardAppear: 'key-press.mp3', item: 'key-press.mp3', highlight: 'click.mp3', payoff: 'notification.mp3', overlay: 'key-press.mp3'},
  none: {name: '不要音效'},
};

export const CARDS = {
  clean: '白卡', glass: '半透明玻璃', terminal: '发光描边', soft: '大圆角柔和', paper: '纸片加胶带',
  sticker: '粗描边贴纸', editorial: '杂志顶线', chalk: '粉笔虚线', note: '侧边色条',
};

export const SUBTITLES = {
  stroke: {name: '白字描边'},
  box: {name: '色块底'},
  shadow: {name: '白字投影'},
};

// 内容类型。AI 听完口播后先判断属于哪一类，再出这一类的 3 套风格（可以再加 1 套别的类当对照）。
export const CATEGORIES = {
  tech: '科技 / AI / 数码',
  life: '生活 / vlog / 个人成长',
  family: '家庭 / 亲子 / 宠物',
  knowledge: '知识 / 教育 / 读书',
  business: '商业 / 财经 / 职场',
  travel: '美食 / 旅行 / 户外',
};

// 每套风格：p 是配色。dark=true 表示深色底。
export const STYLES = {
  'tech-1': {name: '白底蓝光', category: 'tech', bg: 'grid', font: 'sans', card: 'clean', avatar: 'circle', motion: 'spring', sfx: 'crisp', subtitle: 'stroke',
    p: {bg: '#F3F5F9', line: 'rgba(30,60,120,.06)', glowA: 'rgba(77,140,255,.28)', glowB: 'rgba(80,200,230,.20)', ink: '#14181F', sub: '#5A6475', accent: '#2F6BFF', accent2: '#16B5E8', card: '#FFFFFF', keyword: '#4DB5FF'}},
  'tech-2': {name: '暗夜霓虹', category: 'tech', bg: 'darkgrid', font: 'qingke', card: 'glass', avatar: 'rounded', motion: 'snap', sfx: 'tech', subtitle: 'stroke',
    p: {dark: true, bg: '#0B0D17', line: 'rgba(120,140,255,.10)', glowA: 'rgba(140,80,255,.40)', glowB: 'rgba(0,220,255,.30)', ink: '#F2F4FF', sub: '#9AA3C7', accent: '#8B5CFF', accent2: '#00E0FF', card: 'rgba(255,255,255,.06)', keyword: '#00E0FF'}},
  'tech-3': {name: '终端极客', category: 'tech', bg: 'scan', font: 'sans', card: 'terminal', avatar: 'hex', motion: 'snap', sfx: 'tech', subtitle: 'box',
    p: {dark: true, bg: '#0A0F0C', line: 'rgba(80,255,150,.06)', glowA: 'rgba(40,255,140,.18)', glowB: 'rgba(40,255,140,.10)', ink: '#D9FFE8', sub: '#6FAF8A', accent: '#2BFF88', accent2: '#B6FF3B', card: '#0F1A14', keyword: '#2BFF88'}},

  'life-1': {name: '薄荷小清新', category: 'life', bg: 'blobs', font: 'xiaowei', card: 'soft', avatar: 'circle', motion: 'smooth', sfx: 'soft', subtitle: 'shadow',
    p: {bg: '#F2FAF6', line: 'rgba(0,0,0,0)', glowA: 'rgba(120,220,190,.45)', glowB: 'rgba(255,210,170,.40)', ink: '#24423A', sub: '#6B8A80', accent: '#2FB38A', accent2: '#7FD8BE', card: '#FFFFFF', keyword: '#7FE0C2'}},
  'life-2': {name: '暖阳胶片', category: 'life', bg: 'paper', font: 'serif', card: 'paper', avatar: 'portrait', motion: 'smooth', sfx: 'soft', subtitle: 'shadow',
    p: {bg: '#F3EADB', line: 'rgba(120,90,60,.10)', glowA: 'rgba(255,190,120,.35)', glowB: 'rgba(230,150,110,.25)', ink: '#3A2A1E', sub: '#8A7260', accent: '#D9693A', accent2: '#E9A15B', card: '#FFFBF3', keyword: '#FFB37A'}},
  'life-3': {name: '手账贴纸', category: 'life', bg: 'dots', font: 'kuaile', card: 'sticker', avatar: 'blob', motion: 'bouncy', sfx: 'crisp', subtitle: 'box',
    p: {bg: '#FFF8E6', line: 'rgba(60,40,0,.10)', glowA: 'rgba(255,200,80,.25)', glowB: 'rgba(255,140,170,.20)', ink: '#2A2320', sub: '#7A6A5E', accent: '#FF6B8B', accent2: '#FFC23D', card: '#FFFFFF', keyword: '#FFC23D'}},

  'family-1': {name: '奶油童趣', category: 'family', bg: 'blobs', font: 'kuaile', card: 'sticker', avatar: 'blob', motion: 'bouncy', sfx: 'soft', subtitle: 'box',
    p: {bg: '#FFF3EE', line: 'rgba(0,0,0,0)', glowA: 'rgba(255,170,190,.45)', glowB: 'rgba(170,210,255,.40)', ink: '#4A2E35', sub: '#9A7880', accent: '#FF7FA3', accent2: '#7FB8FF', card: '#FFFFFF', keyword: '#FFB0C8'}},
  'family-2': {name: '温馨暖橙', category: 'family', bg: 'paper', font: 'xiaowei', card: 'soft', avatar: 'circle', motion: 'smooth', sfx: 'soft', subtitle: 'shadow',
    p: {bg: '#FFF1E2', line: 'rgba(160,90,30,.08)', glowA: 'rgba(255,170,90,.40)', glowB: 'rgba(255,220,150,.40)', ink: '#4A2A12', sub: '#9A6A45', accent: '#F07F2E', accent2: '#FFB547', card: '#FFFFFF', keyword: '#FFB547'}},
  'family-3': {name: '森林绿意', category: 'family', bg: 'blobs', font: 'sans', card: 'soft', avatar: 'rounded', motion: 'spring', sfx: 'soft', subtitle: 'stroke',
    p: {bg: '#EEF3EA', line: 'rgba(0,0,0,0)', glowA: 'rgba(140,190,120,.40)', glowB: 'rgba(230,220,160,.40)', ink: '#22331F', sub: '#6A7E62', accent: '#4F8A3A', accent2: '#A3C46A', card: '#FFFFFF', keyword: '#B8E08A'}},

  'knowledge-1': {name: '白底杂志', category: 'knowledge', bg: 'plain', font: 'serif', card: 'editorial', avatar: 'portrait', motion: 'smooth', sfx: 'crisp', subtitle: 'stroke',
    p: {bg: '#F4F3EF', line: 'rgba(0,0,0,.05)', glowA: 'rgba(0,0,0,0)', glowB: 'rgba(0,0,0,0)', ink: '#111111', sub: '#666666', accent: '#E8432D', accent2: '#111111', card: '#FFFFFF', keyword: '#FF7A66'}},
  'knowledge-2': {name: '黑板粉笔', category: 'knowledge', bg: 'chalk', font: 'brush', card: 'chalk', avatar: 'circle', motion: 'smooth', sfx: 'soft', subtitle: 'shadow',
    p: {dark: true, bg: '#1F3A30', line: 'rgba(255,255,255,.04)', glowA: 'rgba(255,255,255,.06)', glowB: 'rgba(255,255,255,.04)', ink: '#F4F1E6', sub: '#B9C4B6', accent: '#FFD866', accent2: '#8FD3FF', card: 'rgba(255,255,255,.04)', keyword: '#FFD866'}},
  'knowledge-3': {name: '学霸笔记', category: 'knowledge', bg: 'lined', font: 'sans', card: 'note', avatar: 'rounded', motion: 'spring', sfx: 'crisp', subtitle: 'stroke',
    p: {bg: '#FBFAF5', line: 'rgba(60,110,200,.12)', glowA: 'rgba(0,0,0,0)', glowB: 'rgba(0,0,0,0)', ink: '#1C2333', sub: '#6A7385', accent: '#3366FF', accent2: '#FFB020', card: '#FFFFFF', keyword: '#FFD24D'}},

  'business-1': {name: '深海金', category: 'business', bg: 'darkglow', font: 'serif', card: 'glass', avatar: 'circle', motion: 'smooth', sfx: 'crisp', subtitle: 'stroke',
    p: {dark: true, bg: '#0B1526', line: 'rgba(212,175,95,.06)', glowA: 'rgba(212,175,95,.22)', glowB: 'rgba(60,110,200,.30)', ink: '#F5F0E4', sub: '#A9B2C3', accent: '#D4AF5F', accent2: '#F2D58C', card: 'rgba(255,255,255,.05)', keyword: '#F2D58C'}},
  'business-2': {name: '商务极简', category: 'business', bg: 'plain', font: 'sans', card: 'editorial', avatar: 'rounded', motion: 'snap', sfx: 'crisp', subtitle: 'box',
    p: {bg: '#FFFFFF', line: 'rgba(0,0,0,.04)', glowA: 'rgba(0,0,0,0)', glowB: 'rgba(0,0,0,0)', ink: '#0A0A0A', sub: '#6B6B6B', accent: '#0A0A0A', accent2: '#2E6BFF', card: '#F5F5F5', keyword: '#FFD400'}},
  'business-3': {name: '行情红绿', category: 'business', bg: 'darkgrid', font: 'sans', card: 'terminal', avatar: 'circle', motion: 'spring', sfx: 'tech', subtitle: 'stroke',
    p: {dark: true, bg: '#111317', line: 'rgba(255,255,255,.05)', glowA: 'rgba(255,70,70,.18)', glowB: 'rgba(30,200,120,.18)', ink: '#F1F3F6', sub: '#8C93A0', accent: '#FF4D4F', accent2: '#1FCB7A', card: '#191C22', keyword: '#FF6B6B'}},

  'travel-1': {name: '落日橘', category: 'travel', bg: 'sunset', font: 'xiaowei', card: 'glass', avatar: 'circle', motion: 'smooth', sfx: 'soft', subtitle: 'shadow',
    p: {dark: true, bg: '#2A1430', line: 'rgba(255,255,255,0)', glowA: 'rgba(255,140,60,.55)', glowB: 'rgba(255,80,120,.40)', ink: '#FFF4EA', sub: '#F2C9B0', accent: '#FF9A3C', accent2: '#FF5E7E', card: 'rgba(255,255,255,.10)', keyword: '#FFC27A'}},
  'travel-2': {name: '海岸蓝', category: 'travel', bg: 'blobs', font: 'xiaowei', card: 'soft', avatar: 'portrait', motion: 'smooth', sfx: 'soft', subtitle: 'shadow',
    p: {bg: '#EEF7FA', line: 'rgba(0,0,0,0)', glowA: 'rgba(90,190,230,.45)', glowB: 'rgba(255,230,170,.40)', ink: '#123040', sub: '#5D7F8E', accent: '#1E9BD7', accent2: '#5FD0C5', card: '#FFFFFF', keyword: '#8FE3FF'}},
  'travel-3': {name: '山野墨绿', category: 'travel', bg: 'paper', font: 'brush', card: 'paper', avatar: 'blob', motion: 'smooth', sfx: 'soft', subtitle: 'stroke',
    p: {bg: '#E9E6DA', line: 'rgba(40,60,40,.08)', glowA: 'rgba(80,120,80,.25)', glowB: 'rgba(200,170,110,.25)', ink: '#1F2B20', sub: '#5E6B5A', accent: '#2F5D3A', accent2: '#C08A3E', card: '#F8F6EE', keyword: '#E8C27A'}},
};

// 把 config.style 解析成一套完整的样子。
// style 可以是字符串 'life-1'，也可以是混搭对象：{base: 'life-1', palette: 'tech-1', font: 'kuaile', avatar: 'hex'}
// 混搭时每一项既可以写风格编号（取那套风格的这一项），也可以直接写零件名。
export const resolveStyle = (style) => {
  const s = typeof style === 'string' ? {base: style} : style;
  const base = STYLES[s.base];
  if (!base) throw new Error(`未知风格 ${s.base}，可选：${Object.keys(STYLES).join(', ')}`);
  const pick = (key) => {
    const v = s[key];
    if (v === undefined) return base[key];
    return STYLES[v] ? STYLES[v][key] : v;
  };
  const p = s.palette ? (STYLES[s.palette] ? STYLES[s.palette].p : s.palette) : base.p;
  // 背景跟着配色走（深色配色配深色背景），除非单独指定
  const bg = s.bg ? pick('bg') : (s.palette && STYLES[s.palette] ? STYLES[s.palette].bg : base.bg);
  const font = FONTS[pick('font')];
  return {
    name: base.name, p, bg, card: pick('card'),
    font: {...font, title: `${font.title}, "Noto Sans SC", sans-serif`, body: `${font.body}, "PingFang SC", sans-serif`, sub: `${font.sub}, "Noto Sans SC", sans-serif`},
    avatar: AVATARS[pick('avatar')], motion: MOTIONS[pick('motion')], sfx: SFX_PACKS[pick('sfx')], subtitle: pick('subtitle'),
  };
};

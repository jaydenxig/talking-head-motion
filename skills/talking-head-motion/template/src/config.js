// 全片设置：换风格、开关模块、换头像位置都只改这里。
export const CONFIG = {
  fps: 30,

  // 画面方向：'landscape' 横屏 1920×1080，'portrait' 竖屏 1080×1920
  orientation: 'landscape',
  // 竖屏版式（只在竖屏时有用）：
  //   split  上图下人：讲图卡时上半屏放卡片，下半屏放人
  //   float  人全屏 + 浮卡：人一直全屏，卡片浮在胸前
  //   pip    小头像 + 满屏图卡：和横屏一样，人缩成角落小窗
  portraitLayout: 'split',

  // 口播素材（放在 public/ 下）。matte 是抠像结果（带透明通道的 webm），没有就设为 null，cutout 状态会退回全屏口播。
  talk: 'talk.mp4',
  matte: null,
  // 口播原片的尺寸。横屏原片放进竖屏时会裁出中间一条，x 是保留哪一块（人脸中心的横向位置，0.5 = 正中）。
  source: {width: 1920, height: 1080, x: 0.5},

  // 这次要做哪些部分（第 0 步用户打勾的结果）。关掉的部分不渲染，也不用为它写分镜。
  modules: {
    cards: true,      // 图卡（关掉后 pip / cutout 都按全屏口播处理）
    overlays: true,   // 全屏口播上的章节卡、便签、小标签
    avatar: true,     // 图卡段落的小头像
    subtitles: true,  // 烧录字幕
    sfx: true,        // 音效
    music: false,     // 配乐（需要 public/ 下有 music.file）
  },

  // 风格：写一个风格编号（见 styles.js），或者混搭：
  // style: {base: 'life-1', palette: 'tech-1', font: 'kuaile', avatar: 'oval'}
  style: 'tech-1',

  // 小头像：corner 可选 'top-left' | 'top-right'。形状由风格里的 avatar 决定，也可以在 style 里单独换。
  // crop 控制框里取口播画面的哪一块：scale 是框高占原画面高度的比例，x/y 是人脸中心在原画面里的比例位置。
  avatar: {corner: 'top-right', margin: 56, crop: {scale: 0.42, x: 0.5, y: 0.36}},

  // 字幕。竖屏用 portrait 这组：底部约 20% 会被平台的标题和简介挡住，所以要抬高。
  subtitle: {size: 54, bottom: 64, portrait: {size: 58, bottom: 470}},

  // 配乐：只在图卡段落进来，回到口播压低；首尾各 1 秒淡入淡出。
  music: {file: 'music.mp3', volume: 0.12, duck: 0.35},

  // 状态之间的交接：0.3 秒淡入淡出。
  handoff: 0.3,

  // 内容全部出现后最多再停多久（秒），由 tools/check-pacing.mjs 检查。
  maxHold: 1.0,
};

// 画布尺寸由方向决定
export const sizeOf = (orientation) => (orientation === 'portrait' ? {width: 1080, height: 1920} : {width: 1920, height: 1080});

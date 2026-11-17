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

  // 从原始素材剪出口播（npm run raw → 挑句子 → npm run cut）。口播已经剪好了就不用管这一段，直接放到 public/。
  cut: {
    clips: 'auto',    // raw/ 下没剪过的口播。'auto' = 全部用，按文件名排序；想指定先后就写 ['前半.mov', '后半.mov']
    audio: 'auto',    // 另外录的声音（也放 raw/）。'auto' = 有就用，按波形自动对齐；null = 不用，用素材自己的声音；也可以写文件名
    pause: 'tight',   // 句子之间留多长的气口：'tight' 约 0.35 秒 ／ 'loose' 约 0.8 秒 ／ 'keep' 原样（超过 1.5 秒的收到 0.8 秒）
    speed: 1,         // 整体加速（1 = 不加速；1.1、1.2 这样写）。音调不变。要不要加速先问用户
    loudness: -14,    // 人声响度（LUFS）
  },

  // 口播素材（放在 public/ 下）。matte 是抠像结果（带透明通道的 webm），没有就设为 null，cutout 状态会退回全屏口播。
  talk: 'talk.mp4',
  matte: null,
  // 口播原片的尺寸，以及横竖互转时保留哪一块。'auto' = 用 npm run measure 量出来的（原片尺寸 + 人脸位置），一般不用改。
  // 想手填：{width: 1920, height: 1080, x: 0.5}，x 是人脸中心的横向位置（0.5 = 正中）。
  source: 'auto',

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
  // crop 控制框里取口播画面的哪一块。'auto' = 按量出来的人脸位置取（头占框的一半、露出肩膀），一般不用改。
  // 想手填：{scale: 0.42, x: 0.5, y: 0.36}，scale 是框高占原画面高度的比例，x/y 是框的中心在原画面里的比例位置。
  avatar: {corner: 'top-right', margin: 56, crop: 'auto'},

  // 字幕。竖屏用 portrait 这组：底部约 20% 会被平台的标题和简介挡住，所以要抬高。
  subtitle: {size: 54, bottom: 64, portrait: {size: 58, bottom: 470}},

  // 配乐：只在图卡段落进来，回到口播压低；首尾各 1 秒淡入淡出。
  music: {file: 'music.mp3', volume: 0.12, duck: 0.35},

  // 全屏口播和图卡段落之间怎么交接，用多久（秒）。
  //   'shrink' 人从全屏缩成角上的小头像（同一个画面缩过去，更连贯；横屏和竖屏「小头像」版式有效）
  //   'fade'   两层画面淡入淡出
  handoffStyle: 'shrink',
  handoff: 0.4,

  // 图卡慢推：图卡出全后整张卡极慢地放大一点（0.03 = 3%），画面不会像卡住。不要就写 0。
  drift: 0.03,

  // 内容全部出现后最多再停多久（秒），由 npm run check 检查。
  maxHold: 1.0,

  // 露脸的上限（秒），超了 npm run check 会提醒：
  //   maxFull    连续只有人在说话、画面上没有别的东西，最多多久
  //   maxHidden  连续完全看不到人，最多多久
  limits: {maxFull: 10, maxHidden: 15},
};

// 画布尺寸由方向决定
export const sizeOf = (orientation) => (orientation === 'portrait' ? {width: 1080, height: 1920} : {width: 1920, height: 1080});

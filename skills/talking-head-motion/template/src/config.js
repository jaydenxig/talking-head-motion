// 全片设置：换风格、开关模块、换头像位置都只改这里。
export const CONFIG = {
  fps: 30,
  width: 1920,
  height: 1080,

  // 口播素材（放在 public/ 下）。matte 是抠像结果（带透明通道的 webm），没有就设为 null，cutout 状态会退回全屏口播。
  talk: 'talk.mp4',
  matte: null,

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

  subtitle: {size: 54, bottom: 64},

  // 配乐：只在图卡段落进来，回到口播压低；首尾各 1 秒淡入淡出。
  music: {file: 'music.mp3', volume: 0.12, duck: 0.35},

  // 状态之间的交接：0.3 秒淡入淡出。
  handoff: 0.3,

  // 内容全部出现后最多再停多久（秒），由 tools/check-pacing.mjs 检查。
  maxHold: 1.0,
};

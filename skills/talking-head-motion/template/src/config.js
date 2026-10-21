// 全片设置：换风格、换头像位置都只改这里。
export const CONFIG = {
  fps: 30,
  width: 1920,
  height: 1080,

  // 口播素材（放在 public/ 下）。matte 是抠像结果（带透明通道的 webm），没有就设为 null，cutout 状态会退回全屏口播。
  talk: 'talk.mp4',
  matte: null,

  // 小圆头像：corner 可选 'top-left' | 'top-right'。
  // crop 控制圆框里取口播画面的哪一块：scale 是放大倍数，x/y 是人脸中心在原画面里的比例位置。
  avatar: {corner: 'top-right', size: 200, margin: 56, crop: {scale: 0.42, x: 0.5, y: 0.36}},

  // 风格：默认「白底蓝光」。换一套皮只需要改这几个值。
  theme: {
    bg: '#F3F5F9',
    grid: 'rgba(30,60,120,.06)',
    glowA: 'rgba(77,140,255,.28)',
    glowB: 'rgba(80,200,230,.20)',
    ink: '#14181F',
    sub: '#5A6475',
    accent: '#2F6BFF',
    accent2: '#16B5E8',
    card: '#FFFFFF',
    shadow: '0 30px 80px rgba(30,60,120,.16)',
    font: '"Noto Sans SC", "PingFang SC", sans-serif',
    mono: '"JetBrains Mono", ui-monospace, Menlo, monospace',
  },

  // 字幕：底部白色粗字 + 深色细描边，关键词用主题蓝。
  subtitle: {size: 54, bottom: 64, stroke: 7, keyword: '#4DB5FF'},

  // 状态之间的交接：0.3 秒淡入淡出。
  handoff: 0.3,

  // 内容全部出现后最多再停多久（秒），由 tools/check-pacing.mjs 检查。
  maxHold: 1.0,
};

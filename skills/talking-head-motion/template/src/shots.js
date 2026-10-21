// 分镜表：每期只改这里。时间单位为秒（成片时间，剪掉气口、按用户选择变速之后的）。
//
// state：
//   full   全屏口播
//   pip    图卡 + 小圆头像（位置见 config.js 的 avatar.corner）
//   cutout 原位抠像 + 图卡（人站在白底网格前）
//
// card.type：
//   cards3  三张编号小卡依次出现（讲「三个点」时用）
//   window  Mac 窗口；img 放截图（public/ 下），或用 lines 画几条消息；highlight 圈重点，zoom 放大重点
//   list    清单逐行出现
//   stat    数字滚动到目标值
//   pill    一句结论胶囊（常跟在 window 下面）
//   quote   引用卡
//
// overlay（叠在全屏口播上）：chapter 章节卡、note 便签、tag 左上/右上的小标签
export const SHOTS = [
  {from: 0, to: 3.2, state: 'full',
    overlay: {type: 'tag', text: '示例：把口播换成你自己的'}},
  {from: 3.2, to: 6.6, state: 'pip',
    card: {type: 'cards3', kicker: 'DEMO · 3 POINTS', title: '这期讲三件事', items: ['先声后画', '一句一画', '音效同帧']}},
  {from: 6.6, to: 9.0, state: 'full',
    overlay: {type: 'chapter', part: 'PART 01', title: '先声后画'}},
  {from: 9.0, to: 13.4, state: 'pip',
    card: {type: 'window', title: '分镜表 shots.js',
      lines: ['0.0 – 3.2  全屏口播 + 小标签', '3.2 – 6.6  三张小卡', '6.6 – 9.0  章节卡'],
      highlight: 1, pill: '时间轴先定，画面再跟上'}},
  {from: 13.4, to: 16.4, state: 'pip',
    card: {type: 'stat', kicker: 'PACING', title: '每个画面停多久', value: 1, unit: ' 秒', note: '内容出全后最多再停'}},
  {from: 16.4, to: 19.6, state: 'full',
    overlay: {type: 'note', text: '音效只用真实录音'}},
  {from: 19.6, to: 23.0, state: 'pip',
    card: {type: 'list', title: '音效规则', items: ['和动作同帧', '压在人声下面', '同一动作同一声']}},
  {from: 23.0, to: 25.5, state: 'full'},
];

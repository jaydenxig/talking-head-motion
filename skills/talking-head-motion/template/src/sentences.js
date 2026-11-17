// 句子时间轴：每句话一个编号。分镜表（shots.js）按编号指句子，字幕也从这里来。
// 由 npm run timeline 从口播里识别出来（或 npm run cut 剪口播时一起生成）；这份是演示内容。
// 只改 text：改错字、给关键词加 [方括号]（会上色）、给英文词补中文「take over（接管）」。
// 不要改 id / from / to，也不要增删行。句子断得不对，重跑 npm run timeline。
export const DURATION = 25.5;   // 口播总时长（秒）
export const SENTENCES = [
  {id: 'S01', from: 0.0, to: 3.2, text: '这是一条演示用的口播'},
  {id: 'S02', from: 3.2, to: 6.6, text: '这期讲[三件事]'},
  {id: 'S03', from: 6.6, to: 9.0, text: '第一个：[先声后画]'},
  {id: 'S04', from: 9.0, to: 13.4, text: '先把口播剪紧，再按句子排画面'},
  {id: 'S05', from: 13.4, to: 16.4, text: '内容出全后最多再停[一秒]'},
  {id: 'S06', from: 16.4, to: 19.6, text: '音效只用[真实录音]'},
  {id: 'S07', from: 19.6, to: 23.0, text: '要和动作[同帧]，压在人声下面'},
  {id: 'S08', from: 23.0, to: 25.5, text: '下期见'},
];

// 逐词时间（机器生成，别改）。用来把「说到哪个词」换算成秒；没有也能用，按字数估算。
export const WORDS = {};

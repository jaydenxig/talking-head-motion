// 分镜表：每期只改这里。不用写秒数——每一镜写它对应哪几句话（句子编号见 sentences.js），时间由程序算。
// 这份是演示内容，对应 sentences.js 里的 8 句演示口播。
//
// 每一镜：
//   say    这一镜对应的句子：'S03'、'S03-S05' 或 ['S03', 'S04']。每句话都要归到一镜，按说话顺序往下排
//   state  full 全屏口播 ／ pip 图卡 + 小头像 ／ cutout 原位抠像 + 图卡
//   card   pip / cutout 时的图卡；overlay  full 时叠在人像上的小卡片
//   why    放了图卡就写一句：观众第一次看到它能明白什么。写不出来的卡多半该删
//
// 卡片有哪些、每种能填什么：npm run cards
// 卡片里的东西什么时候出现：默认自动对到你说的词上（清单第 2 条 = 你说到第 2 条的时候）；
// 想自己指定就写 at：{text: '音效同帧', at: '同帧'} 表示说到「同帧」时出现。
//
// 填完跑 npm run check，它会用大白话告诉你哪里填错了。
export const SHOTS = [
  {say: 'S01', state: 'full',
    overlay: {type: 'tag', text: '示例：把口播换成你自己的'}},
  {say: 'S02', state: 'pip', why: '一眼知道这期有三部分',
    card: {type: 'cards3', kicker: 'DEMO · 3 POINTS', title: '这期讲三件事', items: ['先声后画', '一句一画', '音效同帧']}},
  {say: 'S03', state: 'full',
    overlay: {type: 'chapter', part: 'PART 01', title: '先声后画'}},
  {say: 'S04', state: 'pip', why: '看到分镜表长什么样：一句话对一个画面',
    card: {type: 'window', title: '分镜表 shots.js',
      lines: ['S01  全屏口播 + 小标签', 'S02  三张小卡', 'S03  章节卡'],
      highlight: 1, highlightAt: '按句子', pill: '先定哪句话，画面再跟上', mock: true}},
  {say: 'S05', state: 'pip', why: '记住这个数：一秒',
    card: {type: 'stat', kicker: 'PACING', title: '每个画面停多久', value: 1, unit: ' 秒', note: '内容出全后最多再停', at: '一秒'}},
  {say: 'S06', state: 'full',
    overlay: {type: 'note', text: '合成音效 = AI 味'}},
  {say: 'S07', state: 'pip', why: '音效的两条规矩，能截图',
    card: {type: 'list', title: '音效规则', items: ['和动作同帧', {text: '比人声小', at: '人声'}]}},
  {say: 'S08', state: 'full'},
];

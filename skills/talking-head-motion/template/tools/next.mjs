// 「下一步」：看看这期做到哪了，只告诉你现在该做的那一件事。
// 不知道该干什么的时候就跑它；做完一步再跑一次。前一步没过关，不会放你去下一步。
//
// 用法：
//   node tools/next.mjs                # npm run next
//   node tools/next.mjs --ok <步骤>    # 需要用户点头的步骤，用户确认后记一笔：takes / modules / text / style / assets / storyboard
//   node tools/next.mjs --undo <步骤>  # 撤销某一步的确认
//   node tools/next.mjs --reset        # 新的一期：清掉所有确认记录
import {spawnSync} from 'node:child_process';
import {existsSync, readFileSync, readdirSync, statSync, writeFileSync, rmSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';
import {runLint} from './lint.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const stateFile = path.join(root, '.progress.json');
const CONFIRM = {takes: '留哪些句子、气口松紧、要不要加速', modules: '要做哪些部分、横屏还是竖屏', text: '字幕文字（错字、关键词）', style: '风格', assets: '素材够不够、缺的怎么办', storyboard: '分镜表'};
const state = existsSync(stateFile) ? JSON.parse(readFileSync(stateFile, 'utf8')) : {ok: {}};
const save = () => writeFileSync(stateFile, JSON.stringify(state, null, 2));
const argOf = (k) => { const i = process.argv.indexOf(`--${k}`); return i > 0 ? process.argv[i + 1] : null; };

if (process.argv.includes('--reset')) { rmSync(stateFile, {force: true}); console.log('已清掉确认记录。'); process.exit(0); }
for (const [flag, val] of [['ok', true], ['undo', false]]) {
  const step = argOf(flag);
  if (!step) continue;
  if (!CONFIRM[step]) { console.error(`没有「${step}」这一步。可以写：${Object.keys(CONFIRM).join(' / ')}`); process.exit(1); }
  if (val) state.ok[step] = new Date().toISOString(); else delete state.ok[step];
  save();
  console.log(val ? `记下了：用户已确认「${CONFIRM[step]}」。\n` : `已撤销「${CONFIRM[step]}」的确认。\n`);
}

const load = async (f) => import(pathToFileURL(path.join(root, f)).href + `?t=${Date.now()}`);
const has = (cmd) => spawnSync(cmd, ['-version'], {stdio: 'ignore'}).status === 0;
const mtime = (f) => (existsSync(path.join(root, f)) ? statSync(path.join(root, f)).mtimeMs : 0);
const read = (f) => (existsSync(path.join(root, f)) ? readFileSync(path.join(root, f), 'utf8') : '');
const {CONFIG} = await load('src/config.js');
const {MEASURED} = await load('src/measured.js');
const talk = path.join(root, 'public', CONFIG.talk);
const sig = existsSync(talk) ? `${statSync(talk).size}-${Math.round(statSync(talk).mtimeMs)}` : '';
const demoSentences = read('src/sentences.js').includes('这份是演示内容');
const demoShots = read('src/shots.js').includes('这份是演示内容');
const sen = await load('src/sentences.js');
const lint = await runLint().catch((e) => ({errors: [{where: '程序', msg: `检查器跑不起来：${e.message}`}], warns: []}));
const M = CONFIG.modules || {};
const landscapeSrc = MEASURED.talk ? MEASURED.talk.width >= MEASURED.talk.height : null;

// 原始素材：raw/ 下有没剪过的口播，就先走「识别 → 挑句子 → 剪」三步；口播已经剪好直接放 public/ 的，跳过这三步
const rawDir = path.join(root, 'raw');
const rawVideos = existsSync(rawDir) ? readdirSync(rawDir).filter((f) => /\.(mp4|mov|m4v|webm|mkv)$/i.test(f)) : [];
const takes = await load('src/takes.js');
const fromRaw = rawVideos.length > 0 || takes.TAKES.length > 0;
const takesFresh = takes.CLIPS.length > 0 && takes.CLIPS.every((c) => { const f = path.join(rawDir, c.file); return existsSync(f) && `${statSync(f).size}-${Math.round(statSync(f).mtimeMs)}` === c.sig; });
const nKeep = takes.TAKES.filter((t) => t.keep).length, nDrop = takes.TAKES.length - nKeep;
const rawSteps = !fromRaw ? [] : [
  {name: '识别原始素材', done: () => takesFresh, todo: () => [
    takes.TAKES.length ? 'raw/ 下的素材换过了，要重新识别。跑：npm run raw -- --force' : '跑：npm run raw（有专有名词就带上：npm run raw -- --vocab "Muse,Claude"）',
    '它把 raw/ 下没剪过的口播逐句识别出来、编上号（R001、R002…），写进 src/takes.js，并先标出疑似「说错重来」的句子。',
    '另外录的声音也放在 raw/ 的话，它会按波形自动对齐，剪的时候替换手机的声音。',
  ]},
  {name: '挑要留的句子', confirm: 'takes', done: () => !!state.ok.takes, todo: () => [
    `通读 src/takes.js（${takes.TAKES.length} 句，程序先标了 ${nDrop} 句不要）。规则见 references/cutting.md，要点：`,
    '  · 带 why 的是程序标的疑似重讲，逐条核对，标错了改回 keep: true',
    '  · 再找程序认不出来的：说到一半停下、换了个说法重来的（前一遍没说完）；和内容无关的话（「好，开始」「再来一遍」）',
    '  · 同样的话说了几遍，留最后完整的那一遍；带 note 的句子看一眼',
    '  · 只改 keep 和 text，不动 id / clip / from / to，不增删行',
    '然后问用户两件事，写进 src/config.js 的 cut：气口留多长（pause：tight 紧 / loose 松 / keep 原样）、要不要加速（speed；npm run raw 的输出里有语速和建议）。',
    '可以先跑 npm run cut -- --dry 看会剪成多长。把「去掉了哪几句」告诉用户，他同意后跑：npm run next -- --ok takes',
  ]},
  {name: '剪口播', done: () => { const c = {pause: 'tight', speed: 1, loudness: -14, ...(CONFIG.cut || {})}; return existsSync(talk) && !!state.cut && state.cut.key === JSON.stringify([c.pause, c.speed, c.loudness]) && mtime('src/takes.js') <= Date.parse(state.cut.at) + 1000; }, todo: () => [
    state.cut ? '剪过之后又改了 src/takes.js 或 config.js 里的 cut 设置，要重新剪。' : null,
    '跑：npm run cut',
    '它按留下来的句子把素材剪成 public/ 下的口播（去掉不要的句子、收紧气口、换声音、加速、统一响度），句子时间轴也一起写好。',
    '剪完看它的验收报告：提示「可能切到字」的地方要听一下。每一段对应原片哪里见 out/剪辑表.md。',
  ]},
];

// 每一步：done = 过关了没有；todo = 没过关时要做什么
const steps = [
  {name: '环境', done: () => has('ffmpeg') && has('ffprobe') && existsSync(path.join(root, 'node_modules/remotion')), todo: () => [
    !existsSync(path.join(root, 'node_modules/remotion')) && '跑：npm install',
    !(has('ffmpeg') && has('ffprobe')) && '装 ffmpeg（macOS：brew install ffmpeg；Windows：winget install ffmpeg）',
  ]},
  ...rawSteps,
  {name: '口播素材', done: () => existsSync(talk), todo: () => [
    '两种放法选一种：',
    '  A. 素材还没剪：把原始口播（和另外录的声音，如果有）放进 raw/，再跑 npm run next，它会带你识别、挑句子、剪。',
    `  B. 口播已经剪好了：直接放到 public/${CONFIG.talk}（文件名要和 config.js 的 talk 一致）。`,
    '还没有素材、只想先试效果：python3 tools/make-placeholder.py public/talk.mp4（竖屏加 --portrait）',
  ]},
  {name: '量一量口播', done: () => MEASURED.talk && MEASURED.talk.sig === sig, todo: () => [
    '跑：npm run measure',
    '它会量出口播是横是竖、多长、脸在哪。头像取哪块、横竖怎么裁都按量出来的算，不用自己估。',
  ]},
  {name: '问用户：做哪些部分、横屏还是竖屏', confirm: 'modules', done: () => !!state.ok.modules, todo: () => [
    '照 SKILL.md「第 0 步」问用户：全部都要还是自己挑；横屏还是竖屏' + (landscapeSrc === null ? '' : `（原片是${landscapeSrc ? '横' : '竖'}着拍的，建议成片也做${landscapeSrc ? '横屏' : '竖屏'}；反过来要放大裁切，容易发虚）`) + '。',
    '把结果写进 src/config.js 的 modules 和 orientation（竖屏还要选 portraitLayout）。',
    '用户选好以后跑：npm run next -- --ok modules',
  ]},
  {name: '音效文件', done: () => !M.sfx || existsSync(path.join(root, 'public/sfx')), todo: () => ['跑：npm run sfx']},
  {name: '句子时间轴', done: () => !demoSentences && MEASURED.talk && Math.abs((sen.DURATION || 0) - MEASURED.talk.duration) < 0.3, todo: () => [
    demoSentences ? '跑：npm run timeline' : '口播换过了，句子要重新识别。跑：npm run timeline -- --force',
    '有专有名词（产品名、人名）就带上，识别更准：npm run timeline -- --vocab "Muse,Claude"',
    '它把口播里的每句话识别出来、编上号（S01、S02…）。后面的分镜表按编号指句子，不用写秒数。',
  ]},
  {name: '对稿：改错字、标关键词', confirm: 'text', done: () => !!state.ok.text, todo: () => [
    '打开 src/sentences.js，只改每一行的 text：',
    '  · 对照用户给的口播稿改掉识别错的字（产品名、人名最容易错）',
    '  · 每句给最多 1–2 个关键词加 [方括号]：核心概念、产品名、数字',
    '  · 英文词后面补中文：take over（接管）',
    '  · 不要改 id / from / to，不要增删行',
    '然后跑 npm run srt，把 out/subtitles.srt 交给用户过一遍错字（字幕烧进画面以后就改不了了）。',
    '用户说没问题了，跑：npm run next -- --ok text',
  ]},
  {name: '选风格', confirm: 'style', done: () => !!state.ok.style, todo: () => [
    '照 SKILL.md「第 1–3 步」：判断内容类型 → 出风格样板（node tools/make-samples.mjs --category <类型>' + (CONFIG.orientation === 'portrait' ? ' --portrait' : '') + '）→ 用户挑选或混搭 → 写进 src/config.js 的 style。',
    '用户以前定过风格卡，就直接照风格卡写 config.js，不用再出样板。',
    '定好以后跑：npm run next -- --ok style',
  ]},
  {name: '对素材：哪些话缺画面', confirm: 'assets', done: () => !!state.ok.assets, todo: () => [
    '跑：npm run needs（出 out/素材清单.md：哪些句子在讲具体操作或具体东西、最好有什么画面）。',
    '对照 public/ 里已有的截图和录屏，把表里「现在有没有」「怎么办」两栏填上。',
    '把表发给用户，问缺的能不能补（截图或录屏放进 public/）。补了就再跑 npm run measure。',
    '补不了的：讲动作的用动作卡演（对话 chat / 流程 flow / 文档 doc，会标「示意」），不要退成文字清单；实在没什么可演的才不配。',
    '用户答复以后跑：npm run next -- --ok assets',
  ]},
  {name: '写分镜表', done: () => !demoShots && lint.errors.length === 0, todo: () => (demoShots ? [
    '照 references/storyboard.md 写 src/shots.js：每一镜写它对应哪几句话（say）、画面状态（state）、放什么卡（card / overlay）。',
    '卡片菜单（有哪些卡、每种填什么、怎么写）：npm run cards',
    '每句话都要归到一镜；不用写秒数。用到了 focus（框重点）就跑一次 npm run measure。',
    '写完跑：npm run check',
  ] : [
    `分镜表还有 ${lint.errors.length} 个错误，前几个：`,
    ...lint.errors.slice(0, 4).map((e) => `  ✗ ${e.where}：${e.msg}`),
    lint.errors.some((e) => /npm run measure/.test(e.msg)) ? '跑 npm run measure（让它去找要框的字），再跑 npm run check 看全部。' : '跑 npm run check 看全部，照提示改。',
  ])},
  {name: '用户确认分镜', confirm: 'storyboard', done: () => !!state.ok.storyboard, todo: () => [
    '跑：npm run storyboard（出 out/分镜表.md）和 npm run stills（出每一镜的静帧和 out/stills/总览.jpg）。',
    '读 out/分镜表.md 末尾「截图里露出来的字」：逐条核对每张截图露出来的是不是这一镜在讲的事。不相干的消息混在里面，就把 crop 收小。',
    lint.warns.length ? `检查器还有 ${lint.warns.length} 条提醒（npm run check 能看到），能改的先改掉，不改的在发给用户时说明原因。` : null,
    '把分镜表和总览图发给用户，让他用大白话说「第几镜换成什么」；按他说的改 src/shots.js，改完重跑 check / storyboard / stills。',
    '用户点头以后跑：npm run next -- --ok storyboard',
  ]},
  {name: '渲染成片', done: () => mtime('out/talk.mp4') > Math.max(mtime('src/shots.js'), mtime('src/sentences.js'), mtime('src/config.js'), mtime('src/measured.js')), todo: () => [
    state.ok.storyboard && mtime('src/shots.js') > Date.parse(state.ok.storyboard) ? '注意：分镜表在用户确认之后又改过。改动大的话先让用户再看一眼。' : null,
    '跑：npm run render（成片在 out/talk.mp4），再跑 npm run srt（字幕文件在 out/subtitles.srt）。',
  ]},
];

let current = -1;
const lines = ['这期的进度：'];
steps.forEach((s, i) => {
  const ok = current < 0 && s.done();
  if (!ok && current < 0) current = i;
  lines.push(` ${ok ? '✓' : current === i ? '→' : ' '} ${String(i + 1).padStart(2)}. ${s.name}`);
});
console.log(lines.join('\n'));
if (current < 0) {
  console.log('\n全部做完了。把 out/talk.mp4 和 out/subtitles.srt 交给用户，说清楚：做了什么、哪里拿不准要他定。');
  console.log('然后照 SKILL.md「每期结束后」，把他这期提的修改记下来。下一期开始前跑 npm run next -- --reset。');
} else {
  console.log(`\n现在该做：${steps[current].name}`);
  steps[current].todo().filter(Boolean).forEach((t) => console.log(`  ${t}`));
  console.log('\n做完再跑一次 npm run next。');
}

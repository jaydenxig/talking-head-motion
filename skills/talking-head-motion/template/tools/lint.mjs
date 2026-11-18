// 检查器：配置、句子、分镜表哪里填错了，用大白话说出来，并告诉你怎么改。
// 「✗」是必须改的错误（不改渲染出来就是错的），「！」是提醒（能渲染，但值得看一眼）。
//
// 用法：
//   node tools/lint.mjs            # npm run check
//   node tools/lint.mjs --cards    # npm run cards：卡片菜单——有哪些卡片、每种能填什么、怎么写
//   node tools/lint.mjs --json     # 给程序读的结果
import {existsSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const load = async (f) => import(pathToFileURL(path.join(root, f)).href + `?t=${Date.now()}`);
const r1 = (v) => Math.round(v * 10) / 10;

const ICONS = ['doc', 'chat', 'ai', 'web', 'person', 'mail', 'clock', 'search', 'phone', 'check'];

// 写错的名字猜一个最像的
const near = (word, list) => {
  const dist = (a, b) => {
    const m = Array.from({length: a.length + 1}, (_, i) => [i, ...new Array(b.length).fill(0)]);
    for (let j = 1; j <= b.length; j++) m[0][j] = j;
    for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++) m[i][j] = Math.min(m[i - 1][j] + 1, m[i][j - 1] + 1, m[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    return m[a.length][b.length];
  };
  const best = list.map((x) => [dist(String(word).toLowerCase(), x.toLowerCase()), x]).sort((a, b) => a[0] - b[0])[0];
  return best && best[0] <= Math.max(2, Math.floor(best[1].length / 3)) ? best[1] : null;
};

export const runLint = async () => {
  const errors = [], warns = [];
  const err = (where, msg) => errors.push({where, msg});
  const warn = (where, msg) => warns.push({where, msg});
  const {CONFIG} = await load('src/config.js');
  const {SHOTS} = await load('src/shots.js');
  const sen = await load('src/sentences.js');
  const {MEASURED} = await load('src/measured.js');
  const {STATES, CARD_TYPES, OVERLAY_TYPES, SHOT_FIELDS} = await load('src/schema.js');
  const {resolveProject, resolveLayout, textWidth} = await load('src/resolve.js');
  const {resolveStyle, STYLES} = await load('src/styles.js');
  const {layoutOf, subtitleTop, mediaFit, overlayPlace, faceBoxOf, picsPlace} = await load('src/layout.js');
  const {sizeOf} = await load('src/resolve.js');
  const SENTENCES = sen.SENTENCES || [], WORDS = sen.WORDS || {}, DURATION = sen.DURATION || 0;
  const pub = (f) => path.join(root, 'public', String(f));
  const files = MEASURED.files || {};
  const M = CONFIG.modules || {};

  // ---------- 配置 ----------
  const pick = (v, list, where, name) => { if (!list.includes(v)) err(where, `${name} 写的是 '${v}'，只能是：${list.join(' / ')}${near(v, list) ? `。是不是想写 '${near(v, list)}'？` : ''}`); };
  pick(CONFIG.orientation, ['landscape', 'portrait'], 'config.js', 'orientation');
  if (CONFIG.orientation === 'portrait') pick(CONFIG.portraitLayout, ['split', 'float', 'pip'], 'config.js', 'portraitLayout');
  const MODS = ['cards', 'overlays', 'avatar', 'subtitles', 'sfx', 'music'];
  Object.keys(M).forEach((k) => { if (!MODS.includes(k)) err('config.js', `modules 里没有「${k}」这一项。能填的有：${MODS.join('、')}`); else if (typeof M[k] !== 'boolean') err('config.js', `modules.${k} 要写 true 或 false`); });
  let look = null;
  try { look = resolveStyle(CONFIG.style); } catch (e) { err('config.js', `style 认不出来：${e.message}`); }
  if (CONFIG.style && typeof CONFIG.style === 'object') Object.entries(CONFIG.style).forEach(([k, v]) => {
    if (!['base', 'palette', 'bg', 'font', 'card', 'avatar', 'motion', 'sfx', 'subtitle'].includes(k)) err('config.js', `style 里没有「${k}」这一项`);
    else if (k !== 'base' && look && typeof v === 'string' && !STYLES[v] && look[k === 'palette' ? 'p' : k] === undefined) err('config.js', `style.${k} 写的 '${v}' 认不出来。写一个风格编号（如 'tech-1'）或零件名（见 src/styles.js）`);
  });
  if (CONFIG.avatar) pick(CONFIG.avatar.corner, ['top-left', 'top-right'], 'config.js', 'avatar.corner');
  if (!existsSync(pub(CONFIG.talk))) err('口播', `找不到 public/${CONFIG.talk}。把口播放进 public/，文件名和 config.js 的 talk 一致`);
  if (CONFIG.matte && !existsSync(pub(CONFIG.matte))) err('config.js', `matte 写的是 '${CONFIG.matte}'，但 public/ 下没有这个文件。还没抠像就写 matte: null`);
  if (M.music && !existsSync(pub(CONFIG.music.file))) err('config.js', `打开了配乐（modules.music），但 public/ 下没有 ${CONFIG.music.file}。先把曲子放进去，或者把 modules.music 关掉`);
  if (M.sfx && look && look.sfx && look.sfx.cardAppear && !existsSync(pub(`sfx/${look.sfx.cardAppear}`))) err('音效', '打开了音效（modules.sfx），但 public/sfx/ 下还没有音效文件。跑 npm run sfx 下载');

  // ---------- 句子 ----------
  if (!Array.isArray(SENTENCES) || !SENTENCES.length) err('sentences.js', '还没有句子。先跑 npm run timeline 识别口播');
  const seen = new Set();
  SENTENCES.forEach((s, i) => {
    const where = s && s.id ? s.id : `sentences.js 第 ${i + 1} 行`;
    if (!s || typeof s.id !== 'string' || !/^S\d+$/.test(s.id)) return err(where, '这一行的 id 不对（应该是 S01、S02 这样）。不要手改 id，句子乱了就重跑 npm run timeline');
    if (seen.has(s.id)) err(where, '这个编号出现了两次。不要增删或复制行，句子乱了就重跑 npm run timeline --force');
    seen.add(s.id);
    if (typeof s.from !== 'number' || typeof s.to !== 'number' || !(s.to > s.from)) err(where, 'from / to 被改坏了（要是数字，而且 to 比 from 大）。重跑 npm run timeline --force');
    const prev = SENTENCES[i - 1];
    if (prev && typeof prev.to === 'number' && s.from < prev.to - 0.011) err(where, `开始时间（${s.from}）比上一句的结束时间（${prev.to}）还早。时间不要手改，重跑 npm run timeline --force`);
    if (typeof s.text !== 'string' || !s.text.trim()) return err(where, 'text 是空的。每句都要有字；这句其实没说话的话，重跑 npm run timeline');
    const open = (s.text.match(/\[/g) || []).length, close = (s.text.match(/\]/g) || []).length;
    if (open !== close || /\[[^\]]*\[/.test(s.text)) err(where, `关键词的方括号没配对：「${s.text}」。写法是 这期讲[三件事]`);
    else if (open > 2) warn(where, `一句里标了 ${open} 个关键词，都上色就等于都不突出。每句最多 1–2 个：「${s.text}」`);
    const w = textWidth(s.text.replace(/（[^）]*）|\([^)]*\)/g, (x) => x));
    const full = [...s.text.replace(/[[\]]/g, '')].reduce((n, ch) => n + (ch.charCodeAt(0) < 256 ? 0.55 : 1), 0);
    if (full > 22) warn(where, `这句字幕有 ${Math.round(full)} 个字宽，一行放不下会折成两行：「${s.text.replace(/[[\]]/g, '')}」。能删的口头语删一删`);
    void w;
  });
  if (DURATION && SENTENCES.length && SENTENCES[SENTENCES.length - 1].to > DURATION + 0.05) err('sentences.js', '最后一句的结束时间超过了口播总时长。重跑 npm run timeline --force');
  if (MEASURED.talk && DURATION && Math.abs(MEASURED.talk.duration - DURATION) > 0.3) err('sentences.js', `句子是按 ${DURATION} 秒的口播识别的，但现在 public/${CONFIG.talk} 是 ${MEASURED.talk.duration} 秒。口播换过了：重跑 npm run timeline --force`);
  if (M.subtitles && SENTENCES.length > 5 && !SENTENCES.some((s) => /\[/.test(s.text || ''))) warn('sentences.js', '还没有给任何关键词加 [方括号]。字幕里的核心概念、产品名、数字加上方括号会上色，如 这期讲[三件事]');

  // ---------- 分镜表：一项一项查填的东西 ----------
  const wOf = (t) => Math.round(textWidth(String(t)) * 10) / 10;
  const checkText = (v, f, where, name) => {
    if (typeof v !== 'string') return err(where, `${name} 要写一段带引号的字，现在写的是 ${JSON.stringify(v)}`);
    if (!v.trim()) return err(where, `${name} 是空的`);
    if (f.max && wOf(v) > f.max * 1.5) err(where, `${name}「${v}」太长了（${wOf(v)} 个字宽，最多 ${f.max}），画面里放不下。改短`);
    else if (f.max && wOf(v) > f.max) warn(where, `${name}「${v}」有点长（${wOf(v)} 个字宽，建议不超过 ${f.max}），可能会折行或挤`);
  };
  const checkAnchor = (v, where, name) => { if (typeof v !== 'string' && typeof v !== 'number') err(where, `${name} 的 at 要写你说的一个词（如 '发送'），或者一个秒数`); };
  const checkRect = (v, where, name, media) => {
    if (!Array.isArray(v) || v.length !== 4 || v.some((n) => typeof n !== 'number' || n < 0) || v[2] <= 0 || v[3] <= 0) return err(where, `${name} 要写成 [x, y, 宽, 高] 四个数字（原图像素）`);
    if (media && (v[0] + v[2] > media.width + 1 || v[1] + v[3] > media.height + 1)) err(where, `${name} [${v.join(', ')}] 超出了图的范围（图是 ${media.width}×${media.height}）`);
  };
  const checkFields = (obj, spec, where, label) => {
    const fields = spec.fields;
    const names = ['type', ...Object.keys(fields)];
    const menu = Object.entries(fields).map(([k, f]) => `${k}（${f.desc}）`).join('、');
    Object.keys(obj).forEach((k) => {
      if (names.includes(k) || k.startsWith('_')) return;
      const guess = near(k, names);
      err(where, `${label}没有「${k}」这一项${guess ? `，是不是想写 ${guess}？` : '。'}能填的有：${menu}`);
    });
    const fileOf = obj.img || obj.src;
    const media = fileOf ? files[fileOf] : null;
    for (const [k, f] of Object.entries(fields)) {
      const v = obj[k];
      const name = `${label}的 ${k}`;
      if (v === undefined || v === null) { if (f.required) err(where, `${label}缺 ${k}（${f.desc}）`); continue; }
      if (f.needs && obj[f.needs] === undefined) err(where, `${name} 要配合 ${f.needs} 用（${fields[f.needs].desc}），这张卡没写 ${f.needs}`);
      if (f.type === 'text') checkText(v, f, where, name);
      else if (f.type === 'number') {
        if (typeof v !== 'number' || !Number.isFinite(v)) err(where, `${name} 要写数字（不带引号），现在写的是 ${JSON.stringify(v)}`);
        else if ((f.min !== undefined && v < f.min) || (f.max !== undefined && v > f.max)) err(where, `${name} 写的是 ${v}，要在 ${f.min ?? '−∞'} 到 ${f.max ?? '∞'} 之间`);
      } else if (f.type === 'bool') { if (typeof v !== 'boolean') err(where, `${name} 要写 true 或 false`); }
      else if (f.type === 'image' || f.type === 'video') {
        const isImg = /\.(png|jpe?g|webp|gif|bmp)$/i.test(v), isVid = /\.(mp4|mov|m4v|webm|mkv)$/i.test(v);
        if (typeof v !== 'string') err(where, `${name} 要写文件名（带引号）`);
        else if (!existsSync(pub(v))) err(where, `${name} 写的是 '${v}'，但 public/ 下没有这个文件。素材里没有的画面不要编；把文件放进 public/，或者换一张卡`);
        else if (f.type === 'image' && !isImg) err(where, `${name} 要的是图片，'${v}' ${isVid ? '是视频：放视频用录屏卡 type: \'screen\'' : '不是图片'}`);
        else if (f.type === 'video' && !isVid) err(where, `${name} 要的是视频，'${v}' ${isImg ? '是图片：放图片用截图卡 type: \'image\'' : '不是视频'}`);
        else if (!files[v]) warn(where, `还没量过 ${v} 的尺寸，排版可能不准。跑 npm run measure`);
      } else if (f.type === 'texts' || f.type === 'items') {
        if (!Array.isArray(v)) { err(where, `${name} 要写成 [ '…', '…' ] 这样的一组`); continue; }
        if ((f.min && v.length < f.min) || (f.max && v.length > f.max)) err(where, `${name} 有 ${v.length} 条，这种卡要 ${f.min}–${f.max} 条${v.length > f.max ? '：太多了放不下，拆成两镜或只留最重要的几条' : ''}`);
        v.forEach((x, i) => {
          const nm = `${name} 第 ${i + 1} 条`;
          if (f.type === 'items' && x && typeof x === 'object') {
            Object.keys(x).forEach((kk) => { if (!['text', 'at', ...(f.icon ? ['icon'] : [])].includes(kk)) err(where, `${nm} 只能写 text 和 at${f.icon ? '、icon' : ''}，多了「${kk}」`); });
            if (x.icon !== undefined && !ICONS.includes(x.icon)) err(where, `${nm} 的 icon 写的是 '${x.icon}'，只能是：${ICONS.join(' / ')}${near(x.icon, ICONS) ? `。是不是想写 '${near(x.icon, ICONS)}'？` : ''}`);
            checkText(x.text, {max: f.each}, where, nm);
            if (x.at !== undefined) checkAnchor(x.at, where, nm);
          } else checkText(x, {max: f.each}, where, nm);
        });
      } else if (f.type === 'messages') {
        if (!Array.isArray(v)) { err(where, `${name} 要写成 [{from: 'me', text: '…'}, {from: 'ai', text: '…'}] 这样的一组`); continue; }
        if (v.length < f.min || v.length > f.max) err(where, `${name} 有 ${v.length} 条，要 ${f.min}–${f.max} 条${v.length > f.max ? '：太多了放不下，拆成两镜' : ''}`);
        v.forEach((x, i) => {
          const nm = `${name} 第 ${i + 1} 条`;
          if (!x || typeof x !== 'object') return err(where, `${nm} 要写成 {from: 'me' 或 'ai', text: '一句话'}，或发文件 {from: 'me', file: '文件名.pdf'}`);
          Object.keys(x).forEach((kk) => { if (!['from', 'text', 'file', 'at'].includes(kk)) err(where, `${nm} 只能写 from / text / file / at，多了「${kk}」`); });
          if (!['me', 'ai'].includes(x.from)) err(where, `${nm} 的 from 要写 'me'（你发的）或 'ai'（对方回的）`);
          if ((x.text === undefined) === (x.file === undefined)) err(where, `${nm} 要么写 text（一句话），要么写 file（发一个文件），二选一`);
          if (x.text !== undefined) checkText(x.text, {max: f.each}, where, nm);
          if (x.file !== undefined) checkText(x.file, {max: 16}, where, `${nm} 的文件名`);
          if (x.at !== undefined) checkAnchor(x.at, where, nm);
        });
      } else if (f.type === 'anchor') { if (typeof v !== 'string' && typeof v !== 'number') err(where, `${name} 要写你在这一镜里说的一个词（如 '发送'），或者一个秒数`); }
      else if (f.type === 'timed') {
        if (v && typeof v === 'object') { checkText(v.text, f, where, name); if (v.at !== undefined) checkAnchor(v.at, where, name); } else checkText(v, f, where, name);
      } else if (f.type === 'rect') checkRect(v, where, name, media);
      else if (f.type === 'piclist') {
        if (!Array.isArray(v) || !v.length) { err(where, `${name} 要写成 ['a.jpg', 'b.jpg'] 这样的一组截图文件名`); continue; }
        if (v.length > f.max) err(where, `${name} 有 ${v.length} 张，最多 ${f.max} 张并排，再多就看不清了`);
        v.forEach((x, i) => {
          const img = typeof x === 'string' ? x : x && x.img;
          if (typeof img !== 'string') return err(where, `${name} 第 ${i + 1} 张要写文件名，或 {img: '文件名', crop: [x, y, 宽, 高]}`);
          if (!existsSync(pub(img))) err(where, `${name} 第 ${i + 1} 张「${img}」在 public/ 下没有这个文件`);
          else if (!files[img]) warn(where, `还没量过 ${img} 的尺寸，跑 npm run measure`);
          if (x && typeof x === 'object' && x.crop !== undefined) checkRect(x.crop, where, `${name} 第 ${i + 1} 张的 crop`, files[img]);
        });
      }
      else if (f.type === 'steplist') {
        if (!Array.isArray(v) || !v.length) { err(where, `${name} 要写成 [{text: '…', at: '…'}] 这样的一组`); continue; }
        if (v.length > f.max) err(where, `${name} 有 ${v.length} 条，最多 ${f.max} 条`);
        v.forEach((x, i) => {
          const t = typeof x === 'string' ? x : x && x.text;
          checkText(t, {max: 14}, where, `${name} 第 ${i + 1} 条`);
          if (x && typeof x === 'object' && x.sub !== undefined) checkText(x.sub, {max: 16}, where, `${name} 第 ${i + 1} 条的小字`);
          if (x && typeof x === 'object' && x.at !== undefined) checkAnchor(x.at, where, `${name} 第 ${i + 1} 条`);
        });
      }
      else if (f.type === 'picnext') {
        if (!v || typeof v !== 'object' || !Array.isArray(v.imgs)) { err(where, `${name} 要写成 {imgs: ['c.jpg'], at: '说到哪个词时换'}`); continue; }
        v.imgs.forEach((x, i) => { const img = typeof x === 'string' ? x : x && x.img; if (typeof img !== 'string' || !existsSync(pub(img))) err(where, `${name} 第 ${i + 1} 张「${img}」在 public/ 下没有这个文件`); });
        if (v.at !== undefined) checkAnchor(v.at, where, name);
      }
      else if (f.type === 'words') { if (!Array.isArray(v) || v.some((x) => typeof x !== 'string' || !x.trim())) err(where, `${name} 要写成 ['email', '张三'] 这样的一组词`); }
      else if (f.type === 'focus') {
        const list = Array.isArray(v) ? v : [v];
        if (list.length > 4) warn(where, `${label}一镜里框了 ${list.length} 处，观众看不过来。最多三四处，或者拆成几镜`);
        list.forEach((x, i) => {
          const nm = `${name} 第 ${i + 1} 处`;
          if (!x || typeof x !== 'object' || Array.isArray(x)) return err(where, `${nm} 要写成 {text: '图上的字'} 或 {rect: [x, y, 宽, 高]}`);
          Object.keys(x).forEach((kk) => { if (!['text', 'rect', 'at', 'label', 'nth'].includes(kk)) err(where, `${nm} 只能写 text / rect / at / label / nth，多了「${kk}」`); });
          if (x.text === undefined && x.rect === undefined) err(where, `${nm} 要写 text（图上的字，位置由 npm run measure 去找）或 rect（自己量的位置）`);
          if (x.text !== undefined && typeof x.text !== 'string') err(where, `${nm} 的 text 要写图上的字（带引号）`);
          else if (typeof x.text === 'string' && [...x.text.trim()].length < 2) warn(where, `${nm} 只框一个字「${x.text}」，太短了：图上同样的字可能有好几处，框出来观众也看不出重点。写完整的词或短语（图上连着的 2–10 个字）`);
          if (x.rect !== undefined) checkRect(x.rect, where, `${nm} 的 rect`, media);
          if (x.at !== undefined) checkAnchor(x.at, where, nm);
          if (x.label !== undefined) checkText(x.label, {max: 10}, where, `${nm} 的 label`);
          if (x.nth !== undefined && (!Number.isInteger(x.nth) || x.nth < 1)) err(where, `${nm} 的 nth 要写 1、2、3 这样的整数（图上有几处同样的字时取第几处）`);
        });
      }
    }
    if (spec.oneOf && !spec.oneOf.some((k) => obj[k] !== undefined)) err(where, `${label}要写 ${spec.oneOf.join(' 或 ')} 其中一个`);
  };

  if (!Array.isArray(SHOTS) || !SHOTS.length) err('shots.js', '分镜表是空的。每句话都要归到一镜，写法见 src/shots.js 开头的说明，卡片菜单看 npm run cards');
  const layout = look ? resolveLayout(CONFIG, MEASURED, look) : null;
  (Array.isArray(SHOTS) ? SHOTS : []).forEach((s, i) => {
    const where = `第 ${i + 1} 镜`;
    if (!s || typeof s !== 'object') return;
    Object.keys(s).forEach((k) => { if (!SHOT_FIELDS[k]) { const g = near(k, Object.keys(SHOT_FIELDS)); err(where, `一镜里没有「${k}」这一项${g ? `，是不是想写 ${g}？` : '。'}能写的有：say、state、card、overlay、why、memo`); } });
    if (s.why !== undefined && typeof s.why !== 'string') err(where, 'why 要写一句话（带引号）：观众第一次看到这个画面能明白什么');
    if (!STATES[s.state]) return err(where, `state 写的是 ${JSON.stringify(s.state)}，只能是 full / pip / cutout${near(s.state, Object.keys(STATES)) ? `。是不是想写 '${near(s.state, Object.keys(STATES))}'？` : ''}`);
    if (s.state === 'full' && s.card) err(where, 'state 是 full（全屏口播）就不能带图卡。要放图卡把 state 改成 pip；只想在人像上叠一个小卡片就用 overlay');
    if (s.state !== 'full' && !s.card) err(where, `state 是 ${s.state} 就要有图卡（card）。这一句不配画面的话，把 state 改成 full`);
    if (s.card !== undefined) {
      if (!s.card || typeof s.card !== 'object' || Array.isArray(s.card)) err(where, 'card 要写成 {type: \'…\', …}');
      else if (!CARD_TYPES[s.card.type]) err(where, `卡片类型 type 写的是 ${JSON.stringify(s.card.type)}，没有这种卡。有这些：${Object.entries(CARD_TYPES).map(([k, v]) => `${k}（${v.name}）`).join('、')}${near(s.card.type, Object.keys(CARD_TYPES)) ? `。是不是想写 '${near(s.card.type, Object.keys(CARD_TYPES))}'？` : ''}`);
      else checkFields(s.card, CARD_TYPES[s.card.type], where, `${CARD_TYPES[s.card.type].name}卡`);
    }
    if (s.overlay !== undefined) {
      if (!s.overlay || typeof s.overlay !== 'object') err(where, 'overlay 要写成 {type: \'…\', …}');
      else if (!OVERLAY_TYPES[s.overlay.type]) err(where, `overlay 的 type 写的是 ${JSON.stringify(s.overlay.type)}，只能是 chapter（章节卡）/ note（便签）/ tag（小标签）/ pics（截图浮在人像上）`);
      else checkFields(s.overlay, OVERLAY_TYPES[s.overlay.type], where, OVERLAY_TYPES[s.overlay.type].name);
      if (s.state !== 'full') warn(where, 'overlay 是叠在全屏人像上的，这一镜是图卡，两样东西会挤在一起。去掉 overlay，或者把这一镜改成 full');
    }
    if (s.state === 'cutout') {
      if (!CONFIG.matte) warn(where, '用了 cutout（原位抠像），但还没有抠像文件（config.js 的 matte 是 null），背景不会被换掉。先用 tools/matte.py 抠像，或者把这一镜改成 pip');
      if (layout && layout.cutout && layout.cutout.center) err(where, `用了 cutout（图卡摆在人旁边），但${layout.cutout.reason}。把这一镜改成 pip`);
    }
    if (M.cards === false && s.card) warn(where, '这一镜有图卡，但 config.js 里把图卡关掉了（modules.cards: false），渲染时会当成全屏口播');
  });

  // ---------- 换算成时间之后才能查的 ----------
  const P = resolveProject({config: CONFIG, shots: Array.isArray(SHOTS) ? SHOTS : [], sentences: SENTENCES, words: WORDS, duration: DURATION, measured: MEASURED});
  P.issues.forEach((x) => (x.level === 'error' ? err : warn)(x.where, x.msg));
  if (layout) layout.issues.forEach((x) => (x.level === 'error' ? err : warn)(x.where, x.msg));
  const maxHold = CONFIG.maxHold ?? 1;
  // 句子还没分完时，每一镜的起止时间是乱的，先不报停顿这类问题，免得添乱
  const broken = P.issues.some((x) => x.level === 'error' && /分给|混用|没有 S|say/.test(x.msg));
  let geo = null;
  if (look && layout) {
    const canvas = sizeOf(CONFIG.orientation);
    const lay = layoutOf(canvas.width, canvas.height, CONFIG.portraitLayout);
    const sub = lay.portrait ? CONFIG.subtitle.portrait : CONFIG.subtitle;
    geo = {...look, ...lay, layout, canvas, avatarCfg: CONFIG.avatar, avatarOn: M.avatar !== false, subTop: subtitleTop(lay, canvas.height, CONFIG.subtitle, M.subtitles !== false),
      subFullTop: M.subtitles !== false ? canvas.height - sub.bottom - sub.size * 3 : null};
    // 字幕会不会压到嘴
    const fb = faceBoxOf(geo);
    if (fb && M.subtitles !== false && canvas.height - sub.bottom - sub.size * 1.5 < fb.mouth) warn('字幕', `字幕会压到嘴（嘴大约在第 ${Math.round(fb.mouth)} 像素，字幕从第 ${Math.round(canvas.height - sub.bottom - sub.size * 1.5)} 像素开始）。这条口播人在画面里偏低：把 config.js 里字幕的 bottom 调小一点，或者下次拍的时候让眼睛在画面上三分之一处`);
  }
  P.shots.forEach((s) => {
    const where = `第 ${s.index + 1} 镜`;
    const len = s.to - s.from;
    const range = s.ids.length > 1 ? `${s.ids[0]}–${s.ids[s.ids.length - 1]}` : s.ids[0] || '';
    if (len < 1 && s.index < P.shots.length - 1) warn(where, `这一镜（${range}）只有 ${r1(len)} 秒，一闪而过。和前一镜或后一镜并在一起`);
    if (s.state !== 'full' && s.card) {
      const hold = s.to - s.done;
      if (hold < -0.05) err(where, `太短：这一镜（${range}）只有 ${r1(len)} 秒，内容要 ${r1(s.done - s.from)} 秒才出全，还没出全就切走了。把后面一句也并进来（改 say），或者少放几条`);
      else if (hold < 0.4) warn(where, `最后出现的内容只停了 ${r1(Math.max(0, hold))} 秒就切走了，观众来不及看。把后面一句也并进这一镜，或者让它早点出现（写 at）`);
      else if (hold > maxHold && s.speechTo < s.to - maxHold && !broken) warn(where, `话说完以后画面还停了 ${r1(s.to - Math.max(s.done, s.speechTo))} 秒：${range} 后面有一段 ${r1(s.to - s.speechTo)} 秒的停顿没剪掉。把口播里这段停顿剪掉再重跑 npm run timeline，或者接受它`);
      const c = s.card;
      if (c.type === 'screen' && c.media && c.end !== undefined && c.end > c.media.duration + 0.15) err(where, `录屏不够长：这一镜要从第 ${c.start} 秒放到第 ${c.end} 秒，可 ${c.src} 只有 ${c.media.duration} 秒，后面 ${r1(c.end - c.media.duration)} 秒会定格。把 start 提前、缩短这一镜，或者换一段录屏`);
      // 图 / 录屏最后显示多大（和渲染用的是同一份算法）：太小了字看不清
      if (c.media && geo) {
        const {fit} = mediaFit(geo, s);
        const file = c.img || c.src;
        const tall = fit.c.h / fit.c.w > 1.25;
        const small = (c.focusBoxes || []).filter((b) => b.rect && b.rect[3] * fit.k < 20);
        if (small.length) warn(where, `${file} 上框出来的字显示到画面里只有 ${Math.round(small[0].rect[3] * fit.k)} 像素高，看不清。加 crop: [x, y, 宽, 高] 只显示要讲的那一块（这处字在原图的 [${small[0].rect.join(', ')}]，crop 取它周围一圈就行）${tall && !c.scroll && c.type !== 'screen' ? '；或者加 scroll: true 让长图滚动着看' : ''}`);
        else if (!c.scroll && fit.k < 0.3) warn(where, `${file}（${fit.c.w}×${fit.c.h}）放进画面要缩到 ${Math.round(fit.k * 100)}%，上面的字多半看不清。加 crop 只显示要讲的那一块${tall && c.type !== 'screen' ? '，或者加 scroll: true 让长图滚动着看' : ''}`);
        else if (tall && !c.scroll && c.type !== 'screen' && fit.dw < 520 && !geo.portrait) warn(where, `${file} 是竖长的图（${fit.c.w}×${fit.c.h}），整张放进横屏只有 ${Math.round(fit.dw)} 像素宽，两边空一大片。加 crop 只显示要讲的那一块，或者加 scroll: true 让它滚动着看`);
      }
      // 裁出来的那一块，内容只占一小部分：多半是裁宽了或者裁歪了
      if (Array.isArray(c.crop) && (c.img || c.src)) {
        const f = c.img || c.src;
        const cr = (MEASURED.crops || {})[`${f}|${c.crop.map((v) => Math.max(0, Math.round(v))).join(',')}`];
        if (cr && typeof cr === 'object' && cr.cover < 0.55) warn(where, `crop 裁出来的这一块，内容只占 ${Math.round(cr.cover * 100)}%${cr.empty ? `，${cr.empty}空了一大片` : ''}，画面上会是一小块内容加一大片空白。用 node tools/measure.mjs --text ${f} --crop ${c.crop.join(',')} 看这一块里露出来的字，再把 crop 收到只包住要讲的那几行（四周留一点边）`);
      }
      if (c.scroll && c.media) {
        const cw = c.crop ? c.crop[2] : c.media.width, ch = c.crop ? c.crop[3] : c.media.height;
        if (ch / cw < 0.8) warn(where, `写了 scroll（长图滚动），但 ${c.img} 不是长图（${cw}×${ch}），不会滚。去掉 scroll`);
      }
    }
  });
  // ---------- 取舍：每个画面都要帮观众看懂，不是为了有东西在动 ----------
  const {norm} = await load('src/resolve.js');
  const noWhy = [];
  P.shots.forEach((s) => {
    const where = `第 ${s.index + 1} 镜`;
    const said = norm(s.said);
    const c = s.card, o = s.overlay;
    if (c && !(typeof s.why === 'string' && s.why.trim())) noWhy.push(s.index + 1);
    // 和你说的话一字不差的字：字幕已经有了，画面上再放一遍没有信息量
    const echo = (t, what) => { const n = norm(t || ''); if (n.length >= 5 && said.includes(n)) warn(where, `${what}「${t}」和你这一镜说的话一字不差——字幕已经有这句了，画面上再放一遍没有信息量。换成结论、数字或对比，或者删掉`); };
    if (c && c.type === 'pill') echo(c.text, '结论');
    if (c && c.pill) echo(c.pill, '结论');
    if (o && o.type === 'note' && M.overlays !== false) echo(o.text, '便签');
    // 叠在人像上的小卡片不能压到脸
    if (o && o.type === 'pics' && geo && o.items) {
      const pl = picsPlace(geo, o.items);
      if (pl.h < 240) warn(where, `浮在人像上的截图只能放到 ${Math.round(pl.h)} 像素高（放在${pl.where}），看不太清。少放一张、用 crop 只取要看的那一块，或者改成图卡（pip）`);
    }
    if (o && o.type !== 'pics' && geo && M.overlays !== false && s.state === 'full' && overlayPlace(geo, o, CONFIG.avatar.corner).overlap) err(where, `${{chapter: '章节卡', note: '便签', tag: '小标签'}[o.type]}「${o.title || o.text}」会压到脸：这条口播里脸的上方、下方都放不下这么大的卡片。把字改短，或者这一镜不放`);
    // 用几行字拼出来的窗口不是截图
    if (c && c.type === 'window' && !c.img && c.lines && !c.mock) warn(where, `这个窗口里的内容是用几行字拼出来的，不是真截图。它如果是在模仿真实的界面、聊天或数据，加上 mock: true（角上会标「示意」），免得观众当成真的`);
    // 一张卡出全以后挂太久
    if (c && s.to - s.done > 6 && !broken) warn(where, `这张卡出全以后又挂了 ${r1(s.to - s.done)} 秒，画面一直没变（你还在说：「${s.said.slice(-24)}」）。拆成两镜、用 focus 框出正在讲的地方，或者中间回到人脸（full）`);
  });
  const OPS = /打开|点击|点一下|下载|安装|登录|注册|输入|上传|发给|发送|复制|粘贴|搜索|设置里|页面|界面|按钮|可以看到|你会看到|就会出现/;
  const noProof = P.shots.filter((s) => s.card && !s.card.img && !s.card.src && OPS.test(s.said)).map((s) => s.index + 1);
  if (noProof.length && !broken) warn('素材', `第 ${noProof.join('、')} 镜讲的是具体操作，但画面是文字或示意，没有真截图或真录屏。有真素材更有说服力：问用户能不能补一张截图或一段录屏（npm run needs 会列出清单）；补不了就保持现在这样`);
  // 同一张图的同一块，在隔开的两镜里各放一次：观众会以为画面重复了
  const regionOf = (s) => { const c = s.card, m = c.media; if (!m) return null; const [x, y, w, h] = c.crop || [0, 0, m.width, m.height]; return {x, y, w, h}; };
  const imgs = P.shots.filter((s) => s.card && s.card.img && s.card.media);
  imgs.forEach((b, j) => imgs.slice(0, j).forEach((a) => {
    if (a.card.img !== b.card.img || b.index - a.index <= 1 || broken) return;
    const A = regionOf(a), B = regionOf(b);
    const ix = Math.max(0, Math.min(A.x + A.w, B.x + B.w) - Math.max(A.x, B.x)), iy = Math.max(0, Math.min(A.y + A.h, B.y + B.h) - Math.max(A.y, B.y));
    const share = (ix * iy) / Math.min(A.w * A.h, B.w * B.h);
    if (share > 0.5) warn(`第 ${b.index + 1} 镜`, `放的是 ${b.card.img} 上第 ${a.index + 1} 镜已经露过的那一块（重叠 ${Math.round(share * 100)}%），观众会觉得画面重复了。换别的素材，或者两镜只在一处用它；第 ${a.index + 1} 镜如果把好几条消息都框进去了，把它的 crop 收小，只留那一镜要讲的那条`);
  }));
  if (noWhy.length && !broken) warn('取舍', `第 ${noWhy.join('、')} 镜放了图卡但没写 why。每张卡写一句：观众第一次看到它能明白什么（why: '…'）。写不出来的那张，多半该删`);
  const first = P.shots[0];
  if (first && !broken && first.state === 'full' && !(first.overlay && M.overlays !== false) && first.to - first.from > 3 && P.shots.length > 1) warn('第 1 镜', `开头 ${r1(first.to - first.from)} 秒只有人在说话。前三秒没有东西可看，观众就划走了：把最抓人的素材（成品、结果、数字）放到开头，或者至少叠一个小标签 / 便签`);

  // 句间停顿：合成一条提醒
  const gaps = SENTENCES.slice(1).map((s, i) => [SENTENCES[i].id, s.id, s.from - SENTENCES[i].to]).filter((x) => x[2] > 0.6);
  if (gaps.length) warn('节奏', `有 ${gaps.length} 处句子之间停顿超过 0.6 秒，口播可能还没剪紧：${gaps.slice(0, 8).map((g) => `${g[0]}→${g[1]} ${r1(g[2])} 秒`).join('，')}${gaps.length > 8 ? ' …' : ''}`);
  // 露脸：连续干讲太久、连续看不到人太久
  const lim = {maxFull: 10, maxHidden: 15, ...(CONFIG.limits || {})};
  let run = null;
  const span = (a, b) => (a === b ? `第 ${a} 镜` : `第 ${a}–${b} 镜`);
  const flush = () => { if (run && run.to - run.from > lim.maxFull) warn(span(run.a, run.b), `连续 ${r1(run.to - run.from)} 秒只有人在说话、画面上没有别的东西（${run.s0}–${run.s1}）。超过 ${lim.maxFull} 秒观众容易划走：中间挑一句配图卡、截图或小标签`); run = null; };
  P.shots.forEach((s) => {
    const plain = (s.state === 'full' || M.cards === false) && !(s.overlay && M.overlays !== false);
    if (!plain) return flush();
    if (!run) run = {from: s.from, a: s.index + 1, s0: s.ids[0]};
    run.to = s.to; run.b = s.index + 1; run.s1 = s.ids[s.ids.length - 1];
  });
  flush();
  P.stats.runs.filter((r) => r.kind === 'hidden' && r.to - r.from > lim.maxHidden).forEach((r) => warn(span(r.shots[0], r.shots[r.shots.length - 1]), `连续 ${r1(r.to - r.from)} 秒完全看不到人。口播视频里人不出现太久会像在看 PPT：打开小头像（modules.avatar），或者中间插一镜 full`));

  // 按镜头顺序排：配置和句子的问题在前，然后第 1 镜、第 2 镜…
  const order = (x) => { const m = x.where.match(/^第 (\d+)/); return m ? Number(m[1]) : x.where === '分镜表' ? 1e6 : x.where === '取舍' ? 1.5e6 : x.where === '素材' ? 1.6e6 : x.where === '节奏' ? 2e6 : -1; };
  errors.sort((a, b) => order(a) - order(b));
  warns.sort((a, b) => order(a) - order(b));
  return {errors, warns, project: P, layout, config: CONFIG, sentences: SENTENCES};
};

const cards = async () => {
  const {STATES, CARD_TYPES, OVERLAY_TYPES} = await load('src/schema.js');
  const L = [];
  const fieldLine = (k, f) => {
    const lim = f.type === 'text' || f.type === 'timed' ? (f.max ? `最多 ${f.max} 字` : '') : f.type === 'items' || f.type === 'texts' ? `${f.min}–${f.max} 条，每条最多 ${f.each} 字` : f.type === 'number' ? '数字' : f.type === 'bool' ? 'true / false' : f.type === 'image' ? '图片文件名' : f.type === 'video' ? '视频文件名' : f.type === 'rect' ? '[x, y, 宽, 高]' : f.type === 'anchor' ? '你说的一个词' : f.type === 'focus' ? "{text: '图上的字'} 或 {rect: […]}，可加 at / label" : f.type === 'words' ? "['email', 'phone', '要糊的词']" : f.type === 'messages' ? `${f.min}–${f.max} 条，每条最多 ${f.each} 字` : '';
    return `      ${(k + (f.required ? ' *' : '')).padEnd(13)}${f.desc}${lim ? `（${lim}）` : ''}`;
  };
  L.push('分镜表（src/shots.js）每一镜的写法：{say: 对应哪几句, state: 画面状态, card 或 overlay}', '带 * 的必须填。', '');
  L.push('■ 画面状态 state');
  Object.entries(STATES).forEach(([k, v]) => L.push(`  ${k.padEnd(8)}${v}`));
  L.push('', '■ 图卡 card（state 是 pip 或 cutout 时用）');
  Object.entries(CARD_TYPES).forEach(([k, c]) => { L.push(`  ${k} · ${c.name}：${c.use}`); Object.entries(c.fields).forEach(([n, f]) => L.push(fieldLine(n, f))); L.push(`      例：${c.example}`, ''); });
  L.push('■ 叠加层 overlay（state 是 full 时，叠在人像上）');
  Object.entries(OVERLAY_TYPES).forEach(([k, c]) => { L.push(`  ${k} · ${c.name}：${c.use}`); Object.entries(c.fields).forEach(([n, f]) => L.push(fieldLine(n, f))); L.push(`      例：${c.example}`, ''); });
  L.push('■ 什么时候出现（at）',
    '  清单的每一条、要框的每一处，默认自动对到你说的词上；对不上的平均排。',
    "  想自己指定，就写 at：{text: '比人声小', at: '人声'} = 说到「人声」时出现。同一个词说了两次，第 2 次写 '人声#2'。",
    '  at 里的词必须是这一镜的句子里真的说了的；写错了 npm run check 会把这一镜说的话列给你。', '',
    '■ 只是人在说话、不配画面的句子',
    "  也要归到一镜：{say: 'S08', state: 'full'}。", '');
  console.log(L.join('\n'));
};

const isMain = process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url;
if (isMain) {
  if (process.argv.includes('--cards')) { await cards(); process.exit(0); }
  const {errors, warns, project: P} = await runLint();
  if (process.argv.includes('--json')) { console.log(JSON.stringify({errors, warns, stats: P.stats}, null, 2)); process.exit(errors.length ? 1 : 0); }
  const show = (list, mark) => list.forEach((x) => console.log(`${mark} ${x.where}：${x.msg}`));
  if (errors.length) { console.log(`必须改的（${errors.length}）：`); show(errors, '✗'); console.log(''); }
  if (warns.length) { console.log(`提醒（${warns.length}）：`); show(warns, '！'); console.log(''); }
  const st = P.stats;
  if (st.total > 0 && P.shots.length) {
    const pct = (v) => `${Math.round((v / st.total) * 100)}%`;
    console.log(`全片 ${st.total} 秒，${P.shots.length} 镜。露脸：整张脸 ${pct(st.full)}（${r1(st.full)} 秒）· 小窗 ${pct(st.small)}（${r1(st.small)} 秒）· 看不到人 ${pct(st.hidden)}（${r1(st.hidden)} 秒）`);
  }
  console.log(errors.length ? `\n还有 ${errors.length} 个错误要改。改完再跑 npm run check。` : warns.length ? '\n没有错误。上面的提醒看一眼，觉得没问题就可以往下走（npm run next）。' : '\n检查通过。');
  process.exitCode = errors.length ? 1 : 0;
}

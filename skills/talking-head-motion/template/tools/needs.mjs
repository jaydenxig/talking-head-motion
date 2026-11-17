// 缺素材清单：写分镜之前，先看哪些句子在讲具体的操作或东西、手上有没有能配的截图和录屏。
// 有真素材就用真的；补不了的，用动作卡（对话 / 流程 / 文档）把动作演出来；只有几个并列的要点才用文字清单。
// 用法：node tools/needs.mjs        # npm run needs，结果在 out/素材清单.md
import {existsSync, mkdirSync, readdirSync, writeFileSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const load = async (f) => import(pathToFileURL(path.join(root, f)).href + `?t=${Date.now()}`);
const {CONFIG} = await load('src/config.js');
const {SENTENCES} = await load('src/sentences.js');
const {MEASURED} = await load('src/measured.js');
const clean = (t) => t.replace(/[[\]]/g, '');

// 一句话在讲什么 → 最好配什么
const KINDS = [
  {re: /打开|点击|点一下|点开|下载|安装|登录|注册|输入|上传|复制|粘贴|搜索|设置|勾选|拖/, want: '录屏（那一步操作的过程），或那个界面的截图'},
  {re: /发给|发送|告诉它|告诉他|问它|问他|让它|让他|提示词|回复|回答/, want: '对话的截图；没有的话用「对话卡」演'},
  {re: /页面|界面|按钮|侧边栏|菜单|窗口|可以看到|你会看到|就会出现|弹出/, want: '那个界面的截图或录屏'},
  {re: /简历|文档|报告|表格|名单|资料|文件|PDF|邮件|消息|通知/, want: '那份东西的截图（敏感信息会打码）；没有的话用「文档卡」演'},
  {re: /\d|[两三四五六七八九十百千万]+(天|个|次|倍|家|份|条|分钟|小时|块|元)|一(天|次|倍|分钟|小时)/, want: '能证明这个数字的截图；没有就用大数字卡'},
];
const rows = [];
SENTENCES.forEach((s) => {
  const t = clean(s.text);
  const k = KINDS.find((x) => x.re.test(t));
  if (k) rows.push({id: s.id, t, want: k.want});
});
// 连着的几句合成一行
const groups = [];
rows.forEach((r) => {
  const g = groups[groups.length - 1];
  const n = Number(r.id.slice(1));
  if (g && g.want === r.want && n === g.last + 1) { g.to = r.id; g.last = n; g.t += ' ' + r.t; } else groups.push({from: r.id, to: r.id, last: n, t: r.t, want: r.want});
});
const pub = path.join(root, 'public');
const files = existsSync(pub) ? readdirSync(pub).filter((f) => /\.(png|jpe?g|webp|gif|mp4|mov|m4v|webm)$/i.test(f) && f !== CONFIG.talk && f !== CONFIG.matte) : [];
const info = (f) => { const m = (MEASURED.files || {})[f]; return m ? `${m.width}×${m.height}${m.duration ? `，${m.duration} 秒` : ''}` : '还没量（跑 npm run measure）'; };
const cell = (t) => t.replace(/\|/g, '｜');
const out = [
  '# 素材清单', '',
  '写分镜之前对一遍：哪些话最好有画面证明、手上有没有。',
  '「现在有没有」「怎么办」两栏由你（AI）填，然后把整张表发给用户，问他缺的能不能补。', '',
  '## 手上已有的素材（public/）', '',
  ...(files.length ? files.map((f) => `- ${f}（${info(f)}）`) : ['（还没有。截图、录屏放进 public/ 再跑一次）']), '',
  '## 这些话最好有画面', '',
  '| 句子 | 你说 | 最好有什么 | 现在有没有（写文件名） | 怎么办：用现有的 / 请用户补 / 用动作卡演 / 不配 |',
  '|---|---|---|---|---|',
  ...groups.map((g) => `| ${g.from}${g.to !== g.from ? `–${g.to}` : ''} | ${cell(g.t)} | ${g.want} |  |  |`), '',
  '没列在上面的句子（观点、感受、过渡）一般不配画面，留给人脸。', '',
  '## 问用户的话（照这个意思说）', '',
  '「这几句最好有真截图或录屏：……。你手上有吗？有的话放进 public/ 文件夹；没有的，我用示意动画演出来（会标「示意」）。」', '',
].join('\n');
mkdirSync(path.join(root, 'out'), {recursive: true});
writeFileSync(path.join(root, 'out/素材清单.md'), out);
console.log(`素材清单：out/素材清单.md（${groups.length} 处最好有画面，手上有 ${files.length} 个素材）`);
groups.slice(0, 12).forEach((g) => console.log(`  ${g.from}${g.to !== g.from ? `–${g.to}` : ''}「${g.t.slice(0, 26)}${g.t.length > 26 ? '…' : ''}」→ ${g.want}`));
if (groups.length > 12) console.log(`  … 共 ${groups.length} 处，见文件`);

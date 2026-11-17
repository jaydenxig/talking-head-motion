// 考试：把一道考题（eval/cases/<名字>/）交给一个模型去做，做完自动评分。
// 用来回答一个问题：换成这个模型，这套做法还能不能做对？
//
// 用法：
//   node eval/run.mjs --case eval/cases/<名字>            # 用 eval/.env 里配的模型
//   node eval/run.mjs --case … --model deepseek-v4-pro    # 临时换一个模型名
//   node eval/run.mjs --case … --score-only <工作目录>     # 不重新考，只对一份已有的结果重新评分
//
// eval/.env（自己建，不会提交）：
//   EVAL_BASE_URL=https://api.deepseek.com
//   EVAL_API_KEY=sk-……
//   EVAL_MODEL=deepseek-flash
//
// 一道考题的文件夹里有：
//   task.md      交给模型的话（用户不在场，要交代的都写在里面）
//   truth.json   标准答案和评分方式
//   overlay/     盖到仓库副本上的文件（考试开始时的状态）。*.link 文件里写一个绝对路径，会变成指向它的链接（大视频用）
import {spawnSync} from 'node:child_process';
import {cpSync, existsSync, mkdirSync, readFileSync, readdirSync, symlinkSync, writeFileSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const repo = path.resolve(here, '..');
const arg = (k, d) => { const i = process.argv.indexOf(`--${k}`); return i > 0 ? process.argv[i + 1] : d; };
const caseDir = path.resolve(arg('case') || '');
if (!existsSync(path.join(caseDir, 'task.md'))) { console.error('用法：node eval/run.mjs --case eval/cases/<名字>（里面要有 task.md 和 truth.json）'); process.exit(1); }
const env = {...process.env};
if (existsSync(path.join(here, '.env'))) for (const line of readFileSync(path.join(here, '.env'), 'utf8').split('\n')) { const m = line.match(/^\s*([A-Z_]+)\s*=\s*(.*?)\s*$/); if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, ''); }
if (arg('model')) env.EVAL_MODEL = arg('model');
const truth = JSON.parse(readFileSync(path.join(caseDir, 'truth.json'), 'utf8'));

let work = arg('score-only') ? path.resolve(arg('score-only')) : null;
let stats = null;
if (!work) {
  if (!env.EVAL_API_KEY) { console.error('还没配模型：在 eval/ 下建一个 .env 文件，写上 EVAL_BASE_URL、EVAL_API_KEY、EVAL_MODEL 三行（见 eval/README.md）'); process.exit(1); }
  const stamp = new Date().toLocaleString('sv').replace(/[: ]/g, '-').slice(5, 16);
  work = path.join(here, 'work', `${path.basename(caseDir)}_${String(env.EVAL_MODEL).replace(/[^\w.-]/g, '_')}_${stamp}`);
  const root = path.join(work, 'repo');
  mkdirSync(root, {recursive: true});
  // 1. 仓库副本：只带说明和模板，不带依赖、素材和以前的产出
  const tpl = 'skills/talking-head-motion/template';
  const skip = (src) => { const rel = path.relative(repo, src); return !(/(^|\/)(node_modules|\.git|\.DS_Store)$/.test(rel) || rel.startsWith('eval') || rel.startsWith(`${tpl}/out`) || rel === `${tpl}/.progress.json` || (rel.startsWith(`${tpl}/public/`) && !rel.startsWith(`${tpl}/public/sfx`) && !rel.endsWith('README.md')) || (rel.startsWith(`${tpl}/raw/`) && !rel.endsWith('README.md'))); };
  for (const f of ['AGENTS.md', 'README.md', 'skills']) cpSync(path.join(repo, f), path.join(root, f), {recursive: true, filter: skip});
  symlinkSync(path.join(repo, tpl, 'node_modules'), path.join(root, tpl, 'node_modules'));
  // 2. 盖上考题的初始状态
  const lay = (dir, rel = '') => {
    for (const e of readdirSync(dir, {withFileTypes: true})) {
      const src = path.join(dir, e.name), dst = path.join(root, rel, e.name);
      if (e.isDirectory()) { mkdirSync(dst, {recursive: true}); lay(src, path.join(rel, e.name)); }
      else if (e.name.endsWith('.link')) symlinkSync(readFileSync(src, 'utf8').trim(), dst.slice(0, -5));
      else cpSync(src, dst);
    }
  };
  if (existsSync(path.join(caseDir, 'overlay'))) lay(path.join(caseDir, 'overlay'));
  cpSync(path.join(root, tpl, 'src'), path.join(work, 'src_before'), {recursive: true});
  // 3. 开考
  console.log(`开考：${path.basename(caseDir)} × ${env.EVAL_MODEL}\n工作目录：${work}`);
  const r = spawnSync(process.execPath, [path.join(here, 'agent.mjs'), '--root', root, '--task', path.join(caseDir, 'task.md'), '--log', path.join(work, 'log.jsonl'), '--turns', String(truth.maxTurns || 80)], {env, encoding: 'utf8', maxBuffer: 1 << 26, timeout: 60 * 60 * 1000});
  try { stats = JSON.parse(r.stdout.slice(r.stdout.indexOf('{'))); } catch { stats = {error: (r.stderr || r.stdout || '').slice(-500)}; }
  writeFileSync(path.join(work, 'stats.json'), JSON.stringify(stats, null, 2));
} else if (existsSync(path.join(work, 'stats.json'))) stats = JSON.parse(readFileSync(path.join(work, 'stats.json'), 'utf8'));

// ---------- 评分 ----------
const tplDir = path.join(work, 'repo/skills/talking-head-motion/template');
const load = async (f) => import(pathToFileURL(f).href + `?t=${Date.now()}`);
const R = [`# 考试结果：${path.basename(caseDir)}`, '', `模型：${env.EVAL_MODEL || '（只评分）'}`, ''];
if (stats) {
  R.push('## 过程', '',
    `- 来回 ${stats.turns ?? '?'} 轮；${stats.finished ? '自己宣布做完了' : stats.error ? `中途出错：${stats.error}` : '没有宣布做完（轮数用完或停住了）'}`,
    `- 用了约 ${Math.round(((stats.tokensIn || 0) + (stats.tokensOut || 0)) / 1000)} 千 token（读 ${Math.round((stats.tokensIn || 0) / 1000)} 千，写 ${Math.round((stats.tokensOut || 0) / 1000)} 千）`,
    `- 工具调用：${Object.entries(stats.calls || {}).map(([k, v]) => `${k} ${v} 次`).join('，') || '无'}；其中跑检查 ${stats.checks || 0} 次`,
    `- 越界的动作（想改不该改的文件、想跑不让跑的命令）：${(stats.refused || []).length ? stats.refused.join('；') : '没有'}`,
    stats.summary ? `- 它的汇报：${stats.summary.replace(/\n+/g, ' ')}` : '', '');
}
let pass = true;
const before = await load(path.join(work, 'src_before/takes.js')).catch(() => null);
if (truth.type === 'takes') {
  // 挑句子：该去掉的去掉了几句、不该去掉的去掉了几句、有没有把清单改坏
  let now = null, broken = '';
  try { now = (await load(path.join(tplDir, 'src/takes.js'))).TAKES; } catch (e) { broken = `takes.js 被改坏了，读不出来：${e.message}`; }
  R.push('## 结果', '');
  if (broken) { R.push(`- ✗ ${broken}`); pass = false; } else {
    const orig = before.TAKES;
    const moved = now.length !== orig.length || now.some((t, i) => t.id !== orig[i].id || t.from !== orig[i].from || t.to !== orig[i].to || t.clip !== orig[i].clip);
    const scope = (t) => !truth.until || t.id <= truth.until;
    const must = new Set(truth.drop), maybe = new Set(truth.maybe || []);
    const dropped = now.filter((t) => !t.keep && scope(t));
    const hit = dropped.filter((t) => must.has(t.id)), wrong = dropped.filter((t) => !must.has(t.id) && !maybe.has(t.id)), miss = now.filter((t) => t.keep && must.has(t.id));
    R.push(`- 该去掉的 ${must.size} 句里，去掉了 **${hit.length}** 句`,
      miss.length ? `- 漏掉的：${miss.map((t) => `${t.id}「${t.text}」`).join('，')}` : '- 没有漏的',
      wrong.length ? `- ✗ 不该去掉却去掉了 ${wrong.length} 句：${wrong.map((t) => `${t.id}「${t.text}」`).join('，')}` : '- 没有误删',
      moved ? '- ✗ 动了不该动的东西（编号 / 时间 / 行数变了）' : '- 编号和时间都没动');
    if (truth.startKeepAll) R.push(`- 这道题开考时所有句子都是「留」，${hit.length} 句全是它自己找出来的`);
    pass = !moved && wrong.length <= (truth.allowWrong ?? 1) && hit.length >= (truth.needHit ?? must.size - 1);
  }
} else if (truth.type === 'shots') {
  R.push('## 结果', '');
  let lint = null;
  try { lint = await (await load(path.join(tplDir, 'tools/lint.mjs'))).runLint(); } catch (e) { R.push(`- ✗ 检查器跑不起来（文件被改坏了）：${e.message}`); pass = false; }
  if (lint) {
    const P = lint.project;
    const sb = await load(path.join(work, 'src_before/sentences.js')), sa = lint.sentences;
    const moved = sa.length !== sb.SENTENCES.length || sa.some((s, i) => s.id !== sb.SENTENCES[i].id || s.from !== sb.SENTENCES[i].from || s.to !== sb.SENTENCES[i].to);
    const edited = sa.filter((s, i) => sb.SENTENCES[i] && s.text !== sb.SENTENCES[i].text).length;
    const cards = P.shots.filter((s) => s.card);
    const types = {};
    cards.forEach((s) => { types[s.card.type] = (types[s.card.type] || 0) + 1; });
    const real = cards.filter((s) => s.card.img || s.card.src), action = cards.filter((s) => ['chat', 'flow', 'doc'].includes(s.card.type));
    const usedFiles = new Set(real.map((s) => s.card.img || s.card.src));
    const st = P.stats;
    const demo = readFileSync(path.join(tplDir, 'src/shots.js'), 'utf8').includes('这份是演示内容');
    R.push(demo ? '- ✗ 分镜表没有写（还是演示内容）' : `- 分镜表写了 ${P.shots.length} 镜`,
      `- 检查器：**${lint.errors.length} 个错误**，${lint.warns.length} 条提醒`,
      ...lint.errors.slice(0, 6).map((e) => `  - ✗ ${e.where}：${e.msg.slice(0, 140)}`),
      ...lint.warns.slice(0, 8).map((e) => `  - ！ ${e.where}：${e.msg.slice(0, 140)}`),
      moved ? '- ✗ 句子的编号 / 时间 / 行数被改动了' : `- 句子的编号和时间都没动；改了 ${edited} 句的字，${sa.filter((s) => /\[/.test(s.text)).length} 句标了关键词`,
      `- 图卡 ${cards.length} 张：${Object.entries(types).map(([k, v]) => `${k}×${v}`).join('，') || '无'}`,
      `- 用真素材的 ${real.length} 张（手上 ${truth.assets ? truth.assets.length : '?'} 个素材，用上了 ${truth.assets ? truth.assets.filter((f) => usedFiles.has(f)).length : usedFiles.size} 个）；用动作卡演的 ${action.length} 张；写了 why 的 ${cards.filter((s) => s.why).length} / ${cards.length} 张`,
      `- 打码：${cards.filter((s) => s.card.mask).length} 张截图写了 mask`,
      `- 露脸：整张脸 ${Math.round((st.full / st.total) * 100)}% · 小窗 ${Math.round((st.small / st.total) * 100)}%`);
    pass = !demo && !moved && lint.errors.length === 0;
    writeFileSync(path.join(work, '分镜表_它写的.js'), readFileSync(path.join(tplDir, 'src/shots.js'), 'utf8'));
  }
}
R.push('', `## 结论：${pass ? '通过' : '没通过'}`, '', `完整的对话记录在 ${path.join(work, 'log.jsonl')}，它改完的文件在 ${tplDir}/src/。`);
writeFileSync(path.join(work, '结果.md'), R.filter((x) => x !== undefined).join('\n'));
console.log('\n' + R.join('\n'));

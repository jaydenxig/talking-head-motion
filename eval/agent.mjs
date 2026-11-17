// 考官程序里的「考生」：把任何一家兼容 OpenAI 接口的模型接上三样工具（读文件、改文件、跑命令），
// 让它在一份仓库副本里照 AGENTS.md 干活。用来检验：换一个模型，这套做法还能不能做对。
//
// 用法（一般由 eval/run.mjs 调，不用直接跑）：
//   node eval/agent.mjs --root <仓库副本> --task <任务说明.md> --log <记录.jsonl>
// 模型由环境变量决定（放在 eval/.env 里）：
//   EVAL_BASE_URL   接口地址，如 https://api.deepseek.com 或 https://api.x.ai/v1
//   EVAL_API_KEY    密钥
//   EVAL_MODEL      模型名
//   EVAL_EXTRA      （可选）附加到请求里的 JSON，如 {"reasoning_effort":"none"}
//
// 工具是故意给得很少、很笨的：能读、能整篇写、能替换一段、能跑白名单里的命令。弱模型在这种条件下能做对，才算数。
import {spawnSync} from 'node:child_process';
import {appendFileSync, existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync} from 'node:fs';
import path from 'node:path';

const arg = (k, d) => { const i = process.argv.indexOf(`--${k}`); return i > 0 ? process.argv[i + 1] : d; };
const ROOT = path.resolve(arg('root'));
const TPL = path.join(ROOT, 'skills/talking-head-motion/template');
const LOG = path.resolve(arg('log', path.join(ROOT, '../log.jsonl')));
const MAX_TURNS = Number(arg('turns', 80));
const BASE = (process.env.EVAL_BASE_URL || '').replace(/\/$/, '');
const KEY = process.env.EVAL_API_KEY, MODEL = process.env.EVAL_MODEL;
if (!BASE || !KEY || !MODEL) { console.error('缺环境变量：EVAL_BASE_URL / EVAL_API_KEY / EVAL_MODEL（写在 eval/.env 里）'); process.exit(2); }
const EXTRA = process.env.EVAL_EXTRA ? JSON.parse(process.env.EVAL_EXTRA) : {};

const log = (o) => appendFileSync(LOG, JSON.stringify({t: new Date().toISOString(), ...o}) + '\n');
const stats = {turns: 0, calls: {}, refused: [], checks: 0, tokensIn: 0, tokensOut: 0, finished: false};
const inside = (p) => { const full = path.resolve(ROOT, p); return full === ROOT || full.startsWith(ROOT + path.sep) ? full : null; };
const clip = (s, n = 9000) => (s.length > n ? `${s.slice(0, n)}\n…（后面还有 ${s.length - n} 个字没显示。读文件可以用 offset 接着读）` : s);

// 只许改这几个地方：和 AGENTS.md 里写的规矩一致。改别的会被拒绝并记一笔
const WRITABLE = [/^skills\/talking-head-motion\/template\/src\/(config|takes|sentences|shots)\.js$/, /^skills\/talking-head-motion\/template\/out\/[^/]+\.md$/];
// 只许跑这些命令（都在 template/ 里跑）。出图和渲染由考官来做
const ALLOWED = [
  /^npm run (next|check|cards|needs|measure|storyboard|srt|raw|cut|timeline)( -- [-\w "',.一-鿿]+)?$/,
  /^node tools\/(next|lint|needs|measure|storyboard|cut|make-srt)\.mjs( [-\w "',./一-鿿]+)?$/,
];

const tools = {
  read_file: {desc: '读一个文件。path 相对仓库根目录。文件长的话用 offset（从第几个字开始）接着读', params: {path: 'string', offset: 'number?'}, run: ({path: p, offset = 0}) => {
    const full = inside(p);
    if (!full || !existsSync(full)) return `没有这个文件：${p}`;
    if (statSync(full).isDirectory()) return `${p} 是文件夹，用 list_dir 看`;
    return clip(readFileSync(full, 'utf8').slice(offset));
  }},
  list_dir: {desc: '列出一个文件夹里有什么。path 相对仓库根目录', params: {path: 'string'}, run: ({path: p}) => {
    const full = inside(p || '.');
    if (!full || !existsSync(full)) return `没有这个文件夹：${p}`;
    return readdirSync(full, {withFileTypes: true}).filter((e) => !['node_modules', '.git'].includes(e.name)).map((e) => (e.isDirectory() ? `${e.name}/` : e.name)).join('\n') || '（空的）';
  }},
  write_file: {desc: '整篇写一个文件（会覆盖原来的内容）', params: {path: 'string', content: 'string'}, run: ({path: p, content}) => {
    const rel = path.relative(ROOT, inside(p) || '');
    if (!WRITABLE.some((r) => r.test(rel))) { stats.refused.push(`写 ${p}`); return `不能改这个文件：${p}。只能改 template/src 下的 config.js / takes.js / sentences.js / shots.js，和 template/out 下的 .md`; }
    mkdirSync(path.dirname(path.join(ROOT, rel)), {recursive: true});
    writeFileSync(path.join(ROOT, rel), content);
    return `已写入 ${rel}（${content.length} 个字）`;
  }},
  replace_in_file: {desc: '把文件里的一段原样替换成另一段。find 必须和文件里的内容一字不差，而且只出现一次', params: {path: 'string', find: 'string', replace: 'string'}, run: ({path: p, find, replace}) => {
    const rel = path.relative(ROOT, inside(p) || '');
    if (!WRITABLE.some((r) => r.test(rel))) { stats.refused.push(`改 ${p}`); return `不能改这个文件：${p}`; }
    const full = path.join(ROOT, rel);
    if (!existsSync(full)) return `没有这个文件：${p}`;
    const s = readFileSync(full, 'utf8');
    const n = s.split(find).length - 1;
    if (n !== 1) return n === 0 ? '没找到要替换的那一段（要和文件里一字不差，包括空格和引号）' : `这一段在文件里出现了 ${n} 次，要多带一点上下文让它只出现一次`;
    writeFileSync(full, s.replace(find, () => replace));
    return `已替换（${rel}）`;
  }},
  run: {desc: '在 skills/talking-head-motion/template/ 里跑一条命令。能跑的：npm run next / check / cards / needs / measure / storyboard / srt / raw / cut（可以带 -- 参数），以及 node tools/measure.mjs --text <图> [字]', params: {command: 'string'}, run: ({command}) => {
    const cmd = String(command || '').trim();
    if (/^npm (install|i|ci)$/.test(cmd)) return '依赖已经装好了，不用再装。';
    if (!ALLOWED.some((r) => r.test(cmd))) { stats.refused.push(`跑 ${cmd}`); return `这条命令不在可以跑的范围里：${cmd}。出静帧和渲染成片由用户那边来做，你做到分镜表检查通过、导出分镜表就可以了`; }
    if (/check|lint\.mjs/.test(cmd)) stats.checks++;
    const r = spawnSync('bash', ['-lc', cmd], {cwd: TPL, encoding: 'utf8', timeout: 15 * 60 * 1000, maxBuffer: 1 << 26});
    return clip(`${r.stdout || ''}${r.stderr ? `\n${r.stderr}` : ''}`.trim() || '（没有输出）', 7000);
  }},
  finish: {desc: '全部做完了（或者做不下去了）就调用它，用几句话向用户汇报', params: {summary: 'string'}, run: ({summary}) => { stats.finished = true; stats.summary = summary; return 'ok'; }},
};
const toolDefs = Object.entries(tools).map(([name, t]) => ({type: 'function', function: {name, description: t.desc, parameters: {type: 'object',
  properties: Object.fromEntries(Object.entries(t.params).map(([k, v]) => [k, {type: v.replace('?', '')}])), required: Object.entries(t.params).filter(([, v]) => !v.endsWith('?')).map(([k]) => k)}}}));

const chat = async (messages) => {
  for (let attempt = 0; ; attempt++) {
    try {
      const res = await fetch(`${BASE}/chat/completions`, {method: 'POST', headers: {'content-type': 'application/json', authorization: `Bearer ${KEY}`},
        body: JSON.stringify({model: MODEL, messages, tools: toolDefs, tool_choice: 'auto', ...EXTRA}), signal: AbortSignal.timeout(300000)});
      if (!res.ok) throw new Error(`${res.status} ${(await res.text()).slice(0, 300)}`);
      return await res.json();
    } catch (e) {
      if (attempt >= 2) throw e;
      await new Promise((r) => setTimeout(r, 4000 * (attempt + 1)));
    }
  }
};

const messages = [
  {role: 'system', content: '你是一个能读文件、改文件、跑命令的助手，在一个代码仓库里帮用户干活。用户不在电脑前，他把要交代的话都写在任务里了。用给你的工具做事；全部做完后调用 finish 汇报。'},
  {role: 'user', content: readFileSync(path.resolve(arg('task')), 'utf8')},
];
log({type: 'start', model: MODEL, task: messages[1].content});
let idle = 0;
while (stats.turns < MAX_TURNS && !stats.finished) {
  stats.turns++;
  let data;
  try { data = await chat(messages); } catch (e) { log({type: 'error', error: String(e.message)}); stats.error = String(e.message); break; }
  const msg = data.choices[0].message;
  stats.tokensIn += data.usage?.prompt_tokens || 0;
  stats.tokensOut += data.usage?.completion_tokens || 0;
  messages.push({role: 'assistant', content: msg.content || '', ...(msg.tool_calls ? {tool_calls: msg.tool_calls} : {}), ...(msg.reasoning_content !== undefined ? {reasoning_content: msg.reasoning_content} : {})});
  log({type: 'assistant', content: msg.content, calls: (msg.tool_calls || []).map((c) => ({name: c.function.name, args: c.function.arguments.slice(0, 600)}))});
  if (!msg.tool_calls || !msg.tool_calls.length) {
    if (++idle >= 2) break;
    messages.push({role: 'user', content: '（用户不在。还没做完就接着用工具做；做完了就调用 finish 汇报。）'});
    continue;
  }
  idle = 0;
  for (const c of msg.tool_calls) {
    const name = c.function.name;
    stats.calls[name] = (stats.calls[name] || 0) + 1;
    let out;
    try { out = tools[name] ? tools[name].run(JSON.parse(c.function.arguments || '{}')) : `没有 ${name} 这个工具`; } catch (e) { out = `参数不对：${e.message}`; }
    messages.push({role: 'tool', tool_call_id: c.id, content: String(out)});
    log({type: 'tool', name, out: String(out).slice(0, 1500)});
  }
}
log({type: 'end', stats});
console.log(JSON.stringify(stats, null, 2));

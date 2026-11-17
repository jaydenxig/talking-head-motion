// 每一镜出一张静帧（取这一镜内容刚出全的那一刻），再拼成一张总览图。整片渲染之前先看这个，几十秒就出来。
// 用法：
//   node tools/stills.mjs                 # 每一镜一张
//   node tools/stills.mjs --shots 3,5     # 只出第 3、5 镜
//   node tools/stills.mjs --at 12.5,30    # 出指定秒数的画面
//   可选：--scale 0.5（缩小一半，默认）、--out out/stills、--no-label（不加顶部的镜号标签）
// 环境变量 REMOTION_BROWSER 可以指定 Chrome 路径。
import {bundle} from '@remotion/bundler';
import {renderStill, selectComposition} from '@remotion/renderer';
import {execFileSync} from 'node:child_process';
import {mkdirSync, readdirSync, rmSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {runLint} from './lint.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const arg = (k, d) => { const i = process.argv.indexOf(`--${k}`); return i > 0 ? process.argv[i + 1] : d; };
const has = (k) => process.argv.includes(`--${k}`);
const out = path.resolve(root, arg('out', 'out/stills'));
const scale = Number(arg('scale', 0.5));
const browserExecutable = process.env.REMOTION_BROWSER || null;

const {errors, project: P} = await runLint();
if (errors.length) { console.error(`分镜表还有 ${errors.length} 个错误，先跑 npm run check 改掉再出图。`); process.exit(1); }
const fps = P.fps;
const total = Math.round(P.duration * fps);
let jobs;
if (arg('at')) {
  jobs = arg('at').split(',').map(Number).map((t) => ({frame: Math.min(total - 1, Math.round(t * fps)), name: `t${String(t).replace('.', '_')}`, label: `第 ${t} 秒`}));
} else {
  const only = arg('shots') ? arg('shots').split(',').map(Number) : null;
  jobs = P.shots.filter((s) => !only || only.includes(s.index + 1)).map((s) => {
    const a = Math.round(s.from * fps), b = Math.round(s.to * fps);
    const frame = Math.max(a + 8, Math.min(Math.round(s.done * fps) + 4, b - 12));
    const ids = s.ids.length > 1 ? `${s.ids[0]}-${s.ids[s.ids.length - 1]}` : s.ids[0] || '';
    return {frame: Math.min(total - 1, frame), name: String(s.index + 1).padStart(2, '0'), label: `第 ${s.index + 1} 镜 · ${ids} · ${s.state}`};
  });
}
rmSync(out, {recursive: true, force: true});
mkdirSync(out, {recursive: true});
console.log('打包中…');
const serveUrl = await bundle({entryPoint: path.join(root, 'src/index.js')});
for (const j of jobs) {
  const inputProps = {label: has('no-label') ? '' : j.label};
  const composition = await selectComposition({serveUrl, id: 'Talk', inputProps, browserExecutable});
  await renderStill({serveUrl, composition, frame: j.frame, output: path.join(out, `${j.name}.png`), inputProps, scale, browserExecutable});
  console.log(`✓ ${j.label}（第 ${(j.frame / fps).toFixed(1)} 秒）`);
}
rmSync(serveUrl, {recursive: true, force: true});
// 拼总览图：横屏 3 列，竖屏 6 列
const files = readdirSync(out).filter((f) => f.endsWith('.png')).sort();
if (files.length > 1) {
  const portrait = P.shots.length && (await import('../src/config.js')).CONFIG.orientation === 'portrait';
  const cols = Math.min(files.length, portrait ? 6 : 3), rows = Math.ceil(files.length / cols);
  execFileSync('ffmpeg', ['-loglevel', 'error', '-y', '-pattern_type', 'glob', '-i', path.join(out, '*.png'), '-vf', `scale=${portrait ? 360 : 640}:-1,tile=${cols}x${rows}:padding=6:color=white`, '-frames:v', '1', '-q:v', '3', path.join(out, '总览.jpg')]);
  console.log(`\n总览图：${path.join(out, '总览.jpg')}`);
}
console.log(`完成：${out}（${files.length} 张）`);

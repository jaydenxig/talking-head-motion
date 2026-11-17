// 渲染成片。检查没过不会开始。
// 开了音效就一次出两版：out/talk.mp4（有音效）和 out/talk_无音效.mp4——画面只渲染一遍，无音效版只是换一条声音。
// 用法：node tools/render.mjs        # npm run render
// 环境变量 REMOTION_BROWSER 可以指定 Chrome 路径。
import {execFileSync, spawnSync} from 'node:child_process';
import {mkdirSync, rmSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {runLint} from './lint.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const {errors, warns, config} = await runLint();
if (errors.length) {
  console.error(`还有 ${errors.length} 个错误，先改掉再渲染（npm run check 看全部）：`);
  errors.slice(0, 5).forEach((e) => console.error(`✗ ${e.where}：${e.msg}`));
  process.exit(1);
}
if (warns.length) console.log(`检查器还有 ${warns.length} 条提醒（npm run check 能看到），继续渲染。`);
mkdirSync(path.join(root, 'out'), {recursive: true});
const browser = process.env.REMOTION_BROWSER ? [`--browser-executable=${process.env.REMOTION_BROWSER}`] : [];
const remotion = (args) => { const r = spawnSync('npx', ['remotion', 'render', 'src/index.js', 'Talk', ...args, ...browser], {cwd: root, stdio: 'inherit'}); if (r.status !== 0) process.exit(r.status ?? 1); };
const full = path.join(root, 'out/talk.mp4');
remotion([full]);
console.log(`\n成片：${full}`);
if (config.modules && config.modules.sfx) {
  // 无音效版：只把声音重出一遍（不带音效），画面直接用上面那条的
  const wav = path.join(root, 'out/.nosfx.wav');
  remotion([wav, '--codec=wav', `--props=${JSON.stringify({noSfx: true})}`, '--log=error']);
  const out = path.join(root, 'out/talk_无音效.mp4');
  execFileSync('ffmpeg', ['-v', 'error', '-y', '-i', full, '-i', wav, '-map', '0:v', '-map', '1:a', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '192k', '-shortest', out]);
  rmSync(wav, {force: true});
  console.log(`无音效版：${out}`);
}
console.log('再跑 npm run srt 导出字幕文件。');

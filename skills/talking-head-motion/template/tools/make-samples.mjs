// 风格样板：每套候选风格画 4 张静帧 + 一段 4 秒带音效的小动图，再拼成一张总览图，给用户挑。
// 用法：
//   node tools/make-samples.mjs --styles tech-1,tech-2,tech-3            # 按风格编号
//   node tools/make-samples.mjs --category life                          # 这一类的全部风格
//   node tools/make-samples.mjs --styles life-1 --mix '{"palette":"tech-1","font":"kuaile"}'   # 混搭后的确认图
//   --parts-only 只出零件对照表；可选：--no-teaser 不出小动图；--no-label 不加顶部风格标签；--off subtitles,sfx 关掉没勾选的模块；--out out/samples
// 环境变量 REMOTION_BROWSER 可以指定 Chrome 路径（无头服务器上用 chrome-headless-shell）。
import {bundle} from '@remotion/bundler';
import {renderMedia, renderStill, selectComposition} from '@remotion/renderer';
import {execFileSync} from 'node:child_process';
import {mkdirSync, writeFileSync, rmSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {STYLES, CATEGORIES, FONTS, AVATARS, MOTIONS, SFX_PACKS, SUBTITLES, CARDS} from '../src/styles.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const arg = (k, d) => { const i = process.argv.indexOf(`--${k}`); return i > 0 ? process.argv[i + 1] : d; };
const has = (k) => process.argv.includes(`--${k}`);

let ids = arg('styles') ? arg('styles').split(',') : [];
if (arg('category')) ids = Object.keys(STYLES).filter((k) => STYLES[k].category === arg('category'));
if (!ids.length) {
  console.error('用 --styles 或 --category 指定风格。类型：' + Object.entries(CATEGORIES).map(([k, v]) => `${k}=${v}`).join('，'));
  process.exit(1);
}
const mix = arg('mix') ? JSON.parse(arg('mix')) : null;
const off = (arg('off') || '').split(',').filter(Boolean);
const modules = Object.fromEntries(off.map((k) => [k, false]));
const out = path.resolve(root, arg('out', 'out/samples'));
mkdirSync(out, {recursive: true});
const scenes = ['chapter', 'cards3', 'window', 'list'];
const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
const browserExecutable = process.env.REMOTION_BROWSER || null;

console.log('打包中…');
const serveUrl = await bundle({entryPoint: path.join(root, 'src/index.js')});
const notes = [];

for (const [n, id] of (has('parts-only') ? [] : ids.entries())) {
  const S = STYLES[id];
  const letter = mix ? '确认' : letters[n];
  const style = mix ? {base: id, ...mix} : id;
  const label = has('no-label') ? '' : mix ? '混搭确认图' : `${letter} · ${S.name}`;
  const files = [];
  for (const sc of scenes) {
    const inputProps = {style, scene: sc, label, modules};
    const comp = await selectComposition({serveUrl, id: 'Sample', inputProps, browserExecutable});
    const file = path.join(out, `${letter}_${id}_${sc}.png`);
    await renderStill({serveUrl, composition: comp, frame: 80, output: file, inputProps, browserExecutable});
    files.push(file);
  }
  // 2×2 拼图
  const sheet = path.join(out, `${letter}_${id}_总览.jpg`);
  execFileSync('ffmpeg', ['-loglevel', 'error', '-y', ...files.flatMap((f) => ['-i', f]), '-filter_complex',
    '[0][1]hstack[a];[2][3]hstack[b];[a][b]vstack,scale=1920:-1', '-q:v', '3', sheet]);
  if (!has('no-teaser')) {
    const inputProps = {style, label, modules};
    const comp = await selectComposition({serveUrl, id: 'Teaser', inputProps, browserExecutable});
    await renderMedia({serveUrl, composition: comp, codec: 'h264', outputLocation: path.join(out, `${letter}_${id}_小动图.mp4`), inputProps, browserExecutable});
  }
  const pick = (k) => (mix && mix[k] !== undefined ? (STYLES[mix[k]] ? STYLES[mix[k]][k] : mix[k]) : S[k]);
  notes.push(`## ${label}（${id}，${CATEGORIES[S.category]}）\n` +
    `- 配色：${mix && mix.palette ? (STYLES[mix.palette] ? STYLES[mix.palette].name + ' 的配色' : '自定义') : S.name + ' 的配色'}\n` +
    `- 字体：${FONTS[pick('font')].name}\n- 卡片：${CARDS[pick('card')]}\n- 头像形状：${AVATARS[pick('avatar')].name}\n` +
    `- 动效：${MOTIONS[pick('motion')].name}\n- 音效包：${SFX_PACKS[pick('sfx')].name}\n- 字幕：${SUBTITLES[pick('subtitle')].name}\n`);
  console.log(`✓ ${label}`);
}
// 零件对照表：几套风格的配色、字体、卡片、字幕、动效音效并排，外加四种头像形状
if (!mix) {
  const inputProps = {styles: ids};
  const comp = await selectComposition({serveUrl, id: 'Parts', inputProps, browserExecutable});
  await renderStill({serveUrl, composition: comp, frame: 0, output: path.join(out, '零件对照表.png'), inputProps, browserExecutable});
  console.log('✓ 零件对照表');
}
writeFileSync(path.join(out, '样板说明.md'), `# 风格样板\n\n每套风格可以整套选，也可以每一项单独挑（比如「配色要 A，字体要 B，头像要 C」）。\n\n${notes.join('\n')}`);
rmSync(serveUrl, {recursive: true, force: true});
console.log(`完成：${out}`);

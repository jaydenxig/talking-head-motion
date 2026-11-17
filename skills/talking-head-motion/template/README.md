# 模板

Remotion 项目。**不知道该干什么就跑 `npm run next`**：它看这期做到哪了，只告诉你现在该做的那一件事。

## 每期要动的文件

- `raw/`：没剪过的原始口播（不会提交到仓库）；`src/takes.js`：识别出来的逐句清单，你只改 `keep`（留不留）和 `text`
- `src/config.js`：要做哪些模块（`modules`）、横屏还是竖屏、选哪套风格（`style`，可混搭）、头像位置
- `src/sentences.js`：句子时间轴，`npm run timeline` 生成；你只改每行的 `text`（错字、`[关键词]`）
- `src/shots.js`：分镜表。每一镜写它对应哪几句话（`say: 'S03-S05'`）、画面状态、放什么卡。**不写秒数**
- `src/samples.js`：风格样板里显示的内容（从这期口播里挑几句）
- `src/measured.js`：`npm run measure` 量出来的数据（口播尺寸、脸的位置、素材尺寸、要框的字的位置），不要手改

## 命令

| 命令 | 干什么 |
|---|---|
| `npm run next` | 现在该做哪一步（需要用户点头的步骤：`npm run next -- --ok modules / text / style / storyboard`） |
| `npm run raw` | 识别 `raw/` 下没剪过的口播：逐句编号写进 `src/takes.js`，先标出疑似重讲；另外录的声音自动对齐 |
| `npm run cut` | 按 `takes.js` 里留下的句子剪出 `public/talk.mp4` 和句子时间轴（`-- --dry` 只算不剪）。气口、加速在 `config.js` 的 `cut` 里 |
| `npm run measure` | 量口播和素材：尺寸、时长、脸在哪、分镜表里 `focus` 要框的字在图上哪里 |
| `npm run timeline` | 识别口播，生成句子时间轴（`-- --vocab "专有名词"`、`-- --srt 字幕.srt`、`-- --force`） |
| `npm run needs` | 缺素材清单 `out/素材清单.md`：哪些话最好有截图或录屏、手上有没有 |
| `npm run cards` | 卡片菜单：有哪些卡、每种能填什么、怎么写 |
| `npm run check` | 检查配置、句子、分镜表，用大白话说哪里错了、怎么改 |
| `npm run storyboard` | 导出给人看的分镜表 `out/分镜表.md` |
| `npm run stills` | 每一镜出一张静帧 + 总览图（`-- --shots 3,5`、`-- --at 12.5`） |
| `npm run render` | 渲染成片到 `out/talk.mp4`（检查没过不会开始）；开了音效同时出 `out/talk_无音效.mp4` |
| `npm run srt` | 导出字幕 `out/subtitles.srt` |
| `npm run sfx` | 下载音效到 `public/sfx/` |
| `node tools/make-samples.mjs --category life` | 出风格样板（`--styles a,b,c`、`--mix '{...}'`、`--portrait`） |

## 里面是怎么分工的

- `src/resolve.js`：把按句子编号写的分镜表换算成秒数和节拍（每张卡里的每个元素说到哪个词时出现）。渲染和所有工具共用这一份。
- `src/layout.js`：排版尺寸（图卡放哪块、截图和录屏显示多大）。渲染和检查器共用。
- `src/schema.js`：每种卡片能填什么。检查器、卡片菜单都读它。
- `src/Film.jsx`：渲染引擎；`src/styles.js`：风格库（6 类 × 3 套，加上可以单独替换的零件）；`src/sfx.js`：音效和动画共用的节拍。
- `tools/vision.swift`：找脸、找字，用的是 macOS 自带的识别。其他系统暂时没有接：脸的位置手填 `config.js` 的 `source` / `avatar.crop`，要框的地方写 `focus: {rect: [x, y, 宽, 高]}`。
- 语音识别用 whisper.cpp（`brew install whisper-cpp`，模型放 `~/.whisper-models/`）；没有的话用任何工具出一份 .srt 也行。

无头服务器上渲染时，如果 Chrome 启动失败，加 `--browser-executable=<chrome-headless-shell 路径>`（样板和静帧工具用环境变量 `REMOTION_BROWSER`）。
渲染完记得清掉系统临时目录里的 `remotion-webpack-bundle-*`，每份会复制一遍 public/，素材大时很占磁盘。

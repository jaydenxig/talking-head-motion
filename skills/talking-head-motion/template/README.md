# 模板

Remotion 项目。每期要改的文件：

- `src/config.js`：要做哪些模块（`modules`）、选哪套风格（`style`，可混搭）、头像位置（`avatar.corner: 'top-left' | 'top-right'`）
- `src/samples.js`：风格样板里显示的内容（从这期口播里挑几句）
- `src/shots.js`：分镜（每镜的时间、状态、图卡）
- `src/subs.js`：字幕（`[关键词]` 会上色）

风格库在 `src/styles.js`（6 类 × 3 套，加上可以单独替换的零件），渲染引擎在 `src/Film.jsx`。

出风格样板：`node tools/make-samples.mjs --category life`（或 `--styles a,b,c`，混搭确认图加 `--mix '{...}'`）。

无头服务器上渲染时，如果 Chrome 启动失败，加 `--browser-executable=<chrome-headless-shell 路径>`（样板工具用环境变量 `REMOTION_BROWSER`）。
渲染完记得清掉系统临时目录里的 `remotion-webpack-bundle-*`，每份会复制一遍 public/，素材大时很占磁盘。

# 模板

Remotion 项目。每期只需要改三个文件：

- `src/shots.js`：分镜（每镜的时间、状态、图卡）
- `src/subs.js`：字幕（`[关键词]` 会上色）
- `src/config.js`：风格、头像位置（`avatar.corner: 'top-left' | 'top-right'`）、字幕样式

常用命令见仓库根目录 README。

无头服务器上渲染时，如果 Chrome 启动失败，可以加 `--browser-executable=<chrome-headless-shell 路径>`。
渲染完记得清掉系统临时目录里的 `remotion-webpack-bundle-*`，每份会复制一遍 public/，素材大时很占磁盘。

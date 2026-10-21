# 第三方工具和素材

本仓库只包含自己写的代码和文档，下面这些都**没有**打包进来，使用时按各自的许可自行下载。

| 名称 | 用途 | 许可 | 说明 |
|---|---|---|---|
| [Remotion](https://www.remotion.dev) | 用 React 写动画、渲染视频 | [Remotion License](https://www.remotion.dev/license) | 个人和 3 人以下的公司免费；更大的公司需要购买授权。npm install 时安装。 |
| [HyperFrames](https://github.com/heygen-com/hyperframes)（HeyGen） | 流程和音效规则的参考；音效从它的 npm 包里取 | Apache-2.0 | 「只用真实录音、音量压低、和动作同帧」等音效规则参考了它的 media-use skill。 |
| Pixabay 音效（经 HyperFrames 分发） | 模板默认音效 | [Pixabay Content License](https://pixabay.com/service/license-summary/) | 可商用、无需署名，但不允许把音效文件单独转存分发，所以本仓库不包含，用 `tools/fetch-sfx.sh` 下载。 |
| [RobustVideoMatting](https://github.com/PeterL1n/RobustVideoMatting) | 视频抠像（可选） | GPL-3.0 | 模型文件需自行下载，`tools/matte.py` 只是调用它的脚本。 |
| [Noto Sans SC](https://fonts.google.com/noto/specimen/Noto+Sans+SC)、[JetBrains Mono](https://www.jetbrains.com/lp/mono/) | 字体 | SIL OFL 1.1 | 通过 @fontsource 安装。 |

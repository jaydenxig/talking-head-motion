# 音效

## 规则
1. **只用真实录音，不用程序合成或 AI 生成的音效。** 合成音效是「AI 味」的主要来源。
2. **压在人声下面**：音量约为原始的 0.25–0.35（大约低 9–12 dB），只做点缀。
3. **和画面动作同帧**：音效和动画共用 `src/sfx.js` 的同一张节拍表，由代码在同一帧触发。
4. **同一种动作永远配同一个声音**，让观众形成条件反射：
   | 动作 | 声音 |
   |---|---|
   | 从口播进入图卡段落 | whoosh-short |
   | 卡片弹出、便签、章节卡 | pop |
   | 列表 / 小卡逐个出现 | click-soft |
   | 圈出重点 | click |
   | 数字到顶、结论胶囊 | ping |
5. **少而精**：只放在关键时刻。觉得吵就先删 click-soft。

## 音效来源
模板默认用 HyperFrames 自带的 21 个 Pixabay 真实录音（Pixabay Content License，可商用、无需署名）。
本仓库**不转存**这些文件，运行 `template/tools/fetch-sfx.sh` 从 HyperFrames 的 npm 包里取。
也可以自己去 https://pixabay.com/sound-effects/ 或 https://freesound.org （看清每条的许可）下载，同名放进 `public/sfx/`。

## 人声
声音质感主要在录音阶段决定（见 `shooting-checklist.md`）。后期：降噪、轻压缩，整体响度约 -14 LUFS。

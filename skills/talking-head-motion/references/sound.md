# 音效

## 规则
1. **只用真实录音，不用程序合成或 AI 生成的音效。** 合成音效是「AI 味」的主要来源。
2. **要短、要干。** 口播底下的音效，拖着回音的「叮——」「滋——」会盖在下一句话上，听着廉价。模板会把每个音效截到 `tail` 秒以内并淡出（见 `styles.js` 的 `SFX_PACKS`）。
3. **压在人声下面**：`npm run measure` 会量每个音效文件有多响，混音时把它的峰值压到人声下面一截（约低 11 分贝），不同文件响度不一样也能配平。
4. **和画面动作同帧**：音效和动画共用同一张节拍表（`src/sfx.js`），由代码在同一帧触发。
5. **同一种动作永远配同一个声音**，让观众形成条件反射。声音由风格里的「音效包」决定，用户挑风格时可以单独换：
   | 动作 | 干脆利落 `dry` | 清脆 UI `crisp` | 柔和温暖 `soft` | 科技电子 `tech` |
   |---|---|---|---|---|
   | 从口播进入图卡段落 | whoosh-short | whoosh-short | whoosh-short | glitch-3 |
   | 卡片弹出 | key-press | pop | click-soft | key-press |
   | 列表 / 小卡逐个出现 | click-soft | click-soft | click-soft | key-press |
   | 框出 / 圈出重点 | click | click | sparkle | click |
   | 数字到顶、结论胶囊 | pop | ping | chime | notification |
   | 章节卡、便签 | click-soft | pop | click-soft | key-press |

   `dry` 全是 0.4 秒左右的短促声音，适合语速快的教程和知识类口播，是白底蓝光等几套风格的默认。也可以选 `none`，或者在第 0 步不勾音效。
6. **少而精**：只放在关键时刻。觉得吵就先删 click-soft。
7. **有音效、无音效两版都交**：`npm run render` 开了音效时一次出两条（`out/talk.mp4` 和 `out/talk_无音效.mp4`），画面只渲染一遍。用户要拿去二次剪辑、或者听了觉得不合适时，直接用无音效版。
8. 用户说某个声音不好听：换成更短更干的（快门、打字机单键、纸张翻页、轻敲这一类），同名放进 `public/sfx/`；拿不准就做几个备选让他试听着挑。

## 音效来源
模板默认用 HyperFrames 自带的 21 个 Pixabay 真实录音（Pixabay Content License，可商用、无需署名）。
本仓库**不转存**这些文件，运行 `template/tools/fetch-sfx.sh` 从 HyperFrames 的 npm 包里取。
也可以自己去 https://pixabay.com/sound-effects/ 或 https://freesound.org （看清每条的许可）下载，同名放进 `public/sfx/`。

## 人声
声音质感主要在录音阶段决定（见 `shooting-checklist.md`）。后期只统一响度到 -14 LUFS（`npm run cut` 会做），不降噪——降噪过头人声会发闷、有「AI 味」。另外录了一条更清楚的声音，放进 `raw/` 会自动对齐替换。

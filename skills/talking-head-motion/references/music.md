# 配乐

只有用户在第 0 步勾了「配乐」才做这一步。

## 原则
- **不用 AI 生成的音乐**，也不把曲子放进仓库转发。给用户推荐可商用的纯音乐，让他自己试听、下载。
- **来源（无版权风险）**：
  - Pixabay Music：https://pixabay.com/music/ ，免费可商用、不用署名。
  - 剪映素材库里标「可商用」的曲子（只能在剪映里用）。
  - 要授权书的话用付费曲库（如曲多多）。
- **音量**：约 10%–15%（比人声低 15–20 dB），首尾 1 秒淡入淡出。
- **只在图卡段落抬起来，讲重点句时压低**。模板打开 `modules.music` 后自动这样做（`config.js` 的 `music.volume` 和 `music.duck`）。

## 按内容类型推荐（Pixabay Music 搜索词）
每次给 3–5 首候选，写清楚曲名、时长、链接，用户点开就能试听。

| 类型 | 情绪 | 搜索词 |
|---|---|---|
| 科技 | 轻快、有推进感、电子 | `tech corporate` · `future bass light` · `electronic background` |
| 生活 | 轻松、温暖 | `lofi chill` · `acoustic happy` · `vlog background` |
| 家庭 | 温柔、可爱 | `ukulele happy` · `children playful` · `soft piano warm` |
| 知识 | 安静、专注 | `ambient piano` · `documentary calm` · `minimal background` |
| 商业 | 稳重、自信 | `corporate inspiring` · `business presentation` · `motivational` |
| 美食旅行 | 开阔、明亮 | `cinematic travel` · `acoustic folk` · `summer upbeat` |

共同要求：无人声、中速、鼓点轻，开头不要太炸。

## 用户选好以后
1. 让他把曲子下载下来，放进素材文件夹（AI 所在环境往往连不上曲库，不要自己去下）。
2. 复制到 `template/public/music.mp3`，打开 `modules.music`，渲染后让他听整体效果。
3. 也可以不混进成片，只给他建议，让他在剪映里自己加。

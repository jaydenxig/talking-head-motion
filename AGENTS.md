# 给 AI 助手的说明

这个仓库是一套「把真人口播做成带图卡、字幕、音效的短视频」的做法，工具在 `skills/talking-head-motion/template/`。
你是哪一家的模型都可以用。照下面做：

1. 先完整读一遍 `skills/talking-head-motion/SKILL.md`（主流程，不长）。
2. 进 `skills/talking-head-motion/template/`，跑 `npm install`，然后跑 **`npm run next`**。
   它会检查这期做到哪了，只告诉你现在该做的那一件事。照它说的做，做完再跑一次。**拿不准下一步就跑它，不要自己猜。**
3. 它提到某份规则（`references/xxx.md`）时，再去读那一份；第一次写分镜之前读 `references/example.md`，那是一份完整范例。

必须守的规矩：

- **不写秒数。** 分镜表按句子编号写（`say: 'S03-S05'`），时间由程序算。
- **不估坐标。** 脸在哪、要框或要糊的字在图上哪里，都由 `npm run measure` 量。
- **只改该改的文件**：`src/config.js`、`src/takes.js`（只改 `keep` 和 `text`）、`src/sentences.js`（只改 `text`）、`src/shots.js`。不要改 `src/` 里别的代码来「绕过」报错。
- **`npm run check` 报错就照它说的改**，改到没有错误再往下；提醒逐条看。它的报错是中文大白话，会告诉你怎么改。
- **需要用户拿主意的地方必须问用户**（做哪些部分、横屏竖屏、风格、去掉哪些句子、气口和速度、分镜表），用户确认后再 `npm run next -- --ok <步骤>`。不要替用户确认。
- **画面的来源按顺序想**：真截图真录屏 → 动作卡把动作演出来（`chat` / `flow` / `doc`）→ 文字清单。讲的是动作就不要列成一张文字清单。
- **截图露出来的字要和这一镜说的话对得上**：你看不见图，就用 `node tools/measure.mjs --text 图 --crop x,y,宽,高` 读这一块露出了什么；分镜表末尾也会列出来。
- **素材里没有的画面不编**；自己拼的界面标 `mock: true`；截图里的真名、公司名、金额用 `mask` 糊掉。
- 你看不了图或视频也没关系：检查靠 `npm run check` 的文字报告，画面交给用户看（`npm run stills` 出的总览图）。录屏从第几秒开始放（`start`）如果你看不了视频，就问用户。

不用去读 `tools/` 和 `src/` 里的程序代码（很长，读了也用不上）：规矩都在 `references/` 里，卡片怎么填看 `npm run cards`，填错了 `npm run check` 会告诉你。

卡片有哪些、每种怎么填：`npm run cards`。

# talking-head-motion

给真人口播视频（横屏、竖屏都支持）加「图卡动效 + 小圆头像 + 烧录字幕 + 真实录音音效」的 AI skill，外加封面和各平台发布文案的规则。
适合讲 AI、产品、工具的知识类博主，配合 Claude Code 等能写代码的 AI 使用。

![风格样板](docs/styles.jpg)

> 上图是同一段口播套用不同风格的样板（人物是占位的卡通形象，用 `tools/make-placeholder.py` 生成，换成你自己的口播即可）。下图是「零件对照表」：几套风格拆开并排，配色、字体、卡片、字幕、动效音效、头像形状都可以单独挑。

![零件对照表](docs/parts.jpg)

> 竖屏三种版式：从左到右是全屏口播、上图下人、人全屏 + 浮卡、小头像 + 满屏图卡。

![竖屏版式](docs/portrait.jpg)

## 它解决什么问题

让 AI 剪口播，常见的结果是「在画面上贴几张图文」，节奏拖、音效有 AI 味，而且风格是 AI 定的，不一定是你喜欢的。
这个 skill 把一条口播从素材到发布拆成固定的流程，让 AI 产出零件、人来做导演：

1. **先选横屏还是竖屏、要做什么**：竖屏有三种版式可选（上图下人 / 人全屏 + 浮卡 / 小头像 + 满屏图卡），都避开了抖音底部的标题简介和右侧点赞列。
   要做的部分：图卡、章节卡、小头像、字幕、音效、配乐、封面、发布文案，每项附一句大白话说明，可以全选；勾了的才做，没勾的不花 token。
2. **按内容类型出风格样板**：AI 先听口播，判断是科技、生活、家庭、知识、商业还是美食旅行，再出这一类的 3 套风格。每套 4 张静帧 + 一段 4 秒带音效的小动图，外加一张「零件对照表」，先看再定。
3. **可以混搭**：配色、字体、卡片、头像形状（圆形 / 圆角方形 / 正方形 / 竖椭圆）、动效、音效包、字幕样式都能单独挑，比如「颜色要 A，字体要 B，头像要 C」。
4. **再做整片**：
   - **先声后画**：口播先剪紧（去掉气口和多余停顿），再按句子时间轴排画面。
   - **要不要加速你来定**：AI 先测你的语速（每秒多少字），对照日常聊天（约 4–5 字/秒）和节奏紧凑的口播博主（约 6.3–6.6 字/秒）给建议，你选了才加速。
   - **三种排版状态**：全屏口播 / 图卡 + 小头像 / 原位抠像 + 图卡，只在句子边界切换，交接 0.3 秒淡入淡出。
   - **节奏规则**：内容出全后最多再停 1 秒，句间不留空档。附自动检查脚本。
   - **音效跟着动作走**：只用真实录音，和动画同帧，同一动作永远同一个声音，压在人声下面。
   - **字幕**：烧进画面，关键词上色，英文词配中文；同时导出 .srt。
   - **打码**：只针对有法律风险的信息，小块马赛克。
   - **配乐**：按类型推荐可商用纯音乐给你试听，选好后只在图卡段落抬起来。
5. **发布包**：4:3 和 3:4 两种封面的版式规则（产品名必须是最大的字），抖音 / 小红书 / 视频号 / B 站的标题和简介、章节时间点。

**为什么要先选模块、先看样板？为了省 token，也省时间。**
直接让 AI 做整片，如果做完才发现不喜欢颜色或字体，整片的代码要重写一轮，渲染一次又要十几分钟。
静帧和几秒的小动图很便宜，几分钟就能出来，方向在这一步定下来，后面基本不用返工。
同样，没勾的模块（比如不要字幕、不要配乐）从头到尾都不做，也不花 token。

内置 6 类 × 3 套 = 18 套风格，换风格只改一个配置文件。

## 目录

```
skills/talking-head-motion/
├── SKILL.md              # 给 AI 读的主流程
├── references/           # 各环节的规则：风格挑选、风格卡、拍摄清单、剪口播、分镜、节奏、字幕、音效、打码、配乐、封面、发布
└── template/             # Remotion 模板
    ├── src/config.js     # 全片设置：横屏 / 竖屏和竖屏版式、要做哪些模块、选哪套风格（可混搭）、头像位置
    ├── src/sentences.js  # 句子时间轴（识别出来的每句话 + 编号），字幕也从这里来
    ├── src/shots.js      # 分镜表：每一镜对应哪几句话、放什么卡（每期主要改这里，不写秒数）
    ├── src/measured.js   # 量出来的数据：脸在哪、素材多大、要框的字在图上哪里
    ├── src/styles.js     # 风格库：6 类 × 3 套，以及可以单独替换的零件
    ├── src/schema.js     # 每种卡片能填什么（检查器和卡片菜单都读它）
    ├── src/resolve.js    # 把句子编号换算成秒数和节拍；src/layout.js 算排版尺寸
    ├── raw/              # 没剪过的原始口播放这里；src/takes.js 是识别出来的逐句清单
    └── tools/            # 下一步、识别原始素材、剪、量一量、识别口播、检查、分镜表、静帧、风格样板、导出 srt、抠像、打码、下载音效
```

## 安装

把 `skills/talking-head-motion` 复制到 Claude Code 的 skills 目录：

```bash
git clone https://github.com/jaydenxig/talking-head-motion.git
cp -r talking-head-motion/skills/talking-head-motion ~/.claude/skills/
```

然后对 AI 说：「用 talking-head-motion 帮我把这条口播做成短视频」，并给它口播视频和口播稿。

不用 Claude Code 也可以：Codex、Grok、Cursor 这类能读文件、能跑命令的 AI，把整个仓库克隆下来，让它先读根目录的 `AGENTS.md`，照着做就行。

## 单独跑模板

需要 Node.js 18+ 和 ffmpeg。

```bash
cd skills/talking-head-motion/template
npm install
npm run sfx          # 下载真实录音音效到 public/sfx/
# 把你的口播放到 public/talk.mp4；还没拍的话，先生成一段卡通人物占位视频试效果：
python3 tools/make-placeholder.py public/talk.mp4   # 加 --portrait 生成竖着拍的版本
npm run next         # 不知道该干什么就跑它：它看做到哪了，只告诉你现在该做的那一步
# 口播还没剪：原始素材放进 raw/，然后
npm run raw          # 逐句识别，写进 src/takes.js，先标出疑似重讲
npm run cut          # 按清单里留下的句子剪出 public/talk.mp4（气口、加速在 config.js 的 cut 里）
npm run measure      # 量口播：尺寸、时长、脸在哪（头像和裁切按它算）
npm run timeline     # 识别口播，给每句话编号（需要 whisper.cpp；或 -- --srt 字幕.srt）
node tools/make-samples.mjs --category life   # 出这一类的 3 套风格样板（静帧 + 小动图）
node tools/make-samples.mjs --styles tech-1 --portrait --layouts split,float,pip   # 竖屏：比较三种版式
npm run cards        # 卡片菜单：有哪些卡、每种能填什么
# 在 src/config.js 里选定风格，改 src/sentences.js 的错字，写 src/shots.js
npm run check        # 检查：哪里填错了、怎么改
npm run stills       # 每一镜出一张静帧看看
npm run render       # 渲染成片到 out/talk.mp4
npm run srt          # 导出字幕 .srt
```

## 现在的状态

v0.5：让不那么强的模型也能做对。思路是把容易出错的事从模型手里拿走，交给程序：

- **不写秒数**：分镜表按句子编号写（`say: 'S03-S05'`），每一镜、每个元素什么时候出现由程序算；清单的每一条自动对到你说的那个词上。
- **不估坐标**：脸在哪、要框的字在截图上哪里，由 `npm run measure` 量出来。头像取哪块、横竖互转保留哪块、原片会不会被放大发虚，都按量出来的算。
- **只填表**：新增录屏卡（讲操作时素材占满、人在小窗）和截图卡（能框重点、能裁切、长图能滚动）；每种卡能填什么看 `npm run cards`。
- **不靠眼睛验收**：`npm run check` 用大白话指出填错的字段、对不上的词、放不下的字、缩得太小的截图、连续干讲太久，并告诉你怎么改。
- **一步一关**：`npm run next` 只告诉你现在该做哪一步，前一步没过关不放行。

- **剪口播也不用算秒数**：原始素材放进 `raw/`，`npm run raw` 逐句识别并先标出说错重来的句子，在清单里把不要的改成 `keep: false`，`npm run cut` 就按量出来的停顿下刀——去重讲、收气口、换外录的声音（按波形自动对齐）、加速、统一响度，剪完自己验收一遍接缝。

- **取舍有规矩**：每张卡要写一句「观众能明白什么」；和原话一字不差的字、开头三秒只有人脸、一张卡挂太久、拼出来的界面没标「示意」，检查器都会提醒。截图里的名字、公司、金额写 `mask` 就只糊那几个字。
- **观感**：人从全屏缩成角上的小头像（同一个画面缩过去，不是淡入淡出）；图卡极慢地推近，不会像卡住；音效默认换成短促干脆的一套并按响度配平；一次渲染出有音效、无音效两版。
- **动作演出来，不列成字**：新增对话卡（打字、发文件、对方回复）、流程卡、文档卡（扫描、划重点、盖结果）。讲操作又没有真截图时用它们，不退成文字清单；写分镜前有一步「对素材」，列出哪些话缺画面、问你能不能补。
- **不压脸**：章节卡、便签的位置按脸自动选（头顶上方或胸口），放不下就报错。
- **有范例可抄**：`references/example.md` 是一条真实教程口播开头一分钟的完整做法，从挑句子到每一镜为什么这么排。

- **真的换模型考过**：`eval/` 是一个小考官程序，任何兼容 OpenAI 接口的模型都能接。用 DeepSeek 考了挑句子和写分镜，四道题全部通过，暴露出来的问题已经改进去了，见 [eval/验收记录.md](eval/验收记录.md)。

找脸和找字目前用的是 macOS 自带的识别，其他系统要手填位置。语音识别用 whisper.cpp。

规则来自作者实际做完的视频、对参考视频的逐帧拆解，以及试用后加上的「先选模块、先看样板」流程。每做一期，会把新的修改沉淀进来。

## 许可

本仓库代码和文档使用 [MIT](LICENSE) 许可。用到的第三方工具和素材见 [THIRD_PARTY.md](THIRD_PARTY.md)，特别注意 Remotion 对公司用户有单独的授权要求。

---

**English summary.** An AI skill (for Claude Code and similar agents) that turns a landscape or portrait (9:16, with three layouts and platform safe zones) talking-head recording into a short video with motion-graphic cards, a small circular picture-in-picture, burned-in subtitles and real-recorded sound effects synced to animation events — plus rules for 4:3 / 3:4 covers and publishing copy for Chinese platforms. It first asks which modules you want, classifies the content (tech / life / family / knowledge / business / travel) and renders 3 style samples per category (stills + a 4-second clip with sound) so you can pick or mix palette, font, card, avatar shape, motion and sound pack before the full render. Includes a Remotion template with 18 styles, a pacing checker, SRT export, matting and targeted-mosaic helpers. Docs are in Chinese. MIT licensed; see THIRD_PARTY.md for Remotion, HyperFrames, Pixabay and RobustVideoMatting terms.

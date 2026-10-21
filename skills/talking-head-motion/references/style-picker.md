# 风格样板和混搭

## 内容类型 → 候选风格
AI 听完口播后先判断类型，再出这一类的 3 套风格（编号对应 `template/src/styles.js`）。拿不准时，可以再加 1 套别的类当对照。

| 类型 | 适合 | 风格 1 | 风格 2 | 风格 3 |
|---|---|---|---|---|
| `tech` 科技 / AI / 数码 | 工具测评、AI 新闻、编程 | 白底蓝光（明亮、轻科技） | 暗夜霓虹（深紫底、发光玻璃卡） | 终端极客（黑绿、代码感） |
| `life` 生活 / vlog / 个人成长 | 日常、习惯、经验分享 | 薄荷小清新 | 暖阳胶片 | 手账贴纸 |
| `family` 家庭 / 亲子 / 宠物 | 育儿、家居、萌宠 | 奶油童趣 | 温馨暖橙 | 森林绿意 |
| `knowledge` 知识 / 教育 / 读书 | 科普、读书、方法论 | 白底杂志 | 黑板粉笔 | 学霸笔记 |
| `business` 商业 / 财经 / 职场 | 商业分析、理财、职场 | 深海金 | 商务极简 | 行情红绿 |
| `travel` 美食 / 旅行 / 户外 | 探店、旅行、风景 | 落日橘 | 海岸蓝 | 山野墨绿 |

## 一套风格由哪些零件组成（都可以单独换）
| 零件 | 可选值 |
|---|---|
| 配色 `palette` | 任何一套风格的配色（写风格编号） |
| 背景 `bg` | grid 细网格 · darkgrid 深色网格 · scan 扫描线 · blobs 柔光色块 · paper 纸纹 · dots 圆点 · plain 极简竖线 · chalk 黑板 · lined 横线本 · darkglow 深色光晕 · sunset 落日渐变 |
| 字体 `font` | sans 黑体 · serif 宋体 · kuaile 圆润可爱 · brush 毛笔 · xiaowei 文艺 · qingke 方正粗标题 |
| 卡片 `card` | clean 白卡 · glass 玻璃 · terminal 发光描边 · soft 大圆角 · paper 纸片加胶带 · sticker 粗描边贴纸 · editorial 杂志顶线 · chalk 虚线 · note 侧边色条 |
| 头像形状 `avatar` | circle 圆形 · rounded 圆角方形 · portrait 竖长方形 · blob 不规则圆 · hex 六边形 |
| 动效 `motion` | spring 弹出 · smooth 平滑上浮 · bouncy 俏皮弹跳 · snap 利落滑入 |
| 音效包 `sfx` | crisp 清脆 UI · soft 柔和温暖 · tech 科技电子 · none 不要 |
| 字幕 `subtitle` | stroke 白字描边 · box 色块底 · shadow 白字投影 |

头像位置（左上 / 右上）在 `config.js` 的 `avatar.corner` 里单独选。

## 提问方式
样板发出去之后，每个零件问一个问题，选项写成「A 落日橘的」「B 海岸蓝的」「C 山野墨绿的」，再加一个「都不要，换一种」。
用户回答后，写成：
```js
style: {base: 'travel-2', palette: 'travel-1', font: 'travel-3', avatar: 'hex'}
```
然后 `node tools/make-samples.mjs --styles travel-2 --mix '{"palette":"travel-1","font":"travel-3","avatar":"hex"}'` 出确认图。

## 加一套新风格
在 `styles.js` 的 `STYLES` 里照格式加一项（编号 `类型-序号`），再出样板检查：
浅色底上的字够不够深、深色底上叠在口播画面上的章节卡看不看得清、强调色上的文字看不看得清。

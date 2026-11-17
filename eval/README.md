# 考试：换一个模型，这套做法还能不能做对

> 2026-11-17 用 `deepseek-flash` 考过一轮，四道题全部通过，结果和暴露出来的问题见 [验收记录.md](验收记录.md)。

这套东西的目标是「不那么强的模型也能做对」。光靠判断不算数，要真的让那个模型从头做一遍。
这里是一个很小的考官程序：给模型三样最基本的工具（读文件、改文件、跑命令），让它在一份仓库副本里照 `AGENTS.md` 干活，做完自动评分。

任何兼容 OpenAI 接口的模型都能接：DeepSeek、Grok、通义、Kimi、本地的 Ollama……

## 怎么跑

1. 在这个文件夹里建一个 `.env`（不会提交到仓库）：
   ```
   EVAL_BASE_URL=https://api.deepseek.com
   EVAL_API_KEY=sk-你的密钥
   EVAL_MODEL=deepseek-flash
   ```
   Grok 的话：`EVAL_BASE_URL=https://api.x.ai/v1`，`EVAL_MODEL` 填它的模型名。
2. 准备考题（见 `cases/README.md`）。
3. 开考：
   ```bash
   node eval/run.mjs --case eval/cases/<考题名>
   ```
   临时换个模型：加 `--model 模型名`。结果在 `eval/work/<考题>_<模型>_<时间>/结果.md`，旁边的 `log.jsonl` 是完整的对话记录。

## 考什么

| 考题类型 | 考的是 | 怎么评分 |
|---|---|---|
| 挑句子 | 通读原始素材的逐句清单，找出说错重来的 | 该去掉的去掉了几句、误删了几句、有没有把清单改坏 |
| 写分镜 | 对稿、对素材、写分镜表，改到检查通过 | 检查器还剩几个错误、句子的时间有没有被动过、真素材用上了几个、动作有没有演出来、越界了几次 |

评分只管「对不对」。画面好不好看，要把它写的分镜表渲染出来，人来看。

## 考生拿到的条件

- 只能改 `src/` 下的 `config.js`、`takes.js`、`sentences.js`、`shots.js` 和 `out/` 下的 .md。想改别的会被拒绝，并记为一次越界。
- 只能跑 `npm run next / check / cards / needs / measure / storyboard / srt / raw / cut`。出静帧和渲染不让它跑，由人来做。
- 用户不在场。所有要用户拿主意的事，都提前写在考题的 `task.md` 里。

## 花多少钱

一道题大约来回 30–80 轮，每一轮都要把之前的对话重新发一遍，总量大约几十万到一两百万 token，主要是「读」。按便宜的模型算是几毛到几块钱。

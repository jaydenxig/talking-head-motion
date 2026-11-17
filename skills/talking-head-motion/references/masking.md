# 打码

- **只打可能带来麻烦的信息**：真名、别人的公司名、邮箱、手机号、账号 ID、订单号、工资和金额。其他截图内容不用管。
- **只盖住那几个字**，不要大范围模糊整张截图——整张糊掉，截图就没用了。

## 截图：在分镜表里写 `mask`
```js
card: {type: 'image', img: 'chat.png', mask: ['email', 'phone', 'money', '张三', '某某科技']}
```
- `'email'` 邮箱、`'phone'` 手机号、`'money'` 金额和薪资（`20-40K`、`¥1,200`、`3 万元` 这类）是按格式找的，图上有几处糊几处。
- 其他的写要糊的词本身，要和图上的字一模一样。
- 位置由 `npm run measure` 去找。有哪个词在图上没找到，它会报出来并列出图上认出的字——照着改，不要估坐标。
- 不知道一张图上有哪些该糊的：`node tools/measure.mjs --text 截图.png` 把图上的字全列出来，逐行看有没有名字、公司、金额。
- 出静帧（`npm run stills`）以后，把带截图的那几镜再看一遍有没有漏的。交给用户时说明糊了哪几类。

## 录屏
录屏里的字会动，`mask` 管不了。两个办法：
- 录之前把敏感信息挪出画面，或者用 `crop` 只显示不含敏感信息的那一块。
- 用 ffmpeg 在对应时间段对小区域做像素化，再放进 `public/`：
  `ffmpeg -i in.mp4 -filter_complex "[0]crop=w:h:x:y,scale=iw/12:-1,scale=w:h:flags=neighbor[m];[0][m]overlay=x:y:enable='between(t,3,6)'" out.mp4`

## 已经处理成图片文件的
`python tools/mosaic.py 原图.png public/打码后.png x,y,w,h` 仍然可用。

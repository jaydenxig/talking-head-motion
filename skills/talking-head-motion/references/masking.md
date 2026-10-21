# 打码

- **只打可能带来法律风险的信息**：被评价的别人公司名、个人邮箱、手机号、账号 ID、订单号。其他截图内容不用管。
- 用**小块马赛克**，只盖住那几个字，不要大范围模糊整张截图。
- 截图类素材在放进模板前打码：`python tools/mosaic.py 原图.png public/打码后.png x,y,w,h`。
- 录屏类素材用 ffmpeg 在对应时间段对小区域做像素化，例：
  `ffmpeg -i in.mp4 -filter_complex "[0]crop=w:h:x:y,scale=iw/12:-1,scale=w:h:flags=neighbor[m];[0][m]overlay=x:y:enable='between(t,3,6)'" out.mp4`
- 交付前逐张检查一遍有没有漏掉的名字。

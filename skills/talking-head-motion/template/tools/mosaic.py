"""给截图打小块马赛克：只打可能有法律风险的信息（别人的公司名、邮箱、手机号、ID）。

用法：
  pip install pillow
  python tools/mosaic.py 截图.png public/截图_打码.png 120,340,260,40 [x,y,w,h ...] [--block 12]
坐标是原图像素，x,y 是左上角。块越小越不显眼，默认 12 像素。
"""
import sys

from PIL import Image

args = sys.argv[1:]
block = 12
if "--block" in args:
    i = args.index("--block")
    block = int(args[i + 1])
    del args[i:i + 2]
src, dst, boxes = args[0], args[1], args[2:]
img = Image.open(src).convert("RGB")
for b in boxes:
    x, y, w, h = map(int, b.split(","))
    region = img.crop((x, y, x + w, y + h))
    small = region.resize((max(1, w // block), max(1, h // block)), Image.NEAREST)
    img.paste(small.resize((w, h), Image.NEAREST), (x, y))
img.save(dst)
print("masked", len(boxes), "region(s) ->", dst)

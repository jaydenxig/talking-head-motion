# 占位口播：还没有真人素材时，生成一段「人形卡通人物在说话」的视频，用来出风格样板、试排版。
# 用法：python tools/make-placeholder.py public/talk.mp4 [--seconds 25.5] [--portrait]
# 需要 Pillow 和 ffmpeg。人物会眨眼、张嘴、轻微点头，隔一会儿抬手做个手势。
import argparse
import math
import subprocess

from PIL import Image, ImageDraw, ImageFilter

ap = argparse.ArgumentParser()
ap.add_argument('out')
ap.add_argument('--seconds', type=float, default=25.5)
ap.add_argument('--portrait', action='store_true', help='竖着拍的口播（1080×1920）')
a = ap.parse_args()

W, H = (1080, 1920) if a.portrait else (1920, 1080)
FPS = 30
N = round(a.seconds * FPS)

SKIN, SKIN_D = (238, 203, 172), (222, 180, 148)
HAIR = (52, 40, 36)
SHIRT, SHIRT_D = (58, 78, 110), (44, 60, 88)
INNER = (236, 238, 242)
INK = (40, 32, 30)
MOUTH = (150, 70, 70)


def room():
    """暖色房间：墙面渐变 + 虚化的书架、台灯和绿植"""
    bg = Image.new('RGB', (W, H))
    d = ImageDraw.Draw(bg)
    for y in range(H):
        k = y / H
        d.line([(0, y), (W, y)], fill=(int(214 - 30 * k), int(196 - 32 * k), int(176 - 34 * k)))
    s = W / 1920 if not a.portrait else 1.0
    # 书架
    x0 = int(110 * s)
    d.rectangle([x0, int(H * 0.18), x0 + int(380 * s), int(H * 0.86)], fill=(150, 116, 88))
    for i in range(4):
        y = int(H * (0.25 + 0.15 * i))
        d.rectangle([x0 + 16, y, x0 + int(380 * s) - 16, y + 12], fill=(118, 88, 64))
        for j in range(7):
            bx = x0 + 30 + j * int(46 * s)
            d.rectangle([bx, y - int(90 * s) + (j % 3) * 14, bx + int(34 * s), y], fill=[(92, 120, 150), (190, 120, 90), (220, 200, 160), (110, 140, 110)][(i + j) % 4])
    # 台灯光
    lx, ly = W - int(260 * s), int(H * 0.32)
    d.ellipse([lx - 260, ly - 260, lx + 260, ly + 260], fill=(250, 226, 180))
    d.rectangle([lx - 8, ly, lx + 8, int(H * 0.8)], fill=(90, 80, 70))
    # 绿植
    px, py = W - int(150 * s), int(H * 0.72)
    for k in range(9):
        ang = -2.6 + k * 0.33
        d.ellipse([px + math.cos(ang) * 120 - 50, py + math.sin(ang) * 140 - 28, px + math.cos(ang) * 120 + 50, py + math.sin(ang) * 140 + 28], fill=(84, 128, 92))
    d.rectangle([px - 70, py, px + 70, py + int(H * 0.18)], fill=(170, 120, 96))
    return bg.filter(ImageFilter.GaussianBlur(22))


SS = 2  # 超采样，边缘更平滑
# 人物放在画面中间，脸大约在高度 36% 的位置
scale = 1.0 if not a.portrait else 1.4
BOX_W = 900  # 人物画布（1 倍尺寸）
oy = 0 if not a.portrait else int(H * 0.36 - 400 * scale)
BOX_H = 1080 if not a.portrait else math.ceil((H - oy) / scale) + 4
ox = int(W / 2 - BOX_W * scale / 2)


def person(t):
    """画一帧人物（RGBA，BOX_W×BOX_H），中心线在 BOX_W/2"""
    im = Image.new('RGBA', (BOX_W * SS, BOX_H * SS), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    S = lambda *v: [x * SS for x in v]
    cx = BOX_W / 2
    bob = 5 * math.sin(t * 2.2) + 2 * math.sin(t * 5.1)
    sway = 6 * math.sin(t * 0.9)
    hx, hy = cx + sway, 400 + bob  # 脸中心

    # 身体：圆肩 + 上衣
    d.rounded_rectangle(S(cx - 290, 600, cx + 290, BOX_H + 200), radius=150 * SS, fill=SHIRT)
    d.polygon(S(cx - 75, 590, cx + 75, 590, cx, 720), fill=INNER)  # 领口
    d.line(S(cx - 75, 590, cx, 720, cx + 75, 590), fill=SHIRT_D, width=8 * SS)
    d.line(S(cx - 200, 760, cx - 210, BOX_H), fill=SHIRT_D, width=6 * SS)  # 手臂分界
    d.line(S(cx + 200, 760, cx + 210, BOX_H), fill=SHIRT_D, width=6 * SS)
    # 脖子
    d.rounded_rectangle(S(hx - 55, hy + 90, hx + 55, 620), radius=30 * SS, fill=SKIN_D)
    # 头发（后）
    d.ellipse(S(hx - 135, hy - 175, hx + 135, hy + 70), fill=HAIR)
    # 耳朵、脸
    d.ellipse(S(hx - 132, hy - 20, hx - 92, hy + 50), fill=SKIN_D)
    d.ellipse(S(hx + 92, hy - 20, hx + 132, hy + 50), fill=SKIN_D)
    d.ellipse(S(hx - 112, hy - 130, hx + 112, hy + 140), fill=SKIN)
    # 刘海
    d.chord(S(hx - 122, hy - 170, hx + 122, hy + 10), 180, 360, fill=HAIR)
    d.ellipse(S(hx - 60, hy - 120, hx + 120, hy - 40), fill=HAIR)
    # 眉毛、眼睛（每 3.7 秒眨一次）
    d.arc(S(hx - 66, hy - 36, hx - 24, hy - 16), 200, 340, fill=HAIR, width=7 * SS)
    d.arc(S(hx + 24, hy - 36, hx + 66, hy - 16), 200, 340, fill=HAIR, width=7 * SS)
    blink = (t % 3.7) < 0.12
    for ex in (hx - 45, hx + 45):
        if blink:
            d.line(S(ex - 13, hy + 10, ex + 13, hy + 10), fill=INK, width=5 * SS)
        else:
            d.ellipse(S(ex - 11, hy - 3, ex + 11, hy + 21), fill=INK)
            d.ellipse(S(ex - 4, hy + 1, ex + 2, hy + 7), fill=(255, 255, 255))
    # 嘴：说话时开合
    talk = max(0.0, math.sin(t * 11.0)) * (0.6 + 0.4 * math.sin(t * 2.3)) * (0 if (t % 6) > 5.3 else 1)
    mh = 4 + 22 * talk
    d.rounded_rectangle(S(hx - 26, hy + 72 - mh / 2, hx + 26, hy + 72 + mh / 2), radius=int(min(mh, 26) / 2 * SS), fill=MOUTH)
    # 手势：每 8 秒抬一次手，停 2.5 秒
    g = t % 8.0
    up = 0.0
    if 2.0 < g < 4.5:
        up = min(1.0, (g - 2.0) / 0.35, (4.5 - g) / 0.35)
    if up > 0:
        handx, handy = cx + 130, 1060 - 260 * up
        d.line(S(cx + 205, 800, cx + 215, 980, handx, handy + 50), fill=SHIRT_D, width=74 * SS, joint='curve')
        d.ellipse(S(handx - 48, handy - 40, handx + 48, handy + 60), fill=SKIN)
        d.rounded_rectangle(S(handx - 40, handy - 95, handx - 18, handy - 10), radius=11 * SS, fill=SKIN)  # 竖起的食指
    return im.resize((BOX_W, BOX_H), Image.LANCZOS)


bg = room()

ff = subprocess.Popen(['ffmpeg', '-loglevel', 'error', '-y', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-s', f'{W}x{H}', '-r', str(FPS), '-i', '-',
                       '-f', 'lavfi', '-i', 'anullsrc=r=44100:cl=stereo', '-t', str(a.seconds),
                       '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '20', '-c:a', 'aac', '-shortest', a.out], stdin=subprocess.PIPE)
for i in range(N):
    fr = bg.copy()
    p = person(i / FPS)
    if scale != 1.0:
        p = p.resize((int(BOX_W * scale), int(BOX_H * scale)), Image.LANCZOS)
    fr.paste(p, (ox, oy), p)
    ff.stdin.write(fr.tobytes())
ff.stdin.close()
ff.wait()
print(f'完成：{a.out}（{W}×{H}，{a.seconds} 秒）')
